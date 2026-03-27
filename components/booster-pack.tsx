"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getBoosterPack, recordBoosterPackOpen } from "@/app/actions"
import type { Game } from "@/lib/types"

interface BoosterPackProps {
  boosterPackStatus: { packsOpenedToday: number; packsRemaining: number }
  onPackOpened: (games: Game[]) => void
}

type PackPhase = "idle" | "shaking" | "opening" | "revealing" | "done"

export function BoosterPack({ boosterPackStatus, onPackOpened }: BoosterPackProps) {
  const [phase, setPhase] = useState<PackPhase>("idle")
  const [games, setGames] = useState<Game[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState(boosterPackStatus)

  const openPack = useCallback(async () => {
    if (status.packsRemaining <= 0) return
    setError(null)

    try {
      // Phase 1: Shaking
      setPhase("shaking")

      // Record the opening and fetch games in parallel
      const [, fetchedGames] = await Promise.all([
        recordBoosterPackOpen(),
        getBoosterPack(),
      ])

      setGames(fetchedGames)
      setStatus(prev => ({
        packsOpenedToday: prev.packsOpenedToday + 1,
        packsRemaining: prev.packsRemaining - 1,
      }))

      // Phase 2: Opening (tear open)
      setPhase("opening")
      await new Promise(r => setTimeout(r, 800))

      // Phase 3: Reveal cards one by one
      setPhase("revealing")
      for (let i = 0; i < fetchedGames.length; i++) {
        await new Promise(r => setTimeout(r, 150))
        setRevealedCount(i + 1)
      }

      // Phase 4: Done — brief pause then send games to deck
      await new Promise(r => setTimeout(r, 600))
      setPhase("done")
      onPackOpened(fetchedGames)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open pack")
      setPhase("idle")
    }
  }, [status.packsRemaining, onPackOpened])

  const isDisabled = status.packsRemaining <= 0

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-6"
          >
            {/* Pack visual */}
            <motion.div
              className="relative flex h-48 w-36 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-primary/30 border-2 border-primary/40 shadow-lg shadow-primary/20"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(88, 101, 242, 0.2)",
                  "0 0 40px rgba(88, 101, 242, 0.4)",
                  "0 0 20px rgba(88, 101, 242, 0.2)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Pack icon */}
              <svg className="h-16 w-16 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              {/* Sparkle decoration */}
              <motion.div
                className="absolute -top-2 -right-2 text-primary"
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                ✦
              </motion.div>
            </motion.div>

            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground mb-2">Booster Pack</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                {isDisabled
                  ? "You've opened all your packs for today. Come back tomorrow for more!"
                  : "Open a pack to discover curated games. Swipe to find your next play!"}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <motion.button
                onClick={openPack}
                disabled={isDisabled}
                whileTap={isDisabled ? {} : { scale: 0.96 }}
                className={`h-14 w-full rounded-2xl text-base font-semibold transition-all min-h-[56px] ${
                  isDisabled
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {isDisabled ? "No Packs Left Today" : "Open Booster Pack"}
              </motion.button>

              <span className="text-xs text-muted-foreground">
                {status.packsRemaining} pack{status.packsRemaining !== 1 ? "s" : ""} remaining today
              </span>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive text-center"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}

        {(phase === "shaking" || phase === "opening") && (
          <motion.div
            key="animation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              className="relative flex h-48 w-36 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-primary/30 border-2 border-primary/40"
              animate={
                phase === "shaking"
                  ? {
                      rotate: [-2, 2, -2, 2, -3, 3, -1, 1, 0],
                      scale: [1, 1.02, 1, 1.03, 1, 1.05, 1],
                    }
                  : {
                      scale: [1, 1.1, 0],
                      opacity: [1, 1, 0],
                      rotateY: [0, 0, 90],
                    }
              }
              transition={
                phase === "shaking"
                  ? { duration: 1.5, repeat: Infinity }
                  : { duration: 0.6 }
              }
            >
              <svg className="h-16 w-16 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </motion.div>
            <p className="text-sm text-muted-foreground animate-pulse">
              {phase === "shaking" ? "Opening pack..." : "Revealing games..."}
            </p>
          </motion.div>
        )}

        {phase === "revealing" && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="grid grid-cols-5 gap-2 max-w-xs">
              {games.map((game, i) => (
                <motion.div
                  key={game.id}
                  initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
                  animate={
                    i < revealedCount
                      ? { rotateY: 0, scale: 1, opacity: 1 }
                      : { rotateY: 180, scale: 0.5, opacity: 0 }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="aspect-[3/4] rounded-lg overflow-hidden border border-border/50 bg-secondary"
                >
                  {game.header_image && (
                    <img
                      src={game.header_image}
                      alt={game.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </motion.div>
              ))}
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-muted-foreground"
            >
              {revealedCount} of {games.length} games revealed
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
