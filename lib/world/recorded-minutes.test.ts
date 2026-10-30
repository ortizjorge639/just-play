import assert from "node:assert/strict"
import { test } from "node:test"
import { recordedMinutes } from "./recorded-minutes"

test("only canonical finished recorded durations deepen residents", () => {
  const rows = Object.freeze([
    { game_id: "a", status: "Finished", record_time: true, duration_minutes: 20 },
    { game_id: "a", status: "Finished", record_time: true, duration_minutes: 7 },
    { game_id: "b", status: "Finished", record_time: true, duration_minutes: 4 },
    ...["Playing", "Paused", "LockedIn"].map(status => ({ game_id: "a", status, record_time: true, duration_minutes: 999 })),
    { game_id: "a", status: "Finished", record_time: false, duration_minutes: 100 },
    ...[-1, NaN, Infinity].map(duration_minutes => ({ game_id: "a", status: "Finished", record_time: true, duration_minutes })),
  ])
  assert.deepEqual([...recordedMinutes(rows)], [["a", 27], ["b", 4]])
})
