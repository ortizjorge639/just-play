import { test, expect, type Page } from "@playwright/test"

const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { standbyFixture: { emoteCalls: string[] } }).standbyFixture.emoteCalls)

const goHome = async (page: Page, query = "") => {
  await page.goto(`/?app-shell&residents${query}`)
  await page.getByRole("button", { name: "Home" }).click()
}

test("a wave shows one line and records the emote", async ({ page }) => {
  await goHome(page)
  await page.getByRole("button", { name: "Say hi to A Short Hike" }).click()
  await page.getByRole("button", { name: "Wave" }).click()
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toHaveCount(1)
  await expect(page.getByText(/^Last: Waved/)).toBeVisible()
  expect(await calls(page)).toEqual(["test-game:wave"])
})

test("the menu opens and closes by keyboard and returns focus", async ({ page }) => {
  await goHome(page)
  const trigger = page.getByRole("button", { name: "Say hi to A Short Hike" })
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("button", { name: "Wave" })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Wave" })).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(await calls(page)).toEqual([])
})

test("a failed save still shows the line and one quiet note", async ({ page }) => {
  await goHome(page, "&emote-fail")
  await page.getByRole("button", { name: "Say hi to A Short Hike" }).click()
  await page.getByRole("button", { name: "Rest" }).click()
  await expect(page.getByText("Couldn't save that one.")).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toHaveCount(1)
  await expect(page.getByText(/^Last:/)).toHaveCount(0)
})

test("the same emote gives the same line each time, and works with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await goHome(page)
  const status = page.getByRole("status").filter({ hasText: /\S/ })
  const pick = async () => {
    await page.getByRole("button", { name: "Say hi to A Short Hike" }).click()
    await page.getByRole("button", { name: "Celebrate" }).click()
    return status.textContent()
  }
  const first = await pick()
  expect(await pick()).toBe(first)
})

test("every emote is offered", async ({ page }) => {
  await goHome(page)
  await page.getByRole("button", { name: "Say hi to A Short Hike" }).click()
  for (const n of ["Wave", "Celebrate", "Rest", "Check in"]) {
    await expect(page.getByRole("button", { name: n })).toBeVisible()
  }
})
