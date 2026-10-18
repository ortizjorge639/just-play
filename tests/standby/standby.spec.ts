import { test, expect } from "@playwright/test"

test("StandBy traps focus, hides discovery, exits with Escape and restores entry focus", async ({ page }) => {
  await page.goto("/")
  const enter = page.getByRole("button", { name: /Enter StandBy/ })
  await enter.click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("heading", { name: "A Short Hike" })).toBeVisible()
  await expect(dialog).toContainText("Reach the summit")
  await expect(dialog).toContainText("Time recording on")
  await expect(dialog.getByText("Avg. Session")).toHaveCount(0)
  for (let i = 0; i < 10; i++) await page.keyboard.press("Tab")
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(enter).toBeFocused()
})

test("clock visibility is independent of recording; no-record sessions show no elapsed time", async ({ page }) => {
  await page.goto("/?hidden")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog")).toContainText("Clock hidden; time recording on")
  await expect(page.getByLabel(/elapsed time/)).toHaveCount(0)
  await page.goto("/?untracked")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog")).toContainText("Time recording off")
  await expect(page.getByLabel(/elapsed time/)).toHaveCount(0)
})

test("remote pause, finish and fetch errors reconcile without offline success", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await page.evaluate(() => { window.standbyFixture.session!.status = "Paused"; window.dispatchEvent(new Event("focus")) })
  await expect(page.getByRole("dialog").getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
  await page.evaluate(() => { window.standbyFixture.error = "Server unavailable"; window.dispatchEvent(new Event("focus")) })
  await expect(page.getByRole("alert")).toContainText("Server unavailable")
  await expect(page.getByRole("dialog").getByRole("button", { name: "Resume", exact: true })).toBeDisabled()
  await page.evaluate(() => { window.standbyFixture.error = null; window.standbyFixture.session = null; window.dispatchEvent(new Event("online")) })
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("status")).toContainText("Session ended")
})

test("StandBy reminders are optional and never auto-pause", async ({ page }) => {
  await page.clock.install()
  await page.goto("/?long&reminders")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog")).toContainText("Your session will keep running")
  await page.clock.fastForward(3 * 60 * 60 * 1000)
  await expect(page.getByRole("dialog")).toContainText("Playing")
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
  await page.getByRole("button", { name: "Dismiss", exact: true }).click()
  await expect(page.getByRole("dialog")).not.toContainText("A good moment")
  await page.goto("/?long")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog")).not.toContainText("A good moment")
})

