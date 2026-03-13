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
    <div className="flex flex-col min-h-dvh px-6">
      {/* Greeting — centered hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-2 pb-6 text-center"
      >
        <h1 className="text-2xl font-bold text-foreground">
          {"Hey, "}
          {displayName || "Player"} 👋
        </h1>
      </motion.div>

      {/* Level + XP — centered Duolingo-style */}
      {playerStats && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col items-center gap-4 pb-8"
        >
          {/* Level badge — big, centered */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-chart-1/30 to-chart-1/10 border-2 border-chart-1/25">
            <span className="text-4xl font-black text-chart-1">
              {playerStats.level}
            </span>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-chart-1 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              level
            </span>
          </div>

          {/* Chunky XP progress bar */}
          <div className="flex w-full max-w-xs flex-col items-center gap-2">
            <div className="relative h-4 w-full rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-chart-1"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(playerStats.progress * 100, 4)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {playerStats.xpInCurrentLevel}
              <span className="text-muted-foreground/60"> / {playerStats.xpToNextLevel} XP</span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Streak — centered with weekly dots */}
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
                {playerStats.streak >= 2 ? "🔥" : "📅"}
              </span>
              <span className="text-base font-bold text-foreground">
                {playerStats.streak > 0
                  ? `${playerStats.streak} day streak`
                  : "Start a streak!"}
              </span>
              {playerStats.bestStreak > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  · Best: {playerStats.bestStreak}
                </span>
              )}
            </div>

            {/* Weekly dots — evenly spaced */}
            <div className="flex items-center justify-center gap-3 w-full">
              {WEEKDAY_LABELS.map((label, i) => {
                const played = playerStats.weeklyDays[i]
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
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No sessions yet. Go play something!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sessions.map((session, i) => (
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
          </div>
        )}
      </div>
    </div>
  )
}
