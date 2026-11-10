import { test, expect, type Page } from "@playwright/test"

// The top bar names the tab that is showing.
const tabLabel = (page: Page) => page.getByRole("banner").locator("p").nth(1)

// AppShell reloads after a session ends; the harness receipt is written just before that reload.
async function endSession(page: Page, choice: string) {
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  const action = page.getByRole("button", { name: choice })
  await expect(page.locator("div.rounded-t-3xl").filter({ has: action })).toHaveCSS("transform", "none")
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), action.click()])
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("standby-test-finished-notes"))).not.toBeNull()
}

for (const choice of ["Done for Today", "I Beat This Game!", "Abandon Game"]) {
  test(`${choice} lands on Progress after the reload`, async ({ page }) => {
    await page.goto("/?app-shell")
    await expect(tabLabel(page)).toHaveText("Now Playing")
    await endSession(page, choice)

    // Only a beaten game moves in; its card covers the page until dismissed.
    if (choice === "I Beat This Game!") {
      await expect(page.getByRole("heading", { name: /has moved in/ })).toBeVisible()
      await page.getByRole("button", { name: "Got it" }).click()
    }
    await expect(page.getByRole("heading", { name: /has moved in/ })).toHaveCount(0)
    await expect(tabLabel(page)).toHaveText("Progress")
    await expect(page.getByRole("region", { name: "Player profile" })).toBeVisible()
    // The handover is used once, so a later reload goes back to the default tab.
    expect(await page.evaluate(() => sessionStorage.getItem("landingTab"))).toBeNull()

    await page.reload()
    await expect(tabLabel(page)).toHaveText("Now Playing")
  })
}

test("a stale landing handover is discarded", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.evaluate(() => sessionStorage.setItem("landingTab", JSON.stringify({ tab: "progress", timestamp: Date.now() - 60000 })))
  await page.reload()

  await expect(page.getByRole("button", { name: "End Session", exact: true })).toBeVisible()
  await expect(tabLabel(page)).toHaveText("Now Playing")
  expect(await page.evaluate(() => sessionStorage.getItem("landingTab"))).toBeNull()
})

async function saveDeckWithFixtureGame(page: Page) {
  await page.evaluate(() => {
    const now = new Date()
    const fixtureGame = {
      id: "test-game", name: "A Short Hike", genres: ["Adventure"], estimated_session_length: 60,
      header_image: "/fixture-art.svg", description: "Explore at your own pace.",
      featured: true, source: "test", created_at: "2026-10-01T00:00:00Z",
    }
    localStorage.setItem("jp-deck", JSON.stringify({
      day: `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
      games: [fixtureGame, { ...fixtureGame, id: "deck-A", name: "Deck A" }],
    }))
  })
}

test("a saved deck drops a game that has since moved into Home", async ({ page }) => {
  await page.goto("/?app-shell&current-game&residents")
  await saveDeckWithFixtureGame(page)
  await page.reload()

  await expect(page.getByRole("heading", { name: "Deck A", level: 2 })).toBeVisible()
  await expect(page.getByRole("button", { name: /A Short Hike/ })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Deck A/ })).toHaveCount(1)
})

test("a saved deck keeps a game that is not on Home", async ({ page }) => {
  await page.goto("/?app-shell&current-game")
  await saveDeckWithFixtureGame(page)
  await page.reload()

  await expect(page.getByRole("heading", { name: "A Short Hike", level: 2 })).toBeVisible()
  await expect(page.getByRole("button", { name: /A Short Hike/ })).toHaveCount(1)
})

test("a saved deck with only a moved-in game falls back to the empty deck", async ({ page }) => {
  await page.goto("/?app-shell&current-game&residents")
  await saveDeckWithFixtureGame(page)
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("jp-deck")!)
    localStorage.setItem("jp-deck", JSON.stringify({ ...saved, games: saved.games.slice(0, 1) }))
  })
  await page.reload()

  await expect(page.getByRole("heading", { name: "No more games" })).toBeVisible()
})
