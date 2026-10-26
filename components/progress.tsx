"use client"

import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react"
import { motion, useReducedMotion } from "framer-motion"
import Image from "next/image"
import type { Session, Game, PlayerStats, NameCard as NameCardData } from "@/lib/types"
import { NameCard } from "./name-card"
import { formatDistanceToNow } from "date-fns"
import { calculateStreak } from "@/lib/streak"
import { XPParticles } from "./xp-particles"

interface ProgressProps {
  sessions: (Session & { games: Game })[]
  displayName: string | null
  playerStats: PlayerStats | null
  nameCard: NameCardData | null
  library: Game[]
  onEditCard: () => void
}

interface PendingXP {
  xp: number
  previousStats: {
    totalXP: number
    level: number
    xpInCurrentLevel: number
    xpToNextLevel: number
    totalSessions: number
  }
  timestamp: number
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

function useCountUp(target: number, from: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(enabled ? from : target)
  const rafRef = useRef<number>(0)
  const skip = !enabled || from === target

  useEffect(() => {
    if (skip) return

    const start = performance.now()
    const diff = target - from

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + diff * eased))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    // Delay start slightly so the page has rendered
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, 400)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(rafRef.current)
    }
  }, [target, from, duration, skip])

  return skip ? target : value
}

type HistoryRow = Session & { games: Game; count: number }

// Back-to-back sessions of one game on the same day read as one row.
const subscribeNever = () => () => {}

function groupHistory(sessions: (Session & { games: Game })[]): HistoryRow[] {
  const rows: HistoryRow[] = []
  for (const s of sessions) {
    const last = rows[rows.length - 1]
    const day = (x: Session) => new Date(x.ended_at ?? x.started_at).toDateString()
    if (last && last.game_id === s.game_id && day(last) === day(s)) {
      last.duration_minutes = (last.duration_minutes || 0) + (s.duration_minutes || 0)
      last.xp_awarded = (last.xp_awarded || 0) + (s.xp_awarded || 0)
      last.count += 1
    } else {
      rows.push({ ...s, count: 1 })
    }
  }
  return rows
}

