import { test, expect } from "@playwright/test"

test("Home shows a calm empty state when nothing lives here yet", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: "Home" }).click()

  await expect(page.getByText("Games you finish will live here.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Lives here" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Archived" })).toHaveCount(0)
})

test("With no homes, the settlement shows a first home plot and a way back", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "See your settlement" }).click()
  const layer = page.getByRole("dialog", { name: "Your settlement" })
  await expect(layer).toBeVisible()
  await expect(layer.getByRole("heading", { name: "Your first home goes here" })).toBeVisible()
  await expect(layer.getByTestId("first-home-plot")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(layer).toHaveCount(0)
})

test("Home tab is announced as the current page and Progress no longer lists residents", async ({ page }) => {
  await page.goto("/?app-shell&residents&postcards")
  const home = page.getByRole("button", { name: "Home" })
  await home.click()
  await expect(home).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { name: "Lives here" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible()

  await page.getByRole("button", { name: /Progress/i }).click()
  await expect(page.getByRole("heading", { name: "Lives here" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Archived" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Residents" })).toHaveCount(0)
})

test("Home is reachable by keyboard", async ({ page }) => {
  await page.goto("/?app-shell")
  const home = page.getByRole("button", { name: "Home" })
  await home.focus()
  await page.keyboard.press("Enter")
  await expect(home).toHaveAttribute("aria-current", "page")
})

test("Home says how many homes sit on how many decks", async ({ page }) => {
  await page.goto("/?app-shell&residents")
  await page.getByRole("button", { name: "Home" }).click()
  await expect(page.getByText(/^\d+ homes? on \d+ decks?$/)).toBeVisible()
})

test("Settlement toggle draws the 3D settlement and returns to the list", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  const list = page.getByRole("button", { name: "List" })
  const settlement = page.getByRole("button", { name: "Settlement" })
  await expect(list).toHaveAttribute("aria-pressed", "true")

  await settlement.click()
  await expect(settlement).toHaveAttribute("aria-pressed", "true")
  const scene = page.getByRole("group", { name: /^Settlement with 7 homes on 2 decks/ })
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await expect(scene.locator("canvas")).toHaveCount(1)

  await page.getByRole("button", { name: "Back to Home" }).click()
  await expect(page.getByTestId("settlement-3d")).toHaveCount(0)
  await expect(list).toHaveAttribute("aria-pressed", "true")
  await expect(settlement).toBeFocused()
})

test("Settlement takes the whole screen, with a way back", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const layer = page.getByRole("dialog", { name: "Your settlement" })
  await expect(layer).toBeVisible()
  const viewport = page.viewportSize()!
  const box = await layer.boundingBox()
  expect(Math.abs(box!.width - viewport.width)).toBeLessThan(2)
  expect(Math.abs(box!.height - viewport.height)).toBeLessThan(2)
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  const sceneBox = await scene.boundingBox()
  expect(sceneBox!.width).toBeGreaterThan(viewport.width - 2)
  expect(sceneBox!.height).toBeGreaterThan(viewport.height * 0.4)

  await expect(page.getByRole("button", { name: "Back to Home" })).toBeFocused()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab")
    expect(await layer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press("Escape")
  await expect(layer).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Settlement" })).toBeFocused()
})

test("Settlement header shows whose it is, and a hint shows once", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&card-filled")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const layer = page.getByRole("dialog", { name: "Your settlement" })
  await expect(layer.getByText("Slow games, long evenings")).toBeVisible()
  const hint = layer.getByText("Tap a home to see who lives there. Drag to look around.")
  await expect(hint).toBeVisible()
  await layer.getByRole("button", { name: "Got it" }).click()
  await expect(hint).toHaveCount(0)

  await page.getByRole("button", { name: "Back to Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  await expect(layer).toBeVisible()
  await expect(hint).toHaveCount(0)
})

test("Picking a home also clears the hint", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const hint = page.getByText("Tap a home to see who lives there. Drag to look around.")
  await expect(hint).toBeVisible()
  await page.getByRole("list", { name: "Homes" }).getByRole("button", { name: "Home 3" }).click()
  await expect(hint).toHaveCount(0)
})

