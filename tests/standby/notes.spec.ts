import { test, expect, type Page } from "@playwright/test"
import { execFileSync } from "node:child_process"

const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const sourceCommitted = execFileSync("git", [
  "diff", "--name-only", "HEAD", "--", "components", "hooks", "tests/standby",
], { encoding: "utf8" }).trim() === ""
test.afterEach(async ({ page }, testInfo) => {
  const observed = await page.evaluate(() => ({
    session: window.standbyFixture?.session,
    notesInvocations: window.standbyFixture?.notesWrites,
    readSnapshots: window.standbyFixture?.readSnapshots,
    readCompletions: window.standbyFixture?.readCompletions,
    terminalNotes: window.standbyFixture?.finishedNotes,
    reloadReceipt: sessionStorage.getItem("standby-test-finished-notes"),
    events: window.standbyFixture?.events.map((event, index) => ({
      barrierSequence: index + 1, ...event,
    })),
  }))
  await testInfo.attach("mocked-ui-history.json", {
    contentType: "application/json",
    body: JSON.stringify({
      sourceSHA, sourceCommitted, case: testInfo.title, contextId: testInfo.testId,
      oracleType: "browser-components-with-mocked-actions-not-database",
      status: testInfo.status, observed,
    }),
  })
})

const endings = [
  { name: "Done for Today", kind: "finish" },
  { name: "I Beat This Game!", kind: "beaten" },
  { name: "Abandon Game", kind: "abandoned" },
] as const

async function openNotes(page: Page, url = "/", virtualClock = true) {
  if (virtualClock) await page.clock.install()
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

for (const ending of endings) {
  test(`018-only ${ending.kind} blocks even a clean acknowledged draft without terminal mutation or completed UI`, async ({ page }) => {
    const editor = await openNotes(page, "/?empty-notes")
    await page.evaluate(() => { window.standbyFixture.schema020 = false })
    await editor.fill("Acknowledged ordinary note")
    await page.clock.fastForward(1001)
    await expect(page.getByRole("status")).toHaveText("Notes saved.")
    const before = await page.evaluate(() => window.standbyFixture.session)
    await finish(page, ending.name)
    await expect(page.getByRole("alert")).toContainText("migration 020")
    await expect(editor).toBeEnabled()
    await expect(editor).toHaveValue("Acknowledged ordinary note")
    expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
    expect(await page.evaluate(() => window.standbyFixture.session)).toEqual(before)
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  })
}

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
  expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  await page.evaluate(() => { window.standbyFixture.schema020 = true })
  await finish(page, "Done for Today")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.finishedNotes.map(raw => JSON.parse(raw)[0]))).toEqual([""])
})

test("018-only StandBy finish is unavailable without ending or losing its normal-screen draft", async ({ page }) => {
  const editor = await openNotes(page, "/?empty-notes")
  await editor.fill("Keep the memory")
  await page.clock.fastForward(1001)
  await expect(page.getByRole("status")).toHaveText("Notes saved.")
  await page.evaluate(() => { window.standbyFixture.schema020 = false })
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "End session", exact: true }).click()
  await dialog.getByRole("button", { name: "Finish session", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("migration 020")
  expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  await dialog.getByRole("button", { name: "Exit StandBy", exact: true }).click()
  await expect(editor).toHaveValue("Keep the memory")
  await expect(editor).toBeEnabled()
})

