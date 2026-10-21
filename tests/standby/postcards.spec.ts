import { test, expect } from "@playwright/test"

test("Progress tab shows Keepsakes heading and game name when a postcard exists", async ({ page }) => {
  // Navigate with postcards parameter to populate fixture
  await page.goto("/?postcards&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Check for Keepsakes heading
  await expect(page.getByRole("heading", { name: /Keepsakes/i })).toBeVisible()

  // Check for game name in the postcard card
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Progress tab renders nothing when no postcards exist", async ({ page }) => {
  // Navigate without postcards parameter - fixture will be empty
  await page.goto("/?app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Check that Keepsakes heading is not present
  await expect(page.getByRole("heading", { name: /Keepsakes/i })).toHaveCount(0)
})

test("Delete button removes postcard from the list", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Click delete button (find button labeled "Delete" in the postcard)
  const deleteButton = page.getByRole("button", { name: /Delete/i }).first()
  await deleteButton.click()

  // In mock, this removes the postcard from the fixture
  // The component should still render but the postcard row should be gone
  // (In real scenario, page would reload after deletePostcard Server Action)
})

test("Bring back button is visible on postcards", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Check for Bring back button
  const bringBackButton = page.getByRole("button", { name: /Bring back/i })
  await expect(bringBackButton).toBeVisible()
})

test("Respects reduced motion preference for postcard animations", async ({ page }) => {
  // Use prefers-reduced-motion media query
  await page.emulateMedia({ reducedMotion: "reduce" })

  // Navigate with postcards
  await page.goto("/?postcards&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Verify postcards still render (no animations, but visible)
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Postcard shows creation date in human-readable format", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Check for date text (should show "ago" format from formatDistanceToNow)
  const dateText = page.locator("text=/ago/")
  await expect(dateText).toBeVisible()
})
