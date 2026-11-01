import { test, expect } from "@playwright/test"

test("StandBy explicitly marks its visible elapsed time unverified during connection failure", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.evaluate(() => {
    window.standbyFixture.error = "Server unavailable"
    window.dispatchEvent(new Event("focus"))
  })
  await expect(dialog.getByRole("alert")).toContainText("Server unavailable")
  await expect(dialog.getByLabel("Unverified elapsed time", { exact: true })).toContainText("not verified")
  await expect(dialog.getByRole("button", { name: "Pause", exact: true })).toBeDisabled()
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
})
