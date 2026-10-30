import { test as base, expect, chromium, type Page } from "@playwright/test"
import { spawn } from "node:child_process"
import { mkdtemp, readFile } from "node:fs/promises"
import { removeDisposableProfile } from "./disposable-profile"
import { tmpdir } from "node:os"
import path from "node:path"

// Playwright's ordinary page fixture enables session-scoped focus emulation:
// bringing another tab forward then does not produce native hidden events.
// This dedicated Chromium fixture attaches without those defaults. It never
// overrides document visibility or synthesizes browser lifecycle events.
export const test = base.extend<{ nativePage: Page }>({
  nativePage: async ({}, providePage) => {
    const profile = await mkdtemp(path.join(tmpdir(), "jp-native-visibility-"))
    const child = spawn(chromium.executablePath(), [
      "--no-sandbox", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
      `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
      "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-8000) })
    let spawnError: Error | undefined
    child.on("error", error => { spawnError = error })
    const exited = new Promise<void>(resolve => {
      child.once("exit", () => resolve())
      child.once("error", () => resolve())
    })
    let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined
    const failures: unknown[] = []
    try {
      let endpoint = ""
      await expect.poll(async () => {
        if (spawnError) throw spawnError
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Native Chromium exited: ${stderr}`)
        try {
          const [port, route] = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).trim().split("\n")
          endpoint = `ws://127.0.0.1:${port}${route}`
          return !!port && !!route
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
          throw error
        }
      }, { timeout: 10000, message: "Disposable native Chromium CDP startup" }).toBe(true)
      // noDefaults is a verified Playwright 1.64 CDP option, not yet in its
      // public TypeScript declarations. Keep it on this dedicated connection.
      const connectOptions = { timeout: 10000, noDefaults: true }
      browser = await chromium.connectOverCDP(endpoint, connectOptions)
      const context = browser.contexts()[0]
      const page = context.pages()[0]
      await page.setViewportSize({ width: 320, height: 568 })
      await page.emulateMedia({ reducedMotion: "no-preference" })
      // Fail at the browser prerequisite, before testing application behavior.
      const cover = await context.newPage()
      await cover.goto("about:blank")
      await cover.bringToFront()
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden")
      await page.bringToFront()
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible")
      await cover.close()
      console.log("Native empty-page visibility prerequisite: hidden -> visible")
      await providePage(page)
    } catch (error) {
      failures.push(error)
    } finally {
      try { await browser?.close() } catch (error) { failures.push(error) }
      try {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
        let timer: ReturnType<typeof setTimeout> | undefined
        await Promise.race([exited, new Promise<void>(resolve => {
          timer = setTimeout(() => { child.kill("SIGKILL"); resolve() }, 3000)
        })])
        if (timer) clearTimeout(timer)
        await exited
      } catch (error) { failures.push(error) }
      try { await removeDisposableProfile(profile) } catch (error) { failures.push(error) }
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) throw new AggregateError(failures, "Native visibility fixture and cleanup failed")
    }
  },
})

export { expect } from "@playwright/test"
