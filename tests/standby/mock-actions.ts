import type { Game, Session, SessionStatus, StandbyPreferences, Resident, Postcard, SettlementPiece, StampRule, StampRuleInput, NameCard, NameCardInput } from "@/lib/types"

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
  holdReads: boolean
  readReleases: (() => void)[]
  readSnapshots: (string | null)[]
  readCompletions: number
  releaseNextRead: () => void
  writes: SessionStatus[]
  savedPreferences: StandbyPreferences | null
  gameEndWrites: { kind: "beaten" | "abandoned"; gameId: string; expected?: ExpectedSession | null }[]
  notesDelay: number
  holdNoteWrites: boolean
  noteReleases: (() => void)[]
  releaseNextNote: () => void
  holdNoteAcks: boolean
  noteAckReleases: (() => void)[]
  releaseNextNoteAck: () => void
  noteAckError: string | null
  finalizationDelay: number
  notesError: string | null
  notesErrorMode: "before-commit" | "commit-then-reject" | "reject-then-commit-late"
  deferredNotes: { id: string; notes: string }[]
  settleLateOnFinish: boolean
  settleLateNotes: () => void
  rejectedLateNotes: number
  schema020: boolean
  finalDrafts: string[]
  creationError: string | null
  completionError: string | null
  notesWrites: string[]
  finishedNotes: string[]
  events: { kind: "notes-start" | "notes-saved" | "notes-late" | "notes-ack-held" | "notes-ack-released" | "finish" | "beaten" | "abandoned"; notes: string }[]
  residents: Resident[]
  postcards: Postcard[]
  pieces: SettlementPiece[]
  stampRules: StampRule[]
  stampCalls: string[]
  nameCard: NameCard | null
  cardCalls: NameCardInput[]
  emoteCalls: string[]
} = {
  session: { ...initialSession }, error: null, delay: 0, writes: [], savedPreferences: null, gameEndWrites: [],
  holdReads: false, readReleases: [], readSnapshots: [], readCompletions: 0,
  releaseNextRead: () => { fixture.readReleases.shift()?.() },
  notesDelay: 0, finalizationDelay: 0, notesError: null, notesWrites: [], finishedNotes: [], events: [],
  holdNoteWrites: false, noteReleases: [],
  releaseNextNote: () => { fixture.noteReleases.shift()?.() },
  holdNoteAcks: false, noteAckReleases: [], noteAckError: null,
  releaseNextNoteAck: () => { fixture.noteAckReleases.shift()?.() },
  creationError: null, completionError: null,
  notesErrorMode: "before-commit", deferredNotes: [], settleLateOnFinish: true,
  settleLateNotes: settleLateNotes, rejectedLateNotes: 0, schema020: true,
  finalDrafts: [],
  residents: [],
  postcards: [],
  pieces: [],
  stampRules: [],
  stampCalls: [],
  nameCard: null,
  cardCalls: [],
  emoteCalls: [],
}

type ExpectedSession = Pick<Session, "id" | "status" | "started_at" | "paused_elapsed_seconds">

