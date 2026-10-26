import type { Game, Session } from "@/lib/types"

export type HistoryRow = Session & { games: Game; count: number }

// Back-to-back sessions of one game on the same day read as one row.
export function groupHistory(sessions: (Session & { games: Game })[]): HistoryRow[] {
  const rows: HistoryRow[] = []
  const day = (x: Session) => new Date(x.ended_at ?? x.started_at).toDateString()
  for (const s of sessions) {
    const last = rows[rows.length - 1]
    if (last && last.game_id === s.game_id && day(last) === day(s)) {
      last.duration_minutes = (last.duration_minutes || 0) + (s.duration_minutes || 0)
      last.xp_awarded = (last.xp_awarded || 0) + (s.xp_awarded || 0)
      last.count += 1
    } else {
      rows.push({ ...s, count: 1 })
    }
  }
  return rows
}
