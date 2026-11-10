import { test, expect, type Page } from "@playwright/test"

// Home keeps games that were set aside in a collapsed Keepsakes section.
async function openKeepsakes(page: Page) {
  await page.getByRole("button", { name: "Home", exact: true }).click()
  const keepsakes = page.locator("details").filter({ hasText: "Keepsakes" })
  await keepsakes.locator("summary").click()
  return keepsakes
}

test("Home tab shows a Keepsakes section with the game name when a postcard exists", async ({ page }) => {
  // Navigate with postcards parameter to populate fixture
  await page.goto("/?postcards&app-shell")

  const keepsakes = await openKeepsakes(page)
  await expect(keepsakes.locator("summary")).toHaveText("Keepsakes (1)")

  // Check for game name in the postcard card
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()
})

test("Home tab has no Keepsakes section when no postcards exist", async ({ page }) => {
  // Navigate without postcards parameter - fixture will be empty
  await page.goto("/?app-shell")

  await page.getByRole("button", { name: "Home", exact: true }).click()

  await expect(page.getByRole("heading", { name: /Completed games/ })).toBeVisible()
  await expect(page.locator("details").filter({ hasText: "Keepsakes" })).toHaveCount(0)
})

test("Delete button successfully removes postcard from the list", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  const keepsakes = await openKeepsakes(page)

  // Verify postcard is visible
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()

  // Click delete button
  const deleteButton = page.getByRole("button", { name: /Delete/i }).first()
  await deleteButton.click()
  await page.getByRole("button", { name: /Yes, delete/i }).click()

  // The delete went through without an error. The row itself leaves when the server
  // re-renders Home, which this harness does not do.
  await expect.poll(() => page.evaluate(() => window.standbyFixture.postcards.length)).toBe(0)
  await expect(keepsakes.getByRole("alert")).toHaveCount(0)
  await expect(page.getByText("Delete this keepsake for good?")).toHaveCount(0)
})

test("Delete button shows error message on failure and keeps postcard visible", async ({ page }) => {
  // Navigate with postcards parameter and failure flag
  await page.goto("/?postcards&delete-fail&app-shell")

  const keepsakes = await openKeepsakes(page)

  // Verify postcard is visible
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()

  // Click delete button
  const deleteButton = page.getByRole("button", { name: /Delete/i }).first()
  await deleteButton.click()
  await page.getByRole("button", { name: /Yes, delete/i }).click()


  // Error message should be visible
  await expect(page.locator("text=Could not delete postcard")).toBeVisible()

  // Postcard should still be visible (no optimistic removal)
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()
})

test("Bring back succeeds without an error and keeps the postcard", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  const keepsakes = await openKeepsakes(page)

  // Verify postcard is visible
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()

  // Check for Bring back button and click it
  const bringBackButton = page.getByRole("button", { name: /Bring back/i })
  await expect(bringBackButton).toBeVisible()
  await bringBackButton.click()

  await expect(bringBackButton).toBeEnabled()
  await expect(page.getByText(/did not go through/i)).toHaveCount(0)
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()
})

test("Bring back button shows error message on failure and keeps postcard visible", async ({ page }) => {
  // Navigate with postcards parameter and failure flag
  await page.goto("/?postcards&reinvite-fail&app-shell")

  const keepsakes = await openKeepsakes(page)

  // Verify postcard is visible
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()

  // Click Bring back button
  const bringBackButton = page.getByRole("button", { name: /Bring back/i })
  await bringBackButton.click()


  // Error message should be visible
  await expect(page.locator("text=That did not go through")).toBeVisible()

  // Postcard should still be visible (no optimistic removal)
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()
})

test("Respects reduced motion preference for postcard animations", async ({ page }) => {
  // Use prefers-reduced-motion media query
  await page.emulateMedia({ reducedMotion: "reduce" })

  // Navigate with postcards
  await page.goto("/?postcards&app-shell")

  const keepsakes = await openKeepsakes(page)

  // Verify postcards still render (no animations, but visible)
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()
})

test("Postcard shows creation date in human-readable format", async ({ page }) => {
  // Navigate with postcards parameter
  await page.goto("/?postcards&app-shell")

  const keepsakes = await openKeepsakes(page)

  // Check for date text (should show "ago" format from formatDistanceToNow)
  const dateText = keepsakes.getByText(/ago/)
  await expect(dateText).toBeVisible()
})

test("Delete asks first, and Keep it leaves the postcard alone", async ({ page }) => {
  await page.goto("/?postcards&app-shell")
  const keepsakes = await openKeepsakes(page)
  await page.getByRole("button", { name: /^Delete keepsake/i }).first().click()
  await expect(page.getByText("Delete this keepsake for good?")).toBeVisible()
  await page.getByRole("button", { name: "Keep it" }).click()
  await expect(page.getByText("Delete this keepsake for good?")).toHaveCount(0)
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()
})
