// Run: node --test scripts\auth-recovery.test.mjs
// Real action/route/page code; mocked Next/Supabase boundaries. Never sends email
// or exchanges a real code, and does not establish successful private recovery.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { compileFunction } from "node:vm"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)
const preview = "https://v0-just-play-app-git-ortiz-7b88aa-officialguy639-8364s-projects.vercel.app"
const production = "https://v0-just-play-app.vercel.app"
const stale = "https://just-play-five.vercel.app"
const environment = {
  NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: stale,
  VERCEL_BRANCH_URL: new URL(preview).host,
  VERCEL_PROJECT_PRODUCTION_URL: new URL(production).host,
  VERCEL_URL: "fixture-deployment.vercel.app",
}

class Redirect extends Error {
  constructor(location) { super("Next redirect"); this.location = location }
}
class NextResponse extends Response {
  static redirect(location) {
    return new NextResponse(null, { status: 307, headers: { Location: String(location) } })
  }
}
function fixture(options = {}) {
  const calls = []
  let clients = 0
  const requestHeaders = new Headers(options.headers ?? {
    origin: preview, host: new URL(preview).host,
  })
  const supabase = { auth: {
    resetPasswordForEmail: async (...args) => {
      calls.push(["reset", ...args])
      return { error: options.resetError ?? null }
    },
    exchangeCodeForSession: async (code) => {
      calls.push(["exchange", code])
      return { error: options.exchangeError ?? null }
    },
    signInWithPassword: async (value) => { calls.push(["login", value]); return { error: null } },
    signUp: async (value) => { calls.push(["signup", value]); return { error: null } },
  } }
  const cache = new Map()
  const load = (relative) => {
    const filename = path.resolve(root, relative)
    if (cache.has(filename)) return cache.get(filename)
    const loaded = { exports: {} }
    cache.set(filename, loaded.exports)
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    })
    const resolve = (specifier) => {
      if (specifier === "@/lib/supabase/server") return { createClient: async () => { clients++; return supabase } }
      if (specifier === "next/headers") return { headers: async () => requestHeaders }
      if (specifier === "next/navigation") return { redirect: (location) => { throw new Redirect(location) } }
      if (specifier === "next/server") return { NextResponse }
      if (specifier === "next/link") return function Link(props) {
        return React.createElement("a", props, props.children)
      }
      if (specifier.startsWith("react")) return require(specifier)
      if (specifier.startsWith("@/")) return load(`${specifier.slice(2)}.ts`)
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`))
      throw new Error(`Unexpected dependency: ${specifier}`)
    }
    compileFunction(outputText, ["require", "module", "exports", "process"], { filename })(
      resolve, loaded, loaded.exports, { env: { ...environment, ...options.env } },
    )
    return loaded.exports
  }
  return { load, calls, clients: () => clients }
}
function resetForm(email = "player@example.invalid") {
  const form = new FormData()
  form.set("email", email)
  return form
}
async function redirected(promise, expected) {
  await assert.rejects(promise, (error) => error instanceof Redirect &&
    (expected instanceof RegExp ? expected.test(error.location) : error.location === expected))
}
const callback = (origin = preview, query = "code=fixture-code&next=/auth/update-password") =>
  new Request(`${origin}/auth/callback?${query}`)

test("reset uses the actual trusted preview origin despite stale canonical env, with literal next slashes", async () => {
  const f = fixture()
  await redirected(f.load("app/auth/actions.ts").requestPasswordReset(resetForm()), "/auth/forgot-password?sent=1")
  assert.deepEqual(f.calls, [["reset", "player@example.invalid", {
    redirectTo: `${preview}/auth/callback?next=/auth/update-password`,
  }]])
})

test("production recovery stays on the initiating production origin, not stale env", async () => {
  const f = fixture({ headers: { origin: production, host: new URL(production).host } })
  await redirected(f.load("app/auth/actions.ts").requestPasswordReset(resetForm()), "/auth/forgot-password?sent=1")
  assert.equal(f.calls[0][2].redirectTo, `${production}/auth/callback?next=/auth/update-password`)
})

test("managed forwarded host is accepted only when it matches the trusted request origin", async () => {
  const f = fixture({ headers: { origin: preview, host: "internal.invalid", "x-forwarded-host": new URL(preview).host } })
  await redirected(f.load("app/auth/actions.ts").requestPasswordReset(resetForm()), "/auth/forgot-password?sent=1")
  assert.equal(f.calls.length, 1)
})

for (const [name, headers, env] of [
  ["foreign origin even when host is also spoofed", { origin: "https://attacker.invalid", host: "attacker.invalid" }, {}],
  ["trusted origin with mismatched host", { origin: preview, host: new URL(production).host }, {}],
  ["origin containing a destination path", { origin: `${preview}/auth/update-password`, host: new URL(preview).host }, {}],
  ["missing origin", { host: new URL(preview).host }, {}],
  ["opaque origin", { origin: "null", host: new URL(preview).host }, {}],
  ["insecure public origin", { origin: preview.replace("https:", "http:"), host: new URL(preview).host }, {}],
  ["missing trusted preview configuration", { origin: preview, host: new URL(preview).host }, { VERCEL_BRANCH_URL: undefined }],
]) {
  test(`reset rejects ${name} without creating a client or sending email`, async () => {
    const f = fixture({ headers, env })
    await redirected(f.load("app/auth/actions.ts").requestPasswordReset(resetForm()), /forgot-password\?error=/)
    assert.equal(f.clients(), 0)
    assert.deepEqual(f.calls, [])
  })
}

test("local development permits same-origin loopback; production does not", async () => {
  const helper = fixture().load("lib/auth-redirects.ts")
  assert.equal(helper.recoveryRedirectTo("http://localhost:3000", "localhost:3000", { NODE_ENV: "development" }),
    "http://localhost:3000/auth/callback?next=/auth/update-password")
  assert.throws(() => helper.recoveryRedirectTo("http://localhost:3000", "localhost:3000", { NODE_ENV: "production" }))
  assert.throws(() => helper.trustedAppOrigin("https://user:secret@attacker.invalid", environment))
})

test("trust is exact for configured canonical, branch, production and deployment origins", () => {
  const helper = fixture().load("lib/auth-redirects.ts")
  for (const origin of [stale, preview, production, "https://fixture-deployment.vercel.app"]) {
    assert.equal(helper.trustedAppOrigin(origin, environment), origin)
  }
  for (const origin of [`${preview}.attacker.invalid`, `${preview}?next=/`, `${preview}#fragment`, "https://another-project.vercel.app"]) {
    assert.throws(() => helper.trustedAppOrigin(origin, environment))
  }
})

