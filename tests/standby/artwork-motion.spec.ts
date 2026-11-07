import { test, expect } from "@playwright/test"

test("remote artwork renders dither and ASCII without tainting either canvas", async ({ page }) => {
  await page.route("https://artwork-fixture.invalid/cover.svg", route => route.fulfill({
    contentType: "image/svg+xml",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#507050"/><circle cx="400" cy="300" r="180" fill="#e9be78"/></svg>',
  }))
  await page.goto("/?remote-art")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const field = page.getByTestId("standby-field")
  const texture = page.getByTestId("standby-ascii")
  await expect(texture).toHaveAttribute("data-rendered", "true")
  await expect(field.locator("img")).toHaveAttribute("crossorigin", "anonymous")
  await expect(field.locator(".game-art-dither")).toBeVisible()
  const nonempty = () => texture.evaluate((canvas: HTMLCanvasElement) =>
    canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0))
  expect(await nonempty()).toBe(true)
  const checksum = () => texture.evaluate((canvas: HTMLCanvasElement) =>
    canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data
      .reduce((hash, value) => (hash * 31 + value) | 0, 0))
  const dither = await checksum()
  await page.getByRole("button", { name: "Appearance", exact: true }).click()
  await page.getByLabel("Style", { exact: true }).selectOption("ascii")
  await expect(field).toHaveAttribute("data-effect", "ascii")
  await expect.poll(checksum).not.toBe(dither)
  await expect.poll(nonempty).toBe(true)
})

test("remote artwork without CORS retains the image and reports unavailable effects", async ({ page }) => {
  const warnings: string[] = []
  page.on("console", message => {
    if (message.type() === "warning") warnings.push(message.text())
  })
  await page.route("https://artwork-fixture.invalid/cover.svg", route => route.fulfill({
    contentType: "image/svg+xml",
    headers: { "Access-Control-Allow-Origin": "https://not-allowed.invalid" },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#507050"/></svg>',
  }))
  await page.goto("/?remote-art")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const field = page.getByTestId("standby-field")
  await expect.poll(() => field.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await expect(field.locator("img")).not.toHaveAttribute("crossorigin")
  await expect(field.locator("img")).toBeVisible()
  await expect(page.getByTestId("standby-ascii")).toBeHidden()
  await expect.poll(() => warnings.some(message => message.includes("Canvas-safe image loading failed"))).toBe(true)
  await expect.poll(() => warnings.some(message => message.includes("treatment unavailable"))).toBe(true)
})

test("artwork atmosphere survives blocked dither without depending on the clock or session status", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.addInitScript(() => {
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new DOMException("Fixture blocks canvas readback", "SecurityError")
    }
  })
  await page.goto("/?untracked")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const field = page.getByTestId("standby-field")
  await expect(field.locator("canvas")).toHaveCount(2)
  for (const canvas of await field.locator("canvas").all()) await expect(canvas).toBeHidden()
  await expect(field.locator("img")).toBeVisible()
  await expect(page.getByLabel(/elapsed time/)).toHaveCount(0)
  const forms = field.locator(".standby-artwork")
  await expect(forms).toHaveCount(1)
  for (const form of await forms.all()) {
    await expect(form).toHaveCSS("animation-play-state", "running")
    expect(await form.evaluate(element => Number.parseFloat(getComputedStyle(element).animationDuration))).toBe(24)
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
  for (const form of await forms.all()) await expect(form).toHaveCSS("animation-play-state", "running")
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual(["Paused"])
})

