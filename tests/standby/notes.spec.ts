import { test, expect, type Page } from "@playwright/test"

const endings = [
  { name: "Done for Today", kind: "finish" },
  { name: "I Beat This Game!", kind: "beaten" },
  { name: "Abandon Game", kind: "abandoned" },
] as const

async function openNotes(page: Page, url = "/") {
  await page.clock.install()
  await page.goto(url)
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Notes", exact: false }).click()
  const editor = page.getByRole("textbox", { name: "Session notes, page 1", exact: true })
  // Expansion moves End Session even after a transient frame-stability check.
  await expect(page.locator("div.overflow-hidden").filter({ has: editor }).first()).toHaveAttribute("style", /height:\s*auto/)
  return editor
}

async function finish(page: Page, name: string) {
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  const action = page.getByRole("button", { name, exact: false })
  // Exercise real pointer input only after entry, and never retry on an exiting sheet.
  await expect(page.locator("div.rounded-t-3xl").filter({ has: action })).toHaveCSS("transform", "none")
  await expect(action).toBeEnabled()
  await action.click()
  await expect(page.getByRole("button", { name, exact: false })).toBeHidden()
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
    await page.evaluate(() => { window.standbyFixture.holdNoteWrites = true })
    await editor.fill("Old draft")
    await page.clock.fastForward(1001)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(1)
    await editor.fill("Latest legitimate draft")
    await finish(page, ending.name)
    await expect(editor).toBeDisabled()
    expect(await page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    await page.evaluate(() => { window.standbyFixture.releaseNextNote() })
    await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(2)
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    await page.evaluate(() => { window.standbyFixture.releaseNextNote() })
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

  for (const mode of ["commit-then-reject", "reject-then-commit-late"] as const) {
    test(`${ending.kind} overwrites a reverted draft after ${mode}, including execution after the newer ACK`, async ({ page }) => {
      const editor = await openNotes(page, "/?empty-notes")
      await page.evaluate((value) => {
        window.standbyFixture.notesErrorMode = value
        window.standbyFixture.notesError = "Response lost"
      }, mode)
      await editor.fill("Text to remove")
      await page.clock.fastForward(1001)
      await expect(page.getByRole("alert")).toContainText("Response lost")
      if (mode === "commit-then-reject") {
        expect(await page.evaluate(() => JSON.parse(window.standbyFixture.session!.notes!)[0])).toBe("Text to remove")
      }
      await editor.fill("")
      await page.evaluate(() => { window.standbyFixture.notesError = null })
      await finish(page, ending.name)
      await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual([""])
      expect(await page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(2)
      expect(await page.evaluate(() => window.standbyFixture.finalDrafts.map(raw => JSON.parse(raw)[0]))).toEqual([""])
      if (ending.kind === "finish") {
        expect(await page.evaluate(() => window.standbyFixture.atomicFinishRequirements)).toEqual([true])
      }
      if (mode === "reject-then-commit-late") {
        const kinds = await page.evaluate(() => window.standbyFixture.events.map(event => event.kind))
        expect(kinds.indexOf("notes-late")).toBeGreaterThan(kinds.lastIndexOf("notes-saved"))
        expect(kinds.at(-1)).toBe(ending.kind)
      }
    })
  }

  test(`${ending.kind} retains the reverted draft and blocks end when its forced overwrite also loses the response`, async ({ page }) => {
    const editor = await openNotes(page, "/?empty-notes")
    await page.evaluate(() => {
      window.standbyFixture.notesErrorMode = "commit-then-reject"
      window.standbyFixture.notesError = "Response lost after commit"
    })
    await editor.fill("Text to remove")
    await page.clock.fastForward(1001)
    await expect(page.getByRole("alert")).toContainText("Response lost after commit")
    await editor.fill("")
    await finish(page, ending.name)
    await expect(page.getByRole("alert")).toContainText("Your draft is still here")
    await expect(editor).toBeEnabled()
    await expect(editor).toHaveValue("")
    const attempts = await page.evaluate(() => window.standbyFixture.notesWrites.length)
    expect(attempts).toBeGreaterThanOrEqual(2)
    expect(await page.evaluate(() => JSON.parse(window.standbyFixture.notesWrites.at(-1)!)[0])).toBe("")
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([])
    await page.evaluate(() => { window.standbyFixture.notesError = null })
    await finish(page, ending.name)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual([""])
    expect(await page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(attempts + 1)
  })

  test(`${ending.kind} rejects uncertain execution arriving after the atomic finish`, async ({ page }) => {
    const editor = await openNotes(page, "/?empty-notes")
    await page.evaluate(() => {
      window.standbyFixture.notesErrorMode = "reject-then-commit-late"
      window.standbyFixture.notesError = "Response lost"
      window.standbyFixture.settleLateOnFinish = false
    })
    await editor.fill("Late old text")
    await page.clock.fastForward(1001)
    await expect(page.getByRole("alert")).toContainText("Response lost")
    await editor.fill("")
    await page.evaluate(() => { window.standbyFixture.notesError = null })
    await finish(page, ending.name)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual([""])
    await page.evaluate(() => { window.standbyFixture.settleLateNotes() })
    expect(await page.evaluate(() => window.standbyFixture.rejectedLateNotes)).toBe(1)
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual([""])
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

test("018-only finish stays available with acknowledged writes", async ({ page }) => {
  const editor = await openNotes(page, "/?empty-notes")
  await page.evaluate(() => { window.standbyFixture.schema020 = false })
  await editor.fill("Acknowledged ordinary note")
  await finish(page, "Done for Today")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual(["Acknowledged ordinary note"])
  expect(await page.evaluate(() => window.standbyFixture.atomicFinishRequirements)).toEqual([false])
})

test("018-only finish blocks uncertainty without losing the draft until the atomic boundary is available", async ({ page }) => {
  const editor = await openNotes(page, "/?empty-notes")
  await page.evaluate(() => {
    window.standbyFixture.schema020 = false
    window.standbyFixture.notesErrorMode = "reject-then-commit-late"
    window.standbyFixture.notesError = "Response lost"
  })
  await editor.fill("Unknown old write")
  await page.clock.fastForward(1001)
  await expect(page.getByRole("alert")).toContainText("Response lost")
  await editor.fill("")
  await page.evaluate(() => { window.standbyFixture.notesError = null })
  await finish(page, "Done for Today")
  await expect(page.getByRole("alert")).toContainText("Atomic note finalization is unavailable")
  await expect(editor).toBeEnabled()
  await expect(editor).toHaveValue("")
  expect(await page.evaluate(() => window.standbyFixture.atomicFinishRequirements)).toEqual([true])
  expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  await page.evaluate(() => { window.standbyFixture.schema020 = true })
  await finish(page, "Done for Today")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual([""])
})