export async function getActiveSession() {
  const snapshot = fixture.session ? { ...fixture.session } : null
  fixture.readSnapshots.push(snapshot?.notes ?? null)
  if (fixture.holdReads) await new Promise<void>(resolve => fixture.readReleases.push(resolve))
  if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay))
  if (fixture.error) throw new Error(fixture.error)
  fixture.readCompletions++
  return snapshot
}
export async function updateSessionStatus(
  _id: string,
  status: SessionStatus,
  _expected?: unknown,
  finalNotes?: { notes: string },
) {
  if (!fixture.session) throw new Error("Session ended on another device")
  if (status === "Finished" && !fixture.schema020) {
    throw new Error("Atomic note finalization is unavailable. Database migration 020 is required; your draft remains editable.")
  }
  fixture.writes.push(status)
  if (status === "Finished" && fixture.finalizationDelay) {
    await new Promise(resolve => setTimeout(resolve, fixture.finalizationDelay))
    if (!fixture.session) throw new Error("Session ended on another device")
  }
  if (status === "Finished" && fixture.schema020) {
    if (fixture.settleLateOnFinish) settleLateNotes()
    if (finalNotes) {
      fixture.finalDrafts.push(finalNotes.notes)
      fixture.session = { ...fixture.session, notes: finalNotes.notes }
    }
  }
  const updated = { ...fixture.session, status, started_at: new Date().toISOString(), active: status !== "Finished" }
  fixture.session = updated
  if (status === "Finished") {
    fixture.events.push({ kind: "finish", notes: updated.notes || "" })
    fixture.finishedNotes.push(updated.notes || "")
    sessionStorage.setItem("standby-test-finished-notes", JSON.stringify(fixture.finishedNotes))
    fixture.session = null
  }
  return { session: updated, xpAwarded: { total: 5, bonuses: [] } }
}
export async function saveStandbyPreferences(preferences: StandbyPreferences) {
  if (fixture.error) throw new Error(fixture.error)
  fixture.savedPreferences = preferences
}
export async function updateSessionNotes(id: string, notes: string) {
  fixture.notesWrites.push(notes)
  fixture.events.push({ kind: "notes-start", notes })
  if (fixture.holdNoteWrites) await new Promise<void>(resolve => fixture.noteReleases.push(resolve))
  if (fixture.notesDelay) await new Promise(resolve => setTimeout(resolve, fixture.notesDelay))
  if (fixture.notesError) {
    if (fixture.notesErrorMode === "commit-then-reject") storeNotes(id, notes)
    if (fixture.notesErrorMode === "reject-then-commit-late") fixture.deferredNotes.push({ id, notes })
    throw new Error(fixture.notesError)
  }
  storeNotes(id, notes)
  if (fixture.holdNoteAcks) {
    fixture.events.push({ kind: "notes-ack-held", notes })
    await new Promise<void>(resolve => fixture.noteAckReleases.push(resolve))
    fixture.events.push({ kind: "notes-ack-released", notes })
    if (fixture.noteAckError) throw new Error(fixture.noteAckError)
  }
}
function storeNotes(id: string, notes: string) {
  if (!fixture.session?.active || fixture.session.id !== id) throw new Error("Only active session notes can be edited.")
  fixture.session = { ...fixture.session, notes }
  fixture.events.push({ kind: "notes-saved", notes })
}
export async function updateSessionGoal() {}
export async function startSessionForGame() {
  if (fixture.creationError) throw new Error(fixture.creationError)
  fixture.session = { ...initialSession, status: "Playing" }
}
export async function markGameBeaten(gameId: string, expected?: ExpectedSession | null, finalNotes?: string) {
  fixture.gameEndWrites.push({ kind: "beaten", gameId, expected })
  if (!fixture.schema020) throw new Error("Atomic note finalization is unavailable. Database migration 020 is required; your draft remains editable.")
  if (fixture.completionError) throw new Error(fixture.completionError)
  if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay))
  if (fixture.finalizationDelay) await new Promise(resolve => setTimeout(resolve, fixture.finalizationDelay))
  const beatenGame = fixture.session?.games
  finishGame("beaten", finalNotes)
  // Stands in for the migration 023 trigger, which only adds a resident the first time.
  if (!fixture.residents.some(r => r.game_id === gameId)) {
    fixture.residents = [...fixture.residents, {
      user_id: "test-user",
      game_id: gameId,
      arrived_at: new Date().toISOString(),
      arrival_source: "beaten",
      game: beatenGame,
    }]
  }
}
export async function abandonGame(gameId: string, expected?: ExpectedSession | null, finalNotes?: string) {
  fixture.gameEndWrites.push({ kind: "abandoned", gameId, expected })
  if (!fixture.schema020) throw new Error("Atomic note finalization is unavailable. Database migration 020 is required; your draft remains editable.")
  if (fixture.completionError) throw new Error(fixture.completionError)
  if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay))
  if (fixture.finalizationDelay) await new Promise(resolve => setTimeout(resolve, fixture.finalizationDelay))
  finishGame("abandoned", finalNotes)
}

function settleLateNotes() {
  for (const write of fixture.deferredNotes.splice(0)) {
    if (!fixture.session?.active || fixture.session.id !== write.id) {
      fixture.rejectedLateNotes++
    } else {
      fixture.session = { ...fixture.session, notes: write.notes }
      fixture.events.push({ kind: "notes-late", notes: write.notes })
    }
  }
}

