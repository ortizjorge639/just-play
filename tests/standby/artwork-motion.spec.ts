import { test, expect } from "@playwright/test"

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
  await expect(field.locator("canvas")).toBeHidden()
  await expect(field.locator("img")).toBeVisible()
  await expect(page.getByLabel(/elapsed time/)).toHaveCount(0)
  const forms = field.locator(".standby-color-form")
  await expect(forms).toHaveCount(3)
  for (const form of await forms.all()) {
    await expect(form).toHaveCSS("animation-play-state", "running")
    expect(await form.evaluate(element => Number.parseFloat(getComputedStyle(element).animationDuration))).toBeGreaterThanOrEqual(30)
    expect(await form.evaluate(element => getComputedStyle(element).backgroundImage)).toContain("fixture-art.svg")
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
  const forms = field.locator(".standby-color-form")
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

test("reduced motion keeps static artwork and color forms, including preference changes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const field = page.getByTestId("standby-field")
  await expect(field.locator("img")).toBeVisible()
  for (const form of await field.locator(".standby-color-form").all()) {
    await expect(form).toHaveCSS("animation-name", "none")
    await expect(form).toHaveCSS("opacity", "0.3")
  }
  expect(await field.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(field.locator(".standby-color-form").first()).toHaveCSS("animation-name", "standby-color-drift")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(field.locator(".standby-color-form").first()).toHaveCSS("animation-name", "none")
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`artwork visibly shifts over a long loop at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto("/?hidden")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    const field = page.getByTestId("standby-field")
    await expect.poll(() => field.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect.poll(() => field.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(3)
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
    const transform = await field.locator(".standby-color-form").first().evaluate(element => getComputedStyle(element).transform)
    await seek(16000)
    await expect.poll(() => field.locator(".standby-color-form").first().evaluate(element => getComputedStyle(element).transform)).not.toBe(transform)
    const after = await field.screenshot({ path: testInfo.outputPath("atmosphere-later.png"), animations: "allow" })
    expect(after.equals(before)).toBe(false)
    await page.getByRole("dialog").screenshot({ path: testInfo.outputPath("standby-composition.png"), animations: "allow" })
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
    expect(await page.getByRole("dialog").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  })
}