test("pause/resume and deliberate finish use the same authoritative session", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Pause", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
  await dialog.getByRole("button", { name: "Resume", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await dialog.getByRole("button", { name: "End session", exact: true }).click()
  await expect(dialog).toContainText("Done for today?")
  await dialog.getByRole("button", { name: "Finish session", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual(["Paused", "Playing", "Finished"])
})

test("preferences persist independently and do not change the current recording contract", async ({ page }) => {
  await page.goto("/")
  await page.getByText("Time & StandBy preferences", { exact: true }).click()
  await page.getByLabel("Record play time for future sessions").uncheck()
  await expect.poll(() => page.evaluate(() => window.standbyFixture.savedPreferences?.record_time)).toBe(false)
  await expect(page.getByText("This session: time recording on.", { exact: false })).toBeVisible()
  await page.getByLabel("Show elapsed clock (recorded sessions only)").uncheck()
  await expect.poll(() => page.evaluate(() => window.standbyFixture.savedPreferences?.show_clock)).toBe(false)
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog")).toContainText("Clock hidden; time recording on")
})

test("a late background read cannot replace a just-paused session", async ({ page }) => {
  await page.clock.install()
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  await page.evaluate(() => { window.standbyFixture.delay = 1000 })
  await page.clock.fastForward(20001)
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await page.clock.fastForward(1001)
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled()
  expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual(["Paused"])
})

test("StandBy is only available after the locked-in session actually starts", async ({ page }) => {
  await page.goto("/?locked")
  await expect(page.getByRole("button", { name: /Enter StandBy/ })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Start Playing", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Start Playing", exact: true }).click()
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog")).toContainText("Playing")
})

for (const choice of [
  { name: "I Beat This Game!", kind: "beaten" },
  { name: "Abandon Game", kind: "abandoned" },
]) {
  test(`normal-screen ${choice.kind} supplies the displayed session snapshot`, async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "End Session", exact: true }).click()
    await page.getByRole("button", { name: choice.name, exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([{
      kind: choice.kind,
      gameId: "test-game",
      expected: {
        id: "test-session", status: "Playing",
        started_at: expect.any(String), paused_elapsed_seconds: 0,
      },
    }])
  })
}

test("the existing current-game screen starts a session and enters StandBy", async ({ page }) => {
  await page.goto("/?current-game")
  await expect(page.getByRole("button", { name: "Start Today's Session", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Start Today's Session", exact: true }).click()
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog").getByRole("heading", { name: "A Short Hike" })).toBeVisible()
})

test("the current-game screen blocks unsafe actions while offline", async ({ page, context }) => {
  await page.goto("/?current-game")
  await expect(page.getByRole("button", { name: "Start Today's Session", exact: true })).toBeEnabled()
  await context.setOffline(true)
  await expect(page.getByRole("alert")).toContainText("Offline.")
  await expect(page.getByRole("button", { name: "Start Today's Session", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "More options", exact: true }).click()
  await expect(page.getByRole("button", { name: "I Beat This Game!", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Abandon Game", exact: true })).toBeDisabled()
  await context.setOffline(false)
  await expect(page.getByRole("button", { name: "I Beat This Game!", exact: true })).toBeEnabled()
})

for (const choice of [
  { name: "I Beat This Game!", kind: "beaten" },
  { name: "Abandon Game", kind: "abandoned" },
]) {
  test(`current-game ${choice.kind} explicitly expects no active session`, async ({ page }) => {
    await page.goto("/?current-game")
    await expect(page.getByRole("button", { name: "Start Today's Session", exact: true })).toBeEnabled()
    await page.evaluate(() => { window.standbyFixture.delay = 10000 })
    await page.getByRole("button", { name: "More options", exact: true }).click()
    await page.getByRole("button", { name: choice.name, exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.standbyFixture.gameEndWrites)).toEqual([{
      kind: choice.kind, gameId: "test-game", expected: null,
    }])
  })
}

test("fullscreen unsupported or denied retains usable full-window StandBy", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false })
  })
  await page.goto("/")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Fullscreen is unavailable")
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
})

test("wake lock unsupported has an explicit fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined })
  })
  await page.goto("/?awake")
  await page.getByRole("button", { name: /Enter StandBy/ }).click()
  await expect(page.getByRole("dialog")).toContainText(/Keep-awake (unavailable|denied)/)
})

