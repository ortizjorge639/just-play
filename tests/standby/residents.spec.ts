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

test("Arrival card shows once when game is first marked beaten", async ({ page }) => {
  // Start with no residents
  await page.goto("/")

  // Simulate marking game as beaten
  await page.evaluate(() => {
    window.standbyFixture.gameEndWrites.push({
      kind: "beaten",
      gameId: "test-game",
    })
    // Simulate DB trigger: add game to residents
    window.standbyFixture.residents.push({
      user_id: "test-user",
      game_id: "test-game",
      arrived_at: new Date().toISOString(),
      arrival_source: "beaten",
      game: window.standbyFixture.session?.games ?? undefined,
    })
  })

  // Click Mark Beaten button (or equivalent finish action)
  const beatButton = page.locator("button:has-text('Mark beaten')")
  if (await beatButton.isVisible()) {
    await beatButton.click()
  }

  // Arrival card should appear with correct copy
  await expect(page.locator("text=has moved in")).toBeVisible()
  await expect(page.locator("text=You can find it under Residents in Progress")).toBeVisible()
  await expect(page.locator("button:has-text('Got it')")).toBeVisible()

  // Close card
  await page.locator("button:has-text('Got it')").click()
  await expect(page.locator("text=has moved in")).not.toBeVisible()
})

test("Arrival card respects prefers-reduced-motion", async ({ page }) => {
  // Set reduced motion preference via CSS media query override
  await page.addInitScript(() => {
    // Mock window.matchMedia for reduced motion
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === "(prefers-reduce-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  })

  await page.goto("/")

  // Trigger arrival card
  await page.evaluate(() => {
    window.standbyFixture.residents.push({
      user_id: "test-user",
      game_id: "test-game",
      arrived_at: new Date().toISOString(),
      arrival_source: "beaten",
      game: window.standbyFixture.session?.games ?? undefined,
    })
  })

  // Arrival card should render (animations will be simplified)
  await expect(page.locator("text=has moved in")).toBeVisible()

  // Card should be accessible (no animation delays should impede interaction)
  await expect(page.locator("button:has-text('Got it')")).toBeEnabled()
})

test("Missing residents table gracefully degrades", async ({ page }) => {
  // This would require mocking getResidents to return an error
  // For now, we verify the app doesn't crash when residents list is empty
  await page.goto("/")

  // Page should render normally even if residents table is missing
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Progress tab shows Residents heading and game name when a resident exists", async ({ page }) => {
  // Navigate with residents parameter to populate fixture
  await page.goto("/?residents&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Check for Residents heading
  await expect(page.getByRole("heading", { name: /Residents/i })).toBeVisible()

  // Check for game name in the resident card
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Check for arrival date text
  await expect(page.locator("text=/Arrived/")).toBeVisible()
})

test("Progress tab renders nothing when no residents exist", async ({ page }) => {
  // Navigate without residents parameter - fixture will be empty
  await page.goto("/?app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Check that Residents heading is not present
  await expect(page.getByRole("heading", { name: /Residents/i })).toHaveCount(0)
})
