import assert from "node:assert/strict"
import { test } from "node:test"
import { getSessionElapsedSeconds, getSessionTransitionTiming } from "./session-time"

const start = "2026-10-17T10:00:00.000Z"
const later = Date.parse("2026-10-17T11:00:00.000Z")

test("lock-in waiting is not play time; actual start sets the clock origin", () => {
  assert.equal(getSessionElapsedSeconds({ status: "LockedIn", started_at: start }, later), 0)
  assert.equal(getSessionElapsedSeconds({ status: "Playing", started_at: new Date(later).toISOString() }, later), 0)
  assert.equal(getSessionElapsedSeconds({ status: "Playing", started_at: start }, later), 3600)
})

test("pause preserves elapsed and resume adds only the current playing segment", () => {
  assert.equal(getSessionElapsedSeconds({ status: "Paused", started_at: start, paused_elapsed_seconds: 120 }, later), 120)
  assert.equal(getSessionElapsedSeconds({
    status: "Playing",
    started_at: "2026-10-17T10:59:00.000Z",
    paused_elapsed_seconds: 120,
  }, later), 180)
})

test("untracked sessions never expose elapsed, saved time or finished duration", () => {
  for (const status of ["LockedIn", "Playing", "Paused", "Finished"] as const) {
    assert.equal(getSessionElapsedSeconds({
      status, started_at: start, paused_elapsed_seconds: 120, duration_minutes: 60, record_time: false,
    }, later), 0)
  }
})

test("legacy recording defaults on; invalid or future clock origins cannot add time", () => {
  assert.equal(getSessionElapsedSeconds({ status: "Playing", started_at: start }, later), 3600)
  assert.equal(getSessionElapsedSeconds({ status: "Playing", started_at: "invalid" }, later), 0)
  assert.equal(getSessionElapsedSeconds({ status: "Playing", started_at: start }, Date.parse(start) - 1000), 0)
  assert.equal(getSessionElapsedSeconds({ status: "Finished", started_at: start, duration_minutes: 7 }, later), 420)
})

test("starting from LockedIn resets started_at and finishing without starting records zero", () => {
  const locked = { status: "LockedIn" as const, started_at: start, paused_elapsed_seconds: 0 }
  assert.deepEqual(getSessionTransitionTiming(locked, "Playing", later), {
    status: "Playing", started_at: new Date(later).toISOString(), paused_elapsed_seconds: 0,
  })
  assert.deepEqual(getSessionTransitionTiming(locked, "Finished", later), {
    status: "Finished", active: false, ended_at: new Date(later).toISOString(),
    duration_minutes: 0, paused_elapsed_seconds: 0,
  })
})

test("multiple pause/resume cycles count only actual playing segments", () => {
  const playing = { status: "Playing" as const, started_at: start, paused_elapsed_seconds: 0 }
  const firstPause = { ...playing, ...getSessionTransitionTiming(playing, "Paused", Date.parse(start) + 120_000) }
  assert.equal(firstPause.paused_elapsed_seconds, 120)
  const resumed = { ...firstPause, ...getSessionTransitionTiming(firstPause, "Playing", later) }
  const pausedAgain = { ...resumed, ...getSessionTransitionTiming(resumed, "Paused", later + 180_000) }
  const finished = getSessionTransitionTiming(pausedAgain, "Finished", later + 3_600_000)
  assert.equal(finished.duration_minutes, 5)
  assert.equal(finished.paused_elapsed_seconds, 300)
})

test("untracked transitions always persist zero timing, but retain lifecycle timestamps", () => {
  const untracked = { status: "Playing" as const, started_at: start, paused_elapsed_seconds: 900, record_time: false }
  for (const status of ["Paused", "Playing", "Finished"] as const) {
    const update = getSessionTransitionTiming(untracked, status, later)
    assert.equal(update.duration_minutes, 0)
    assert.equal(update.paused_elapsed_seconds, 0)
    if (status === "Finished") assert.equal(update.ended_at, new Date(later).toISOString())
  }
})
