import { test, expect } from "@playwright/test"

test("Home shows a calm empty state when nothing lives here yet", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: "Home" }).click()

  await expect(page.getByText("Games you finish will live here.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Lives here" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Keepsakes" })).toHaveCount(0)
})

test("Home tab is announced as the current page and Progress no longer lists residents", async ({ page }) => {
  await page.goto("/?app-shell&residents&postcards")
  const home = page.getByRole("button", { name: "Home" })
  await home.click()
  await expect(home).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { name: "Lives here" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Keepsakes" })).toBeVisible()

  await page.getByRole("button", { name: /Progress/i }).click()
  await expect(page.getByRole("heading", { name: "Lives here" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Keepsakes" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Residents" })).toHaveCount(0)
})

test("Home is reachable by keyboard", async ({ page }) => {
  await page.goto("/?app-shell")
  const home = page.getByRole("button", { name: "Home" })
  await home.focus()
  await page.keyboard.press("Enter")
  await expect(home).toHaveAttribute("aria-current", "page")
})
