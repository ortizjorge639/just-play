import { test, expect } from "@playwright/test"

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`Now Playing preserves the wide artwork stage at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto("/?app-shell")
    await page.getByRole("button", { name: "Now Playing", exact: true }).click()
    const stage = page.locator(".session-stage")
    const controls = page.getByRole("group", { name: /^Session controls/ })
    const pause = controls.getByRole("button", { name: "Pause", exact: true })
    await expect(pause).toBeEnabled()
    await expect(stage.locator("..")).toHaveCSS("transform", "none")
    const artworkElement = stage.getByTestId("now-playing-artwork")
    const artwork = await artworkElement.boundingBox()
    const strip = await controls.boundingBox()
    expect(artwork).not.toBeNull()
    expect(strip).not.toBeNull()
    expect(strip!.y).toBeGreaterThanOrEqual(artwork!.y + artwork!.height - 1)
    expect(artwork!.width / artwork!.height).toBeCloseTo(16 / 9, 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(stage.getByRole("button", { name: "Enter StandBy" })).toBeVisible()
    await expect(stage.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-expanded", "true")
    await expect(stage.getByRole("textbox", { name: "Session notes, page 1" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Session preferences" })).toBeVisible()
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
  await expect(page.locator("time[aria-label='Last known elapsed session time']")).toBeVisible()
  await expect(page.getByText("Last known", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  await page.evaluate(() => { window.standbyFixture.error = null })
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
})

test("untracked sessions never display an elapsed measurement in the action strip", async ({ page }) => {
  await page.goto("/?untracked")
  const controls = page.getByRole("group", { name: /^Session controls/ })
  await expect(controls.getByText("Untracked", { exact: true })).toBeVisible()
  await expect(controls.locator("time")).toHaveCount(0)
  await expect(controls.getByRole("button", { name: /timer/i })).toHaveCount(0)
})

test("StandBy renders full-screen ASCII game art behind the session controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: "Enter StandBy" }).click()
  const field = page.getByTestId("standby-field")
  const canvas = page.getByTestId("standby-ascii")
  await expect(field).toBeVisible()
  await expect(canvas).toHaveAttribute("data-rendered", "true")
  await expect(page.getByTestId("standby-controls")).toBeVisible()
  await expect(page.getByRole("heading", { name: "A Short Hike" })).toBeVisible()
  expect(await field.evaluate((element) => {
    const { width, height } = element.getBoundingClientRect()
    return width >= innerWidth && height >= innerHeight
  })).toBe(true)
})

test("StandBy keeps its ASCII art while honoring reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.getByRole("button", { name: "Enter StandBy" }).click()
  const canvas = page.getByTestId("standby-ascii")
  await expect(canvas).toHaveAttribute("data-rendered", "true")
  await expect(page.locator(".standby-pointer-glow")).toBeHidden()
  await expect(page.getByTestId("standby-controls")).toBeVisible()
})

test("StandBy pointer movement shifts a restrained color wash across the artwork", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto("/")
  await page.getByRole("button", { name: "Enter StandBy" }).click()
  const dialog = page.getByRole("dialog")
  await page.mouse.move(20, 200)
  await expect.poll(() => dialog.evaluate(element => element.style.getPropertyValue("--pointer-hue"))).toBe("103.425")
  await page.mouse.move(780, 200)
  await expect.poll(() => dialog.evaluate(element => element.style.getPropertyValue("--pointer-hue"))).toBe("43.575")
})

test("session preferences are available from the header and not repeated below the controls", async ({ page }) => {
  await page.goto("/?app-shell")
  await expect(page.getByRole("button", { name: "Session preferences" })).toBeVisible()
  await expect(page.getByText("Time & StandBy preferences", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Session preferences" }).click()
  await expect(page.getByRole("checkbox", { name: "Record play time for future sessions" })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: "Show elapsed clock (recorded sessions only)" })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: "Gentle reminders while a session is recorded (they never pause it)" })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: "Keep screen awake while StandBy is visible" })).toBeVisible()
  await expect(page.getByText("This session's time recording is on. Changes apply to the next session.")).toBeVisible()
})

test("locked-in sessions retain the explicit start action", async ({ page }) => {
  await page.goto("/?app-shell&locked")
  await expect(page.getByRole("button", { name: "Start Playing" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Enter StandBy" })).toHaveCount(0)
  await expect(page.getByText("~60m estimated")).toBeVisible()
})
