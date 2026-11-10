import { createRoot } from "react-dom/client"
import { StrictMode, useState } from "react"
import { ActiveSession } from "@/components/active-session"
import { AppShell } from "@/components/app-shell"
import { CurrentGame } from "@/components/current-game"
import { useSessionReconciliation } from "@/hooks/use-session-reconciliation"
import { useSessionNotes } from "@/hooks/use-session-notes"
import { DEFAULT_STANDBY_PREFERENCES } from "@/components/standby-preferences"
import { ENDED_KEY, fixture, game, getActiveSession, initialSession } from "./mock-actions"
import { LANDING_COOKIE, landingTabFromCookie } from "@/lib/landing"
import type { CompletedGame, Game, StampRule, StandbyPreferences } from "@/lib/types"

declare global {
  interface Window { standbyFixture: typeof fixture }
}
window.standbyFixture = fixture
function StampGameHarness(props: {
  syncError: string | null
  onRetry: () => void
  onSessionStarted: () => void
  onGameBeaten: () => void
}) {
  const rules: StampRule[] = fixture.stampRules
  const [arrived, setArrived] = useState<Game | null>(null)
  const played = Number(new URLSearchParams(window.location.search).get("played") ?? 20)
  return <>
    <CurrentGame
      gameProgress={{
        id: "test-progress", user_id: "test-user", game_id: game.id, status: "playing",
        total_sessions: 1, total_time_minutes: played, started_at: initialSession.created_at,
        completed_at: null, created_at: initialSession.created_at, game,
      }}
      {...props}
      stampRules={rules} isResident={false}
      onArrived={setArrived}
    />
    {arrived ? <p role="status">{arrived.name} moved in</p> : null}
  </>
}
const params = new URLSearchParams(window.location.search)
if (params.has("remote-art")) game.header_image = "https://artwork-fixture.invalid/cover.svg"
if (params.has("untracked")) fixture.session = { ...initialSession, record_time: false }
if (params.has("locked")) fixture.session = { ...initialSession, status: "LockedIn" }
if (params.has("active-game")) fixture.session = null
if (params.has("long")) fixture.session = { ...initialSession, started_at: new Date(Date.now() - 3700 * 1000).toISOString() }
if (params.has("current-game")) fixture.session = null
if (params.has("empty-notes") && fixture.session) {
  fixture.session = { ...fixture.session, notes: JSON.stringify(Array(10).fill("")) }
}
if (params.has("stamp-hours")) fixture.stampRules = [{ kind: "hours", target_minutes: 600, label: null, game_id: null }]
if (params.has("stamp-milestone")) fixture.stampRules = [{ kind: "milestone", target_minutes: null, label: "Reached the second act", game_id: null }]
if (params.has("card-filled")) {
  fixture.nameCard = { tagline: "Slow games, long evenings", play_style: "Cozy and unhurried", favorite_game_ids: ["lib-a"] }
}
const libraryHistory = params.has("card-library")
  ? ["a", "b", "c"].map(k => ({
      ...initialSession, id: `h-${k}`, game_id: `lib-${k}`, active: false, status: "Finished" as const,
      games: { ...game, id: `lib-${k}`, name: `Library ${k.toUpperCase()}` },
    }))
  : []
