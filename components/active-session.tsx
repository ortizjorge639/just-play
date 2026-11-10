"use client"

import { useState, useEffect, useCallback, useTransition, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  updateSessionStatus, 
  updateSessionGoal,
  markGameBeaten,
  abandonGame,
  getResidents,
} from "@/app/actions"
import type { Session, Game, SessionStatus, Resident } from "@/lib/types"
import { SessionNotepad } from "./session-notepad"
import { useXPToast } from "./xp-toast"
import { StillPlayingModal } from "./still-playing-modal"
import * as Dialog from "@radix-ui/react-dialog"
import { StandbySession } from "./standby-session"
import type { StandbyPreferences } from "@/lib/types"
import { getSessionElapsedSeconds } from "@/lib/session-time"
import { SessionNotesSaveError, type SessionNotesController } from "@/hooks/use-session-notes"
import { GameArtwork } from "./game-artwork"

type NudgeStage = "none" | "first" | "second"
const DEFAULT_ESTIMATED_MINUTES = 60

interface ActiveSessionProps {
  session: Session & { games: Game; progress: { total_sessions: number; total_time_minutes: number } | null }
  onFinished: () => void
  onSessionUpdated?: (updates: Partial<Session>) => void
  onArrived?: (game: Game) => void
  standbyPreferences: StandbyPreferences
  syncError: string | null
  onRetry: () => void
  onMutationStart: () => void
  onMutationEnd: () => void
  notesController: SessionNotesController
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function ActiveSession(props: ActiveSessionProps) {
  return <ActiveSessionContent key={props.session.id} {...props} />
}

function ActiveSessionContent({ session, onFinished, onSessionUpdated, onArrived, standbyPreferences, syncError, onRetry, onMutationStart, onMutationEnd, notesController }: ActiveSessionProps) {
  const [status, setStatus] = useState<SessionStatus>(session.status)
  const [isPending, startTransition] = useTransition()
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [residents, setResidents] = useState<Resident[]>([])
  const { draft: notes, error: notesError, saveState: notesSaveState, flush: flushNotes, getDraft } = notesController
  const notesMessage = notesSaveState === "acknowledged"
    ? "Notes acknowledged. The final draft will be saved again when finishing."
    : notesSaveState === "saving"
      ? "Saving notes..."
      : notesSaveState === "error"
        ? "Notes not saved. Your draft is still here."
        : null
  const showTimer = standbyPreferences.show_clock && session.record_time !== false
  const [standby, setStandby] = useState(false)
  const [sessionGoal, setSessionGoal] = useState(session.session_goal || "")
  const showXPToast = useXPToast()
  const [showEndOptions, setShowEndOptions] = useState(false)
  // Marking a game beaten cannot be undone, so it asks once before it commits.
  const [confirmBeaten, setConfirmBeaten] = useState(false)
  const openEndOptions = () => {
    setConfirmBeaten(false)
    setShowEndOptions(true)
  }
  const [shimmer, setShimmer] = useState(false)
  const [nudgeStage, setNudgeStage] = useState<NudgeStage>("none")
  const [showNudge, setShowNudge] = useState(false)
  const [autoPaused, setAutoPaused] = useState(false)
  const finalizingRef = useRef(false)
  const [prevPropStatus, setPrevPropStatus] = useState(session.status)

  const game = session.games
  const isPlaying = status === "Playing"
  const isPaused = status === "Paused"
  const isLockedIn = status === "LockedIn"

  // Sync state when the session prop itself changes (not local optimistic updates)
  if (session.status !== prevPropStatus) {
    setPrevPropStatus(session.status)
    setStatus(session.status)
    setSessionGoal(session.session_goal || "")
  }

  // Live timer - handles pause/resume correctly
  const pausedElapsed = session.paused_elapsed_seconds || 0
  if (status === "Paused" && elapsed !== pausedElapsed) {
    setElapsed(pausedElapsed)
  }

  useEffect(() => {
    if (status !== "Playing" || session.record_time === false) return
    
    const estimatedSeconds = (game.time_to_beat_minutes ?? game.estimated_session_length ?? DEFAULT_ESTIMATED_MINUTES) * 60
    const firstThreshold = Math.floor(estimatedSeconds * 1.5)
    const secondThreshold = Math.floor(estimatedSeconds * 2.5)
    
    const tick = () => {
      const totalElapsed = getSessionElapsedSeconds({
        status,
        started_at: session.started_at,
        paused_elapsed_seconds: session.paused_elapsed_seconds,
        record_time: session.record_time,
      })
      setElapsed(totalElapsed)

      // Nudge checks — only fire once per stage
      if (!standby && nudgeStage === "none" && totalElapsed >= firstThreshold) {
        setNudgeStage("first")
        setShowNudge(true)
      } else if (!standby && nudgeStage === "first" && totalElapsed >= secondThreshold) {
        setNudgeStage("second")
        setShowNudge(true)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session.started_at, session.paused_elapsed_seconds, session.record_time, status, nudgeStage, game.estimated_session_length, game.time_to_beat_minutes, standby])

  // Fetch residents when component mounts to check if current game is resident
  useEffect(() => {
    const loadResidents = async () => {
      try {
        const data = await getResidents()
        setResidents(data)
      } catch (err) {
        console.warn("[residents] Failed to fetch:", err)
      }
    }
    loadResidents()
  }, [])

  const transition = useCallback(
    (newStatus: SessionStatus) => {
      if (syncError || isPending || finalizingRef.current) return
      finalizingRef.current = newStatus === "Finished"
      onMutationStart()
      setError(null)
      startTransition(async () => {
        try {
          if (newStatus === "Finished") await flushNotes()
          const result = await updateSessionStatus(session.id, newStatus, {
            status: session.status,
            started_at: session.started_at,
            paused_elapsed_seconds: session.paused_elapsed_seconds || 0,
          }, newStatus === "Finished" ? {
            notes: getDraft(),
          } : undefined)
          setStatus(result.session.status)
          if (newStatus === "Playing") {
            setAutoPaused(false)
            if (!standby) {
              setShimmer(true)
              setTimeout(() => setShimmer(false), 1200)
            }
          }
          onSessionUpdated?.(result.session)

          if (newStatus === "Finished") {
            if (!standby && result?.xpAwarded) showXPToast(result.xpAwarded)
            onFinished()
          }
        } catch (e) {
          if (!(e instanceof SessionNotesSaveError)) setError(e instanceof Error ? e.message : "Something went wrong")
        } finally {
          finalizingRef.current = false
          onMutationEnd()
          onRetry()
        }
      })
    },
    [session, standby, syncError, isPending, onFinished, onSessionUpdated, showXPToast, onRetry, onMutationStart, onMutationEnd, flushNotes, getDraft]
  )

  const handleNudgeDismiss = useCallback(() => {
    setShowNudge(false)
  }, [])

  const handleNudgeFinish = useCallback(() => {
    setShowNudge(false)
    transition("Finished")
  }, [transition])

  const handleAutoPause = useCallback(() => {
    setShowNudge(false)
    setAutoPaused(true)
    transition("Paused")
  }, [transition])

  // Auto-save notes with debounce
  const handleNotesChange = (value: string) => {
    if (finalizingRef.current || syncError) return
    notesController.change(value)
  }

  const handleGoalSave = useCallback(async (goal: string) => {
    if (syncError) {
      setError("Reconnect before saving a goal.")
      return
    }
    try {
      await updateSessionGoal(session.id, goal)
      setSessionGoal(goal)
      onSessionUpdated?.({ session_goal: goal })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save session goal.")
    }
  }, [session.id, onSessionUpdated, syncError])

  const handleMarkBeaten = async () => {
    if (syncError || isPending || finalizingRef.current) return
    finalizingRef.current = true
    setShowEndOptions(false)
    setError(null)
    onMutationStart()
    startTransition(async () => {
      try {
        await flushNotes()
        
        // Read residents BEFORE marking beaten to detect if this game is already resident
        const residentsBefore = await getResidents()
        const residentGameIdsBefore = residentsBefore.map(r => r.game_id)
        
        // Mark as beaten (triggers DB resident creation)
        await markGameBeaten(game.id, {
          id: session.id,
          status: session.status,
          started_at: session.started_at,
          paused_elapsed_seconds: session.paused_elapsed_seconds || 0,
        }, getDraft())
        
        // Fetch residents after finish to check for new arrivals
        const residentsAfter = await getResidents()
        const residentGameIdsAfter = residentsAfter.map(r => r.game_id)
        
        // Check if this game is a new resident (wasn't before, is now)
        const wasResident = residentGameIdsBefore.includes(game.id)
        const isNowResident = residentGameIdsAfter.includes(game.id)
        if (!wasResident && isNowResident && onArrived) {
          onArrived(game)
        }
        
        setResidents(residentsAfter)
        showXPToast({ total: 50, bonuses: ["🏆 Game beaten!"] })
        onFinished()
      } catch (e) {
        if (!(e instanceof SessionNotesSaveError)) setError(e instanceof Error ? e.message : "Something went wrong")
      } finally {
        finalizingRef.current = false
        onMutationEnd()
        onRetry()
      }
    })
  }

  const handleAbandon = async () => {
    if (syncError || isPending || finalizingRef.current) return
    finalizingRef.current = true
    setShowEndOptions(false)
    setError(null)
    onMutationStart()
    startTransition(async () => {
      try {
        await flushNotes()
        await abandonGame(game.id, {
          id: session.id,
          status: session.status,
          started_at: session.started_at,
          paused_elapsed_seconds: session.paused_elapsed_seconds || 0,
        }, getDraft())
        onFinished()
      } catch (e) {
        if (!(e instanceof SessionNotesSaveError)) setError(e instanceof Error ? e.message : "Something went wrong")
      } finally {
        finalizingRef.current = false
        onMutationEnd()
        onRetry()
      }
    })
  }

  return (
    <Dialog.Root open={standby} onOpenChange={setStandby}>
    <div className="session-stage mx-auto w-full max-w-[1440px] px-4 pb-8 md:px-8">
      <div data-testid="now-playing-artwork" className="relative mx-auto aspect-video w-full max-w-[960px] overflow-hidden rounded-xl">
        <GameArtwork
          src={game.header_image}
          alt={game.name}
          sizes="(min-width: 960px) 960px, calc(100vw - 2rem)"
          className="absolute inset-0"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        <AnimatePresence>
          {shimmer && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="absolute inset-y-0 w-1/3"
                style={{
                  background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--foreground) 8%, transparent), transparent)",
                }}
                initial={{ left: "-33%" }}
                animate={{ left: "133%" }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-end p-3 sm:p-6">
          <h1 className="hidden min-w-0 flex-1 break-words text-3xl font-semibold leading-tight text-white lg:block">
            {game.name}
          </h1>
          {!isLockedIn ? (
            <Dialog.Trigger asChild>
              <button
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-white/25 bg-black/70 px-3 text-sm font-medium text-white transition-colors hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-4"
                onClick={() => setShowNudge(false)}
              >
                Enter StandBy
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M7 7h10v10" />
                </svg>
              </button>
            </Dialog.Trigger>
          ) : null}
        </div>
      </div>
      <h1 className="mx-auto mt-3 w-full max-w-[960px] break-words text-2xl font-semibold leading-tight text-foreground lg:hidden">
        {game.name}
      </h1>

      <div className="mt-4 flex min-w-0 flex-col">
        <div
          role="group"
          aria-label={`Session controls, ${status.toLowerCase()}`}
          className="grid min-w-0 gap-4 rounded-xl border border-border bg-card px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-6"
        >
          <div className="min-w-0">
            {showTimer ? (
              isLockedIn ? (
                <p className="text-lg tabular-nums text-muted-foreground">
                  ~{game.time_to_beat_minutes ?? game.estimated_session_length ?? DEFAULT_ESTIMATED_MINUTES}m estimated
                </p>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <time
                    dateTime={`PT${elapsed}S`}
                    aria-label={syncError ? "Last known elapsed session time" : "Elapsed session time"}
                    className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-5xl"
                  >
                    {formatTime(elapsed)}
                  </time>
                  {syncError ? <span className="text-sm text-muted-foreground">Last known</span> : null}
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {session.record_time === false ? "Untracked" : "Clock hidden"}
              </p>
            )}
          </div>
          <fieldset disabled={isPending || !!syncError} className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          {isLockedIn && (
            <button
              onClick={() => transition("Playing")}
              disabled={isPending}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-highlight disabled:opacity-50"
            >
              <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              {isPending ? "Starting..." : "Start Playing"}
            </button>
          )}

          {isPlaying && (
            <>
              <button
                onClick={() => transition("Paused")}
                disabled={isPending}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-background disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                {isPending ? "Pausing..." : "Pause"}
              </button>
              <button
                onClick={openEndOptions}
                className="flex min-h-11 items-center justify-center gap-2 px-2 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                </svg>
                End Session
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={() => transition("Playing")}
                disabled={isPending}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {isPending ? "Resuming..." : "Resume"}
              </button>
              <button
                onClick={openEndOptions}
                className="flex min-h-11 items-center justify-center gap-2 px-2 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                </svg>
                End Session
              </button>
            </>
          )}
          </fieldset>
        </div>

        {syncError ? <div role="alert" className="px-4 py-3 text-sm text-muted-foreground md:px-6">
          {syncError} <button onClick={onRetry} className="min-h-11 px-2 text-foreground underline underline-offset-4">Retry</button>
        </div> : null}
        {autoPaused && isPaused ? <p role="status" className="px-4 py-3 text-sm text-info md:px-6">Auto-paused after inactivity</p> : null}
        {(error || notesError) ? <p role="alert" className="px-4 py-3 text-sm text-destructive md:px-6">{error || notesError}</p> : null}

        <div className="mt-6 grid min-w-0 gap-6">
          {(isLockedIn || isPlaying || isPaused) && (
            <fieldset disabled={isPending || !!syncError} className="flex min-w-0 flex-col gap-2">
              <SessionNotepad
                goal={sessionGoal}
                notes={notes}
                onGoalSave={handleGoalSave}
                onNotesChange={handleNotesChange}
              />
              {notesMessage ? <p role="status" className="text-xs text-muted-foreground">{notesMessage}</p> : null}
            </fieldset>
          )}
          {residents.some(r => r.game_id === game.id) ? <p className="text-sm text-muted-foreground">This game has moved into your home.</p> : null}
          {session.progress && session.progress.total_sessions > 0 ? (
            <p className="text-sm text-muted-foreground">
              {session.progress.total_sessions} {session.progress.total_sessions === 1 ? "session" : "sessions"}
              {session.progress.total_time_minutes > 0 ? ` · ${session.progress.total_time_minutes >= 60
                ? `${Math.floor(session.progress.total_time_minutes / 60)}h ${session.progress.total_time_minutes % 60}m`
                : `${session.progress.total_time_minutes}m`} played` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {/* Still Playing? nudge modal */}
      <AnimatePresence>
        {showNudge && isPlaying && !standby && !syncError && (
          <StillPlayingModal
            elapsed={elapsed}
            onStillPlaying={handleNudgeDismiss}
            onFinishSession={handleNudgeFinish}
            onAutoPause={handleAutoPause}
          />
        )}
      </AnimatePresence>

      {/* End Session Options Modal */}
      <AnimatePresence>
        {showEndOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEndOptions(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl bg-background p-6 pb-10"
            >
              <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted" />
              {confirmBeaten ? (
                <>
                  <h3 className="text-xl font-bold text-foreground mb-1">Beat {game.name}?</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    This ends the session and marks the game as beaten. It can&apos;t be undone.
                  </p>
                  <fieldset disabled={isPending || !!syncError} className="flex flex-col gap-3">
                    <button
                      onClick={handleMarkBeaten}
                      className="h-14 w-full rounded-xl text-base font-semibold text-success-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                      style={{ backgroundColor: "var(--success)" }}
                    >
                      Yes, I beat it
                    </button>
                    <button
                      onClick={() => setConfirmBeaten(false)}
                      className="h-11 w-full rounded-xl text-sm font-medium text-muted-foreground transition-all active:scale-[0.98] min-h-[44px]"
                    >
                      Not yet
                    </button>
                  </fieldset>
                </>
              ) : (
              <>
              <h3 className="text-xl font-bold text-foreground mb-1">End Session</h3>
              <p className="text-sm text-muted-foreground mb-6">How did it go?</p>

              <fieldset disabled={isPending || !!syncError} className="flex flex-col gap-3">
                <button
                  onClick={() => { transition("Finished"); setShowEndOptions(false) }}
                  disabled={isPending}
                  className="h-14 w-full rounded-xl glass-card text-base font-semibold text-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px] flex items-center gap-3 px-5"
                >
                  <svg className="h-5 w-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="flex-1 text-left">Done for Today</span>
                  <span className="text-xs text-muted-foreground">Continue later</span>
                </button>

                <button
                  onClick={() => setConfirmBeaten(true)}
                  disabled={isPending}
                  className="h-14 w-full rounded-xl text-base font-semibold text-success-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px] flex items-center gap-3 px-5"
                  style={{ backgroundColor: "var(--success)" }}
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="flex-1 text-left">I Beat This Game!</span>
                </button>

                <button
                  onClick={handleAbandon}
                  disabled={isPending}
                  className="h-11 w-full rounded-xl border border-border text-sm font-medium text-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                >
                  Set Game Aside
                </button>

                <button
                  onClick={() => setShowEndOptions(false)}
                  className="h-11 w-full rounded-xl text-sm font-medium text-muted-foreground transition-all active:scale-[0.98] min-h-[44px]"
                >
                  Cancel
                </button>
              </fieldset>
              </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {standby && (isPlaying || isPaused) ? <StandbySession
      session={{ ...session, status, notes }}
      notesStatus={notesSaveState === "saved" ? null : notesMessage}
      elapsed={formatTime(elapsed)}
      elapsedSeconds={elapsed}
      preferences={standbyPreferences}
      pending={isPending}
      syncError={syncError}
      error={error || notesError}
      onRetry={onRetry}
      onTransition={transition}
      onExit={() => setStandby(false)}
    /> : null}
    </Dialog.Root>
  )
}
