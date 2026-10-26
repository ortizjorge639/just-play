import { test, expect } from "@playwright/test"

const calls = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { standbyFixture: { stampCalls: string[] } }).standbyFixture.stampCalls)

test("an hours stamp under target shows progress and no button", async ({ page }) => {
  await page.goto("/?current-game&stamp-hours&played=120")
  await expect(page.getByText("2 of 10 hours")).toBeVisible()
  await expect(page.getByRole("button", { name: "Let it move in" })).toHaveCount(0)
})

test("an hours stamp at target offers the button, and confirming moves the game in once", async ({ page }) => {
  await page.goto("/?current-game&stamp-hours&played=600")
  await expect(page.getByText("You've played 10 hours.")).toBeVisible()
  await page.getByRole("button", { name: "Let it move in" }).click()
  await expect(page.getByRole("status").filter({ hasText: "A Short Hike moved in" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Let it move in" })).toHaveCount(0)
  expect(await calls(page)).toEqual(["confirm:test-game"])
})

test("a milestone shows the player's own mark and always offers the button", async ({ page }) => {
  await page.goto("/?current-game&stamp-milestone&played=5")
  await expect(page.getByText("Your own mark: Reached the second act")).toBeVisible()
  await page.getByRole("button", { name: "Let it move in" }).click()
  await expect(page.getByRole("status").filter({ hasText: "moved in" })).toBeVisible()
})

test("a failed confirm shows a plain message and keeps the button", async ({ page }) => {
  await page.goto("/?current-game&stamp-hours&played=600&stamp-confirm-fail")
  await page.getByRole("button", { name: "Let it move in" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "That did not go through. Try again." })).toBeVisible()
  await expect(page.getByRole("button", { name: "Let it move in" })).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "moved in" })).toHaveCount(0)
  expect(await calls(page)).toEqual([])
})

test("with no rule the game shows no done prompt and no per-game control", async ({ page }) => {
  await page.goto("/?current-game&played=120")
  await expect(page.getByRole("button", { name: "Let it move in" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /counts as done/ })).toHaveCount(0)
})

test("when a game is ready it asks if it is done, and Not yet puts it away", async ({ page }) => {
  await page.goto("/?current-game&stamp-hours&played=600")
  await expect(page.getByText("Is A Short Hike done?")).toBeVisible()
  await page.getByRole("button", { name: "Not yet" }).click()
  await expect(page.getByText("Is A Short Hike done?")).toHaveCount(0)
  expect(await calls(page)).toEqual([])
})

test("saving a rule in Settings that fails shows a plain message and does not say saved", async ({ page }) => {
  await page.goto("/?app-shell&stamp-save-fail")
  await page.getByRole("button", { name: /Progress/i }).click()
  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("radio", { name: "When I say so" }).check()
  await page.getByLabel("What counts as done enough?").fill("Beat the first boss")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Could not save that. Try again." })).toBeVisible()
  await expect(page.getByText("Saved.", { exact: true })).toHaveCount(0)
})

test("zero hours is refused before anything is sent", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: /Progress/i }).click()
  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("radio", { name: "After a set number of hours" }).check()
  await page.getByRole("spinbutton", { name: "Hours" }).fill("0")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Pick a number of hours above zero." })).toBeVisible()
  expect(await calls(page)).toEqual([])
})

test("Settings has the default rule and saving it sends the default", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: /Progress/i }).click()
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByText("When does a game count as done?")).toBeVisible()
  await expect(page.getByRole("radio", { name: "When I mark it beaten" })).toBeChecked()
  await page.getByRole("radio", { name: "After a set number of hours" }).check()
  await page.getByRole("spinbutton", { name: "Hours" }).fill("5")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible()
  expect(await calls(page)).toEqual(["set:default:hours"])
})

test("Settings shows the saved default rule", async ({ page }) => {
  await page.goto("/?app-shell&stamp-hours")
  await page.getByRole("button", { name: /Progress/i }).click()
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("radio", { name: "After a set number of hours" })).toBeChecked()
  await expect(page.getByRole("spinbutton", { name: "Hours" })).toHaveValue("10")
})

test("the move-in note shows once and stays dismissed", async ({ page }) => {
  await page.goto("/?current-game&played=120")
  const note = page.getByTestId("move-in-note")
  await expect(note).toContainText("moves into your settlement as a resident")
  await note.getByRole("button", { name: "Got it" }).click()
  await expect(note).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId("move-in-note")).toHaveCount(0)
})

test("Not for me removes the top card and tells the engine", async ({ page }) => {
  await page.goto("/?app-shell&current-game&deck")
  await page.getByRole("button", { name: /Not for me/ }).click()
  await expect.poll(() => calls(page)).toEqual(["skip:deck-B"])
  await page.getByRole("button", { name: /Not for me/ }).click()
  await expect.poll(() => calls(page)).toEqual(["skip:deck-B", "skip:deck-A"])
})

test("a failed Not for me keeps the card and says so plainly", async ({ page }) => {
  await page.goto("/?app-shell&current-game&deck&skip-fail")
  await page.getByRole("button", { name: /Not for me/ }).click()
  await expect(page.getByText("Could not save that. Try again.")).toBeVisible()
  await expect(page.getByRole("button", { name: /Not for me/ })).toBeVisible()
  expect(await calls(page)).toEqual([])
})

test("Settings can clear the skipped games", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: /Progress/i }).click()
  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("button", { name: "Clear my skipped games" }).click()
  await expect(page.getByText("Cleared. Those games can show up again.")).toBeVisible()
  expect(await calls(page)).toEqual(["skip-clear"])
})
