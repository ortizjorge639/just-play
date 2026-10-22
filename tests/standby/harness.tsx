import { createRoot } from "react-dom/client"
import { StrictMode, useState } from "react"
import { ActiveSession } from "@/components/active-session"
import { AppShell } from "@/components/app-shell"
import { CurrentGame } from "@/components/current-game"
import { useSessionReconciliation } from "@/hooks/use-session-reconciliation"
import { useSessionNotes } from "@/hooks/use-session-notes"
import { DEFAULT_STANDBY_PREFERENCES } from "@/components/standby-preferences"
import { fixture, game, getActiveSession, initialSession } from "./mock-actions"
import type { Game, StampRule, StandbyPreferences } from "@/lib/types"

declare global {
  interface Window { standbyFixture: typeof fixture }
}
window.standbyFixture = fixture
function StampGameHarness(props: { syncError: string | null; onRetry: () => void; onSessionStarted: () => void }) {
  const [rules, setRules] = useState<StampRule[]>(fixture.stampRules)
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
      onStampRuleSaved={(gameId, rule) => setRules(prev => [...prev.filter(r => r.game_id !== gameId), ...(rule ? [rule] : [])])}
      onArrived={setArrived}
    />
    {arrived ? <p role="status">{arrived.name} moved in</p> : null}
  </>
}
const params = new URLSearchParams(window.location.search)
if (params.has("untracked")) fixture.session = { ...initialSession, record_time: false }
if (params.has("locked")) fixture.session = { ...initialSession, status: "LockedIn" }
if (params.has("long")) fixture.session = { ...initialSession, started_at: new Date(Date.now() - 3700 * 1000).toISOString() }
if (params.has("current-game")) fixture.session = null
if (params.has("empty-notes") && fixture.session) {
  fixture.session = { ...fixture.session, notes: JSON.stringify(Array(10).fill("")) }
}
if (params.has("stamp-hours")) fixture.stampRules = [{ kind: "hours", target_minutes: 600, label: null, game_id: null }]
if (params.has("stamp-milestone")) fixture.stampRules = [{ kind: "milestone", target_minutes: null, label: "Reached the second act", game_id: null }]
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

function Harness() {
  const { session, sessionReadRevision, updateSession, syncError, refreshSession, invalidateSessionRead, beginMutation, endMutation } = useSessionReconciliation(fixture.session, getActiveSession)
  const notesController = useSessionNotes(session?.id ?? null, session?.notes ?? "", sessionReadRevision, invalidateSessionRead)
  const [preferences, setPreferences] = useState<StandbyPreferences>({
    ...DEFAULT_STANDBY_PREFERENCES,
    show_clock: !params.has("hidden"),
    reminders: params.has("reminders"),
    keep_awake: params.has("awake"),
  })
  return session ? <ActiveSession session={session}
    onFinished={() => { fixture.session = null; void refreshSession() }}
    onSessionUpdated={(updates) => updateSession(previous => previous ? { ...previous, ...updates } : null)}
    standbyPreferences={preferences} onPreferencesSaved={setPreferences}
    syncError={syncError} onRetry={refreshSession} onMutationStart={beginMutation} onMutationEnd={endMutation}
    notesController={notesController}
  /> : params.has("current-game") ? <StampGameHarness
    syncError={syncError} onRetry={refreshSession} onSessionStarted={() => void refreshSession()}
  /> : <p role="status">Session ended on another device.</p>
}
const app = params.has("app-shell")
  ? <AppShell user={{
    id: "test-user", display_name: null, steam_id: null, preferences: {},
    standby_preferences: DEFAULT_STANDBY_PREFERENCES, onboarding_complete: true,
    tutorial_complete: true, streak_enabled: false, total_xp: 0, level: 1,
    streak_count: 0, best_streak: 0, last_session_date: null, created_at: initialSession.created_at,
  }} recommendations={[]} activeSession={fixture.session} activeGame={null}
    sessionHistory={[]} playerStats={null} residents={fixture.residents} postcards={fixture.postcards} stampRules={fixture.stampRules} isBoosterPack={false}
    boosterPackStatus={{ packsOpenedToday: 0, packsRemaining: 0 }} />
  : <Harness />
createRoot(document.getElementById("root")!).render(params.has("strict") ? <StrictMode>{app}</StrictMode> : app)
