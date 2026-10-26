import { test, expect } from "@playwright/test"
import { calculateStreak } from "../../lib/streak"
import { groupHistory } from "../../lib/session-history"
import type { Game, Session } from "../../lib/types"

test("a Saturday night and a Sunday evening session make a 2-day combo on Sunday", () => {
  const today = new Date(2026, 9, 25, 21, 0)
  const info = calculateStreak([new Date(2026, 9, 25, 20, 0), new Date(2026, 9, 24, 22, 0)], today)
  expect(info.consecutive).toBe(2)
  expect(info.weeklyDays).toEqual([false, false, false, false, false, true, true])
})

test("a gap breaks the combo but keeps the best run", () => {
  const today = new Date(2026, 9, 25, 12, 0)
  const days = [25, 22, 21, 20].map((d) => new Date(2026, 9, d, 10, 0))
  const info = calculateStreak(days, today)
  expect(info.consecutive).toBe(1)
  expect(info.bestStreak).toBe(3)
})

function session(id: string, gameId: string, end: Date, minutes: number, xp: number) {
  return {
    id, game_id: gameId, started_at: end.toISOString(), ended_at: end.toISOString(),
    duration_minutes: minutes, xp_awarded: xp, games: {} as Game,
  } as Session & { games: Game }
}

test("history merges same-game same-day neighbours and sums time and XP", () => {
  const rows = groupHistory([
    session("a", "g1", new Date(2026, 9, 25, 20), 1, 0),
    session("b", "g1", new Date(2026, 9, 25, 10), 6, 26),
    session("c", "g2", new Date(2026, 9, 25, 9), 2, 5),
    session("d", "g1", new Date(2026, 9, 24, 9), 3, 5),
  ])
  expect(rows.map((r) => [r.game_id, r.duration_minutes, r.xp_awarded, r.count])).toEqual([
    ["g1", 7, 26, 2],
    ["g2", 2, 5, 1],
    ["g1", 3, 5, 1],
  ])
})
