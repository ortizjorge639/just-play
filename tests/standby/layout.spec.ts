import { test, expect, type Page } from "@playwright/test"

const phone = { width: 390, height: 844 }
const desktop = { width: 1440, height: 900 }
const nav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" })
const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test("navigation is a bottom bar on a phone", async ({ page }) => {
  await page.setViewportSize(phone)
  await page.goto("/?app-shell&deck&current-game")
  const box = (await nav(page).boundingBox())!
  expect(box.width).toBe(phone.width)
  expect(box.y + box.height).toBe(phone.height)
  expect(box.height).toBeLessThan(100)
  // The bar carries the product name on small screens.
  await expect(page.getByRole("banner").getByText("Just Play")).toBeVisible()
  expect(await noSidewaysScroll(page)).toBe(true)
})

test("navigation is a left rail on a desktop, and content starts beside it", async ({ page }) => {
  await page.setViewportSize(desktop)
  await page.goto("/?app-shell&deck&current-game")
  const rail = (await nav(page).boundingBox())!
  expect(rail.x).toBe(0)
  expect(rail.y).toBe(0)
  expect(rail.height).toBe(desktop.height)
  expect(rail.width).toBe(224)
  await expect(nav(page).getByText("Just Play")).toBeVisible()
  await expect(page.getByRole("banner").getByText("Just Play")).toBeHidden()

  // Items stack, and nothing in the page sits under the rail.
  const deck = (await nav(page).getByRole("button", { name: "Discover", exact: true }).boundingBox())!
  const home = (await nav(page).getByRole("button", { name: "Home", exact: true }).boundingBox())!
  expect(home.y).toBeGreaterThan(deck.y + deck.height - 1)
  expect((await page.getByRole("banner").boundingBox())!.x).toBe(rail.width)
  expect((await page.getByRole("heading", { name: "Choose a game" }).boundingBox())!.x).toBeGreaterThan(rail.width)
  expect(await noSidewaysScroll(page)).toBe(true)
})

test("the rail switches tabs and marks the current one", async ({ page }) => {
  await page.setViewportSize(desktop)
  await page.goto("/?app-shell&deck&current-game")
  await nav(page).getByRole("button", { name: "Home", exact: true }).click()
  await expect(nav(page).getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { name: /Completed games/ })).toBeVisible()
})

for (const [name, viewport] of [["phone", phone], ["desktop", desktop]] as const) {
  test(`Edit card is a ${name === "phone" ? "bottom sheet" : "centred dialog"} on a ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/?app-shell&current-game&card-library")
    await page.getByRole("button", { name: "Progress", exact: true }).click()
    await page.getByRole("button", { name: "Edit card" }).click()
    const box = (await page.getByRole("dialog").boundingBox())!
    if (name === "phone") {
      expect(box.width).toBe(viewport.width)
      expect(Math.round(box.y + box.height)).toBe(viewport.height)
    } else {
      expect(box.width).toBeLessThanOrEqual(512)
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
      expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1)
    }
  })
}

test("Settings is a readable column beside the rail on a desktop", async ({ page }) => {
  await page.setViewportSize(desktop)
  await page.goto("/?app-shell&current-game")
  await page.getByRole("button", { name: "Progress", exact: true }).click()
  await page.getByRole("button", { name: "Settings" }).click()
  const help = (await page.getByText(/Recording is set when a session starts/).boundingBox())!
  expect(help.width).toBeLessThanOrEqual(768)
  expect(help.x).toBeGreaterThan(224)
  // The rail stays on screen beside Settings (it is inert while the dialog is open).
  await expect(page.locator("nav")).toBeVisible()
})

test("the current game sits beside its actions on a desktop and above them on a phone", async ({ page }) => {
  await page.goto("/?app-shell&active-game")
  const card = page.getByTestId("game-flip-container")
  const start = page.getByRole("button", { name: "Start Today's Session", exact: true })

  await page.setViewportSize(desktop)
  let cardBox = (await card.boundingBox())!, startBox = (await start.boundingBox())!
  expect(startBox.x).toBeGreaterThan(cardBox.x + cardBox.width)
  expect(startBox.y).toBeLessThan(cardBox.y + cardBox.height)

  await page.setViewportSize(phone)
  cardBox = (await card.boundingBox())!
  startBox = (await start.boundingBox())!
  expect(startBox.y).toBeGreaterThan(cardBox.y + cardBox.height)
  expect(await noSidewaysScroll(page)).toBe(true)
})

test("Home and Progress share one content width on a desktop", async ({ page }) => {
  await page.setViewportSize(desktop)
  await page.goto("/?app-shell&current-game&completed-games")
  // Both pages centre a 1024px column in the space beside the rail. Tabs slide in, so poll.
  const left = 224 + (desktop.width - 224 - 1024) / 2 + 24
  const settledAt = (locator: ReturnType<Page["getByRole"]>) =>
    expect.poll(async () => Math.abs((await locator.boundingBox())!.x - left)).toBeLessThanOrEqual(1)
  await page.getByRole("button", { name: "Home", exact: true }).click()
  await settledAt(page.getByRole("heading", { name: /Completed games/ }))
  await page.getByRole("button", { name: "Progress", exact: true }).click()
  await settledAt(page.getByRole("region", { name: "Player profile" }))
})

test("search opens as a centred panel on a desktop and above the bar on a phone", async ({ page }) => {
  await page.goto("/?app-shell&deck&current-game")
  const open = page.getByRole("button", { name: "Search for a game" })
  const field = page.getByPlaceholder("Search any game...")

  await page.setViewportSize(desktop)
  await open.click()
  await expect(field).toBeFocused()
  const panel = (await field.locator("xpath=ancestor::div[contains(@class,'glass-card')]").boundingBox())!
  expect(panel.width).toBeLessThanOrEqual(576)
  expect(Math.abs(panel.x + panel.width / 2 - desktop.width / 2)).toBeLessThanOrEqual(13)
  expect(panel.y).toBeLessThan(desktop.height / 3)
  // The rail is dimmed with the rest of the page.
  expect(await page.evaluate(() => !document.elementFromPoint(40, 60)?.closest("nav"))).toBe(true)

  // Clicking the dimmed page closes search.
  await page.mouse.click(desktop.width / 2, desktop.height - 100)
  await expect(field).toHaveCount(0)
  await page.setViewportSize(phone)
  await open.click()
  // The bar slides up into place just above the bottom navigation.
  const bar = field.locator("xpath=ancestor::div[contains(@class,'glass-card')]")
  await expect.poll(async () => {
    const box = (await bar.boundingBox())!
    return box.y > phone.height / 2 && box.y + box.height <= phone.height - 64
  }).toBe(true)
})

test("tabs slide in without ever making a phone screen scroll sideways", async ({ page }) => {
  await page.setViewportSize(phone)
  // Record the widest the page gets on any frame, including mid-animation.
  await page.addInitScript(() => {
    const state = window as unknown as { widest: number }
    state.widest = 0
    const tick = () => {
      if (document.documentElement) state.widest = Math.max(state.widest, document.documentElement.scrollWidth - innerWidth)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto("/?app-shell&active-game")
  for (const tab of ["Home", "Progress", "Now Playing"]) {
    await page.getByRole("button", { name: tab, exact: true }).click()
    await expect(page.getByRole("button", { name: tab, exact: true })).toHaveAttribute("aria-current", "page")
    await page.waitForTimeout(400)
  }
  expect(await page.evaluate(() => (window as unknown as { widest: number }).widest)).toBe(0)
})
