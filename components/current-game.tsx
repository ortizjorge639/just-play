"use client"

import { useState, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { startSessionForGame, markGameBeaten, abandonGame } from "@/app/actions"
import { useXPToast } from "./xp-toast"
import { StampPanel } from "./stamp-panel"
import { MoveInNote } from "./move-in-note"
import type { GameProgress, Game, StampRule } from "@/lib/types"

interface CurrentGameProps {
  gameProgress: GameProgress & { game: Game }
  onSessionStarted: () => void
  syncError: string | null
  onRetry: () => void
  stampRules: StampRule[]
  isResident: boolean
  onStampRuleSaved: (gameId: string | null, rule: StampRule | null) => void
  onArrived: (game: Game) => void
}

export function CurrentGame({
  gameProgress, onSessionStarted, syncError, onRetry,
  stampRules, isResident, onStampRuleSaved, onArrived,
}: CurrentGameProps) {
  const [isPending, startTransition] = useTransition()
  const [showOptions, setShowOptions] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showXPToast = useXPToast()

  const game = gameProgress.game
  const ownRule = stampRules.find(r => r.game_id === game.id) ?? null
  const defaultRule = stampRules.find(r => r.game_id === null) ?? null

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

  const handleMarkBeaten = () => {
    if (syncError || isPending) return
    startTransition(async () => {
      try {
        await markGameBeaten(game.id, null)
        showXPToast({ total: 50, bonuses: ["🏆 Game beaten!"] })
        window.location.reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
        onRetry()
      }
    })
  }

  const handleAbandon = () => {
    if (syncError || isPending) return
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
      {syncError ? <div role="alert" className="mb-4 rounded-lg border border-amber-400/40 p-3 text-sm">
        {syncError} <button className="min-h-11 underline" onClick={onRetry}>Retry</button>
      </div> : null}
      {/* Flippable card */}
      <div
        className="relative w-full max-w-[320px] cursor-pointer mb-6"
        style={{ aspectRatio: "3/4", perspective: "1200px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* ── Front face ── */}
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl"
            style={{
              backfaceVisibility: "hidden",
              background: "rgba(15,15,20,0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {/* Game image */}
            <div className="relative h-[55%] w-full overflow-hidden">
              <Image
                src={game.header_image}
                alt={game.name}
                fill
                className="object-cover"
                sizes="320px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
            </div>

            {/* Currently playing badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "color-mix(in srgb, var(--success) 20%, transparent)", borderWidth: "1px", borderStyle: "solid", borderColor: "color-mix(in srgb, var(--success) 30%, transparent)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" style={{ animation: "pulse 2s infinite" }} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--success)]">Playing</span>
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
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-foreground"
                    style={{ background: "rgba(255,255,255,0.12)" }}
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

            {/* Tap hint */}
            <div className="absolute bottom-2 right-3 text-[10px] text-foreground/30">tap to flip</div>
          </div>

          {/* ── Back face ── */}
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl overflow-y-auto"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "rgba(15,15,20,0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex flex-col gap-4 p-5 h-full">
              {/* Small header image */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl shrink-0">
                <Image
                  src={game.header_image}
                  alt={game.name}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
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
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-foreground/80"
                    style={{ background: "rgba(255,255,255,0.08)" }}
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

              {/* Progress bar */}
              <div className="flex flex-col gap-1.5 mt-auto">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Journey</span>
                  <span>{gameProgress.status === "playing" ? "In progress" : gameProgress.status}</span>
                </div>
                <div className="relative h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--success)]"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(Math.max((gameProgress.total_sessions / 10) * 100, 4), 100)}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
              </div>

              {/* Tap hint */}
              <div className="text-center text-[10px] text-foreground/30 shrink-0">tap to flip back</div>
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
          ownRule={ownRule}
          onRuleSaved={onStampRuleSaved}
          onArrived={onArrived}
        />
      ) : null}

      {/* Actions */}
      <div className="w-full max-w-[320px] flex flex-col gap-3">
        <button
          onClick={handleStartSession}
          disabled={isPending || !!syncError}
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
                  disabled={isPending || !!syncError}
                  className="h-14 w-full rounded-xl text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                  style={{ backgroundColor: "var(--success)" }}
                >
                  I Beat This Game!
                </button>

                <button
                  onClick={handleAbandon}
                  disabled={isPending || !!syncError}
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