export function Progress({ sessions, displayName, playerStats, nameCard, library, onEditCard }: ProgressProps) {
  const prefersReducedMotion = useReducedMotion()
  const [pending, setPending] = useState<PendingXP | null>(null)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [showBarParticles, setShowBarParticles] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const [barParticleOrigin, setBarParticleOrigin] = useState({ x: 0, y: 0 })

  // Check for pending XP on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("pendingXP")
      if (!raw) return
      const data: PendingXP = JSON.parse(raw)
      // Only animate if XP was earned recently (within 10s)
      if (Date.now() - data.timestamp < 10000) {
        // sessionStorage only exists on the client, so it can only be read after mount
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPending(data)
      }
      sessionStorage.removeItem("pendingXP")
    } catch {
      // ignore
    }
  }, [])

  // Fire bar particles after the count-up finishes
  const onCountUpDone = useCallback(() => {
    if (!barRef.current || !pending) return
    const rect = barRef.current.getBoundingClientRect()
    const barProgress = playerStats
      ? Math.max((playerStats.xpInCurrentLevel / playerStats.xpToNextLevel) * 100, 3)
      : 50
    setBarParticleOrigin({
      x: rect.left + (rect.width * barProgress) / 100,
      y: rect.top + rect.height / 2,
    })
    setShowBarParticles(true)
  }, [pending, playerStats])

  // Trigger particles after count-up duration
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(onCountUpDone, 1800)
    return () => clearTimeout(timer)
  }, [pending, onCountUpDone])

  const hasPending = !!pending
  const prevXP = pending?.previousStats.xpInCurrentLevel ?? (playerStats?.xpInCurrentLevel ?? 0)
  const prevLevel = pending?.previousStats.level ?? (playerStats?.level ?? 1)

  const animatedXP = useCountUp(
    playerStats?.xpInCurrentLevel ?? 0,
    prevXP,
    1200,
    hasPending
  )
  const animatedLevel = useCountUp(
    playerStats?.level ?? 1,
    prevLevel,
    800,
    hasPending && prevLevel !== (playerStats?.level ?? 1)
  )

  const totalMinutes = sessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0
  )
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const history = groupHistory(sessions)
  // The server runs in UTC, so around midnight its "today" differs from the player's. Recount in local time once mounted.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)
  const localStreak = useMemo(
    () => (mounted ? calculateStreak(sessions.map((x) => x.started_at)) : null),
    [mounted, sessions],
  )
  const uniqueGames = new Set(sessions.map((s) => s.game_id)).size

  // XP bar width: animate from previous to current
  const currentBarWidth = playerStats
    ? Math.max((playerStats.xpInCurrentLevel / playerStats.xpToNextLevel) * 100, 3)
    : 0
  const prevBarWidth = pending && playerStats
    ? Math.max((pending.previousStats.xpInCurrentLevel / (pending.previousStats.xpToNextLevel || 1)) * 100, 3)
    : currentBarWidth

  return (
    <div className="flex flex-col min-h-dvh px-6">
      {/* Greeting — centered hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-2 pb-6 text-center"
      >
        <NameCard displayName={displayName} card={nameCard} library={library} onEdit={onEditCard} />
      </motion.div>

      {/* Level + XP — centered Duolingo-style */}
      {playerStats && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col items-center gap-4 pb-8"
        >
          {/* Level badge — big, centered */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500/30 to-amber-500/10 border-2 border-amber-500/25">
            <span className="text-4xl font-black text-amber-400">
              {animatedLevel}
            </span>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              level
            </span>
          </div>

          {/* Chunky XP progress bar */}
          <div className="flex w-full flex-col items-center gap-2">
            <div ref={barRef} className="relative h-4 w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-amber-500"
                initial={{ width: `${hasPending ? prevBarWidth : currentBarWidth}%` }}
                animate={{ width: `${currentBarWidth}%` }}
                transition={{ duration: hasPending ? 1.4 : 0.7, ease: "easeOut", delay: hasPending ? 0.5 : 0 }}
              />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {animatedXP}
              <span className="text-muted-foreground/60"> / {playerStats.xpToNextLevel} XP</span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Combo — centered with weekly dots */}
      {playerStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5 mb-5"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {(localStreak?.consecutive ?? playerStats.streak) >= 2 ? "🔥" : "📅"}
              </span>
              <span className="text-base font-bold text-foreground">
                {(localStreak?.consecutive ?? playerStats.streak) > 0
                  ? `${(localStreak?.consecutive ?? playerStats.streak)}-day combo`
                  : (localStreak?.weeklyDays ?? playerStats.weeklyDays).some(Boolean)
                    ? "Played this week"
                    : "No sessions this week"}
              </span>
              {(localStreak?.bestStreak ?? playerStats.bestStreak) > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  · Best combo: {(localStreak?.bestStreak ?? playerStats.bestStreak)}
                </span>
              )}
            </div>

            {/* Weekly dots — evenly spaced */}
            <div className="flex items-center justify-center gap-3 w-full">
              {WEEKDAY_LABELS.map((label, i) => {
                const played = (localStreak?.weeklyDays ?? playerStats.weeklyDays)[i]
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                        played
                          ? "bg-chart-1 text-white"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {played ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats row — centered tiles */}
      <div className="grid grid-cols-3 gap-3 pb-6">
        {[
          { emoji: "🎮", value: sessions.length, label: "Sessions", delay: 0.15 },
          {
            emoji: "⏱️",
            value: totalHours > 0
              ? `${totalHours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ""}`
              : `${totalMinutes}m`,
            label: "Play Time",
            delay: 0.2,
          },
          { emoji: "🕹️", value: uniqueGames, label: "Games", delay: 0.25 },
        ].map(({ emoji, value, label, delay }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="glass-card flex flex-col items-center justify-center gap-1 p-4 text-center"
          >
            <span className="text-lg">{emoji}</span>
            <span className="text-xl font-bold text-foreground leading-tight">
              {value}
            </span>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </motion.div>
        ))}
      </div>
      {/* Session history */}
      <div className="pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Sessions
        </h2>
      </div>

      <div className="flex-1 pb-8">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No sessions yet. Go play something!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {(showAllSessions ? history : history.slice(0, 10)).map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * Math.min(i, 8) }}
                className="glass-card flex items-center gap-3 p-3"
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={session.games?.header_image || "/images/games/hades.jpg"}
                    alt={session.games?.name || "Game"}
                    fill
                    className="object-cover"
                    sizes="44px"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {session.games?.name || "Unknown Game"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {session.duration_minutes
                      ? `${session.duration_minutes} min`
                      : "< 1 min"}
                    {session.count > 1 && ` · ${session.count} sessions`}
                    {" "}
                    {session.ended_at &&
                      `· ${formatDistanceToNow(new Date(session.ended_at), {
                        addSuffix: true,
                      })}`}
                  </span>
                </div>
                {session.xp_awarded > 0 && (
                  <span className="shrink-0 rounded-full bg-chart-1/15 px-2 py-0.5 text-xs font-semibold text-chart-1">
                    +{session.xp_awarded}
                  </span>
                )}
              </motion.div>
            ))}
            {history.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllSessions((v) => !v)}
                className="min-h-11 rounded-lg text-sm font-semibold text-accent"
              >
                {showAllSessions ? "Show fewer" : `Show all ${history.length}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* XP bar particle burst */}
      {showBarParticles && (
        <XPParticles
          originX={barParticleOrigin.x}
          originY={barParticleOrigin.y}
          count={16}
          spread={5}
          onComplete={() => setShowBarParticles(false)}
        />
      )}
    </div>
  )
}
