import { createRoot } from "react-dom/client"
import { useState } from "react"
import { ActiveSession } from "@/components/active-session"
import { CurrentGame } from "@/components/current-game"
import { useSessionReconciliation } from "@/hooks/use-session-reconciliation"
import { DEFAULT_STANDBY_PREFERENCES } from "@/components/standby-preferences"
import { fixture, game, getActiveSession, initialSession } from "./mock-actions"
import type { StandbyPreferences } from "@/lib/types"

declare global {
  interface Window { standbyFixture: typeof fixture }
}
window.standbyFixture = fixture
const params = new URLSearchParams(window.location.search)
if (params.has("untracked")) fixture.session = { ...initialSession, record_time: false }
if (params.has("locked")) fixture.session = { ...initialSession, status: "LockedIn" }
if (params.has("long")) fixture.session = { ...initialSession, started_at: new Date(Date.now() - 3700 * 1000).toISOString() }
if (params.has("current-game")) fixture.session = null

function Harness() {
  const { session, updateSession, syncError, refreshSession, beginMutation, endMutation } = useSessionReconciliation(fixture.session, getActiveSession)
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
  /> : params.has("current-game") ? <CurrentGame
    gameProgress={{
      id: "test-progress", user_id: "test-user", game_id: game.id, status: "playing",
      total_sessions: 1, total_time_minutes: 20, started_at: initialSession.created_at,
      completed_at: null, created_at: initialSession.created_at, game,
    }}
    syncError={syncError} onRetry={refreshSession} onSessionStarted={() => void refreshSession()}
  /> : <p role="status">Session ended on another device.</p>
}
createRoot(document.getElementById("root")!).render(<Harness />)
