"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import type { Session, Game } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

interface ProgressProps {
  sessions: (Session & { games: Game })[]
  displayName: string | null
}

export function Progress({ sessions, displayName }: ProgressProps) {
  const totalMinutes = sessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0
  )
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const uniqueGames = new Set(sessions.map((s) => s.game_id)).size

  // Calculate streak (consecutive days with sessions)
  const daySet = new Set(
    sessions.map((s) =>
      new Date(s.ended_at || s.created_at).toISOString().split("T")[0]
    )
  )
  const today = new Date()
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split("T")[0]
    if (daySet.has(key)) {
      streak++
    } else if (i > 0) {
      break
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Greeting */}
      <div className="px-6 pb-6">
        <p className="text-muted-foreground text-sm">
          {"Hey, "}
          <span className="text-foreground font-medium">
            {displayName || "Player"}
          </span>
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 px-6 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card flex flex-col items-center gap-1 p-4"
        >
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
          transition={{ delay: 0.3 }}
          className="glass-card flex flex-col items-center gap-1 p-4"
        >
          <span className="text-2xl font-bold text-foreground">
            {uniqueGames}
          </span>
          <span className="text-xs text-muted-foreground">Games</span>
        </motion.div>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="px-6 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card flex items-center gap-4 p-4"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(59, 165, 93, 0.15)" }}
            >
              <svg
                className="h-6 w-6 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {streak} day{streak !== 1 ? "s" : ""} streak
              </span>
              <span className="text-xs text-muted-foreground">
                Keep it going!
              </span>
            </div>
          </motion.div>
        </div>
      )}

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
                      `- ${formatDistanceToNow(new Date(session.ended_at), {
                        addSuffix: true,
                      })}`}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