for (const schema020 of [false, true]) {
  test(`real AppShell Progress/back remount cannot authorize a non-atomic finish (020=${schema020})`, async ({ page }) => {
    let editor = await openNotes(page, "/?empty-notes&app-shell")
    await page.evaluate((installed) => {
      window.standbyFixture.schema020 = installed
      window.standbyFixture.notesErrorMode = "reject-then-commit-late"
      window.standbyFixture.notesError = "Response lost"
    }, schema020)
    await editor.fill("Unknown previous context")
    await page.clock.fastForward(1001)
    await expect(page.getByRole("alert")).toContainText("Response lost")
    await editor.fill("")
    await page.evaluate(() => { window.standbyFixture.notesError = null })
    await page.clock.fastForward(1001)
    await expect(page.getByRole("status")).toContainText("Notes acknowledged")
    await page.getByRole("button", { name: "Progress", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await page.getByRole("button", { name: "Now Playing", exact: true }).click()
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "Notes", exact: false }).click()
    editor = page.getByRole("textbox", { name: "Session notes, page 1", exact: true })
    await expect(page.locator("div.overflow-hidden").filter({ has: editor }).first()).toHaveAttribute("style", /height:\s*auto/)
    await expect(editor).toHaveValue("")
    await expect(page.getByRole("status")).toContainText("Notes acknowledged")
    if (!schema020) {
      await finish(page, "Done for Today")
      await expect(page.getByRole("alert")).toContainText("migration 020")
      await expect(editor).toBeEnabled()
      await expect(editor).toHaveValue("")
      expect(await page.evaluate(() => window.standbyFixture.finishedNotes)).toEqual([])
      expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
      expect(await page.evaluate(() => window.standbyFixture.deferredNotes.length)).toBe(1)
    } else {
      // AppShell reloads on successful finish; the harness-only receipt survives it.
      await page.getByRole("button", { name: "End Session", exact: true }).click()
      const action = page.getByRole("button", { name: /Done for Today/ })
      await expect(page.locator("div.rounded-t-3xl").filter({ has: action })).toHaveCSS("transform", "none")
      await Promise.all([page.waitForNavigation({ waitUntil: "load" }), action.click()])
      await expect.poll(() => page.evaluate(() => {
        const receipt = sessionStorage.getItem("standby-test-finished-notes")
        return receipt ? JSON.parse(receipt).map((raw: string) => JSON.parse(raw)[0]) : []
      })).toEqual([""])
    }

  })
}

for (const interrupted of ["failed", "pending"] as const) {
  test(`Progress/back retains a ${interrupted} note draft without inventing a save acknowledgement`, async ({ page }) => {
    const editor = await openNotes(page, "/?empty-notes&app-shell")
    await page.evaluate((mode) => {
      if (mode === "failed") window.standbyFixture.notesError = "Offline note service"
      else window.standbyFixture.holdNoteWrites = true
    }, interrupted)
    await editor.fill("Memory that has no ACK")
    await page.clock.fastForward(1001)
    await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(1)
    if (interrupted === "failed") await expect(page.getByRole("alert")).toContainText("Offline note service")
    await page.getByRole("button", { name: "Progress", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await page.getByRole("button", { name: "Now Playing", exact: true }).click()
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "Notes", exact: false }).click()
    const remounted = page.getByRole("textbox", { name: "Session notes, page 1", exact: true })
    await expect(remounted).toHaveValue("Memory that has no ACK")
    await expect(page.getByRole("status")).toHaveText(interrupted === "failed"
      ? "Notes not saved. Your draft is still here." : "Saving notes...")
    expect(await page.evaluate(() => window.standbyFixture.session?.notes)).toBe(JSON.stringify(Array(10).fill("")))
    await page.clock.fastForward(20001)
    await expect(remounted).toHaveValue("Memory that has no ACK")
    await expect(page.getByRole("status")).toHaveText(interrupted === "failed"
      ? "Notes not saved. Your draft is still here." : "Saving notes...")
    if (interrupted === "failed") await expect(page.getByRole("alert")).toContainText("Offline note service")
    else {
      await page.evaluate(() => window.standbyFixture.releaseNextNote())
      await expect(page.getByRole("status")).toHaveText("Notes saved.")
      expect(await page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(1)
    }
  })
}

test("clean same-session reconciliation adopts remote notes before and after Progress/back and finishes that draft", async ({ page }) => {
  test.setTimeout(45000)
  const editor = await openNotes(page, "/?empty-notes&app-shell", false)
  await expect(editor).toHaveValue("")
  await page.evaluate(() => {
    window.standbyFixture.session = {
      ...window.standbyFixture.session!,
      notes: JSON.stringify(["Remote legitimate memory", ...Array(9).fill("")]),
    }
  })
  // Exercise the actual 20-second interval without installing a virtual clock.
  await expect(editor).toHaveValue("Remote legitimate memory", { timeout: 25000 })
  await expect(page.getByRole("status")).toHaveText("Notes saved.")
  expect(await page.evaluate(() => window.standbyFixture.notesWrites)).toEqual([])
  await page.getByRole("button", { name: "Progress", exact: true }).click()
  await expect(editor).toHaveCount(0)
  await page.getByRole("button", { name: "Now Playing", exact: true }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Notes", exact: false }).click()
  await expect(editor).toHaveValue("Remote legitimate memory")
  await expect(page.locator("div.overflow-hidden").filter({ has: editor }).first()).toHaveAttribute("style", /height:\s*auto/)
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  const action = page.getByRole("button", { name: /Done for Today/ })
  await expect(page.locator("div.rounded-t-3xl").filter({ has: action })).toHaveCSS("transform", "none")
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), action.click()])
  await expect.poll(() => page.evaluate(() => {
    const receipt = sessionStorage.getItem("standby-test-finished-notes")
    return receipt ? JSON.parse(receipt).map((raw: string) => JSON.parse(raw)[0]) : []
  })).toEqual(["Remote legitimate memory"])
})

