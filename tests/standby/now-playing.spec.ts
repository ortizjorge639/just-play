import { test, expect } from "@playwright/test"

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`artwork stage keeps controls below artwork at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto("/?app-shell")
    await page.getByRole("button", { name: "Now Playing", exact: true }).click()
    const stage = page.locator(".session-stage")
    const controls = page.getByRole("group", { name: "Session controls" })
    const pause = controls.getByRole("button", { name: "Pause", exact: true })
    await expect(pause).toBeEnabled()
    await expect(stage.locator("..")).toHaveCSS("transform", "none")
    const artwork = await stage.getByRole("img", { name: "A Short Hike", exact: true }).boundingBox()
    const strip = await controls.boundingBox()
    expect(artwork).not.toBeNull()
    expect(strip).not.toBeNull()
    expect(strip!.y).toBeGreaterThanOrEqual(artwork!.y + artwork!.height - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(stage.getByText("Time & StandBy preferences", { exact: true })).toBeVisible()
    await expect(stage.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-expanded", "false")
    await pause.click()
    await expect(controls.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
    await testInfo.attach("artwork-stage.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
  })
}

test("large text and a long game title wrap without clipping session controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px"
    window.standbyFixture.session!.games.name = "A Much Longer Game Title With An Unexpectedly Lengthy Subtitle"
    window.dispatchEvent(new Event("focus"))
  })
  const resume = page.getByRole("button", { name: "Resume", exact: true })
  await expect(resume).toBeEnabled()
  await expect(page.getByRole("heading", { name: /Unexpectedly Lengthy/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await resume.click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
})

test("verification failures keep the action strip disabled and mark its time as stale", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.evaluate(() => {
    window.standbyFixture.error = "Server unavailable"
    window.dispatchEvent(new Event("focus"))
  })
  await expect(page.getByRole("alert")).toContainText("Server unavailable")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "End Session", exact: true })).toBeDisabled()
  await expect(page.getByLabel("Last known session time")).toContainText("last known")
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  await page.evaluate(() => { window.standbyFixture.error = null })
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
})

test("untracked sessions never display an elapsed measurement in the action strip", async ({ page }) => {
  await page.goto("/?untracked")
  const controls = page.getByRole("group", { name: "Session controls" })
  await expect(controls.getByLabel("Session time", { exact: true })).toHaveText("Untracked")
  await expect(controls.getByRole("button", { name: "Show timer", exact: true })).toBeDisabled()
})
