"use client"

import { motion } from "framer-motion"
import type { PlayerStats } from "@/lib/types"

interface PlayerHUDProps {
  stats: PlayerStats
}

export function PlayerHUD({ stats }: PlayerHUDProps) {
  const streakFire = stats.streak >= 2

  return (
    <div className="sticky top-[60px] z-20 border-b border-border/50 bg-background/60 backdrop-blur-md px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        {/* Streak */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm" aria-hidden>
            {streakFire ? "🔥" : "📅"}
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-semibold text-foreground">
              {stats.weeklyRatio}/7
            </span>
            {stats.streak > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {stats.streak}d streak
              </span>
            )}
          </div>
        </div>

        {/* XP Bar — center, takes remaining space */}
        <div className="flex flex-1 items-center gap-2 min-w-0 max-w-[200px]">
          <span className="text-xs font-bold text-foreground whitespace-nowrap">
            Lv.{stats.level}
          </span>
          <div className="relative h-2 flex-1 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-chart-1"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(stats.progress * 100, 2)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {stats.xpInCurrentLevel}/{stats.xpToNextLevel}
          </span>
        </div>

        {/* Session count */}
        <div className="flex items-center gap-1">
          <span className="text-sm" aria-hidden>
            🎮
          </span>
          <span className="text-xs font-semibold text-foreground">
            #{stats.totalSessions}
          </span>
        </div>
      </div>
    </div>
  )
}