test("a pre-write poll resolved after the newer ACK cannot roll back notes; a later clean read can be adopted", async ({ page }) => {
  test.setTimeout(65000)
  const editor = await openNotes(page, "/?empty-notes&app-shell", false)
  await page.evaluate(() => {
    window.standbyFixture.holdReads = true
    window.standbyFixture.holdNoteWrites = true
  })
  await expect.poll(() => page.evaluate(() => window.standbyFixture.readReleases.length), { timeout: 25000 }).toBe(1)
  await editor.fill("New local ACK")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(1)
  await page.evaluate(() => window.standbyFixture.releaseNextNote())
  await expect(page.getByRole("status")).toHaveText("Notes saved.")
  const completedReads = await page.evaluate(() => window.standbyFixture.readCompletions)
  await page.evaluate(() => window.standbyFixture.releaseNextRead())
  await expect.poll(() => page.evaluate(() => window.standbyFixture.readCompletions)).toBeGreaterThan(completedReads)
  await expect(editor).toHaveValue("New local ACK")
  await page.getByRole("button", { name: "Progress", exact: true }).click()
  await expect(editor).toHaveCount(0)
  await page.getByRole("button", { name: "Now Playing", exact: true }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Notes", exact: false }).click()
  await expect(editor).toHaveValue("New local ACK")
  await page.evaluate(() => {
    window.standbyFixture.holdReads = false
    window.standbyFixture.session = {
      ...window.standbyFixture.session!,
      notes: JSON.stringify(["Later remote ACK", ...Array(9).fill("")]),
    }
  })
  await expect(editor).toHaveValue("Later remote ACK", { timeout: 25000 })
  await expect(page.getByRole("status")).toHaveText("Notes saved.")
})

test("a dirty draft is not replaced by an authoritative refresh before its debounce", async ({ page }) => {
  const editor = await openNotes(page, "/?empty-notes&app-shell")
  await editor.fill("Local draft")
  await page.evaluate(() => {
    window.standbyFixture.session = {
      ...window.standbyFixture.session!,
      notes: JSON.stringify(["Remote draft", ...Array(9).fill("")]),
    }
    window.dispatchEvent(new Event("online"))
  })
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await expect(editor).toHaveValue("Local draft")
  await expect(page.getByRole("status")).toHaveText("Notes not saved yet.")
  expect(await page.evaluate(() => window.standbyFixture.notesWrites)).toEqual([])
})

test("an uncertain draft stays protected after an overwrite ACK and later remote reconciliation", async ({ page }) => {
  test.setTimeout(45000)
  const editor = await openNotes(page, "/?empty-notes&app-shell", false)
  await page.evaluate(() => {
    window.standbyFixture.notesErrorMode = "reject-then-commit-late"
    window.standbyFixture.notesError = "Response lost"
  })
  await editor.fill("Unknown write")
  await expect(page.getByRole("alert")).toContainText("Response lost")
  await editor.fill("Current intended draft")
  await page.evaluate(() => { window.standbyFixture.notesError = null })
  await expect(page.getByRole("status")).toContainText("Notes acknowledged")
  await page.evaluate(() => {
    window.standbyFixture.settleLateNotes()
  })
  await expect.poll(() => page.evaluate(() => {
    const notes = window.standbyFixture.readSnapshots.at(-1)
    return notes ? JSON.parse(notes)[0] : null
  }), { timeout: 25000 }).toBe("Unknown write")
  await expect(editor).toHaveValue("Current intended draft")
  await expect(page.getByRole("status")).toContainText("Notes acknowledged")
  await page.getByRole("button", { name: "Progress", exact: true }).click()
  await expect(editor).toHaveCount(0)
  await page.getByRole("button", { name: "Now Playing", exact: true }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Notes", exact: false }).click()
  await expect(editor).toHaveValue("Current intended draft")
  await expect(page.getByRole("status")).toContainText("Notes acknowledged")
})

for (const held of ["pre-commit", "committed-ACK"] as const) {
  for (const observation of ["periodic", "reconnect", "Retry"] as const) {
    test(`${observation} read reconciles a remote end/replacement while a ${held} note response stays held`, async ({ page }, testInfo) => {
      test.setTimeout(40000)
      const editor = await openNotes(page, "/?empty-notes&app-shell", false)
      const queuedCount = () => page.evaluate((mode) => mode === "pre-commit"
        ? window.standbyFixture.noteReleases.length : window.standbyFixture.noteAckReleases.length, held)
      await page.evaluate(mode => {
        window.standbyFixture.holdNoteWrites = mode === "pre-commit"
        window.standbyFixture.holdNoteAcks = mode === "committed-ACK"
      }, held)
      await editor.fill("Old session unacknowledged draft")
      await expect.poll(queuedCount).toBe(1)
      await expect(page.getByRole("status")).toHaveText("Saving notes...")
      const readsBefore = await page.evaluate(() => window.standbyFixture.readSnapshots.length)
      const replacement = await page.evaluate(() => ({
        ...window.standbyFixture.session!, id: "replacement-session",
        notes: JSON.stringify(["Replacement memory", ...Array(9).fill("")]),
      }))
      if (observation === "Retry") {
        await page.evaluate(() => {
          window.standbyFixture.error = "Read service unavailable"
          window.dispatchEvent(new Event("online"))
        })
        await expect(page.getByText(/Could not verify session/)).toBeVisible()
      }
      await page.evaluate(({ replace, replacement }) => {
        window.standbyFixture.error = null
        window.standbyFixture.session = replace ? replacement : null
      }, { replace: observation !== "periodic", replacement })
      if (observation === "reconnect") await page.evaluate(() => window.dispatchEvent(new Event("online")))
      if (observation === "Retry") await page.getByRole("button", { name: "Retry", exact: true }).click()
      await expect.poll(() => page.evaluate(() => window.standbyFixture.readSnapshots.length), {
        timeout: observation === "periodic" ? 25000 : 5000,
      }).toBeGreaterThan(readsBefore)
      if (observation === "periodic") {
        await expect(page.getByText("No active session", { exact: true })).toBeVisible()
        await expect(editor).toHaveCount(0)
        await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0)
        // Install the next identity while the old response is STILL outstanding.
        await page.evaluate(replacement => {
          window.standbyFixture.session = replacement
          window.dispatchEvent(new Event("online"))
        }, replacement)
      }
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
      const notes = page.getByRole("button", { name: "Notes", exact: false })
      if (await editor.count() === 0) await notes.click()
      await expect(editor).toHaveValue("Replacement memory")
      await expect(page.getByRole("status")).toHaveText("Notes saved.")
      // The replacement has been observed before the unrelated response settles.
      expect(await queuedCount()).toBe(1)
      const readsWhileHeld = await page.evaluate(() => window.standbyFixture.readSnapshots.length)
      await page.evaluate(({ mode, error }) => {
        if (mode === "pre-commit") window.standbyFixture.releaseNextNote()
        else {
          window.standbyFixture.noteAckError = error
          window.standbyFixture.releaseNextNoteAck()
        }
      }, { mode: held, error: observation === "Retry" ? null : "Old committed response lost" })
      await expect.poll(queuedCount).toBe(0)
      // A fresh read after the old error must remain live and keep the new queue.
      await page.evaluate(() => window.dispatchEvent(new Event("online")))
      await expect.poll(() => page.evaluate(() => window.standbyFixture.readSnapshots.length)).toBeGreaterThan(readsWhileHeld)
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
      await expect(editor).toHaveValue("Replacement memory")
      await expect(page.getByRole("status")).toHaveText("Notes saved.")
      await expect(page.getByRole("alert")).toHaveCount(0)
      await testInfo.attach("liveness-history.json", {
        contentType: "application/json",
        body: JSON.stringify({
          sourceSHA, sourceCommitted, oracleType: "actual-AppShell/mocked-actions-NOT-database",
          held, observation, readsBefore, readsWhileHeld,
          causalOrder: ["note-invoked", held, "remote-end-or-replacement", "authoritative-read",
            "replacement-visible-before-response-release", "old-response-settles", "fresh-read-retains-replacement"],
        }),
      })
    })
  }
}

test("a read begun during a held write cannot replace its newer ACK; a later clean read still adopts", async ({ page }) => {
  const editor = await openNotes(page, "/?empty-notes&app-shell", false)
  await page.evaluate(() => { window.standbyFixture.holdNoteWrites = true })
  await editor.fill("New acknowledged draft")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.noteReleases.length)).toBe(1)
  await page.evaluate(() => {
    window.standbyFixture.holdReads = true
    window.dispatchEvent(new Event("online"))
  })
  await expect.poll(() => page.evaluate(() => window.standbyFixture.readReleases.length)).toBe(1)
  await page.evaluate(() => window.standbyFixture.releaseNextNote())
  await expect(page.getByRole("status")).toHaveText("Notes saved.")
  const completedReads = await page.evaluate(() => window.standbyFixture.readCompletions)
  await page.evaluate(() => window.standbyFixture.releaseNextRead())
  await expect.poll(() => page.evaluate(() => window.standbyFixture.readCompletions)).toBeGreaterThan(completedReads)
  await expect(editor).toHaveValue("New acknowledged draft")
  await page.evaluate(() => {
    window.standbyFixture.holdReads = false
    window.standbyFixture.session = {
      ...window.standbyFixture.session!,
      notes: JSON.stringify(["Later authoritative draft", ...Array(9).fill("")]),
    }
    window.dispatchEvent(new Event("online"))
  })
  await expect(editor).toHaveValue("Later authoritative draft")
  await expect(page.getByRole("status")).toHaveText("Notes saved.")
})

