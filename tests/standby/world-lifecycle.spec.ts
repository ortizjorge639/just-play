import { test, expect } from "@playwright/test"

// Native Chromium + actual art/rendering. The counter observes RAF delivery only;
// it does not replace the clock, drawing, assets, session actions or scheduling.
test.use({ reducedMotion: "no-preference", viewport: { width: 320, height: 568 } })

test("normal-motion world responds to motion preference changes and releases its loop on exit", async ({ page }) => {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window)
    Object.assign(window, { worldRafReceipts: { delivered: 0 } })
    window.requestAnimationFrame = callback => request(timestamp => {
      ;(window as unknown as { worldRafReceipts: { delivered: number } }).worldRafReceipts.delivered++
      callback(timestamp)
    })
  })
  const delivered = () => page.evaluate(() => (window as unknown as { worldRafReceipts: { delivered: number } }).worldRafReceipts.delivered)
  await page.goto("/?app-shell&residents&elder")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready")
  await expect(scene).toHaveAttribute("data-render-state", "running")
  await expect(scene).toHaveAttribute("data-figures", "1")
  await expect(scene).toHaveAttribute("data-routines", /test-game:(rest|look|greeting|stroll)/)
  const running = await delivered()
  await expect.poll(delivered).toBeGreaterThan(running)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(scene).toHaveAttribute("data-render-state", "reduced-motion")
  const reduced = await delivered()
  await page.waitForTimeout(300)
  expect(await delivered()).toBe(reduced)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(scene).toHaveAttribute("data-render-state", "running")
  await expect.poll(delivered).toBeGreaterThan(reduced)
  const exit = page.getByRole("button", { name: "Exit StandBy", exact: true })
  await exit.focus()
  await exit.press("Enter")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(scene).toHaveCount(0)
  await expect(page.locator("canvas")).toHaveCount(0)
  // Allow the dialog's real exit animation to finish before checking quiescence.
  await page.waitForTimeout(300)
  const exited = await delivered()
  await page.waitForTimeout(300)
  expect(await delivered()).toBe(exited)
})