test("empty/non-string email is rejected and rate-limit guidance remains explicit", async () => {
  const empty = fixture()
  await redirected(empty.load("app/auth/actions.ts").requestPasswordReset(resetForm(" ")), /Enter%20your%20email/)
  await redirected(empty.load("app/auth/actions.ts").requestPasswordReset(new FormData()), /Enter%20your%20email/)
  const fileEmail = new FormData()
  fileEmail.set("email", new Blob(["player@example.invalid"]), "email.txt")
  await redirected(empty.load("app/auth/actions.ts").requestPasswordReset(fileEmail), /Enter%20your%20email/)
  assert.equal(empty.clients(), 0)
  const f = fixture({ resetError: { message: "email rate limit exceeded" } })
  await redirected(f.load("app/auth/actions.ts").requestPasswordReset(resetForm()), /Too%20many%20reset%20emails/)
})

test("email whitespace is trimmed before the reset request", async () => {
  const f = fixture()
  await redirected(f.load("app/auth/actions.ts").requestPasswordReset(resetForm(" player@example.invalid ")), "/auth/forgot-password?sent=1")
  assert.equal(f.calls[0][1], "player@example.invalid")
})

test("callback exchanges a code on the initiating preview and goes only to recovery destination", async () => {
  const f = fixture()
  const response = await f.load("app/auth/callback/route.ts").GET(callback())
  assert.equal(response.status, 307)
  assert.equal(response.headers.get("Location"), `${preview}/auth/update-password`)
  assert.deepEqual(f.calls, [["exchange", "fixture-code"]])
})