test("multiple queued note writes never suppress reads or consume lifecycle mutation guards", async ({ page }) => {
  const editor = await openNotes(page, "/?empty-notes&app-shell", false)
  await page.evaluate(() => { window.standbyFixture.holdNoteWrites = true })
  await editor.fill("First queued draft")
  await expect.poll(() => page.evaluate(() => window.standbyFixture.noteReleases.length)).toBe(1)
  await editor.fill("Second queued draft")
  await page.evaluate(() => window.standbyFixture.releaseNextNote())
  await expect.poll(() => page.evaluate(() => window.standbyFixture.notesWrites.length)).toBe(2)
  await expect.poll(() => page.evaluate(() => window.standbyFixture.noteReleases.length)).toBe(1)
  const readsBefore = await page.evaluate(() => window.standbyFixture.readSnapshots.length)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect.poll(() => page.evaluate(() => window.standbyFixture.readSnapshots.length)).toBeGreaterThan(readsBefore)
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await expect(editor).toHaveValue("Second queued draft")
  await expect(page.getByRole("status")).toHaveText("Saving notes...")
  await page.evaluate(() => window.standbyFixture.releaseNextNote())
  await expect(page.getByRole("status")).toHaveText("Notes saved.")
  await page.evaluate(() => {
    window.standbyFixture.session = {
      ...window.standbyFixture.session!,
      notes: JSON.stringify(["Fresh after both writes", ...Array(9).fill("")]),
    }
    window.dispatchEvent(new Event("online"))
  })
  await expect(editor).toHaveValue("Fresh after both writes")
  expect(await page.evaluate(() => window.standbyFixture.notesWrites.map(raw => JSON.parse(raw)[0]))).toEqual([
    "First queued draft", "Second queued draft",
  ])
})
