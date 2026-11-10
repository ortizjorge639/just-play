"use client"

import { useRef, useState, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { startSessionForGame, markGameBeaten, abandonGame } from "@/app/actions"
import { useXPToast } from "./xp-toast"
import { StampPanel } from "./stamp-panel"
import { MoveInNote } from "./move-in-note"
import type { GameProgress, Game, StampRule } from "@/lib/types"
import { GameArtwork } from "./game-artwork"

interface CurrentGameProps {
  gameProgress: GameProgress & { game: Game }
  onSessionStarted: () => void
  onGameBeaten: () => void
  syncError: string | null
  onRetry: () => void
  stampRules: StampRule[]
  isResident: boolean
  onArrived: (game: Game) => void
}

export function CurrentGame({
  gameProgress, onSessionStarted, onGameBeaten, syncError, onRetry,
  stampRules, isResident, onArrived,
}: CurrentGameProps) {
  const [isPending, startTransition] = useTransition()
  const [showOptions, setShowOptions] = useState(false)
  // Marking a game beaten cannot be undone, so it asks once before it commits.
  const [confirmBeaten, setConfirmBeaten] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const frontFlipButtonRef = useRef<HTMLButtonElement>(null)
  const backFlipButtonRef = useRef<HTMLButtonElement>(null)
  const showXPToast = useXPToast()

  const game = gameProgress.game
  const ownRule = stampRules.find(r => r.game_id === game.id) ?? null
  const defaultRule = stampRules.find(r => r.game_id === null) ?? null
  const flipCard = () => {
    const nextFlipped = !flipped
    setFlipped(nextFlipped)
    requestAnimationFrame(() => {
      (nextFlipped ? backFlipButtonRef : frontFlipButtonRef).current?.focus()
    })
  }

  const handleStartSession = () => {
    if (syncError || isPending) return
    setError(null)
    startTransition(async () => {
      try {
        await startSessionForGame(game.id)
        onSessionStarted()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
        onRetry()
      }
    })
  }

  // The sheet closes as an action starts, so a failure shows on the page instead of behind it.
  const handleMarkBeaten = () => {
    if (syncError || isPending) return
    setError(null)
    setShowOptions(false)
    startTransition(async () => {
      try {
        await markGameBeaten(game.id, null)
        showXPToast({ total: 50, bonuses: ["🏆 Game beaten!"] })
        onGameBeaten()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
        onRetry()
      }
    })
  }

  const handleAbandon = () => {
    if (syncError || isPending) return
    setError(null)
    setShowOptions(false)
    startTransition(async () => {
      try {
        await abandonGame(game.id, null)
        window.location.reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
        onRetry()
      }
    })
  }

  const playTime = gameProgress.total_time_minutes >= 60
    ? `${Math.floor(gameProgress.total_time_minutes / 60)}h ${gameProgress.total_time_minutes % 60}m`
    : `${gameProgress.total_time_minutes}m`

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-4">
      {syncError ? <div role="alert" className="mb-4 rounded-lg border border-primary/40 p-3 text-sm text-primary">
        {syncError} <button className="min-h-11 underline" onClick={onRetry}>Retry</button>
      </div> : null}
      {/* Flippable card */}
      <div
        className="relative mb-6 w-full max-w-[320px]"
        style={{ aspectRatio: "3/4", perspective: "1200px" }}
      >
        <motion.div
          data-testid="game-flip-container"
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transformTemplate={(_, generatedTransform) =>
            generatedTransform ? generatedTransform : "rotateY(0deg)"
          }
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* ── Front face ── */}
          <div
            aria-hidden={flipped}
            className="absolute inset-0 overflow-hidden rounded-xl glass-card"
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Game image */}
            <div className="relative h-[55%] w-full overflow-hidden">
              <GameArtwork src={game.header_image} alt="" sizes="320px" className="absolute inset-0" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
            </div>

            {/* Currently playing badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "color-mix(in srgb, var(--success) 20%, transparent)", borderWidth: "1px", borderStyle: "solid", borderColor: "color-mix(in srgb, var(--success) 30%, transparent)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" style={{ animation: "pulse 2s infinite" }} />
              <span className="text-xs font-semibold uppercase tracking-wide text-success">Playing</span>
            </div>

            {/* Game info */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-5">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-foreground leading-tight">{game.name}</h3>
                <p className="text-sm text-foreground/70 leading-relaxed line-clamp-2">
                  {game.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {game.genres?.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    {genre.replace("-", " ")}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-foreground/70">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>~{game.time_to_beat_minutes ?? game.estimated_session_length} min</span>
              </div>
            </div>

            {/* Details action */}
            <button
              ref={frontFlipButtonRef}
              type="button"
              tabIndex={flipped ? -1 : 0}
              onClick={flipCard}
              className="absolute bottom-2 right-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span>View details</span>
              <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10M7 17 17 7" />
              </svg>
            </button>
          </div>

          {/* ── Back face ── */}
          <div
            aria-hidden={!flipped}
            className="absolute inset-0 overflow-y-auto rounded-xl glass-card"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="flex flex-col gap-4 p-5 h-full">
              {/* Small header image */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl shrink-0">
                <GameArtwork src={game.header_image} alt="" sizes="320px" className="absolute inset-0" />
              </div>

              <h3 className="text-lg font-bold text-foreground">{game.name}</h3>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {game.description}
              </p>

              {/* All genres */}
              <div className="flex flex-wrap gap-2">
                {game.genres?.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/80"
                  >
                    {genre.replace("-", " ")}
                  </span>
                ))}
              </div>

              {/* Play stats */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <span>
                    {gameProgress.total_sessions} {gameProgress.total_sessions === 1 ? "session" : "sessions"} · {playTime} played
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>~{game.time_to_beat_minutes ?? game.estimated_session_length} min per session</span>
                </div>
              </div>

              {/* Journey status */}
              <div className="flex flex-col gap-1.5 mt-auto">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Journey</span>
                  <span>{gameProgress.status === "playing" ? "In progress" : gameProgress.status}</span>
                </div>
              </div>

              <button
                ref={backFlipButtonRef}
                type="button"
                tabIndex={flipped ? 0 : -1}
                onClick={flipCard}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 7H7v10m10-10L7 17" />
                </svg>
                <span>Back to cover</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 w-full max-w-[320px] rounded-xl bg-destructive/10 p-4 text-sm text-destructive text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {!isResident ? <MoveInNote /> : null}

      {!isResident ? (
        <StampPanel
          game={game}
          playedMinutes={gameProgress.total_time_minutes}
          rule={ownRule ?? defaultRule}
          onArrived={onArrived}
        />
      ) : null}

      {/* Actions */}
      <div className="w-full max-w-[320px] flex flex-col gap-3">
        <button
          onClick={handleStartSession}
          disabled={isPending || !!syncError}
          className="inline-flex min-h-[44px] h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Starting..." : (
            <>
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Start Today&apos;s Session
            </>
          )}
        </button>

        <button
          onClick={() => { setConfirmBeaten(false); setShowOptions(true) }}
          className="inline-flex min-h-[44px] h-12 w-full items-center justify-center gap-2 rounded-xl glass-card text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
        >
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
          </svg>
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
              className="fixed bottom-0 left-1/2 z-50 max-h-[calc(100dvh-1rem)] w-full max-w-lg -translate-x-1/2 overflow-y-auto glass-card rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:bottom-6 sm:rounded-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted-foreground/30" />
              
              {confirmBeaten ? (
                <>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Beat {game.name}?</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    This marks the game as beaten. It can&apos;t be undone.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleMarkBeaten}
                      disabled={isPending || !!syncError}
                      className="min-h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all hover:bg-primary-highlight active:scale-[0.98] disabled:opacity-50"
                    >
                      Yes, I beat it
                    </button>
                    <button
                      onClick={() => setConfirmBeaten(false)}
                      className="min-h-12 w-full rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      Not yet
                    </button>
                  </div>
                </>
              ) : (
              <>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Game options
              </h3>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setConfirmBeaten(true)}
                  disabled={isPending || !!syncError}
                  className="min-h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all hover:bg-primary-highlight active:scale-[0.98] disabled:opacity-50"
                >
                  I Beat This Game!
                </button>

                <button
                  onClick={handleAbandon}
                  disabled={isPending || !!syncError}
                  className="min-h-12 w-full rounded-xl border border-border text-base font-semibold text-foreground transition-all hover:bg-secondary active:scale-[0.98] disabled:opacity-50"
                >
                  Set Game Aside
                </button>

                <button
                  onClick={() => setShowOptions(false)}
                  className="min-h-12 w-full rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
