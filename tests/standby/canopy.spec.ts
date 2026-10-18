import { test, expect, type Page } from "@playwright/test"
import path from "node:path"

async function enterNook(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await page.getByRole("button", { name: "Canopy nook", exact: true }).click()
}

test("quiet hierarchy removes decorative copy without hiding relevant capability warnings", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined })
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false })
  })
  await page.goto("/?awake")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await page.getByRole("button", { name: "Canopy nook", exact: true }).click()
  await expect(page.locator(".canopy-canvas canvas")).toHaveAttribute("data-render-state", "running")
  const dialog = page.getByRole("dialog")
  await expect(dialog).not.toContainText("A little room in the trees.")
  await expect(dialog).not.toContainText("Settle in. Go play.")
  await expect(page.locator(".canopy-room-label")).toHaveCount(0)
  await expect(dialog.getByRole("status")).toContainText("Keep-awake unavailable")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeInViewport()
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Fullscreen is unavailable")
  await expect(dialog.getByRole("status")).toContainText("Keep-awake unavailable")
  await page.getByRole("button", { name: "Exit StandBy", exact: true }).click()
})

test("nook is opt-in, lazy, and bound to the existing authoritative session", async ({ page }) => {
  const requests: string[] = []
  page.on("request", request => requests.push(request.url()))
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("heading", { name: "A Short Hike" })).toBeVisible()
  expect(requests.some(url => /renderer-|\.glb/.test(url))).toBe(false)
  await page.getByRole("button", { name: "Canopy nook", exact: true }).click()
  const canvas = page.locator(".canopy-canvas canvas")
  await expect(canvas).toHaveAttribute("data-render-state", "running")
  await canvas.evaluate(element => element.setAttribute("data-instance", "original"))
  await page.getByRole("button", { name: "Session details", exact: true }).click()
  await expect(page.locator("#canopy-session-details")).toContainText("Reach the summit")
  await expect(page.locator("#canopy-session-details")).toContainText("not an earned game resident")
  await page.evaluate(() => {
    window.standbyFixture.session!.notes = "Look for the ranger on the trail."
    window.standbyFixture.session!.status = "Paused"
    window.dispatchEvent(new Event("focus"))
  })
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
  await expect(page.locator("#canopy-session-details")).toContainText("Look for the ranger")
  await expect(canvas).toHaveAttribute("data-instance", "original")
  await page.waitForTimeout(1200)
  expect(requests.filter(url => url.endsWith(".glb"))).toHaveLength(1)
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  await page.getByRole("button", { name: "Artwork view", exact: true }).click()
  await expect(canvas).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "A Short Hike" })).toBeVisible()
})

test("asset failure visibly falls back and retry releases the failed scene", async ({ page }) => {
  await page.route("**/canopy/*.glb", route => route.fulfill({ status: 503, body: "Unavailable" }))
  await enterNook(page)
  await expect(page.getByRole("alert")).toContainText("game artwork is still here")
  await expect(page.locator(".canopy-canvas canvas")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.unroute("**/canopy/*.glb")
  await page.getByRole("button", { name: "Retry nook", exact: true }).click()
  await expect(page.locator(".canopy-canvas canvas")).toHaveAttribute("data-render-state", "running")
  await page.locator(".canopy-canvas canvas").evaluate(canvas => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
  })
  await expect(page.getByRole("alert")).toContainText("game artwork is still here")
  await expect(page.locator(".canopy-canvas canvas")).toHaveCount(0)
})

test("unsupported WebGL keeps artwork and session controls available", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith("webgl")) return null
      return original.apply(this, args)
    } as typeof original
  })
  await enterNook(page)
  await expect(page.getByRole("alert")).toContainText("Canopy couldn't open")
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: /Enter StandBy/ })).toBeFocused()
})

test("reduced-motion and document hiding stop the render loop; exit during load cleans up", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    Object.assign(window, { nookHidden: false })
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => Reflect.get(window, "nookHidden") ? "hidden" : "visible" })
    Reflect.set(window, "nookDrawCalls", 0)
    for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Context) continue
      const original = Context.prototype.drawElements
      Context.prototype.drawElements = function (...args: Parameters<typeof original>) {
        Reflect.set(window, "nookDrawCalls", Reflect.get(window, "nookDrawCalls") + 1)
        return original.apply(this, args)
      }
    }
  })
  await enterNook(page)
  const canvas = page.locator(".canopy-canvas canvas")
  await expect(canvas).toHaveAttribute("data-render-state", "reduced-motion")
  await page.waitForTimeout(200)
  const staticCalls = await page.evaluate(() => Reflect.get(window, "nookDrawCalls") as number)
  expect(staticCalls).toBeGreaterThan(0)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => Reflect.get(window, "nookDrawCalls"))).toBe(staticCalls)
  await page.evaluate(() => { Reflect.set(window, "nookHidden", true); document.dispatchEvent(new Event("visibilitychange")) })
  await expect(canvas).toHaveAttribute("data-render-state", "hidden")
  await page.evaluate(() => { Reflect.set(window, "nookHidden", false); document.dispatchEvent(new Event("visibilitychange")) })
  await expect(canvas).toHaveAttribute("data-render-state", "reduced-motion")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(canvas).toHaveAttribute("data-render-state", "running")
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "nookDrawCalls") as number)).toBeGreaterThan(staticCalls)
  await page.evaluate(() => { Reflect.set(window, "nookHidden", true); document.dispatchEvent(new Event("visibilitychange")) })
  const hiddenCalls = await page.evaluate(() => Reflect.get(window, "nookDrawCalls") as number)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => Reflect.get(window, "nookDrawCalls"))).toBe(hiddenCalls)
  await page.evaluate(() => { Reflect.set(window, "nookHidden", false); document.dispatchEvent(new Event("visibilitychange")) })
  await page.getByRole("button", { name: "Artwork view", exact: true }).click()
  await page.route("**/canopy/*.glb", async route => {
    await new Promise(resolve => setTimeout(resolve, 400))
    await route.continue()
  })
  await page.getByRole("button", { name: "Canopy nook", exact: true }).click()
  await page.getByRole("button", { name: "Exit StandBy", exact: true }).click()
  await page.waitForTimeout(600)
  await expect(canvas).toHaveCount(0)
})

