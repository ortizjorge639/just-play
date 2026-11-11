import { test, expect, type Page } from "@playwright/test"

const nav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" })
const tabNames = (page: Page) => nav(page).getByRole("button").allTextContents()

test("Settings is in the top bar on every tab, and signing out lives inside it", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  for (const tab of ["Discover", "Home", "Progress"]) {
    await nav(page).getByRole("button", { name: tab, exact: true }).click()
    await expect(page.getByRole("banner").getByRole("button", { name: "Settings", exact: true })).toBeVisible()
    await expect(page.getByRole("banner").getByRole("button", { name: /Sign out/i })).toHaveCount(0)
  }
  await page.getByRole("banner").getByRole("button", { name: "Settings", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: /Sign out/i })).toBeVisible()
})

test("filters and session preferences no longer share an icon", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  const filtersIcon = await page.getByRole("button", { name: "Update filters", exact: true }).locator("path").getAttribute("d")
  await page.goto("/?app-shell")
  const preferences = page.getByRole("button", { name: "Session preferences", exact: true })
  await expect(preferences.locator("svg")).toHaveAttribute("data-icon", "clock")
  expect(await preferences.locator("path").getAttribute("d")).not.toBe(filtersIcon)
})

test("the navigation never offers an empty Session tab", async ({ page }) => {
  // Nothing in progress: Discover leads.
  await page.goto("/?app-shell&deck&current-game")
  expect(await tabNames(page)).toEqual(["Discover", "Home", "Progress"])
  // A game in progress: Now Playing takes Discover's place.
  await page.goto("/?app-shell&active-game")
  expect(await tabNames(page)).toEqual(["Now Playing", "Home", "Progress"])
  await page.goto("/?app-shell")
  expect(await tabNames(page)).toEqual(["Now Playing", "Home", "Progress"])
})

test("a game with no session running reads In progress, and its note sits below the actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?app-shell&active-game")
  const card = page.getByTestId("game-flip-container")
  await expect(card.getByText("In progress", { exact: true }).first()).toBeVisible()
  await expect(card.getByText("Playing", { exact: true })).toHaveCount(0)

  const start = page.getByRole("button", { name: "Start Today's Session", exact: true })
  await expect(start).toBeInViewport()
  const startBox = (await start.boundingBox())!
  const noteBox = (await page.getByTestId("move-in-note").boundingBox())!
  expect(noteBox.y).toBeGreaterThan(startBox.y + startBox.height)
})

test("an empty Home says what it is for and leads to Discover", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  await nav(page).getByRole("button", { name: "Home", exact: true }).click()
  await expect(page.getByText("No completed games yet.")).toBeVisible()
  await expect(page.getByText(/Home keeps the games you finish/)).toBeVisible()

  await page.getByRole("button", { name: "Find a game to play" }).click()
  await expect(nav(page).getByRole("button", { name: "Discover", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible()
})

test("an empty Home does not send you to Discover while a game is in progress", async ({ page }) => {
  await page.goto("/?app-shell&active-game")
  await nav(page).getByRole("button", { name: "Home", exact: true }).click()
  await expect(page.getByText("No completed games yet.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Find a game to play" })).toHaveCount(0)
})

test("Keepsakes has one name", async ({ page }) => {
  await page.goto("/?app-shell&current-game&postcards")
  await nav(page).getByRole("button", { name: "Home", exact: true }).click()
  const keepsakes = page.locator("details").filter({ hasText: "Keepsakes" })
  await keepsakes.locator("summary").click()
  await expect(keepsakes.getByText("A Short Hike")).toBeVisible()
  await expect(keepsakes.getByText("Archived", { exact: true })).toHaveCount(0)
})
