import { test, expect, type Page } from "@playwright/test"

// The top bar names the tab that is showing.
const tabLabel = (page: Page) => page.getByRole("banner").locator("p").nth(1)

// AppShell reloads after a session ends; the harness receipt is written just before that reload.
async function endSession(page: Page, choice: string) {
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  const action = page.getByRole("button", { name: choice })
  await expect(page.locator("div.rounded-t-3xl").filter({ has: action })).toHaveCSS("transform", "none")
  // Beating a game asks once before it commits.
  const commit = choice === "I Beat This Game!" ? page.getByRole("button", { name: "Yes, I beat it", exact: true }) : action
  if (commit !== action) await action.click()
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), commit.click()])
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("standby-test-finished-notes"))).not.toBeNull()
}

const landingCookie = (page: Page) => page.evaluate(() => document.cookie.includes("jp-landing="))

// Records what the top bar and the XP toast show on every frame of the current page load.
function recordFrames() {
  const frames: { label: string | null; toast: boolean }[] = []
  ;(window as unknown as { landingFrames: typeof frames }).landingFrames = frames
  const tick = () => {
    const label = document.querySelectorAll("header p")[1]?.textContent ?? null
    const toast = /\+\d+ XP/.test(document.body?.innerText ?? "")
    const last = frames[frames.length - 1]
    if (!last || last.label !== label || last.toast !== toast) frames.push({ label, toast })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { landingFrames: { label: string | null; toast: boolean }[] }).landingFrames)

for (const choice of ["Done for Today", "I Beat This Game!", "Set Game Aside"]) {
  test(`${choice} lands on Progress after the reload`, async ({ page }) => {
    await page.addInitScript(recordFrames)
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
    // The page comes back already on Progress: no other tab is shown first.
    expect((await frames(page)).map(frame => frame.label).filter(Boolean)).toEqual(["Progress"])
    // The landing is used once, so a later reload goes back to the default tab.
    expect(await landingCookie(page)).toBe(false)

    await page.reload()
    await expect(tabLabel(page)).toHaveText("Now Playing")
  })
}

test("the reload request carries the landing to the server", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  const action = page.getByRole("button", { name: "Done for Today" })
  await expect(page.locator("div.rounded-t-3xl").filter({ has: action })).toHaveCSS("transform", "none")
  const [request] = await Promise.all([page.waitForRequest(candidate => candidate.isNavigationRequest()), action.click()])

  expect((await request.allHeaders()).cookie).toContain("jp-landing=progress")
})

test("an unrecognised landing value is ignored and cleared", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "jp-landing", value: "home", url: baseURL! }])
  await page.goto("/?app-shell")

  await expect(tabLabel(page)).toHaveText("Now Playing")
  await expect.poll(() => landingCookie(page)).toBe(false)
})

for (const choice of ["Done for Today", "I Beat This Game!"]) {
  test(`the XP toast cut off by ${choice} is shown again after the reload`, async ({ page }) => {
    await page.addInitScript(recordFrames)
    await page.goto("/?app-shell")
    await endSession(page, choice)

    await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible()
    await expect(page.getByText(/^\+\d+ XP$/)).toHaveCount(0)
    // Once it has finished it is not replayed by a later reload.
    expect(await page.evaluate(() => sessionStorage.getItem("pendingXPToast"))).toBeNull()
    await page.reload()
    await expect(tabLabel(page)).toHaveText("Now Playing")
    await page.waitForTimeout(500)
    expect((await frames(page)).some(frame => frame.toast)).toBe(false)
  })
}

test("setting a game aside awards no XP toast before or after the reload", async ({ page }) => {
  await page.addInitScript(recordFrames)
  await page.goto("/?app-shell")
  await endSession(page, "Set Game Aside")

  await expect(tabLabel(page)).toHaveText("Progress")
  await page.waitForTimeout(500)
  expect((await frames(page)).some(frame => frame.toast)).toBe(false)
})

test("a stale interrupted toast is discarded", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.evaluate(() => sessionStorage.setItem("pendingXPToast", JSON.stringify({
    data: { total: 5, bonuses: [] }, levelUp: false, timestamp: Date.now() - 60000,
  })))
  await page.addInitScript(recordFrames)
  await page.reload()

  await expect(tabLabel(page)).toHaveText("Now Playing")
  await page.waitForTimeout(500)
  expect((await frames(page)).some(frame => frame.toast)).toBe(false)
  expect(await page.evaluate(() => sessionStorage.getItem("pendingXPToast"))).toBeNull()
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

// End to end: ?persist-end keeps the session ended across the reload, as the server would.
const deckButtons = (page: Page) => page.getByRole("list").getByRole("button")

test("a beaten game is gone from the saved deck once it has moved in", async ({ page }) => {
  await page.goto("/?app-shell&persist-end")
  await saveDeckWithFixtureGame(page)
  await endSession(page, "I Beat This Game!")
  await page.getByRole("button", { name: "Got it" }).click()
  await expect(tabLabel(page)).toHaveText("Progress")

  await page.getByRole("button", { name: "Deck", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Deck A", level: 2 })).toBeVisible()
  await expect(deckButtons(page)).toHaveCount(1)
  await expect(page.getByRole("button", { name: /A Short Hike/ })).toHaveCount(0)
})

test("a game set aside stays in the saved deck", async ({ page }) => {
  await page.goto("/?app-shell&persist-end")
  await saveDeckWithFixtureGame(page)
  await endSession(page, "Set Game Aside")
  await expect(tabLabel(page)).toHaveText("Progress")

  await page.getByRole("button", { name: "Deck", exact: true }).click()
  await expect(page.getByRole("heading", { name: "A Short Hike", level: 2 })).toBeVisible()
  await expect(deckButtons(page)).toHaveCount(2)
})

test("Done for Today keeps the game as the current game instead of reopening the deck", async ({ page }) => {
  await page.goto("/?app-shell&persist-end")
  await saveDeckWithFixtureGame(page)
  await endSession(page, "Done for Today")
  await expect(tabLabel(page)).toHaveText("Progress")

  await expect(page.getByRole("button", { name: "Deck", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Now Playing", exact: true }).click()
  await expect(page.getByRole("button", { name: /Start Today.s Session/ })).toBeVisible()
})