test("nook preserves remote finish, stale-error disabling, and recording independence", async ({ page }) => {
  await page.goto("/?untracked")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await page.getByRole("button", { name: "Canopy nook", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Time recording off")
  await expect(page.getByLabel(/elapsed time/)).toHaveCount(0)
  await page.evaluate(() => { window.standbyFixture.error = "Reconnect to check this session"; window.dispatchEvent(new Event("focus")) })
  await expect(page.getByRole("alert")).toContainText("Reconnect")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "End session", exact: true })).toBeDisabled()
  await page.evaluate(() => { window.standbyFixture.error = null; window.standbyFixture.session = null; window.dispatchEvent(new Event("online")) })
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator(".canopy-canvas canvas")).toHaveCount(0)
})

for (const [name, width, height] of [["portrait", 390, 844], ["landscape", 844, 390], ["tablet", 768, 1024], ["desktop", 1440, 1000]] as const) {
  test(`rendered ${name} composition fits its viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: "reduce" })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await enterNook(page)
    const canvas = page.locator(".canopy-canvas canvas")
    await expect(canvas).toHaveAttribute("data-render-state", "reduced-motion")
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeInViewport()
    await expect(page.getByRole("button", { name: "Fullscreen", exact: true })).toBeInViewport()
    await expect(page.getByRole("button", { name: "Exit StandBy", exact: true })).toBeInViewport()
    expect(await page.getByRole("dialog").evaluate(element => ({
      x: element.scrollWidth > element.clientWidth + 1,
      y: element.scrollHeight > element.clientHeight + 1,
    }))).toEqual({ x: false, y: false })
    await page.screenshot({ path: process.env.CANOPY_CAPTURE_DIR ? path.join(process.env.CANOPY_CAPTURE_DIR, `canopy-${name}-${testInfo.project.name}.png`) : testInfo.outputPath(`canopy-${name}.png`) })
    const bounds = await canvas.boundingBox()
    expect(bounds!.width).toBeGreaterThan(250)
    expect(bounds!.height).toBeGreaterThan(200)
    expect(await canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement
      return canvas.width * canvas.height
    })).toBeLessThanOrEqual(1_705_000)
    expect(errors).toEqual([])
    await page.getByRole("button", { name: "Session details", exact: true }).click()
    await expect(page.locator("#canopy-session-details")).toBeVisible()
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeInViewport()
    await page.getByRole("button", { name: "End session", exact: true }).click()
    await expect(page.getByRole("button", { name: "Finish session", exact: true })).toBeInViewport()
  })
}

test("long real context is inspectable without hiding phone session controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 390, height: 844 })
  await enterNook(page)
  await page.evaluate(() => {
    const session = window.standbyFixture.session!
    session.games = { ...session.games, name: "The Legend of Zelda: Tears of the Kingdom - A very long library title" }
    session.session_goal = "Explore the mountains. ".repeat(30)
    session.notes = "A representative long note. ".repeat(80)
    window.dispatchEvent(new Event("focus"))
  })
  await page.getByRole("button", { name: "Session details", exact: true }).click()
  await expect(page.locator(".canopy-context-game")).toContainText("A very long library title")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeInViewport()
  await expect(page.getByRole("button", { name: "Fullscreen", exact: true })).toBeInViewport()
  await page.getByRole("button", { name: "End session", exact: true }).click()
  await expect(page.getByRole("button", { name: "Finish session", exact: true })).toBeInViewport()
  await page.getByRole("button", { name: "Exit StandBy", exact: true }).click()
  await expect(page.locator(".canopy-canvas canvas")).toHaveCount(0)
})

test.describe("isolated review recording", () => {
  test.skip(!process.env.CANOPY_RECORD, "Opt-in sanitized product-review media")
  test("real components with representative session props, not a signed-in account", async ({ browser }, testInfo) => {
    test.setTimeout(90_000)
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4387",
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: testInfo.outputPath("video"), size: { width: 1280, height: 720 } },
    })
    const page = await context.newPage()
    try {
      await enterNook(page)
      await expect(page.locator(".canopy-canvas canvas")).toHaveAttribute("data-render-state", "running")
      await page.waitForTimeout(6000)
      await page.getByRole("button", { name: "Session details", exact: true }).click()
      await page.waitForTimeout(2500)
      await page.getByRole("button", { name: "Hide session details", exact: true }).click()
      await page.getByRole("button", { name: "Pause", exact: true }).click()
      await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
      await page.waitForTimeout(1500)
      await page.getByRole("button", { name: "Exit StandBy", exact: true }).click()
      await expect(page.locator(".canopy-canvas canvas")).toHaveCount(0)
    } finally {
      await context.close()
    }
    const video = await page.video()?.path()
    if (video) await testInfo.attach("isolated-canopy-review", { path: video, contentType: "video/webm" })
  })
})
