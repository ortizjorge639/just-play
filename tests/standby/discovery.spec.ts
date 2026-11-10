import { test, expect } from "@playwright/test"

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
]) {
  test(`game selection and skip controls stay predictable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/?app-shell&deck&current-game")

    await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible()
    await expect(page.getByTestId("recommendation-art-overlay")).toHaveCSS(
      "background-image",
      /linear-gradient.*linear-gradient/,
    )
    // The primary action is on screen without scrolling on any upright phone.
    if (viewport.height >= 568) {
      await expect(page.getByRole("button", { name: "Start Playing" })).toBeInViewport()
    }
    const undoSkip = page.getByRole("button", { name: "Undo skip" })
    await expect(undoSkip).toBeDisabled()
    const actionLayout = await page.getByRole("group", { name: "Game recommendation actions" }).evaluate((element) => {
      const style = getComputedStyle(element)
      return { display: style.display, columns: style.gridTemplateColumns.split(" ").length }
    })
    await page.getByRole("button", { name: "Skip for now" }).click()
    await expect(page.getByRole("heading", { name: "Deck B" })).toBeVisible()
    await expect(undoSkip).toBeEnabled()
    await expect.poll(() => page.getByRole("group", { name: "Game recommendation actions" }).evaluate((element) => {
      const style = getComputedStyle(element)
      return { display: style.display, columns: style.gridTemplateColumns.split(" ").length }
    })).toEqual(actionLayout)
    await undoSkip.click()
    await expect(page.getByRole("heading", { name: "Deck A" })).toBeVisible()

    // Looking at another game is free: nothing starts until Start Playing.
    await page.getByRole("button", { name: /Deck B/ }).click()
    await expect(page.getByRole("heading", { name: "Deck B", level: 2 })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start Playing" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Lock in game/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Change game" })).toHaveCount(0)

    expect(await page.evaluate(() => window.standbyFixture.sessionCreateCalls)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test("Split focus keeps a long game title readable at 200% text size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?app-shell&deck&current-game&long-deck")
  await page.addStyleTag({ content: "html{font-size:200%!important}" })
  await expect(page.getByRole("heading", { name: /Tears of the Kingdom/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Start Playing" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("the current game details card is keyboard operable and restores focus after flipping", async ({ page }) => {
  await page.goto("/?current-game")
  const flipContainer = page.getByTestId("game-flip-container")
  await expect.poll(() => flipContainer.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none")

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
  await expect(page.getByRole("button", { name: "Start Playing" })).toBeInViewport()
  await page.getByRole("button", { name: "Booster pack (2 left)" }).click()
  await expect(page.getByRole("heading", { name: "Booster Pack" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open Booster Pack" })).toBeVisible()
  await page.getByRole("button", { name: "Back to recommendations" }).click()
  await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Booster pack (2 left)" })).toBeVisible()
  await page.getByRole("button", { name: "Booster pack (2 left)" }).click()
  await page.getByRole("button", { name: "Open Booster Pack" }).click()
  await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole("button", { name: "Booster pack (1 left)" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Pack A/ })).toBeVisible()
  expect(await page.evaluate(() => window.standbyFixture.boosterPackOpenCalls)).toBe(1)
})

test("the booster pack action keeps its slot when no packs remain", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  await expect(page.getByRole("button", { name: "No packs left today" })).toBeDisabled()
  await expect(page.getByRole("group", { name: "Game recommendation actions" })).toHaveCSS("display", "grid")
})

test("the automatic booster prompt can return to an empty recommendation deck", async ({ page }) => {
  await page.goto("/?app-shell&booster&packs&current-game")
  await expect(page.getByRole("heading", { name: "Booster Pack" })).toBeVisible()
  await page.getByRole("button", { name: "Back to recommendations" }).click()
  await expect(page.getByRole("heading", { name: "No more games" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Booster Pack" })).toHaveCount(0)
})

test("an empty or failed booster fetch does not consume an opening", async ({ page }) => {
  for (const query of ["empty-pack", "booster-error"]) {
    await page.goto(`/?app-shell&deck&current-game&packs&${query}`)
    await page.getByRole("button", { name: "Booster pack (2 left)" }).click()
    await page.getByRole("button", { name: "Open Booster Pack" }).click()
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText("2 packs remaining today")).toBeVisible()
    expect(await page.evaluate(() => window.standbyFixture.boosterPackOpenCalls)).toBe(0)
  }
})

test("the booster pack honors reduced-motion preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/?app-shell&deck&current-game&packs")
  await page.getByRole("button", { name: "Booster pack (2 left)" }).click()
  const art = page.getByTestId("booster-pack-art")
  await expect(art).toBeVisible()
  await expect.poll(() => art.evaluate(element => getComputedStyle(element).transform)).toBe("none")
})

const startCalls = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.standbyFixture.sessionCreateCalls)

test("one tap on Start Playing starts the selected game", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  expect(await startCalls(page)).toEqual([])
  await page.getByRole("button", { name: "Start Playing" }).click()
  await expect.poll(() => startCalls(page)).toEqual(["deck-A"])
})

test("picking another game from the list starts that one instead", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  await page.getByRole("button", { name: /Deck B/ }).click()
  await expect(page.getByRole("heading", { name: "Deck B", level: 2 })).toBeVisible()
  expect(await startCalls(page)).toEqual([])
  await page.getByRole("button", { name: "Start Playing" }).click()
  await expect.poll(() => startCalls(page)).toEqual(["deck-B"])
})

test("skipping moves on without starting anything, and undo brings the game back", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  await page.getByRole("button", { name: /Skip for now/ }).click()
  await expect(page.getByRole("heading", { name: "Deck B", level: 2 })).toBeVisible()
  await page.getByRole("button", { name: /Undo skip/ }).click()
  await expect(page.getByRole("heading", { name: "Deck A", level: 2 })).toBeVisible()
  expect(await startCalls(page)).toEqual([])
})

test("a start that fails says so and leaves the choice in place", async ({ page }) => {
  // The harness's createSession always rejects, standing in for a failed start.
  await page.goto("/?app-shell&deck&current-game")
  const start = page.getByRole("button", { name: "Start Playing" })
  await start.click()
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(start).toBeEnabled()
  await expect(page.getByRole("heading", { name: "Deck A", level: 2 })).toBeVisible()
})

test("the selected game and its action come before the other picks on a phone, beside them on a desktop", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  const start = page.getByRole("button", { name: "Start Playing" })
  const firstPick = page.getByRole("button", { name: /Deck A/ })

  await page.setViewportSize({ width: 390, height: 844 })
  let startBox = (await start.boundingBox())!, pickBox = (await firstPick.boundingBox())!
  expect(startBox.y + startBox.height).toBeLessThan(pickBox.y)

  await page.setViewportSize({ width: 1440, height: 900 })
  startBox = (await start.boundingBox())!
  pickBox = (await firstPick.boundingBox())!
  expect(startBox.x).toBeGreaterThan(pickBox.x + pickBox.width)
})

test("the first tab is called Discover in the navigation and the top bar", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  const tab = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Discover", exact: true })
  await expect(tab).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("banner")).toContainText("Discover")
  await expect(page.getByRole("button", { name: "Deck", exact: true })).toHaveCount(0)
})

test("the empty state only offers what is available", async ({ page }) => {
  // No packs left and nothing skipped: filters and search are the ways forward.
  await page.goto("/?app-shell&current-game")
  const hint = page.getByText(/No games are showing right now/)
  await expect(hint).toHaveText("No games are showing right now. You can update your filters or search for a game.")

  // With packs left, the pack is offered too.
  await page.goto("/?app-shell&booster&packs&current-game")
  await page.getByRole("button", { name: "Back to recommendations" }).click()
  await expect(hint).toHaveText("No games are showing right now. You can open a booster pack, update your filters or search for a game.")
})
