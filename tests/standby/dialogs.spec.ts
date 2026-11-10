import { test, expect, type Page } from "@playwright/test"

// Every overlay is a labelled dialog: focus stays inside it, Escape closes it,
// focus goes back to the control that opened it, and the page behind is inert.
const overlays: { name: string; url: string; title: string; trigger: (page: Page) => ReturnType<Page["getByRole"]>; before?: (page: Page) => Promise<void> }[] = [
  { name: "End Session", url: "/?app-shell", title: "End Session", trigger: page => page.getByRole("button", { name: "End Session", exact: true }) },
  { name: "Game options", url: "/?app-shell&active-game", title: "Game options", trigger: page => page.getByRole("button", { name: "More options", exact: true }) },
  { name: "Update Filters", url: "/?app-shell&deck&current-game", title: "Update Filters", trigger: page => page.getByRole("button", { name: "Update filters", exact: true }) },
  {
    name: "Settings", url: "/?app-shell&current-game", title: "Settings",
    before: page => page.getByRole("button", { name: "Progress", exact: true }).click(),
    trigger: page => page.getByRole("button", { name: "Settings", exact: true }),
  },
]

for (const overlay of overlays) {
  test(`${overlay.name} is a labelled dialog that traps focus and closes on Escape`, async ({ page }) => {
    await page.goto(overlay.url)
    await overlay.before?.(page)
    const trigger = overlay.trigger(page)
    await trigger.click()

    const dialog = page.getByRole("dialog", { name: overlay.title, exact: true })
    await expect(dialog).toBeVisible()
    // The page behind is out of reach for assistive tech and the keyboard.
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0)
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab")
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    }

    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible()
  })
}

test("search is a labelled dialog that focuses its field and closes on Escape", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  await page.getByRole("button", { name: "Search for a game" }).click()
  const dialog = page.getByRole("dialog", { name: "Search for a game" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByPlaceholder("Search any game...")).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Search for a game" })).toBeVisible()
})

test("the beaten confirmation keeps the dialog and its label follows the question", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  await page.getByRole("button", { name: "I Beat This Game!", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Beat A Short Hike?" })).toBeVisible()

  // Escape leaves without ending anything.
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(await page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([])
  await expect(page.getByRole("button", { name: "End Session", exact: true })).toBeFocused()
})

test("Still playing? is a dialog, and Escape keeps the session running", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  // The prompt appears once a session runs well past the game's usual length, so move the
  // session's start back and let the next read pick it up.
  await page.evaluate(() => {
    const fixture = window.standbyFixture
    fixture.session = { ...fixture.session!, started_at: new Date(Date.now() - 95 * 60 * 1000).toISOString() }
    window.dispatchEvent(new Event("online"))
  })
  const dialog = page.getByRole("dialog", { name: "Still playing?" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Still Playing" })).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
})
