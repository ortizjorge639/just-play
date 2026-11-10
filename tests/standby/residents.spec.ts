import { test, expect } from "@playwright/test"
import { fixture } from "./mock-actions"

test("Resident note displays on active session screen when game has a resident", async ({ page }) => {
  // Navigate with residents parameter to populate fixture
  await page.goto("/?residents")

  // Look for resident note in session screen
  await expect(page.locator("text=This game has moved into your home")).toBeVisible()
})

test("Resident note does not display when game has no residents", async ({ page }) => {
  // Navigate without residents parameter
  await page.goto("/")

  // Resident note should not appear
  await expect(page.locator("text=This game has moved into your home")).toHaveCount(0)
})

async function beatGame(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  await page.getByRole("button", { name: "I Beat This Game!", exact: true }).click()
  await page.getByRole("button", { name: "Yes, I beat it", exact: true }).click()
}

test("Arrival card shows the first time a game is beaten", async ({ page }) => {
  await page.goto("/?app-shell")
  await beatGame(page)

  await expect(page.getByRole("heading", { name: /has moved in/ })).toBeVisible()
  await expect(page.getByText("You can find it on Home.")).toBeVisible()
  await page.getByRole("button", { name: "Got it" }).click()
  await expect(page.getByRole("heading", { name: /has moved in/ })).toHaveCount(0)
})

test("Arrival card does not show when the game was already a resident", async ({ page }) => {
  await page.goto("/?app-shell&residents")
  await beatGame(page)

  // The finished session is stored just before the page reloads.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("standby-test-finished-notes"))).not.toBeNull()
  // A finished session lands on Progress once the page is back.
  await expect(page.getByRole("region", { name: "Player profile" })).toBeVisible()
  await expect(page.getByRole("heading", { name: /has moved in/ })).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem("arrivedGame"))).toBeNull()
})

test("Arrival card is usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/?app-shell")
  await beatGame(page)

  await expect(page.getByRole("heading", { name: /has moved in/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Got it" })).toBeEnabled()
})

test("Missing residents table gracefully degrades", async ({ page }) => {
  // This would require mocking getResidents to return an error
  // For now, we verify the app doesn't crash when residents list is empty
  await page.goto("/")

  // Page should render normally even if residents table is missing
  await expect(page.getByRole("heading", { name: "A Short Hike" })).toBeVisible()
})

test("Home tab lists an arrival with its game name and date when a resident exists", async ({ page }) => {
  // Navigate with residents parameter to populate fixture
  await page.goto("/?residents&app-shell")

  await page.getByRole("button", { name: "Home", exact: true }).click()

  const arrivals = page.locator("section").filter({ has: page.getByRole("heading", { name: "Arrivals" }) })
  await expect(arrivals.getByRole("heading", { name: "Arrivals" })).toBeVisible()
  await expect(arrivals.getByText("A Short Hike")).toBeVisible()
  await expect(arrivals.locator("time")).toHaveText(/\w+ \d{1,2}, \d{4}/)
})

test("Home tab hides Lives here when no residents exist", async ({ page }) => {
  // Navigate without residents parameter - fixture will be empty
  await page.goto("/?app-shell")

  await page.getByRole("button", { name: /Home/i }).click()

  await expect(page.getByRole("heading", { name: "Lives here" })).toHaveCount(0)
})

test("beating a game from its card does not announce an arrival when it already lives on Home", async ({ page }) => {
  await page.goto("/?app-shell&active-game&deck&residents")
  await page.getByRole("button", { name: "More options", exact: true }).click()
  await page.getByRole("button", { name: "I Beat This Game!", exact: true }).click()
  await page.getByRole("button", { name: "Yes, I beat it", exact: true }).click()

  await expect(page.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { name: /has moved in/ })).toHaveCount(0)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`the arrival card is a centred card above the app chrome at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/?app-shell")
    await beatGame(page)

    const card = page.getByRole("heading", { name: /has moved in/ }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')]")
    await expect(card).toBeVisible()
    await expect(card).toHaveCSS("opacity", "1")
    const box = (await card.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(384)
    expect(box.height).toBeLessThan(viewport.height * 0.6)
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1)
    // The top bar and bottom navigation sit under the dialog, not over it.
    const covered = await page.evaluate(({ width, height }) => [[width / 2, 20], [width / 2, height - 20]].map(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('[role="dialog"]'),
    ), viewport)
    expect(covered).toEqual([true, true])

    // Clicking beside the card closes it.
    await page.mouse.click(8, viewport.height / 2)
    await expect(page.getByRole("heading", { name: /has moved in/ })).toHaveCount(0)
  })
}
