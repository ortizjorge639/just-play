import { test, expect, type Page } from "@playwright/test"

const endings = [
  { name: "Done for Today", kind: "finish" },
  { name: "I Beat This Game!", kind: "beaten" },
  { name: "Abandon Game", kind: "abandoned" },
] as const

async function openNotes(page: Page) {
  await page.clock.install()
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Notes", exact: false }).click()
  return page.getByRole("textbox", { name: "Session notes, page 1", exact: true })
}

async function finish(page: Page, name: string) {
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  await page.getByRole("button", { name, exact: false }).click()
}

for (const ending of endings) {
  test(`${ending.kind} saves a fresh note before the debounce and keeps finished notes immutable`, async ({ page }) => {
    const editor = await openNotes(page)
    await editor.fill("Reached the summit")
    expect(await page.evaluate(() => window.standbyFixture.notesWrites)).toEqual([])
    await finish(page, ending.name)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Reached the summit"])
    expect(await page.evaluate(() => window.standbyFixture.events.map(event => event.kind))).toEqual(["notes-start", "notes-saved", ending.kind])
    await page.clock.fastForward(2000)
    expect(await page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(1)
    await expect(page.getByRole("textbox")).toHaveCount(0)
  })

  test(`${ending.kind} drains an older in-flight save followed by the latest draft in order`, async ({ page }) => {
    const editor = await openNotes(page)
    await page.evaluate(() => { window.standbyFixture.notesDelay = 3000 })
    await editor.fill("Old draft")
    await page.clock.fastForward(1001)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(1)
    await editor.fill("Latest legitimate draft")
    await finish(page, ending.name)
    await expect(editor).toBeDisabled()
    expect(await page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    await page.clock.fastForward(3001)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(2)
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    await page.clock.fastForward(3001)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Latest legitimate draft"])
    expect(await page.evaluate(() => window.standbyFixture.events.map(event => event.kind))).toEqual([
      "notes-start", "notes-saved", "notes-start", "notes-saved", ending.kind,
    ])
  })

  test(`${ending.kind} refuses to end on note-save failure, retains the draft and permits explicit retry`, async ({ page }) => {
    const editor = await openNotes(page)
    await page.evaluate(() => { window.standbyFixture.notesError = "Note service unavailable" })
    await editor.fill("Keep this memory")
    await finish(page, ending.name)
    await expect(page.getByRole("alert")).toContainText("Your draft is still here")
    await expect(page.getByRole("alert")).toContainText("Note service unavailable")
    await expect(editor).toBeEnabled()
    await expect(editor).toHaveValue("Keep this memory")
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    await page.evaluate(() => { window.standbyFixture.notesError = null })
    await finish(page, ending.name)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Keep this memory"])
  })

  test(`${ending.kind} does not skip a failed older write when a newer draft is pending`, async ({ page }) => {
    const editor = await openNotes(page)
    await page.evaluate(() => {
      window.standbyFixture.notesDelay = 3000
      window.standbyFixture.notesError = "Older write failed"
    })
    await editor.fill("First draft")
    await page.clock.fastForward(1001)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(1)
    await editor.fill("Keep the latest draft")
    await finish(page, ending.name)
    await page.clock.fastForward(3001)
    await expect(page.getByRole("alert")).toContainText("Older write failed")
    await expect(editor).toHaveValue("Keep the latest draft")
    await expect(editor).toBeEnabled()
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([])
    await page.evaluate(() => { window.standbyFixture.notesError = null; window.standbyFixture.notesDelay = 0 })
    await finish(page, ending.name)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Keep the latest draft"])
  })

  test(`${ending.kind} keeps the editor frozen after notes save while finalization is still pending`, async ({ page }) => {
    const editor = await openNotes(page)
    await page.evaluate(() => { window.standbyFixture.finalizationDelay = 3000 })
    await editor.fill("Last accepted draft")
    await finish(page, ending.name)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.events.map(event => event.kind))).toEqual(["notes-start", "notes-saved"])
    await expect(editor).toBeDisabled()
    await page.keyboard.type("must not become another draft")
    await expect(editor).toHaveValue("Last accepted draft")
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    await page.clock.fastForward(3001)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Last accepted draft"])
  })
}

test("StandBy finish drains a note drafted on the normal session screen", async ({ page }) => {
  const editor = await openNotes(page)
  await editor.fill("A quiet session")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "End session", exact: true }).click()
  await dialog.getByRole("button", { name: "Finish session", exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["A quiet session"])
  expect(await page.evaluate(() => window.standbyFixture.events.map(event => event.kind))).toEqual(["notes-start", "notes-saved", "finish"])
})

test("StandBy note-save failure is visible and exiting preserves the editable draft", async ({ page }) => {
  const editor = await openNotes(page)
  await editor.fill("Keep this after StandBy fails")
  await page.evaluate(() => { window.standbyFixture.notesError = "Notes unavailable" })
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "End session", exact: true }).click()
  await dialog.getByRole("button", { name: "Finish session", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Your draft is still here")
  expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
  await dialog.getByRole("button", { name: "Exit StandBy", exact: true }).click()
  await expect(editor).toBeEnabled()
  await expect(editor).toHaveValue("Keep this after StandBy fails")
  await page.evaluate(() => { window.standbyFixture.notesError = null })
  await finish(page, "Done for Today")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Keep this after StandBy fails"])
})

test("pause reconciliation does not replace an unsaved draft with stale server notes", async ({ page }) => {
  const editor = await openNotes(page)
  await editor.fill("Draft before pause")
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
  await expect(editor).toHaveValue("Draft before pause")
  await finish(page, "Done for Today")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Draft before pause"])
})
