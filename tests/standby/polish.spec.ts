import { test, expect, type Page } from "@playwright/test"

test("the notes pager has real tap targets on a phone and still jumps to a page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()

  for (const name of ["Previous page", "Next page"]) {
    const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  const dots = page.getByRole("button", { name: /^Page \d+$/ })
  await expect(dots).toHaveCount(10)
  for (const box of await dots.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()))) {
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(23)
  }

  await page.getByRole("button", { name: "Page 3", exact: true }).click()
  await expect(page.getByRole("button", { name: "Page 3", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("textbox", { name: "Session notes, page 3", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Session notes, page 4", exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("the notes pager fits a 320px phone without sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeVisible()
  const next = (await page.getByRole("button", { name: "Next page", exact: true }).boundingBox())!
  expect(next.x + next.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

// Records every slide or scale that appears in an inline style on any frame.
function recordMotion() {
  const seen = new Set<string>()
  ;(window as unknown as { motionSeen: Set<string> }).motionSeen = seen
  const moving = /translate[XY3d]*\((?!0(px)?[,)])|scale\((?!1[,)])/
  const tick = () => {
    for (const element of document.querySelectorAll<HTMLElement>("[style*='translate'], [style*='scale']")) {
      if (moving.test(element.style.transform)) seen.add(element.style.transform)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
const motionSeen = (page: Page) =>
  page.evaluate(() => [...(window as unknown as { motionSeen: Set<string> }).motionSeen])

async function moveAround(page: Page) {
  await page.goto("/?app-shell")
  await page.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Now Playing", exact: true }).click()
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "End Session" })).toBeVisible()
  await page.waitForTimeout(500)
}

test("tabs and sheets slide by default", async ({ page }) => {
  await page.addInitScript(recordMotion)
  await moveAround(page)
  expect((await motionSeen(page)).length).toBeGreaterThan(0)
})

test("with reduced motion on, tabs and sheets appear without sliding or scaling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(recordMotion)
  await moveAround(page)
  expect(await motionSeen(page)).toEqual([])
  // The sheet is still usable.
  await expect(page.getByRole("button", { name: "Done for Today" })).toBeVisible()
})

test("an auth form's button says it is working and cannot be pressed twice", async ({ page }) => {
  await page.goto("/?submit-button")
  const idle = page.getByRole("button", { name: "Sign In", exact: true })
  await expect(idle).toBeEnabled()
  await idle.click()

  const busy = page.getByRole("button", { name: "Signing in…", exact: true })
  await expect(busy).toBeDisabled()
  await expect(busy).toHaveAttribute("aria-busy", "true")
  // It settles back once the action finishes.
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled()
})

test("the Home stamps setting toggles from anywhere on its row", async ({ page }) => {
  await page.goto("/?app-shell&current-game")
  await page.getByRole("banner").getByRole("button", { name: "Settings", exact: true }).click()
  const toggle = page.getByRole("switch", { name: "Show stamps on game cards" })
  await expect(toggle).toBeChecked()
  await page.getByText("Show stamps on game cards", { exact: true }).click()
  await expect(toggle).not.toBeChecked()
  const row = (await page.locator("label[for='show-home-stamps']").boundingBox())!
  expect(row.height).toBeGreaterThanOrEqual(44)
})
