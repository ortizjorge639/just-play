import { test, expect } from "@playwright/test"

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
]) {
  test(`game selection can be backed out without creating a session at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/?app-shell&deck&current-game")

    await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible()
    if (viewport.width >= 390 && viewport.height >= 844) {
      await expect(page.getByRole("button", { name: /Lock in game/ })).toBeInViewport()
    }
    await page.getByRole("button", { name: /Lock in game/ }).click()
    await expect(page.getByRole("heading", { name: "Deck A" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start Playing" })).toBeVisible()
    if (viewport.width >= 390 && viewport.height >= 844) {
      await expect(page.getByRole("button", { name: "Start Playing" })).toBeInViewport()
    }

    await page.getByRole("button", { name: "Change game" }).click()
    await expect(page.getByRole("button", { name: /Lock in game/ })).toBeVisible()

    await page.getByRole("button", { name: "Skip for now" }).click()
    await expect(page.getByRole("heading", { name: "Deck B" })).toBeVisible()
    await page.getByRole("button", { name: "Undo skip" }).click()
    await expect(page.getByRole("heading", { name: "Deck A" })).toBeVisible()

    expect(await page.evaluate(() => window.standbyFixture.sessionCreateCalls)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test("Split focus keeps a long game title readable at 200% text size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?app-shell&deck&current-game&long-deck")
  await page.addStyleTag({ content: "html{font-size:200%!important}" })
  await page.getByRole("button", { name: /Lock in game/ }).click()
  await expect(page.getByRole("heading", { name: /Tears of the Kingdom/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Start Playing" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("the current game details card is keyboard operable and restores focus after flipping", async ({ page }) => {
  await page.goto("/?current-game")
  const viewDetails = page.getByRole("button", { name: "View details" })
  await viewDetails.focus()
  await page.keyboard.press("Enter")

  const backToCover = page.getByRole("button", { name: "Back to cover" })
  await expect(backToCover).toBeFocused()
  await page.keyboard.press("Space")
  await expect(viewDetails).toBeFocused()
})

test("cover art renders its dither canvas over the same-origin image fixture", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?app-shell&deck&current-game")
  const canvas = page.locator(".game-art-dither").first()
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    if (!element.width || !element.height || element.hidden) return false
    const pixels = element.getContext("2d")?.getImageData(0, 0, element.width, element.height).data
    if (!pixels) return false
    for (let alpha = 3; alpha < pixels.length; alpha += 4) {
      if (pixels[alpha] > 0) return true
    }
    return false
  })).toBe(true)
})

test("booster packs remain available while recommendations are on the deck", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?app-shell&deck&current-game&packs")
  await expect(page.getByRole("button", { name: "Booster pack (2 left)" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Lock in game/ })).toBeInViewport()
  await page.getByRole("button", { name: "Booster pack (2 left)" }).click()
  await expect(page.getByRole("heading", { name: "Booster Pack" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open Booster Pack" })).toBeVisible()
})
