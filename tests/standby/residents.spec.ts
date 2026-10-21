import { test, expect } from "@playwright/test"

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