test("normal code callback still goes home; login/signup behavior and signup redirect remain unchanged", async () => {
  const f = fixture()
  const response = await f.load("app/auth/callback/route.ts").GET(callback(preview, "code=fixture-code"))
  assert.equal(response.headers.get("Location"), `${preview}/`)
  const form = resetForm()
  form.set("password", "fixture-password")
  await redirected(f.load("app/auth/actions.ts").login(form), "/")
  await redirected(f.load("app/auth/actions.ts").signup(form), "/auth/sign-up-success")
  assert.equal(f.calls.find(([kind]) => kind === "signup")[1].options.emailRedirectTo, `${stale}/auth/callback`)
})

test("encoded valid recovery destination is accepted without permitting external redirects", async () => {
  const f = fixture()
  const response = await f.load("app/auth/callback/route.ts").GET(callback(preview, "code=fixture-code&next=%2Fauth%2Fupdate-password"))
  assert.equal(response.headers.get("Location"), `${preview}/auth/update-password`)
})

for (const destination of [
  "https://attacker.invalid", "//attacker.invalid", "/\\attacker.invalid",
  "javascript:alert(1)", "/auth/update-password?next=https://attacker.invalid", "/welcome",
]) {
  test(`callback rejects invalid destination ${JSON.stringify(destination)} before exchanging a code`, async () => {
    const f = fixture()
    const response = await f.load("app/auth/callback/route.ts").GET(callback(preview, `code=fixture-code&next=${encodeURIComponent(destination)}`))
    assert.equal(response.headers.get("Location"), `${preview}/auth/error?reason=invalid-destination`)
    assert.equal(f.clients(), 0)
  })
}

test("callback rejects an untrusted host before exchanging credentials", async () => {
  const f = fixture()
  const response = await f.load("app/auth/callback/route.ts").GET(callback("https://attacker.invalid"))
  assert.equal(response.status, 400)
  assert.equal(f.clients(), 0)
})

test("missing or failed recovery code produces actionable reason without leaking raw errors/codes", async () => {
  const missing = fixture()
  const response = await missing.load("app/auth/callback/route.ts").GET(callback(preview, "next=/auth/update-password"))
  assert.equal(response.headers.get("Location"), `${preview}/auth/error?reason=recovery-link`)
  assert.equal(missing.clients(), 0)
  const f = fixture({ exchangeError: { message: "private-code-sentinel" } })
  const failed = await f.load("app/auth/callback/route.ts").GET(callback())
  assert.equal(failed.headers.get("Location"), `${preview}/auth/error?reason=recovery-link`)
  assert.ok(!failed.headers.get("Location").includes("private-code-sentinel"))
  const normal = await f.load("app/auth/callback/route.ts").GET(callback(preview, "code=fixture-code"))
  assert.equal(normal.headers.get("Location"), `${preview}/auth/error?reason=callback`)
})

test("recovery pages explain fresh-email/same-browser verification before any password entry", async () => {
  const f = fixture()
  const ErrorPage = f.load("app/auth/error/page.tsx").default
  const markup = renderToStaticMarkup(await ErrorPage({ searchParams: Promise.resolve({
    reason: "recovery-link", message: "private-message-sentinel",
  }) }))
  assert.match(markup, /same browser/)
  assert.match(markup, /fresh/)
  assert.match(markup, /href="\/auth\/forgot-password"/)
  assert.ok(!markup.includes("private-message-sentinel"))
  const ForgotPage = f.load("app/auth/forgot-password/page.tsx").default
  const sent = renderToStaticMarkup(await ForgotPage({ searchParams: Promise.resolve({ sent: "1" }) }))
  assert.match(sent, /newest link/)
  assert.match(sent, /same browser/)
})
