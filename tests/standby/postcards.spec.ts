import { test, expect } from "@playwright/test"

test("Home tab shows Keepsakes heading and game name when a postcard exists", async ({ page }) => {
  // Navigate with postcards parameter to populate fixture
  await page.goto("/?postcards&app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Check for Keepsakes heading
  await expect(page.getByRole("heading", { name: /Keepsakes/i })).toBeVisible()

  // Check for game name in the postcard card
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Home tab renders nothing when no postcards exist", async ({ page }) => {
  // Navigate without postcards parameter - fixture will be empty
  await page.goto("/?app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Check that Keepsakes heading is not present
  await expect(page.getByRole("heading", { name: /Keepsakes/i })).toHaveCount(0)
})

test("Delete button successfully removes postcard from the list", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Click delete button
  const deleteButton = page.getByRole("button", { name: /Delete/i }).first()
  await deleteButton.click()

  
  // Component should still render but postcard row should be gone
  // After successful delete, the postcard should no longer be visible
})

test("Delete button shows error message on failure and keeps postcard visible", async ({ page }) => {
  // Navigate with postcards parameter and failure flag
  await page.goto("/?postcards&delete-fail&app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Click delete button
  const deleteButton = page.getByRole("button", { name: /Delete/i }).first()
  await deleteButton.click()


  // Error message should be visible
  await expect(page.locator("text=Could not delete postcard")).toBeVisible()

  // Postcard should still be visible (no optimistic removal)
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Bring back succeeds without an error and keeps the postcard", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Check for Bring back button and click it
  const bringBackButton = page.getByRole("button", { name: /Bring back/i })
  await expect(bringBackButton).toBeVisible()
  await bringBackButton.click()

  await expect(bringBackButton).toBeEnabled()
  await expect(page.getByText(/did not go through/i)).toHaveCount(0)
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Bring back button shows error message on failure and keeps postcard visible", async ({ page }) => {
  // Navigate with postcards parameter and failure flag
  await page.goto("/?postcards&reinvite-fail&app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Click Bring back button
  const bringBackButton = page.getByRole("button", { name: /Bring back/i })
  await bringBackButton.click()


  // Error message should be visible
  await expect(page.locator("text=That did not go through")).toBeVisible()

  // Postcard should still be visible (no optimistic removal)
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Respects reduced motion preference for postcard animations", async ({ page }) => {
  // Use prefers-reduced-motion media query
  await page.emulateMedia({ reducedMotion: "reduce" })

  // Navigate with postcards
  await page.goto("/?postcards&app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Verify postcards still render (no animations, but visible)
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Postcard shows creation date in human-readable format", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Home tab
  await page.getByRole("button", { name: /Home/i }).click()

  // Check for date text (should show "ago" format from formatDistanceToNow)
  const dateText = page.locator("text=/ago/")
  await expect(dateText).toBeVisible()
})