if (params.has("residents")) {
  fixture.residents = [
    {
      user_id: "test-resident",
      game_id: game.id,
      arrived_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      arrival_source: "test",
      game,
    },
  ]
}
if (params.has("residents-many")) {
  fixture.residents = Array.from({ length: 7 }, (_, i) => ({
    user_id: "test-resident",
    game_id: `many-${i}`,
    arrived_at: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString(),
    arrival_source: "test",
    game: { ...game, id: `many-${i}`, name: `Home ${i + 1}` },
  }))
}
if (params.has("residents-tiers")) {
  fixture.residents = [0, 119, 120, 600, 3000].map((minutes, i) => ({
    user_id: "test-resident",
    game_id: `tier-${i}`,
    arrived_at: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString(),
    arrival_source: "test",
    minutes_played: minutes,
    game: { ...game, id: `tier-${i}`, name: `Tier game ${i + 1}` },
  }))
}
if (params.has("elder")) fixture.residents = fixture.residents.map((r) => ({ ...r, minutes_played: 3000 }))
// ?persist-end: after a finish, reload into the state the server would return.
const ended = params.has("persist-end") ? sessionStorage.getItem(ENDED_KEY) : null
if (ended) {
  fixture.session = null
  const stamp = { user_id: "test-user", game_id: game.id, game }
  if (ended === "beaten") fixture.residents = [{ ...stamp, arrived_at: new Date().toISOString(), arrival_source: "beaten" }]
  if (ended === "abandoned") fixture.postcards = [{ ...stamp, created_at: new Date().toISOString() }]
}
// Stands in for app/page.tsx, which reads the same cookie on the server.
const landingCookie = document.cookie.split("; ").find(part => part.startsWith(`${LANDING_COOKIE}=`))?.split("=")[1]
if (params.has("pieces")) {
  fixture.pieces = [
    { game_id: "many-0", piece: "loft", deck: 0, anchor: 1 },
    { game_id: "many-1", piece: "loft", deck: 1, anchor: 0 },
    { game_id: "many-2", piece: "loft", deck: 9, anchor: 0 },
  ]
}
if (params.has("postcards")) {
  fixture.postcards = [
    {
      user_id: "test-postcard",
      game_id: game.id,
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      game,
    },
  ]
}
const completedGames: CompletedGame[] = params.has("completed-games")
  ? Array.from({ length: 5 }, (_, i) => {
    const completedGame = i === 0
      ? game
      : { ...game, id: `completed-${i}`, name: `Completed game ${i + 1}` }
    return {
      id: `progress-${completedGame.id}`,
      user_id: "test-user",
      game_id: completedGame.id,
      status: "beaten" as const,
      total_sessions: 3,
      total_time_minutes: 120,
      started_at: initialSession.created_at,
      completed_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      created_at: initialSession.created_at,
      game: completedGame,
    }
  })
  : []

function Harness() {
  const { session, sessionReadRevision, updateSession, syncError, refreshSession, invalidateSessionRead, beginMutation, endMutation } = useSessionReconciliation(fixture.session, getActiveSession)
  const notesController = useSessionNotes(session?.id ?? null, session?.notes ?? "", sessionReadRevision, invalidateSessionRead)
  const preferences: StandbyPreferences = {
    ...DEFAULT_STANDBY_PREFERENCES,
    show_clock: !params.has("hidden"),
    reminders: params.has("reminders"),
    keep_awake: params.has("awake"),
  }
  return session ? <ActiveSession session={session}
    onFinished={() => { fixture.session = null; void refreshSession() }}
    onSessionUpdated={(updates) => updateSession(previous => previous ? { ...previous, ...updates } : null)}
    standbyPreferences={preferences}
    syncError={syncError} onRetry={refreshSession} onMutationStart={beginMutation} onMutationEnd={endMutation}
    notesController={notesController}
  /> : params.has("current-game") ? <StampGameHarness
    syncError={syncError} onRetry={refreshSession} onSessionStarted={() => void refreshSession()}
    onGameBeaten={() => window.dispatchEvent(new Event("standby-test-router-refresh"))}
  /> : <p role="status">Session ended on another device.</p>
}
const deckGames = params.has("deck")
  ? ["A", "B"].map(k => ({
    ...game,
    id: `deck-${k}`,
    name: params.has("long-deck") && k === "A"
      ? "The Legend of Zelda: Tears of the Kingdom - A very long library title"
      : `Deck ${k}`,
  }))
  : []
const app = params.has("app-shell")
  ? <AppShell user={{
    id: "test-user", display_name: null, steam_id: null, preferences: {},
    standby_preferences: DEFAULT_STANDBY_PREFERENCES, onboarding_complete: true,
    tutorial_complete: true, streak_enabled: false, total_xp: 0, level: 1,
    streak_count: 0, best_streak: 0, last_session_date: null, created_at: initialSession.created_at,
  }} isAnonymous={params.has("anon")} recommendations={deckGames} activeSession={fixture.session}
    initialTab={landingTabFromCookie(landingCookie)}
    activeGame={ended === "finish" || (params.has("active-game") && sessionStorage.getItem("standby-test-game-beaten") !== "true") ? {
      id: "test-progress", user_id: "test-user", game_id: game.id, status: "playing",
      total_sessions: 1, total_time_minutes: 20, started_at: initialSession.created_at,
      completed_at: null, created_at: initialSession.created_at, game,
    } : null}
    sessionHistory={libraryHistory} nameCard={fixture.nameCard} playerStats={null} residents={fixture.residents} completedGames={completedGames} postcards={fixture.postcards} stampRules={fixture.stampRules} isBoosterPack={params.has("booster")}
    boosterPackStatus={{ packsOpenedToday: 0, packsRemaining: params.has("packs") ? 2 : 0 }} />
  : <Harness />
createRoot(document.getElementById("root")!).render(params.has("strict") ? <StrictMode>{app}</StrictMode> : app)
