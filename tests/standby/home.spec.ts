import { test, expect } from "@playwright/test"

test("Home shows a calm empty state when nothing lives here yet", async ({ page }) => {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: "Home" }).click()

  await expect(page.getByText("Games you finish will live here.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Lives here" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Keepsakes" })).toHaveCount(0)
})

test("Home tab is announced as the current page and Progress no longer lists residents", async ({ page }) => {
  await page.goto("/?app-shell&residents&postcards")
  const home = page.getByRole("button", { name: "Home" })
  await home.click()
  await expect(home).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { name: "Lives here" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Keepsakes" })).toBeVisible()

  await page.getByRole("button", { name: /Progress/i }).click()
  await expect(page.getByRole("heading", { name: "Lives here" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Keepsakes" })).toHaveCount(0)
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

  await list.click()
  await expect(page.getByTestId("settlement-3d")).toHaveCount(0)
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
  await expect(spots).toHaveCount(0)
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
