import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// Exercise the real fixture without launching Chromium or using owner profiles.
// Only its external process, browser, filesystem and polling boundaries are fake.
const require = createRequire(import.meta.url)
const fixtureCode = ts.transpileModule(
  readFileSync(new URL("./native-visibility-fixture.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
).outputText

type Options = {
  read?: () => Promise<string>
  setupFailure?: unknown
  testFailure?: unknown
  closeFailure?: unknown
  cleanupFailure?: unknown
  ignoreTerm?: boolean
}

function fixtureHarness(options: Options = {}) {
  const events: string[] = []
  let reads = 0
  let visibility = "visible"
  const child = Object.assign(new EventEmitter(), {
    stderr: new EventEmitter(),
    exitCode: null as number | null,
    signalCode: null as string | null,
    kill(signal: string) {
      events.push(signal)
      if (options.ignoreTerm && signal === "SIGTERM") return true
      setImmediate(() => {
        child.signalCode = signal
        child.emit("exit")
      })
      return true
    },
  })
  const page = {
    setViewportSize: async () => { if (options.setupFailure) throw options.setupFailure },
    emulateMedia: async () => {},
    evaluate: async () => visibility,
    bringToFront: async () => { visibility = "visible" },
  }
  const browser = {
    contexts: () => [{
      pages: () => [page],
      newPage: async () => ({
        goto: async () => {},
        bringToFront: async () => { visibility = "hidden" },
        close: async () => {},
      }),
    }],
    close: async () => {
      events.push("browser.close")
      if (options.closeFailure) throw options.closeFailure
    },
  }
  const dependencies: Record<string, unknown> = {
    "@playwright/test": {
      test: { extend: (fixtures: unknown) => fixtures },
      expect: { poll: (sample: () => Promise<unknown>) => ({
        toBe: async (expected: unknown) => {
          for (let attempt = 0; attempt < 4; attempt++) {
            if (await sample() === expected) return
          }
          throw new Error("poll timeout")
        },
      }) },
      chromium: { executablePath: () => "/unused/chromium", connectOverCDP: async () => browser },
    },
    "node:child_process": { spawn: () => child },
    "node:fs/promises": {
      mkdtemp: async () => "/unused/profile",
      readFile: async () => {
        reads++
        return options.read ? options.read() : "1234\n/devtools/browser/test\n"
      },
    },
    "./disposable-profile": { removeDisposableProfile: async (profile: string) => {
      assert.equal(profile, "/unused/profile")
      assert.notEqual(child.signalCode, null, "wait for Chromium before removing its profile")
      events.push("profile.remove")
      if (options.cleanupFailure) throw options.cleanupFailure
    } },
  }
  const exports: { test?: { nativePage: (context: object, provide: () => Promise<void>) => Promise<void> } } = {}
  runInNewContext(fixtureCode, {
    exports,
    require: (id: string) => dependencies[id] ?? require(id),
    setTimeout, clearTimeout, AggregateError,
    console: { log() {} },
  })
  return {
    events,
    reads: () => reads,
    run: () => exports.test!.nativePage({}, async () => {
      events.push("test")
      if (options.testFailure) throw options.testFailure
    }),
  }
}

test("test, browser close and profile cleanup failures all survive teardown", async () => {
  const primary = new Error("test failed")
  const close = new Error("browser close failed")
  const cleanup = new Error("profile removal failed")
  const fixture = fixtureHarness({ testFailure: primary, closeFailure: close, cleanupFailure: cleanup })
  await assert.rejects(fixture.run(), error => {
    assert.ok(error instanceof AggregateError)
    assert.deepEqual(error.errors, [primary, close, cleanup])
    return true
  })
  assert.deepEqual(fixture.events, ["test", "browser.close", "SIGTERM", "profile.remove"])
})

test("ENOENT and incomplete endpoint contents remain retryable", async () => {
  const pending = ["", "1234", "1234\n/devtools/browser/test\n"]
  let first = true
  const fixture = fixtureHarness({ read: async () => {
    if (first) {
      first = false
      throw Object.assign(new Error("not created yet"), { code: "ENOENT" })
    }
    return pending.shift()!
  } })
  await fixture.run()
  assert.equal(fixture.reads(), 4)
  assert.deepEqual(fixture.events, ["test", "browser.close", "SIGTERM", "profile.remove"])
})

for (const content of ["", "1234", "1234\n"]) {
  test(`incomplete endpoint ${JSON.stringify(content)} remains retryable until timeout`, async () => {
    const fixture = fixtureHarness({ read: async () => content })
    await assert.rejects(fixture.run(), /poll timeout/)
    assert.equal(fixture.reads(), 4)
  })
}

for (const stage of ["setupFailure", "testFailure", "closeFailure", "cleanupFailure"] as const) {
  test(`a lone ${stage} is propagated unchanged`, async () => {
    const failure = new Error(stage)
    const fixture = fixtureHarness({ [stage]: failure })
    await assert.rejects(fixture.run(), error => error === failure)
    assert.equal(fixture.events.at(-1), "profile.remove")
  })
}

for (const stage of ["setupFailure", "closeFailure"] as const) {
  test(`${stage} survives a profile cleanup failure`, async () => {
    const primary = new Error(stage)
    const cleanup = new Error("profile removal failed")
    const fixture = fixtureHarness({ [stage]: primary, cleanupFailure: cleanup })
    await assert.rejects(fixture.run(), error => {
      assert.ok(error instanceof AggregateError)
      assert.deepEqual(error.errors, [primary, cleanup])
      return true
    })
    assert.equal(fixture.events.at(-1), "profile.remove")
  })
}

test("startup read failure survives profile cleanup failure", async () => {
  const primary = Object.assign(new Error("endpoint denied"), { code: "EACCES" })
  const cleanup = new Error("profile removal failed")
  const fixture = fixtureHarness({ read: async () => { throw primary }, cleanupFailure: cleanup })
  await assert.rejects(fixture.run(), error => {
    assert.ok(error instanceof AggregateError)
    assert.deepEqual(error.errors, [primary, cleanup])
    return true
  })
  assert.equal(fixture.reads(), 1)
  assert.deepEqual(fixture.events, ["SIGTERM", "profile.remove"])
})

test("teardown escalates to SIGKILL and waits for exit before profile removal", async () => {
  const fixture = fixtureHarness({ ignoreTerm: true })
  await fixture.run()
  assert.deepEqual(fixture.events, ["test", "browser.close", "SIGTERM", "SIGKILL", "profile.remove"])
})

for (const code of ["EACCES", "EIO"]) {
  test(`DevToolsActivePort ${code} propagates immediately instead of becoming a timeout`, async () => {
    const failure = Object.assign(new Error("cannot read endpoint"), { code })
    const fixture = fixtureHarness({ read: async () => { throw failure } })
    await assert.rejects(fixture.run(), error => error === failure)
    assert.equal(fixture.reads(), 1)
    assert.deepEqual(fixture.events, ["SIGTERM", "profile.remove"])
  })
}
