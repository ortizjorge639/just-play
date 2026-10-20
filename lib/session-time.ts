import type { SessionStatus } from "./types"

export interface SessionClock {
  status: SessionStatus
  started_at: string | null
  paused_elapsed_seconds?: number | null
  record_time?: boolean
  duration_minutes?: number | null
}

/** Only Playing accrues time; LockedIn timestamps are lifecycle metadata. */
export function getSessionElapsedSeconds(session: SessionClock, now = Date.now()): number {
  if (session.record_time === false || session.status === "LockedIn") return 0
  if (session.status === "Finished") {
    return Math.max(0, session.duration_minutes ?? 0) * 60
  }
  const saved = Math.max(0, session.paused_elapsed_seconds ?? 0)
  if (session.status === "Paused") return saved
  const started = session.started_at ? Date.parse(session.started_at) : NaN
  return saved + (Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0)
}

/** The caller validates the state transition and persists this with compare-and-set. */
export function getSessionTransitionTiming(
  session: SessionClock,
  newStatus: SessionStatus,
  now = Date.now()
) {
  const elapsed = getSessionElapsedSeconds(session, now)
  const updates: {
    status: SessionStatus
    started_at?: string
    ended_at?: string
    active?: boolean
    duration_minutes?: number
    paused_elapsed_seconds?: number
  } = { status: newStatus }
  if (newStatus === "Paused") updates.paused_elapsed_seconds = elapsed
  if (newStatus === "Playing") {
    updates.started_at = new Date(now).toISOString()
    if (session.status === "LockedIn") updates.paused_elapsed_seconds = 0
  }
  if (newStatus === "Finished") {
    updates.active = false
    updates.ended_at = new Date(now).toISOString()
    updates.duration_minutes = Math.round(elapsed / 60)
    updates.paused_elapsed_seconds = elapsed
  }
  if (session.record_time === false) {
    updates.duration_minutes = 0
    updates.paused_elapsed_seconds = 0
  }
  return updates
}
