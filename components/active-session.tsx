"use client"

import { useState, useEffect, useCallback, useTransition, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { 
  updateSessionStatus, 
  updateSessionNotes, 
  updateSessionGoal,
  markGameBeaten,
  abandonGame
} from "@/app/actions"
import type { Session, Game, SessionStatus } from "@/lib/types"
import { SessionNotepad } from "./session-notepad"
import { useXPToast } from "./xp-toast"
import { StillPlayingModal } from "./still-playing-modal"

type NudgeStage = "none" | "first" | "second"
const DEFAULT_ESTIMATED_MINUTES = 60

interface ActiveSessionProps {
  session: Session & { games: Game; progress: { total_sessions: number; total_time_minutes: number } | null }
  onFinished: () => void
  onSessionUpdated?: (updates: Partial<Session>) => void
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

export function ActiveSession({ session, onFinished, onSessionUpdated }: ActiveSessionProps) {
  const [status, setStatus] = useState<SessionStatus>(session.status)
  const [isPending, startTransition] = useTransition()
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showTimer, setShowTimer] = useState(true)
  const [notes, setNotes] = useState(session.notes || "")
  const [sessionGoal, setSessionGoal] = useState(session.session_goal || "")
  const showXPToast = useXPToast()
  const [showEndOptions, setShowEndOptions] = useState(false)
  const [shimmer, setShimmer] = useState(false)
  const [nudgeStage, setNudgeStage] = useState<NudgeStage>("none")
  const [showNudge, setShowNudge] = useState(false)
  const [autoPaused, setAutoPaused] = useState(false)
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const notesRef = useRef(notes)
  const sessionIdRef = useRef(session.id)
  const [prevSessionId, setPrevSessionId] = useState(session.id)
  const [prevPropStatus, setPrevPropStatus] = useState(session.status)

  // Keep refs in sync and flush pending notes on unmount
  useEffect(() => {
    notesRef.current = notes
    sessionIdRef.current = session.id
  })

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
        updateSessionNotes(sessionIdRef.current, notesRef.current)
      }
    }
  }, [])

  const game = session.games
  const isPlaying = status === "Playing"
  const isPaused = status === "Paused"
  const isLockedIn = status === "LockedIn"

  // Sync state when the session prop itself changes (not local optimistic updates)
  if (prevSessionId !== session.id || session.status !== prevPropStatus) {
    setPrevSessionId(session.id)
    setPrevPropStatus(session.status)
    setStatus(session.status)
    setNotes(session.notes || "")
    setSessionGoal(session.session_goal || "")
  }

  // Live timer - handles pause/resume correctly
  const pausedElapsed = session.paused_elapsed_seconds || 0
  if (status === "Paused" && elapsed !== pausedElapsed) {
    setElapsed(pausedElapsed)
  }

  useEffect(() => {
    if (status !== "Playing") return
    
    // If playing, calculate from started_at + paused time
    const startTime = new Date(session.started_at).getTime()
    const pausedTime = session.paused_elapsed_seconds || 0
    const estimatedSeconds = (game.time_to_beat_minutes ?? game.estimated_session_length ?? DEFAULT_ESTIMATED_MINUTES) * 60
    const firstThreshold = Math.floor(estimatedSeconds * 1.5)
    const secondThreshold = Math.floor(estimatedSeconds * 2.5)
    
    const tick = () => {
      const currentElapsed = Math.floor((Date.now() - startTime) / 1000)
      const totalElapsed = pausedTime + currentElapsed
      setElapsed(totalElapsed)

      // Nudge checks — only fire once per stage
      if (nudgeStage === "none" && totalElapsed >= firstThreshold) {
        setNudgeStage("first")
        setShowNudge(true)
      } else if (nudgeStage === "first" && totalElapsed >= secondThreshold) {
        setNudgeStage("second")
        setShowNudge(true)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session.started_at, session.paused_elapsed_seconds, status, nudgeStage, game.estimated_session_length])

  const transition = useCallback(
    (newStatus: SessionStatus) => {
      setError(null)
      startTransition(async () => {
        try {
          const result = await updateSessionStatus(session.id, newStatus)
          setStatus(newStatus)

          // Sync parent state so prop stays consistent with local status
          const updates: Partial<Session> = { status: newStatus }
          if (newStatus === "Paused") {
            const start = new Date(session.started_at).getTime()
            const currentElapsed = Math.floor((Date.now() - start) / 1000)
            updates.paused_elapsed_seconds = (session.paused_elapsed_seconds || 0) + currentElapsed
          }
          if (newStatus === "Playing" && status === "Paused") {
            updates.started_at = new Date().toISOString()
            setAutoPaused(false)
            setShimmer(true)
            setTimeout(() => setShimmer(false), 1200)
          }
          onSessionUpdated?.(updates)

          if (newStatus === "Finished") {
            if (result?.xpAwarded) showXPToast(result.xpAwarded)
            onFinished()
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Something went wrong")
        }
      })
    },
    [session.id, session.started_at, session.paused_elapsed_seconds, status, onFinished, onSessionUpdated, showXPToast]
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
    setNotes(value)
    onSessionUpdated?.({ notes: value })
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current)
    }
    notesTimeoutRef.current = setTimeout(() => {
      updateSessionNotes(session.id, value)
    }, 1000)
  }

  const handleGoalSave = useCallback(async (goal: string) => {
    setSessionGoal(goal)
    await updateSessionGoal(session.id, goal)
    onSessionUpdated?.({ session_goal: goal })
  }, [session.id, onSessionUpdated])

  const handleMarkBeaten = async () => {
    startTransition(async () => {
      try {
        await markGameBeaten(game.id)
        showXPToast({ total: 50, bonuses: ["🏆 Game beaten!"] })
        onFinished()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    })
  }

  const handleAbandon = async () => {
    startTransition(async () => {
      try {
        await abandonGame(game.id)
        onFinished()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] min-h-dvh md:min-h-0 md:h-[calc(100dvh-8rem)]">
      {/* Cover art — full-width banner on mobile, tall left column on desktop */}
      <div className="relative h-[28vh] md:h-full overflow-hidden md:rounded-xl">
        <Image
          src={game.header_image}
          alt={game.name}
          fill
          className="object-cover"
          sizes="(min-width: 768px) 60vw, 100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-background/80" />

        {/* Resume shimmer — a light sweep across the cover art */}
        <AnimatePresence>
          {shimmer && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="absolute inset-y-0 w-1/3"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                }}
                initial={{ left: "-33%" }}
                animate={{ left: "133%" }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ 
                  backgroundColor: isPaused ? "#FAA61A" : isPlaying ? "#3BA55D" : "#5865F2",
                  animation: isPlaying ? "pulse 2s infinite" : "none"
                }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: isPaused ? "#FAA61A" : isPlaying ? "#3BA55D" : "#5865F2" }}
              >
                {isPaused ? "Paused" : isPlaying ? "Playing" : "Ready"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground leading-tight truncate">
              {game.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Session content — scrollable column on mobile, right panel on desktop */}
      <div className="flex flex-col gap-4 px-6 pt-4 pb-6 overflow-y-auto">
        {/* Auto-paused indicator */}
        <AnimatePresence>
          {autoPaused && isPaused && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-lg bg-[#FAA61A]/10 border border-[#FAA61A]/20 p-3 text-center text-sm text-[#FAA61A] flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Auto-paused after inactivity
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer */}
        <div className="glass-card p-5 relative">
          <button
            onClick={() => setShowTimer(!showTimer)}
            className="absolute top-3 right-3 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={showTimer ? "Hide timer" : "Show timer"}
          >
            {showTimer ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {isPaused ? "Paused" : isLockedIn ? (game.time_to_beat_minutes ? "Avg. Session" : "Est. Time") : "Session"}
            </span>
            
            <AnimatePresence mode="wait">
              {showTimer ? (
                <motion.span
                  key="timer"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`text-4xl font-bold tabular-nums font-mono ${isPaused ? "text-[#FAA61A]" : "text-foreground"}`}
                >
                  {isLockedIn ? `~${game.time_to_beat_minutes ?? game.estimated_session_length}m` : formatTime(elapsed)}
                </motion.span>
              ) : (
                <motion.span
                  key="hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-4xl font-bold text-muted-foreground"
                >
                  --:--
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Genre tags */}
        {game.genres && game.genres.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {game.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Play stats — only if user has previous sessions with this game */}
        {session.progress && session.progress.total_sessions > 0 && (
          <div className="glass-card px-4 py-3 flex items-center gap-3">
            <svg className="h-4 w-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span className="text-sm text-muted-foreground">
              {session.progress.total_sessions} {session.progress.total_sessions === 1 ? "session" : "sessions"}
              {session.progress.total_time_minutes > 0 && (
                <> · {session.progress.total_time_minutes >= 60
                  ? `${Math.floor(session.progress.total_time_minutes / 60)}h ${session.progress.total_time_minutes % 60}m`
                  : `${session.progress.total_time_minutes}m`
                } played</>
              )}
            </span>
          </div>
        )}

        {/* Notes & Goal — available in all active states */}
        {(isLockedIn || isPlaying || isPaused) && (
          <SessionNotepad
            goal={sessionGoal}
            notes={notes}
            onGoalSave={handleGoalSave}
            onNotesChange={handleNotesChange}
          />
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-8">
          {isLockedIn && (
            <button
              onClick={() => transition("Playing")}
              disabled={isPending}
              className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
            >
              {isPending ? "Starting..." : "Start Playing"}
            </button>
          )}

          {isPlaying && (
            <>
              <button
                onClick={() => transition("Paused")}
                disabled={isPending}
                className="h-14 w-full rounded-xl glass-card text-base font-semibold text-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                {isPending ? "Pausing..." : "Pause"}
              </button>
              <button
                onClick={() => setShowEndOptions(true)}
                className="h-12 w-full rounded-xl border border-muted-foreground/20 text-sm font-semibold text-muted-foreground transition-all active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2 hover:border-destructive/50 hover:text-destructive"
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
                className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {isPending ? "Resuming..." : "Resume"}
              </button>
              <button
                onClick={() => setShowEndOptions(true)}
                className="h-12 w-full rounded-xl border border-muted-foreground/20 text-sm font-semibold text-muted-foreground transition-all active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2 hover:border-destructive/50 hover:text-destructive"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                </svg>
                End Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Still Playing? nudge modal */}
      <AnimatePresence>
        {showNudge && (
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
              <h3 className="text-xl font-bold text-foreground mb-1">End Session</h3>
              <p className="text-sm text-muted-foreground mb-6">How did it go?</p>

              <div className="flex flex-col gap-3">
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
                  onClick={handleMarkBeaten}
                  disabled={isPending}
                  className="h-14 w-full rounded-xl text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px] flex items-center gap-3 px-5"
                  style={{ backgroundColor: "#3BA55D" }}
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="flex-1 text-left">I Beat This Game!</span>
                </button>

                <button
                  onClick={handleAbandon}
                  disabled={isPending}
                  className="h-11 w-full rounded-xl text-sm font-medium text-destructive transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                >
                  Abandon Game
                </button>

                <button
                  onClick={() => setShowEndOptions(false)}
                  className="h-11 w-full rounded-xl text-sm font-medium text-muted-foreground transition-all active:scale-[0.98] min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
