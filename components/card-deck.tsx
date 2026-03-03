"use client"

import { useState, useTransition, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { GameCard } from "./game-card"
import { QuickFilters } from "./quick-filters"
import { createSession } from "@/app/actions"
import type { Game, UserPreferences } from "@/lib/types"

interface CardDeckProps {
  games: Game[]
  preferences: UserPreferences
  onSessionCreated: () => void
}

export function CardDeck({ games, preferences, onSessionCreated }: CardDeckProps) {
  const [deck, setDeck] = useState<Game[]>(games)
  const [rejectedStack, setRejectedStack] = useState<Game[]>([])
  const [lockedGame, setLockedGame] = useState<Game | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const handleReject = useCallback(
    (game: Game) => {
      setDeck((prev) => prev.filter((g) => g.id !== game.id))
      setRejectedStack((prev) => [...prev, game])
    },
    []
  )

  const handleUndo = useCallback(() => {
    if (rejectedStack.length === 0) return
    const lastRejected = rejectedStack[rejectedStack.length - 1]
    setRejectedStack((prev) => prev.slice(0, -1))
    setDeck((prev) => [...prev, lastRejected])
  }, [rejectedStack])

  const handleLockIn = useCallback((game: Game) => {
    setLockedGame(game)
  }, [])

  const confirmLockIn = useCallback(() => {
    if (!lockedGame) return
    setError(null)
    startTransition(async () => {
      try {
        await createSession(lockedGame.id)
        onSessionCreated()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
        setLockedGame(null)
      }
    })
  }, [lockedGame, onSessionCreated])

  const cancelLockIn = useCallback(() => {
    setLockedGame(null)
  }, [])

  if (deck.length === 0) {
    return (
      <>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <svg className="h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">No more games</h2>
          <p className="text-muted-foreground text-base max-w-xs">
            You swiped through all your picks. Refresh or update your filters for new recommendations.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
            {rejectedStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="h-12 rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Bring Back Last Card
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className={`h-12 rounded-xl px-8 text-sm font-semibold transition-colors active:scale-[0.98] min-h-[44px] ${
                rejectedStack.length > 0 
                  ? "glass-card text-foreground hover:bg-muted" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              Refresh Picks
            </button>
            <button
              onClick={() => setShowFilters(true)}
              className="h-12 rounded-xl glass-card px-8 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Update Filters
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {showFilters && (
            <QuickFilters
              currentPreferences={preferences}
              onApply={() => {
                setShowFilters(false)
                window.location.reload()
              }}
              onCancel={() => setShowFilters(false)}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <>
      <div className="relative flex flex-1 items-center justify-center px-6">
        {/* Gesture hints */}
        <div className="absolute top-4 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Swipe up to lock in
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Swipe down to skip
            </span>
          </div>
        </div>

        {/* Card stack */}
        <div className="relative w-full max-w-[320px]" style={{ aspectRatio: "3/4" }}>
          <AnimatePresence>
            {deck.map((game, i) => (
              <GameCard
                key={game.id}
                game={game}
                index={i}
                total={deck.length}
                isTop={i === deck.length - 1}
                onLockIn={handleLockIn}
                onReject={handleReject}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Card count indicator */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {games.map((g) => (
            <div
              key={g.id}
              className="h-1.5 w-6 rounded-full transition-colors"
              style={{
                backgroundColor: deck.find((d) => d.id === g.id)
                  ? "#5865F2"
                  : "rgba(255,255,255,0.08)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Undo button - positioned below the card area */}
      <AnimatePresence>
        {rejectedStack.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex justify-center px-6 pb-2"
          >
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 rounded-full glass-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-95 min-h-[44px]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 rounded-xl bg-destructive/20 p-4 text-center text-sm text-destructive"
        >
          {error}
        </motion.div>
      )}

      {/* Lock-in confirmation modal */}
      <AnimatePresence>
        {lockedGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm"
            onClick={cancelLockIn}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md glass-card rounded-t-3xl p-6 pb-10 flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto h-1 w-12 rounded-full bg-muted-foreground/30" />
              <div className="text-center flex flex-col gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  Lock in {lockedGame.name}?
                </h3>
                <p className="text-sm text-muted-foreground">
                  {"This becomes your active session. You'll see it on your dashboard."}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmLockIn}
                  disabled={isPending}
                  className="h-14 w-full rounded-xl bg-success text-base font-semibold text-success-foreground transition-all hover:bg-success/90 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                >
                  {isPending ? "Starting session..." : "Lock In"}
                </button>
                <button
                  onClick={cancelLockIn}
                  className="h-12 w-full rounded-xl bg-secondary text-base font-medium text-foreground transition-colors hover:bg-muted min-h-[44px]"
                >
                  Go back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