test("artwork atmosphere pauses on document hide, resumes and handles hidden entry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
  })
  await page.goto("/?strict")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const field = page.getByTestId("standby-field")
  const forms = field.locator(".standby-artwork, .standby-ascii")
  await expect(field).toHaveAttribute("data-motion", "paused")
  for (const form of await forms.all()) await expect(form).toHaveCSS("animation-play-state", "paused")
  for (const state of ["visible", "hidden", "visible"]) {
    await page.evaluate(value => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value })
      document.dispatchEvent(new Event("visibilitychange"))
    }, state)
    await expect(field).toHaveAttribute("data-motion", state === "visible" ? "running" : "paused")
    for (const form of await forms.all()) {
      await expect(form).toHaveCSS("animation-play-state", state === "visible" ? "running" : "paused")
    }
  }
  await page.keyboard.press("Escape")
  await expect(field).toHaveCount(0)
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByTestId("standby-field")).toHaveAttribute("data-motion", "running")
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
})

test("reduced motion keeps static artwork and ASCII, including preference changes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const field = page.getByTestId("standby-field")
  await expect(field.locator("img")).toBeVisible()
  for (const form of await field.locator(".standby-artwork, .standby-ascii").all()) {
    await expect(form).toHaveCSS("animation-name", "none")
  }
  expect(await field.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(field.locator(".standby-artwork")).toHaveCSS("animation-name", "standby-art-drift")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(field.locator(".standby-artwork")).toHaveCSS("animation-name", "none")
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`artwork visibly shifts over a long loop at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    const field = page.getByTestId("standby-field")
    await expect.poll(() => field.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect(page.getByTestId("standby-ascii")).toHaveAttribute("data-rendered", "true")
    await expect.poll(() => field.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(2)
    const seek = async (time: number) => {
      await field.evaluate((element, currentTime) => {
        for (const animation of element.getAnimations({ subtree: true })) {
          animation.pause()
          animation.currentTime = currentTime
        }
      }, time)
    }
    await seek(0)
    const before = await field.screenshot({ path: testInfo.outputPath("atmosphere-start.png"), animations: "allow" })
    const transform = await field.locator(".standby-artwork").evaluate(element => getComputedStyle(element).transform)
    await seek(16000)
    await expect.poll(() => field.locator(".standby-artwork").evaluate(element => getComputedStyle(element).transform)).not.toBe(transform)
    const after = await field.screenshot({ path: testInfo.outputPath("atmosphere-later.png"), animations: "allow" })
    expect(after.equals(before)).toBe(false)
    await page.getByRole("dialog").screenshot({ path: testInfo.outputPath("standby-composition.png"), animations: "allow" })
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
    expect(await page.getByRole("dialog").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  })
}

test("the texture stays rigid while the backdrop moves, and freezes for reduced motion and hidden tabs", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const canvas = page.getByTestId("standby-ascii")
  await expect(canvas).toHaveAttribute("data-rendered", "true")
  const pixels = () => canvas.evaluate((element: HTMLCanvasElement) =>
    Array.from(element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data)
      .reduce((hash, value) => (hash * 31 + value) | 0, 0))
  const texture = await pixels()
  const transform = () => canvas.evaluate(element => getComputedStyle(element).transform)
  const before = await transform()
  await expect.poll(transform).not.toBe(before)
  expect(await pixels()).toBe(texture)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(canvas).toHaveCSS("animation-name", "none")
  await expect(canvas).toHaveCSS("transform", "none")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(canvas).toHaveCSS("animation-play-state", "paused")
  const paused = await transform()
  await canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await transform()).toBe(paused)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(canvas).toHaveCSS("animation-play-state", "running")
  await expect.poll(transform).not.toBe(paused)
})

test("appearance offers dither, ASCII, color and motion controls and remembers the choices", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const field = page.getByTestId("standby-field")
  await expect(field).toHaveAttribute("data-effect", "dither")
  const canvas = page.getByTestId("standby-ascii")
  await expect(canvas).toHaveAttribute("data-rendered", "true")
  const checksum = () => canvas.evaluate((element: HTMLCanvasElement) =>
    Array.from(element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data)
      .reduce((hash, value) => (hash * 31 + value) | 0, 0))
  const original = await checksum()
  await page.getByRole("button", { name: "Appearance", exact: true }).click()
  await page.getByLabel("Color", { exact: true }).selectOption("amber")
  await expect.poll(checksum).not.toBe(original)
  const dither = await checksum()
  await page.getByLabel("Style", { exact: true }).selectOption("ascii")
  await expect.poll(checksum).not.toBe(dither)
  await page.getByLabel("Background motion", { exact: true }).uncheck()
  await expect(field).toHaveAttribute("data-effect", "ascii")
  await expect(field).toHaveAttribute("data-color", "amber")
  await expect(field.locator(".standby-ascii")).toHaveCSS("animation-name", "none")
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(page.getByRole("button", { name: "Appearance", exact: true })).toBeFocused()
  await expect(page.getByRole("region", { name: "StandBy appearance" })).toHaveCount(0)
  await page.reload()
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(field).toHaveAttribute("data-effect", "ascii")
  await expect(field).toHaveAttribute("data-color", "amber")
  await expect(field).toHaveAttribute("data-animate", "false")
  await page.getByRole("button", { name: "Appearance", exact: true }).click()
  await page.getByLabel("Style", { exact: true }).selectOption("artwork")
  await expect(field.locator(".standby-ascii")).toBeHidden()
  await expect(field.locator("img")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("button", { name: "Appearance", exact: true })).toBeFocused()
  expect(await page.getByRole("dialog").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
})

test.describe("mobile touch input", () => {
  test.use({ hasTouch: true })

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 390 },
]) {
  test(`touch controls and appearance fit portrait and landscape at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).tap()
    const dialog = page.getByRole("dialog")
    const pause = dialog.getByRole("button", { name: "Pause", exact: true })
    const appearance = dialog.getByRole("button", { name: "Appearance", exact: true })
    for (const button of [
      pause, appearance,
      dialog.getByRole("button", { name: "End session", exact: true }),
      dialog.getByRole("button", { name: "Fullscreen", exact: true }),
      dialog.getByRole("button", { name: "Exit StandBy", exact: true }),
    ]) {
      await expect(button).toBeInViewport({ ratio: 1 })
      const bounds = await button.boundingBox()
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
    }
    const summary = page.locator(".standby-session-summary")
    const summaryBefore = await summary.boundingBox()
    await appearance.tap()
    await expect(page.getByRole("region", { name: "StandBy appearance" })).toBeVisible()
    expect(await summary.boundingBox()).toEqual(summaryBefore)
    for (const element of [
      page.getByLabel("Style", { exact: true }),
      page.getByLabel("Color", { exact: true }),
      page.getByLabel("Background motion", { exact: true }),
      dialog.getByRole("button", { name: "Done", exact: true }),
    ]) await expect(element).toBeInViewport({ ratio: 1 })
    await page.getByLabel("Style", { exact: true }).selectOption("ascii")
    await page.getByLabel("Color", { exact: true }).selectOption("mint")
    await dialog.screenshot({ path: testInfo.outputPath("mobile-appearance.png"), animations: "disabled" })
    await dialog.getByRole("button", { name: "Done", exact: true }).tap()
    await pause.tap()
    await expect(dialog.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
    await dialog.getByRole("button", { name: "Resume", exact: true }).tap()
    await expect(pause).toBeEnabled()
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await dialog.screenshot({ path: testInfo.outputPath("mobile-standby.png"), animations: "disabled" })
    await page.setViewportSize({ width: viewport.height, height: viewport.width })
    await expect(pause).toBeInViewport({ ratio: 1 })
    await expect(appearance).toBeInViewport({ ratio: 1 })
    await dialog.getByRole("button", { name: "End session", exact: true }).tap()
    await expect(dialog.getByRole("button", { name: "Finish session", exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: "Keep playing", exact: true }).tap()
    await expect(dialog.getByRole("button", { name: "Finish session", exact: true })).toHaveCount(0)
  })
}
})