function finishGame(kind: "beaten" | "abandoned", finalNotes?: string) {
  if (fixture.session) {
    if (fixture.settleLateOnFinish) settleLateNotes()
    if (finalNotes !== undefined) {
      fixture.finalDrafts.push(finalNotes)
      fixture.session = { ...fixture.session, notes: finalNotes }
    }

    fixture.finishedNotes.push(fixture.session.notes || "")
    sessionStorage.setItem("standby-test-finished-notes", JSON.stringify(fixture.finishedNotes))
    fixture.events.push({ kind, notes: fixture.session.notes || "" })
    fixture.session = null
  }
}

export async function getResidents(): Promise<Resident[]> {
  return fixture.residents
}

export async function getPostcards(): Promise<Postcard[]> {
  return fixture.postcards
}

export async function deletePostcard(
  _gameId: string
): Promise<{ ok: boolean; error?: string }> {
  // Mock implementation - in real app this would call the RPC
  // Support failure via URL param for testing
  if (new URL(globalThis.location?.href || "").searchParams.has("delete-fail")) {
    return { ok: false, error: "Could not delete postcard. Try again." }
  }
  fixture.postcards = fixture.postcards.filter(p => p.game_id !== _gameId)
  return { ok: true }
}

export async function reInviteGame(
  _gameId: string
): Promise<{ ok: boolean; error?: string }> {
  // The real action starts a session; the postcard stays until the game is beaten.
  // Support failure via URL param for testing
  if (new URL(globalThis.location?.href || "").searchParams.has("reinvite-fail")) {
    return { ok: false, error: "That did not go through. Try again." }
  }
  return { ok: true }
}

function hasParam(name: string) {
  return new URL(globalThis.location?.href || "").searchParams.has(name)
}

export async function getStampRules(): Promise<StampRule[]> {
  return fixture.stampRules
}

export async function setStampRule(
  gameId: string | null,
  rule: StampRuleInput
): Promise<{ ok: boolean; error?: string }> {
  if (hasParam("stamp-save-fail")) return { ok: false, error: "Could not save that. Try again." }
  fixture.stampCalls.push(`set:${gameId ?? "default"}:${rule ? rule.kind : "clear"}`)
  fixture.stampRules = fixture.stampRules.filter(r => r.game_id !== gameId)
  if (rule?.kind === "hours") {
    fixture.stampRules.push({ kind: "hours", target_minutes: rule.targetMinutes, label: null, game_id: gameId })
  } else if (rule?.kind === "milestone") {
    fixture.stampRules.push({ kind: "milestone", target_minutes: null, label: rule.label.trim(), game_id: gameId })
  }
  return { ok: true }
}

export async function confirmStamp(
  gameId: string
): Promise<{ ok: boolean; arrived?: boolean; error?: string }> {
  if (hasParam("stamp-confirm-fail")) return { ok: false, error: "That did not go through. Try again." }
  fixture.stampCalls.push(`confirm:${gameId}`)
  return { ok: true, arrived: true }
}

export async function saveNameCard(
  input: NameCardInput
): Promise<{ ok: boolean; card?: NameCard; error?: string }> {
  if (hasParam("card-save-fail")) return { ok: false, error: "Couldn't save your card. Try again." }
  fixture.cardCalls.push(input)
  const card = {
    tagline: input.tagline.trim() || null,
    play_style: input.playStyle.trim() || null,
    favorite_game_ids: input.favoriteGameIds,
  }
  fixture.nameCard = card
  return { ok: true, card }
}

export async function recordEmote(
  gameId: string,
  emote: string
): Promise<{ ok: boolean; emote?: string; emoted_at?: string; error?: string }> {
  if (hasParam("emote-fail")) return { ok: false, error: "Couldn't save that one." }
  fixture.emoteCalls.push(`${gameId}:${emote}`)
  return { ok: true, emote, emoted_at: new Date().toISOString() }
}

// These surfaces are bundled only for the real AppShell remount test, not exercised.
function outsideHarness(): never { throw new Error("Action outside the StandBy harness contract") }
export const signout = outsideHarness
export const createSession = outsideHarness
export const markTutorialComplete = outsideHarness
export const getBoosterPack = outsideHarness
export const getRecommendations = outsideHarness
export const recordBoosterPackOpen = outsideHarness
export const savePreferences = outsideHarness