test("The 2D fallback scrolls inside the full-screen layer", async ({ page }) => {
  await page.route("**/canopy/hearth-deck-*.glb", (route) => route.abort())
  await page.setViewportSize({ width: 390, height: 500 })
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const deck2 = page.getByRole("region", { name: "Deck 2" })
  await deck2.scrollIntoViewIfNeeded()
  await expect(deck2).toBeInViewport()
})

test("Settlement falls back to the 2D deck map when the art cannot load", async ({ page }) => {
  await page.route("**/canopy/hearth-deck-*.glb", (route) => route.abort())
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  await expect(page.getByRole("region", { name: "Deck 1" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Deck 2" })).toBeVisible()
  await expect(page.getByTestId("settlement-view")).toBeVisible()
  await expect(page.getByTestId("settlement-3d")).toHaveCount(0)
})

test("Settlement view can be moved and zoomed from the keyboard", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await scene.focus()
  const zoom0 = await scene.getAttribute("data-zoom")
  const pan0 = await scene.getAttribute("data-pan")
  expect(zoom0).toBe("1.000")
  await page.keyboard.press("+")
  await expect(scene).toHaveAttribute("data-zoom", "1.250")
  await page.keyboard.press("-")
  await expect(scene).toHaveAttribute("data-zoom", "1.000")
  await page.keyboard.press("ArrowLeft")
  await expect(scene).not.toHaveAttribute("data-pan", pan0!)
  await page.keyboard.press("+")
  await page.keyboard.press("0")
  await expect(scene).toHaveAttribute("data-zoom", zoom0!)
  await expect(scene).toHaveAttribute("data-pan", pan0!)
})

test("Settlement view keeps filling its card when the window resizes", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  for (const size of [{ width: 390, height: 800 }, { width: 1100, height: 700 }]) {
    await page.setViewportSize(size)
    await expect(async () => {
      const host = await scene.boundingBox()
      const canvas = await scene.locator("canvas").boundingBox()
      expect(host!.width).toBeGreaterThan(0)
      expect(Math.abs(canvas!.width - host!.width)).toBeLessThan(2)
      expect(Math.abs(canvas!.height - host!.height)).toBeLessThan(2)
    }).toPass({ timeout: 3000 })
  }
})

test("Settlement homes can be picked from the list and show who lives there", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const chip = page.getByRole("list", { name: "Homes" }).getByRole("button", { name: "Home 3" })
  await chip.click()
  await expect(chip).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("heading", { name: "Home 3" })).toBeVisible()
  await chip.click()
  await expect(page.getByRole("heading", { name: "Home 3" })).toHaveCount(0)
})

test("Tapping a home in the 3D settlement shows who lives there, dragging does not", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  const box = (await scene.boundingBox())!
  const heading = page.getByRole("heading", { level: 3, name: /^Home \d$/ })

  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 5 })
  await page.mouse.up()
  await expect(heading).toHaveCount(0)

  for (let y = 12; y < box.height && !(await heading.count()); y += 14) {
    for (let x = 12; x < box.width && !(await heading.count()); x += 14) {
      await page.mouse.click(box.x + x, box.y + y)
    }
  }
  await expect(heading).toHaveCount(1)
})

test("Deeper play adds companions to the settlement and a quiet line to the portrait", async ({ page }) => {
  await page.goto("/?app-shell&residents-tiers")
  await page.getByRole("button", { name: "Home" }).click()
  await expect(page.getByText("Settled", { exact: true })).toHaveCount(1)
  await expect(page.getByText("At home", { exact: true })).toHaveCount(1)
  await expect(page.getByText("Elder", { exact: true })).toHaveCount(1)
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await expect(scene).toHaveAttribute("data-companions", "6")
})

test("Placed lofts are drawn on their rim spots, and ones for missing decks are skipped", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&pieces")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await expect(scene).toHaveAttribute("data-pieces", "2")
})

