interface RecordedSession {
  game_id: string
  status: string
  record_time: boolean
  duration_minutes: number | null
}

// A projection only. Never infer paused, active, background or opted-out time.
export function recordedMinutes(rows: readonly RecordedSession[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const duration = row.duration_minutes
    if (row.status !== "Finished" || row.record_time !== true || typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) continue
    totals.set(row.game_id, Math.min(Number.MAX_SAFE_INTEGER, (totals.get(row.game_id) ?? 0) + duration))
  }
  return totals
}
