"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import type { Session, Game, PlayerStats } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

interface ProgressProps {
  sessions: (Session & { games: Game })[]
  displayName: string | null
  playerStats: PlayerStats | null
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

export function Progress({ sessions, displayName, playerStats }: ProgressProps) {
  const totalMinutes = sessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0
  )
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const uniqueGames = new Set(sessions.map((s) => s.game_id)).size

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Greeting */}
      <div className="px-6 pb-5">
        <p className="text-muted-foreground text-sm">
          {"Hey, "}
          <span className="text-foreground font-medium">
            {displayName || "Player"}
          </span>
        </p>
      </div>

      {/* Level Card — Duolingo-style */}
      {playerStats && (
        <div className="px-6 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card overflow-hidden"
          >
            <div className="flex items-center gap-4 p-4">
              {/* Level badge */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-chart-1/30 to-chart-1/10 border border-chart-1/20">
                <span className="text-2xl font-black text-chart-1">
                  {playerStats.level}
                </span>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-chart-1 px-1.5 py-px text-[9px] font-bold text-white uppercase tracking-wider">
                  lvl
                </span>
              </div>

              {/* XP progress */}
              <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {playerStats.totalXP.toLocaleString()} XP
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {playerStats.xpInCurrentLevel} / {playerStats.xpToNextLevel}
                  </span>
                </div>
                <div className="relative h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-chart-1"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(playerStats.progress * 100, 3)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Streak Card — Duolingo weekly dots */}
      {playerStats && (
        <div className="px-6 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {playerStats.streak >= 2 ? "🔥" : "📅"}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {playerStats.streak > 0
                    ? `${playerStats.streak} day streak`
                    : "Start a streak!"}
                </span>
              </div>
              {playerStats.bestStreak > 0 && (
                <span className="text-xs text-muted-foreground">
                  Best: {playerStats.bestStreak}d
                </span>
              )}
            </div>

            {/* Weekly dots */}
            <div className="flex items-center justify-between gap-1">
              {WEEKDAY_LABELS.map((label, i) => {
                const played = playerStats.weeklyDays[i]
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
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
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* Stats row — Nintendo-style tiles */}
      <div className="grid grid-cols-3 gap-3 px-6 pb-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card flex flex-col items-center gap-1 p-4"
        >
          <span className="text-lg">🎮</span>
          <span className="text-2xl font-bold text-foreground">
            {sessions.length}
          </span>
          <span className="text-xs text-muted-foreground">Sessions</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card flex flex-col items-center gap-1 p-4"
        >
          <span className="text-lg">⏱️</span>
          <span className="text-2xl font-bold text-foreground">
            {totalHours > 0
              ? `${totalHours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ""}`
              : `${totalMinutes}m`}
          </span>
          <span className="text-xs text-muted-foreground">Play Time</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card flex flex-col items-center gap-1 p-4"
        >
          <span className="text-lg">🕹️</span>
          <span className="text-2xl font-bold text-foreground">
            {uniqueGames}
          </span>
          <span className="text-xs text-muted-foreground">Games</span>
        </motion.div>
      </div>

      {/* Session history */}
      <div className="px-6 pb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Sessions
        </h2>
      </div>

      <div className="flex-1 px-6 pb-8">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No sessions yet. Go play something!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * Math.min(i, 10) }}
                className="glass-card flex items-center gap-4 p-4"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={session.games?.header_image || "/images/games/hades.jpg"}
                    alt={session.games?.name || "Game"}
                    fill
                    className="object-cover"
                    sizes="56px"
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
                    {" "}
                    {session.ended_at &&
                      `· ${formatDistanceToNow(new Date(session.ended_at), {
                        addSuffix: true,
                      })}`}
                  </span>
                </div>
                {session.xp_awarded > 0 && (
                  <span className="shrink-0 rounded-full bg-chart-1/15 px-2 py-0.5 text-xs font-semibold text-chart-1">
                    +{session.xp_awarded} XP
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
