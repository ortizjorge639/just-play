"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { getBoosterPack, getRecommendations, recordBoosterPackOpen } from "@/app/actions"
import type { Game, UserPreferences } from "@/lib/types"

interface BoosterPackProps {
  boosterPackStatus: { packsOpenedToday: number; packsRemaining: number }
  preferences?: UserPreferences
  onPackOpened: (games: Game[], status: { packsOpenedToday: number; packsRemaining: number }) => void
  onCancel: () => void
}

type PackPhase = "idle" | "shaking" | "opening" | "revealing" | "done"

export function BoosterPack({ boosterPackStatus, preferences, onPackOpened, onCancel }: BoosterPackProps) {
  const hasPreferences = preferences && Object.keys(preferences).length > 0
  const prefersReducedMotion = useReducedMotion()
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

      // Fetch first so a recommendation failure does not consume an opening.
      const fetchedGames = hasPreferences && preferences
        ? await getRecommendations(preferences)
        : await getBoosterPack()
      if (fetchedGames.length === 0) {
        setError("No games are available for this pack. Your pack wasn't used.")
        setPhase("idle")
        return
      }

      await recordBoosterPackOpen()

      setGames(fetchedGames)
      const nextStatus = {
        packsOpenedToday: status.packsOpenedToday + 1,
        packsRemaining: status.packsRemaining - 1,
      }
      setStatus(nextStatus)

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
      onPackOpened(fetchedGames, nextStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open pack")
      setPhase("idle")
    }
  }, [status, hasPreferences, preferences, onPackOpened])

  const isDisabled = status.packsRemaining <= 0

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div
            key="idle"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="flex flex-col items-center gap-6"
          >
            {/* Pack visual */}
            <motion.div
              aria-hidden="true"
              data-testid="booster-pack-art"
              className="relative flex h-48 w-36 items-center justify-center rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/30 via-primary/10 to-primary/30 shadow-lg"
            >
              <svg className="h-16 w-16 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </motion.div>

            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground mb-2">Booster Pack</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                {isDisabled
                  ? "No packs left today. You can still search for a game."
                  : "Open your picks and choose a game."}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <motion.button
                onClick={openPack}
                disabled={isDisabled}
                whileTap={isDisabled || prefersReducedMotion ? {} : { scale: 0.96 }}
                className={`h-14 w-full rounded-2xl text-base font-semibold transition-all min-h-[56px] ${
                  isDisabled
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {isDisabled ? "No Packs Left Today" : "Open Booster Pack"}
              </motion.button>

              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 w-full rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Back to recommendations
              </button>

              <span className="text-xs text-muted-foreground">
                {status.packsRemaining} pack{status.packsRemaining !== 1 ? "s" : ""} remaining today
              </span>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="alert"
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
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              aria-hidden="true"
              className="relative flex h-48 w-36 items-center justify-center rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/30 via-primary/10 to-primary/30"
              animate={
                prefersReducedMotion
                  ? { opacity: phase === "opening" ? 0 : 1 }
                  : phase === "shaking"
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
                prefersReducedMotion
                  ? { duration: 0 }
                  : phase === "shaking"
                  ? { duration: 1.5, repeat: Infinity }
                  : { duration: 0.6 }
              }
            >
              <svg className="h-16 w-16 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </motion.div>
            <p role="status" aria-live="polite" aria-atomic="true" className={`text-sm text-muted-foreground${prefersReducedMotion ? "" : " animate-pulse"}`}>
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
            <div className="grid w-full max-w-sm grid-cols-3 gap-3">
              {games.map((game, i) => (
                <motion.figure
                  key={game.id}
                  initial={prefersReducedMotion ? { opacity: 0 } : { rotateY: 180, scale: 0.5, opacity: 0 }}
                  animate={
                    i < revealedCount
                      ? prefersReducedMotion ? { opacity: 1 } : { rotateY: 0, scale: 1, opacity: 1 }
                      : prefersReducedMotion ? { opacity: 0 } : { rotateY: 180, scale: 0.5, opacity: 0 }
                  }
                  transition={{
                    ...(prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring" as const, stiffness: 260, damping: 20 }),
                  }}
                  className="min-w-0 overflow-hidden rounded-lg border border-border/50 bg-secondary"
                >
                  {game.header_image && (
                    // next.config sets images.unoptimized, so next/image adds nothing here
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.header_image}
                      alt={game.name}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  )}
                  <figcaption className="line-clamp-2 min-h-10 px-2 py-1.5 text-center text-xs font-medium text-foreground">
                    {game.name}
                  </figcaption>
                </motion.figure>
              ))}
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              role="status"
              aria-live="polite"
              aria-atomic="true"
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