test("An Elder home can place, move and take back its loft", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&elder&pieces")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  await page.getByRole("button", { name: "Home 4", exact: true }).click()
  const loft = page.getByTestId("loft-section")
  await expect(loft).toContainText("Has a loft to place")
  await loft.getByRole("button", { name: /Place the loft/ }).click()
  const spots = page.getByRole("list", { name: "Free spots" })
  await expect(spots.getByRole("button", { name: "Deck 1, spot 2" })).toHaveCount(0)
  await spots.getByRole("button", { name: "Deck 1, spot 1" }).click()
  await page.getByRole("button", { name: "Put it here" }).click()
  await expect(spots).toHaveCount(0)
  await expect(page.getByTestId("loft-section")).toContainText("Home 4:")
  await expect(page.getByTestId("settlement-3d").locator("xpath=..").locator("p[aria-hidden=true]")).toContainText("Home 4:")
  await page.getByRole("button", { name: "Home 1", exact: true }).click()
  await expect(page.getByTestId("loft-section")).toContainText("Loft on deck 1, spot 2")
  await page.getByRole("button", { name: /Take back the loft/ }).click()
})

test("A loft that can't be placed says so quietly", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&elder&pieces&piece-fail")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  await page.getByRole("button", { name: "Home 4", exact: true }).click()
  await page.getByRole("button", { name: /Place the loft/ }).click()
  await page.getByRole("button", { name: "Deck 1, spot 1" }).click()
  await page.getByRole("button", { name: "Put it here" }).click()
  await expect(page.getByTestId("loft-section")).toContainText("Couldn't place it.")
})

test("Choosing a spot shows its free rings in the 3D scene and clears them after", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&elder&pieces")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await page.getByRole("button", { name: "Home 4", exact: true }).click()
  await page.getByRole("button", { name: /Place the loft/ }).click()
  // 2 decks x 3 spots, minus the 2 taken by other homes' lofts
  await expect(scene).toHaveAttribute("data-hints", "4")
  await page.keyboard.press("Escape")
  await expect(scene).toHaveAttribute("data-hints", "0")
})

test("Picking a spot shows a see-through loft there, and tapping a ring in the scene changes it", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&elder&pieces")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await page.getByRole("button", { name: "Home 4", exact: true }).click()
  await page.getByRole("button", { name: /Place the loft/ }).click()
  await expect(scene).toHaveAttribute("data-ghost", "")
  await expect(page.getByRole("button", { name: "Put it here" })).toHaveCount(0)
  await page.getByRole("button", { name: "Deck 1, spot 1" }).click()
  await expect(scene).toHaveAttribute("data-ghost", "0:0")
  await expect(page.getByRole("button", { name: "Deck 1, spot 1" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "Put it here" })).toBeVisible()
  await scene.evaluate((el) => el.dispatchEvent(new CustomEvent("settlement-spot", { detail: { deck: 1, anchor: 1 } })))
  await expect(scene).toHaveAttribute("data-ghost", "1:1")
  await expect(page.getByRole("button", { name: "Deck 2, spot 2" })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Never mind" }).click()
  await expect(scene).toHaveAttribute("data-ghost", "")
  await expect(scene).toHaveAttribute("data-hints", "0")
})

test("New pieces are added to the live scene without rebuilding it or moving the camera", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&pieces")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await expect(scene).toHaveAttribute("data-pieces", "2")
  await scene.focus()
  await page.keyboard.press("+")
  const zoom = await scene.getAttribute("data-zoom")
  await scene.evaluate((el) => {
    el.dispatchEvent(new CustomEvent("settlement-pieces", { detail: [
      { game_id: "many-0", piece: "loft", deck: 0, anchor: 1 },
      { game_id: "many-1", piece: "loft", deck: 1, anchor: 0 },
      { game_id: "many-3", piece: "loft", deck: 0, anchor: 2 },
    ] }))
  })
  await expect(scene).toHaveAttribute("data-pieces", "3")
  await expect(scene).toHaveAttribute("data-zoom", zoom!)
})

