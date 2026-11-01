import { test, expect } from "@playwright/test"

const viewports = [
  { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 },
]

for (const viewport of viewports) {
  test(`Quiet field fills ${viewport.width}x${viewport.height} with readable, non-overlapping title and controls`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    const dialog = page.getByRole("dialog")
    const field = dialog.getByTestId("standby-field")
    await expect(field).toBeVisible()
    const fieldBox = await field.boundingBox()
    expect(fieldBox).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height })
    expect(await field.locator("svg").count()).toBeGreaterThan(0)
    const title = await dialog.getByRole("heading", { name: "A Short Hike" }).boundingBox()
    const panel = await dialog.getByTestId("standby-controls").boundingBox()
    expect(title && panel).toBeTruthy()
    const apart = title!.y + title!.height <= panel!.y + 1 || title!.x + title!.width <= panel!.x + 1
    expect(apart).toBe(true)
    for (const name of ["Pause", "End session", "Exit StandBy"]) {
      const box = await dialog.getByRole("button", { name, exact: true }).boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
  })
}

test("Quiet field stays usable with a long title at 200% text and keeps the field fixed behind scrolling content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.addStyleTag({ content: "html{font-size:200%!important}" })
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const dialog = page.getByRole("dialog")
  const longName = "The Legend of Zelda: Tears of the Kingdom - A very long library title"
  await page.evaluate(name => {
    const session = window.standbyFixture.session!
    session.games = { ...session.games, name }
    session.session_goal = "Explore the mountains. ".repeat(20)
    window.dispatchEvent(new Event("focus"))
  }, longName)
  await expect(dialog.getByRole("heading", { name: longName })).toBeVisible()
  await expect(dialog.getByTestId("standby-field")).toBeVisible()
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await dialog.getByRole("button", { name: "End session" }).scrollIntoViewIfNeeded()
  await expect(dialog.getByRole("button", { name: "End session" })).toBeInViewport()
  const box = await dialog.getByTestId("standby-field").boundingBox()
  expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 })
  await expect(dialog.getByRole("button", { name: "Exit StandBy" })).toBeInViewport()
})

test("Quiet field honours reduced motion and the Canopy view still switches back", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const dialog = page.getByRole("dialog")
  expect(await dialog.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
  const view = dialog.getByRole("combobox", { name: "StandBy view" })
  await view.selectOption("canopy")
  await expect(dialog.getByTestId("standby-field")).toHaveCount(0)
  await view.selectOption("artwork")
  await expect(dialog.getByTestId("standby-field")).toBeVisible()
})

test("Escape still exits Quiet field after a mouse click on the field and restores entry focus", async ({ page }) => {
  await page.goto("/")
  const enter = page.getByRole("button", { name: /Enter StandBy/ })
  await enter.click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("heading", { name: "A Short Hike" }).click()
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(enter).toBeFocused()
})
