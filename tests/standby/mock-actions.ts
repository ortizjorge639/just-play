import type { Game, Session, SessionStatus, StandbyPreferences } from "@/lib/types"

export const game: Game = {
  id: "test-game", name: "A Short Hike", genres: ["Adventure"],
  estimated_session_length: 60, header_image: "/fixture-art", description: "Explore at your own pace.",
  featured: true, source: "test", created_at: "2026-10-01T00:00:00Z",
}
export type FixtureSession = Session & { games: Game; progress: null }
export const initialSession: FixtureSession = {
  id: "test-session", user_id: "test-user", game_id: game.id,
  started_at: new Date(Date.now() - 60000).toISOString(), ended_at: null,
  duration_minutes: 0, status: "Playing", active: true, notes: "",
  session_goal: "Reach the summit", paused_elapsed_seconds: 0, record_time: true,
  xp_awarded: 0, created_at: new Date().toISOString(), games: game, progress: null,
}
export const fixture: {
  session: FixtureSession | null
  error: string | null
  delay: number
  writes: SessionStatus[]
  savedPreferences: StandbyPreferences | null
  gameEndWrites: { kind: "beaten" | "abandoned"; gameId: string; expected?: ExpectedSession | null }[]
} = { session: { ...initialSession }, error: null, delay: 0, writes: [], savedPreferences: null, gameEndWrites: [] }

type ExpectedSession = Pick<Session, "id" | "status" | "started_at" | "paused_elapsed_seconds">

export async function getActiveSession() {
  const snapshot = fixture.session ? { ...fixture.session } : null
  if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay))
  if (fixture.error) throw new Error(fixture.error)
  return snapshot
}
export async function updateSessionStatus(_id: string, status: SessionStatus) {
  if (!fixture.session) throw new Error("Session ended on another device")
  fixture.writes.push(status)
  fixture.session = { ...fixture.session, status, started_at: new Date().toISOString(), active: status !== "Finished" }
  if (status === "Finished") fixture.session = null
  return { session: { ...initialSession, ...fixture.session, status }, xpAwarded: { total: 5, bonuses: [] } }
}
export async function saveStandbyPreferences(preferences: StandbyPreferences) {
  if (fixture.error) throw new Error(fixture.error)
  fixture.savedPreferences = preferences
}
export async function updateSessionNotes() {}
export async function updateSessionGoal() {}
export async function startSessionForGame() {
  fixture.session = { ...initialSession, status: "Playing" }
}
export async function markGameBeaten(gameId: string, expected?: ExpectedSession | null) {
  fixture.gameEndWrites.push({ kind: "beaten", gameId, expected })
  if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay))
}
export async function abandonGame(gameId: string, expected?: ExpectedSession | null) {
  fixture.gameEndWrites.push({ kind: "abandoned", gameId, expected })
  if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay))
}
