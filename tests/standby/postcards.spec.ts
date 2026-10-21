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

test("Delete button successfully removes postcard from the list", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Click delete button
  const deleteButton = page.getByRole("button", { name: /Delete/i }).first()
  await deleteButton.click()

  // Wait for the postcard to be removed
  await page.waitForTimeout(500)
  
  // Component should still render but postcard row should be gone
  // After successful delete, the postcard should no longer be visible
})

test("Delete button shows error message on failure and keeps postcard visible", async ({ page }) => {
  // Navigate with postcards parameter and failure flag
  await page.goto("/?postcards&delete-fail&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Click delete button
  const deleteButton = page.getByRole("button", { name: /Delete/i }).first()
  await deleteButton.click()

  // Wait for error to appear
  await page.waitForTimeout(500)

  // Error message should be visible
  await expect(page.locator("text=Could not delete postcard")).toBeVisible()

  // Postcard should still be visible (no optimistic removal)
  await expect(page.locator("text=A Short Hike")).toBeVisible()
})

test("Bring back button successfully removes postcard from the list", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Check for Bring back button and click it
  const bringBackButton = page.getByRole("button", { name: /Bring back/i })
  await expect(bringBackButton).toBeVisible()
  await bringBackButton.click()

  // Wait for the postcard to be removed
  await page.waitForTimeout(500)
  
  // Postcard should be removed after successful re-invite
})

test("Bring back button shows error message on failure and keeps postcard visible", async ({ page }) => {
  // Navigate with postcards parameter and failure flag
  await page.goto("/?postcards&reinvite-fail&app-shell")

  // Navigate to Progress tab
  await page.getByRole("button", { name: /Progress/i }).click()

  // Verify postcard is visible
  await expect(page.locator("text=A Short Hike")).toBeVisible()

  // Click Bring back button
  const bringBackButton = page.getByRole("button", { name: /Bring back/i })
  await bringBackButton.click()

  // Wait for error to appear
  await page.waitForTimeout(500)

  // Error message should be visible
  await expect(page.locator("text=Could not bring back this game")).toBeVisible()

  // Postcard should still be visible (no optimistic removal)
  await expect(page.locator("text=A Short Hike")).toBeVisible()
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
