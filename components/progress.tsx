"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import type { Session, Game } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

interface ProgressProps {
  sessions: (Session & { games: Game })[]
  displayName: string | null
  onBack: () => void
  onOpenSettings: () => void
}

export function Progress({ sessions, displayName, onBack, onOpenSettings }: ProgressProps) {
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
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <h1 className="text-lg font-bold text-foreground">Progress</h1>
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary min-h-[44px] min-w-[44px]"
          aria-label="Settings"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

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
                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl">
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
