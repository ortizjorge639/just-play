"use client"

import { useState, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { startSessionForGame, markGameBeaten, abandonGame } from "@/app/actions"
import { useXPToast } from "./xp-toast"
import type { GameProgress, Game } from "@/lib/types"

interface CurrentGameProps {
  gameProgress: GameProgress & { game: Game }
  onSessionStarted: () => void
}

export function CurrentGame({ gameProgress, onSessionStarted }: CurrentGameProps) {
  const [isPending, startTransition] = useTransition()
  const [showOptions, setShowOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showXPToast = useXPToast()

  const game = gameProgress.game

  const handleStartSession = () => {
    setError(null)
    startTransition(async () => {
      try {
        await startSessionForGame(game.id)
        onSessionStarted()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    })
  }

  const handleMarkBeaten = () => {
    startTransition(async () => {
      try {
        await markGameBeaten(game.id)
        showXPToast({ total: 50, bonuses: ["🏆 Game beaten!"] })
        window.location.reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    })
  }

  const handleAbandon = () => {
    startTransition(async () => {
      try {
        await abandonGame(game.id)
        window.location.reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-4">
      {/* Current game header */}
      <div className="mb-6">
        <span className="text-sm text-muted-foreground">Currently playing</span>
        <h2 className="text-2xl font-bold text-foreground">{game.name}</h2>
      </div>

      {/* Game card */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="relative aspect-video w-full">
          <Image
            src={game.header_image}
            alt={game.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {game.description}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass-card p-4 text-center">
          <span className="text-2xl font-bold text-foreground">
            {gameProgress.total_sessions}
          </span>
          <p className="text-xs text-muted-foreground mt-1">Sessions played</p>
        </div>
        <div className="glass-card p-4 text-center">
          <span className="text-2xl font-bold text-foreground">
            {gameProgress.total_time_minutes > 0 
              ? `${Math.round(gameProgress.total_time_minutes / 60)}h ${gameProgress.total_time_minutes % 60}m`
              : "0m"
            }
          </span>
          <p className="text-xs text-muted-foreground mt-1">Total time</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="pt-8 flex flex-col gap-3">
        <button
          onClick={handleStartSession}
          disabled={isPending}
          className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
        >
          {isPending ? "Starting..." : "Start Today's Session"}
        </button>

        <button
          onClick={() => setShowOptions(true)}
          className="h-12 w-full rounded-xl glass-card text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted min-h-[44px]"
        >
          More options
        </button>
      </div>

      {/* Options bottom sheet */}
      <AnimatePresence>
        {showOptions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setShowOptions(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 glass-card rounded-t-3xl p-6 pb-10"
            >
              <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-muted-foreground/30" />
              
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Game options
              </h3>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleMarkBeaten}
                  disabled={isPending}
                  className="h-14 w-full rounded-xl text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                  style={{ backgroundColor: "#3BA55D" }}
                >
                  I Beat This Game!
                </button>

                <button
                  onClick={handleAbandon}
                  disabled={isPending}
                  className="h-14 w-full rounded-xl bg-destructive text-base font-semibold text-destructive-foreground transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                >
                  Abandon Game
                </button>

                <button
                  onClick={() => setShowOptions(false)}
                  className="h-12 w-full rounded-xl glass-card text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