test("A real tap on a glowing ring in the scene picks that spot", async ({ page }) => {
  await page.goto("/?app-shell&residents-many&elder&pieces")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await page.getByRole("button", { name: "Home 4", exact: true }).click()
  await page.getByRole("button", { name: /Place the loft/ }).click()
  await page.getByRole("button", { name: "Deck 1, spot 1" }).click()
  await expect(scene).toHaveAttribute("data-ghost", "0:0")
  await page.waitForTimeout(700)
  await scene.scrollIntoViewIfNeeded()
  await scene.focus()
  await page.keyboard.press("+")
  await page.keyboard.press("-")
  await page.waitForTimeout(300)
  const points = (await scene.getAttribute("data-spot-points"))!.split(";").map((entry) => {
    const [spot, xy] = entry.split("@")
    const [x, y] = xy.split(",").map(Number)
    return { spot, x, y }
  })
  const other = points.find((p) => p.spot !== "0:0")!
  await page.mouse.click(other.x, other.y)
  await expect(scene).toHaveAttribute("data-ghost", other.spot)
  await expect(page.getByRole("button", { name: "Put it here" })).toBeVisible()
})

test("With more than one deck the scene labels each deck, a single deck has no labels", async ({ page }) => {
  await page.goto("/?app-shell&residents-many")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  const scene = page.getByTestId("settlement-3d")
  await expect(scene).toHaveAttribute("data-state", "ready", { timeout: 15000 })
  await expect(scene).toHaveAttribute("data-labels", "2")
  await page.goto("/?app-shell&residents")
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  await expect(page.getByTestId("settlement-3d")).toHaveAttribute("data-labels", "0")
})

const layoutCalls = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { standbyFixture: { layoutCalls: string[] } }).standbyFixture.layoutCalls)

async function openArrange(page: import("@playwright/test").Page, query = "") {
  await page.goto(`/?app-shell&residents-many${query}`)
  await page.getByRole("button", { name: "Home" }).click()
  await page.getByRole("button", { name: "Settlement" }).click()
  await page.getByRole("button", { name: "Arrange" }).click()
}

