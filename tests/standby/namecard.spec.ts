import { test, expect, type Page } from "@playwright/test"

const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { standbyFixture: { cardCalls: unknown[] } }).standbyFixture.cardCalls)

const openEditor = async (page: Page) => {
  await page.getByRole("button", { name: /Progress/i }).click()
  await page.getByRole("button", { name: "Edit card" }).click()
}

test("an empty card shows the name and a quiet edit link, nothing else", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: /Progress/i }).click()
  await expect(page.getByRole("heading", { name: "Player" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit card" })).toBeVisible()
  await expect(page.getByLabel("Favorite games")).toHaveCount(0)
})

test("a filled card shows tagline, play style and favorites", async ({ page }) => {
  await page.goto("/?app-shell&card-filled&card-library")
  await page.getByRole("button", { name: /Progress/i }).click()
  await expect(page.getByText("Slow games, long evenings")).toBeVisible()
  await expect(page.getByText("Cozy and unhurried")).toBeVisible()
  await expect(page.getByLabel("Favorite games").getByText("Library A")).toBeVisible()
})

test("saving updates the card and sends trimmed-ready input", async ({ page }) => {
  await page.goto("/?app-shell&card-library")
  await openEditor(page)
  await page.getByLabel("Name").fill("Mara")
  await page.getByLabel("Tagline").fill("Back after work")
  await page.getByRole("button", { name: "Add Library B" }).click()
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("heading", { name: "Mara" })).toBeVisible()
  await expect(page.getByText("Back after work")).toBeVisible()
  expect(await calls(page)).toEqual([
    { displayName: "Mara", tagline: "Back after work", playStyle: "", favoriteGameIds: ["lib-b"] },
  ])
})

test("a failed save shows one plain line and keeps what was typed", async ({ page }) => {
  await page.goto("/?app-shell&card-save-fail")
  await openEditor(page)
  await page.getByLabel("Name").fill("Mara")
  await page.getByLabel("Tagline").fill("Keep me")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't save your card. Try again." })).toBeVisible()
  await expect(page.getByLabel("Tagline")).toHaveValue("Keep me")
})

test("fields stop at their limits and show a live count", async ({ page }) => {
  await page.goto("/?app-shell")
  await openEditor(page)
  await page.getByLabel("Name").fill("x".repeat(60))
  await page.getByLabel("Tagline").fill("y".repeat(250))
  await page.getByLabel("How you play").fill("z".repeat(100))
  await expect(page.getByText("50/50")).toBeVisible()
  await expect(page.getByText("200/200")).toBeVisible()
  await expect(page.getByText("80/80")).toBeVisible()
})

test("favorites stop at three and can be removed", async ({ page }) => {
  await page.goto("/?app-shell&card-library")
  await openEditor(page)
  for (const n of ["Library A", "Library B", "Library C"]) {
    await page.getByRole("button", { name: `Add ${n}` }).click()
  }
  await expect(page.getByRole("searchbox", { name: "Search your games" })).toHaveCount(0)
  await page.getByRole("button", { name: "Remove Library B" }).click()
  await expect(page.getByRole("searchbox", { name: "Search your games" })).toBeVisible()
})

test("an empty name is rejected before saving", async ({ page }) => {
  await page.goto("/?app-shell")
  await openEditor(page)
  await page.getByLabel("Name").fill("   ")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("alert")).toBeVisible()
})

test("the editor is reachable from Settings and works by keyboard", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: /Progress/i }).click()
  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("button", { name: "Edit name card" }).click()
  await expect(page.getByRole("dialog", { name: "Edit card" })).toBeVisible()
  await page.getByLabel("Name").fill("Kit")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