test("wake lock denial is explicit and fullscreen denial does not close StandBy", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => { throw new Error("Permission denied") } } })
      Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true })
      Element.prototype.requestFullscreen = async () => { throw new Error("Permission denied") }
    })
    await page.goto("/?awake")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    await expect(page.getByRole("dialog")).toContainText("Keep-awake denied")
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click()
    await expect(page.getByRole("dialog")).toContainText("Fullscreen was not allowed")
    await expect(page.getByRole("button", { name: "Exit StandBy" })).toBeEnabled()
  })

  test("wake lock releases on hide/unmount and reacquires only while visible", async ({ page }) => {
    await page.addInitScript(() => {
      const state = { acquired: 0, released: 0, visible: true }
      Object.assign(window, { wakeState: state })
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state.visible ? "visible" : "hidden" })
      Object.defineProperty(navigator, "wakeLock", { configurable: true, value: {
        request: async () => {
          state.acquired++
          const sentinel = new EventTarget()
          return Object.assign(sentinel, {
            released: false,
            async release() {
              state.released++
              sentinel.dispatchEvent(new Event("release"))
            },
          })
        },
      } })
    })
    await page.goto("/?awake")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    await expect(page.getByRole("dialog")).toContainText("Keep-awake active")
    await page.evaluate(() => {
      const state = Reflect.get(window, "wakeState") as { visible: boolean }
      state.visible = false
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await expect(page.getByRole("dialog")).toContainText("Keep-awake released")
    await page.evaluate(() => {
      const state = Reflect.get(window, "wakeState") as { visible: boolean }
      state.visible = true
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await expect(page.getByRole("dialog")).toContainText("Keep-awake active")
    await page.getByRole("button", { name: "Exit StandBy" }).click()
    expect(await page.evaluate(() => Reflect.get(window, "wakeState"))).toMatchObject({ acquired: 2, released: 2 })
  })

  test("late wake-lock acquisition after exit is immediately released", async ({ page }) => {
    await page.addInitScript(() => {
      const state = { released: 0, grant: () => {} }
      Object.assign(window, { wakeState: state })
      Object.defineProperty(navigator, "wakeLock", { configurable: true, value: {
        request: () => new Promise(resolve => {
          state.grant = () => resolve({
            release: async () => { state.released++ },
            addEventListener: () => {},
          })
        }),
      } })
    })
    await page.goto("/?awake")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    await page.getByRole("button", { name: "Exit StandBy" }).click()
    await page.evaluate(() => {
      const state = Reflect.get(window, "wakeState") as { grant: () => void }
      state.grant()
    })
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "wakeState").released)).toBe(1)
  })

  test("fullscreen state and cleanup follow browser events", async ({ page }) => {
    await page.addInitScript(() => {
      let element: Element | null = null
      Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true })
      Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => element })
      Element.prototype.requestFullscreen = async function () {
        element = this
        document.dispatchEvent(new Event("fullscreenchange"))
      }
      document.exitFullscreen = async () => {
        element = null
        document.dispatchEvent(new Event("fullscreenchange"))
      }
    })
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click()
    await expect(page.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Exit StandBy" }).click()
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
  })

  test("offline controls remain disabled until authoritative reconnect", async ({ page, context }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    await context.setOffline(true)
    await expect(page.getByRole("dialog")).toContainText("Offline.")
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled()
    expect(await page.evaluate(() => window.standbyFixture.writes)).toEqual([])
    await context.setOffline(false)
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  })

  test("visible polling discovers remote finish without a focus event", async ({ page }) => {
    await page.clock.install()
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    await page.evaluate(() => { window.standbyFixture.session = null })
    await page.clock.fastForward(21000)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByRole("status")).toContainText("Session ended")
  })

  test("a stalled reconciliation times out explicitly, then retry recovers", async ({ page }) => {
    await page.clock.install()
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    await page.evaluate(() => { window.standbyFixture.delay = 60000; window.dispatchEvent(new Event("focus")) })
    await page.clock.fastForward(16000)
    await expect(page.getByRole("alert")).toContainText("Connection timed out")
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled()
    await page.evaluate(() => { window.standbyFixture.delay = 0 })
    await page.getByRole("button", { name: "Reconnect / retry", exact: true }).click()
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled()
  })
for (const viewport of [
  { width: 390, height: 844 }, { width: 844, height: 390 },
  { width: 768, height: 1024 }, { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`responsive StandBy at ${viewport.width}x${viewport.height} respects viewport and reduced motion`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page.getByRole("button", { name: /Enter StandBy/ }).click()
    const dialog = page.getByRole("dialog")
    const bounds = await dialog.boundingBox()
    expect(bounds?.width).toBe(viewport.width)
    expect(bounds?.height).toBe(viewport.height)
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await dialog.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true)
    await expect(dialog.getByRole("button", { name: "Exit StandBy" })).toBeVisible()
    expect(await dialog.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
  })
}
