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

interface ActiveSessionProps {
  session: Session & { games: Game }
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
  const [showGoalInput, setShowGoalInput] = useState(!session.session_goal)
  const [showEndOptions, setShowEndOptions] = useState(false)
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
    
    const tick = () => {
      const currentElapsed = Math.floor((Date.now() - startTime) / 1000)
      setElapsed(pausedTime + currentElapsed)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session.started_at, session.paused_elapsed_seconds, status])

  const transition = useCallback(
    (newStatus: SessionStatus) => {
      setError(null)
      startTransition(async () => {
        try {
          await updateSessionStatus(session.id, newStatus)
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
          }
          onSessionUpdated?.(updates)

          if (newStatus === "Finished") {
            onFinished()
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Something went wrong")
        }
      })
    },
    [session.id, session.started_at, session.paused_elapsed_seconds, status, onFinished, onSessionUpdated]
  )

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

  const handleSaveGoal = async () => {
    if (sessionGoal.trim()) {
      await updateSessionGoal(session.id, sessionGoal.trim())
      onSessionUpdated?.({ session_goal: sessionGoal.trim() })
      setShowGoalInput(false)
    }
  }

  const handleMarkBeaten = async () => {
    startTransition(async () => {
      try {
        await markGameBeaten(game.id)
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
    <div className="flex flex-1 flex-col min-h-dvh">
      {/* Header with game image */}
      <div className="relative h-[28vh] w-full overflow-hidden flex-shrink-0">
        <Image
          src={game.header_image}
          alt={game.name}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
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

      {/* Session content */}
      <div className="flex flex-1 flex-col gap-4 px-6 pt-4 pb-6 overflow-y-auto">
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
              {isPaused ? "Paused" : isLockedIn ? "Est. Time" : "Session"}
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
                  {isLockedIn ? `~${game.estimated_session_length}m` : formatTime(elapsed)}
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

        {/* Session Goal */}
        <AnimatePresence mode="wait">
          {showGoalInput && !isLockedIn ? (
            <motion.div
              key="goal-input"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4"
            >
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Session Goal (optional)
              </label>
              <input
                type="text"
                value={sessionGoal}
                onChange={(e) => setSessionGoal(e.target.value)}
                placeholder="e.g., Beat the first boss..."
                className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                onKeyDown={(e) => e.key === "Enter" && handleSaveGoal()}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveGoal}
                  disabled={!sessionGoal.trim()}
                  className="flex-1 h-10 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50 min-h-[44px]"
                >
                  Set Goal
                </button>
                <button
                  onClick={() => setShowGoalInput(false)}
                  className="h-10 px-4 rounded-lg text-sm font-medium text-muted-foreground min-h-[44px]"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          ) : sessionGoal ? (
            <motion.div
              key="goal-display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Goal</span>
                  <p className="text-foreground font-medium mt-0.5">{sessionGoal}</p>
                </div>
                <button 
                  onClick={() => setShowGoalInput(true)}
                  className="p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Notes - only show when playing or paused */}
        {(isPlaying || isPaused) && (
          <div className="glass-card p-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Progress, thoughts, reminders..."
              className="w-full h-20 bg-secondary/50 rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Auto-saves</p>
          </div>
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
                  <svg className="h-5 w-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