test("Arrange: pick a home, swap it with another, undo, and save on Done", async ({ page }) => {
  await openArrange(page)
  const picker = page.getByRole("list", { name: "Pick a home" })
  await picker.getByRole("button", { name: /Home 1 ·/ }).click()
  await page.getByRole("button", { name: "Deck 2, spot 1, swap with Home 7" }).click()
  await expect(picker.getByRole("button", { name: "Home 1 · Deck 2, spot 1" })).toBeVisible()
  await expect(picker.getByRole("button", { name: "Home 7 · Deck 1, spot 1" })).toBeVisible()

  await page.getByRole("button", { name: "Undo" }).click()
  await expect(picker.getByRole("button", { name: "Home 1 · Deck 1, spot 1" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled()

  await page.getByRole("button", { name: "Deck 2, spot 1, swap with Home 7" }).click()
  await page.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("button", { name: "Arrange" })).toBeVisible()
  const calls = await layoutCalls(page)
  expect(calls).toHaveLength(1)
  expect(calls[0]).toContain("many-0:1:0")
  expect(calls[0]).toContain("many-6:0:0")

  await page.getByRole("button", { name: "Arrange" }).click()
  await expect(page.getByRole("list", { name: "Pick a home" }).getByRole("button", { name: "Home 1 · Deck 2, spot 1" })).toBeVisible()
})

test("Arrange: a free spot says so, and Cancel saves nothing", async ({ page }) => {
  await openArrange(page)
  await page.getByRole("list", { name: "Pick a home" }).getByRole("button", { name: /Home 7 ·/ }).click()
  await page.getByRole("button", { name: "Deck 2, spot 4, free" }).click()
  await page.getByRole("button", { name: "Cancel" }).click()
  expect(await layoutCalls(page)).toHaveLength(0)
  await page.getByRole("button", { name: "Arrange" }).click()
  await expect(page.getByRole("list", { name: "Pick a home" }).getByRole("button", { name: "Home 7 · Deck 2, spot 1" })).toBeVisible()
})

test("Arrange: Done with no changes saves nothing, and Reset goes back to the automatic layout", async ({ page }) => {
  await openArrange(page)
  await page.getByRole("button", { name: "Done" }).click()
  expect(await layoutCalls(page)).toHaveLength(0)

  await page.getByRole("button", { name: "Arrange" }).click()
  const picker = page.getByRole("list", { name: "Pick a home" })
  await picker.getByRole("button", { name: /Home 2 ·/ }).click()
  await page.getByRole("button", { name: "Deck 1, spot 6, swap with Home 6" }).click()
  await page.getByRole("button", { name: "Reset" }).click()
  await expect(picker.getByRole("button", { name: "Home 2 · Deck 1, spot 2" })).toBeVisible()
})

test("Arrange: a failed save says so in plain words and keeps the changes", async ({ page }) => {
  await openArrange(page, "&layout-fail")
  const picker = page.getByRole("list", { name: "Pick a home" })
  await picker.getByRole("button", { name: /Home 1 ·/ }).click()
  await page.getByRole("button", { name: "Deck 2, spot 1, swap with Home 7" }).click()
  await page.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("alert")).toContainText("Couldn't save that. Your changes are still here.")
  await expect(picker.getByRole("button", { name: "Home 1 · Deck 2, spot 1" })).toBeVisible()
})

async function points(page: import("@playwright/test").Page, attr: "homePoints" | "cellPoints") {
  await page.waitForFunction((a) => !!document.querySelector(`[data-${a === "homePoints" ? "home-points" : "cell-points"}]`), attr)
  const raw = await page.evaluate((a) => {
    const el = document.querySelector<HTMLElement>(`[data-${a === "homePoints" ? "home-points" : "cell-points"}]`)
    return el?.dataset[a] ?? ""
  }, attr)
  return Object.fromEntries(raw.split(";").map((entry) => {
    const [key, xy] = entry.split("@")
    const [x, y] = xy.split(",").map(Number)
    return [key, { x, y }]
  })) as Record<string, { x: number; y: number }>
}

test("Arrange: dragging a home onto another spot swaps them, and Done saves it", async ({ page }) => {
  await openArrange(page)
  const homes = await points(page, "homePoints")
  const cells = await points(page, "cellPoints")
  const from = homes["many-0"]
  const to = cells["0:1"]
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 })
  await page.mouse.move(to.x, to.y, { steps: 5 })
  await page.mouse.up()
  const picker = page.getByRole("list", { name: "Pick a home" })
  await expect(picker.getByRole("button", { name: "Home 1 · Deck 1, spot 2" })).toBeVisible()
  await expect(picker.getByRole("button", { name: "Home 2 · Deck 1, spot 1" })).toBeVisible()
  await page.getByRole("button", { name: "Done" }).click()
  const calls = await layoutCalls(page)
  expect(calls[0]).toContain("many-0:0:1")
  expect(calls[0]).toContain("many-1:0:0")
})

test("Arrange: dropping a home in empty space puts it back", async ({ page }) => {
  await openArrange(page)
  const homes = await points(page, "homePoints")
  const from = homes["many-0"]
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x - 60, from.y - 160, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByRole("list", { name: "Pick a home" }).getByRole("button", { name: "Home 1 · Deck 1, spot 1" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled()
})

test("Arrange: Turn and the R key turn a home a quarter, and Done saves the turn", async ({ page }) => {
  await openArrange(page)
  const picker = page.getByRole("list", { name: "Pick a home" })
  await picker.getByRole("button", { name: /Home 3 ·/ }).click()
  await page.getByRole("button", { name: "Turn" }).click()
  await page.getByRole("button", { name: "Turn" }).focus()
  await page.keyboard.press("r")
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>("[data-rotations]")?.dataset.rotations ?? "")).toContain("many-2:2")
  await page.getByRole("button", { name: "Undo" }).click()
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>("[data-rotations]")?.dataset.rotations ?? "")).toContain("many-2:1")
})

