"use client"

import { useState, useTransition, useCallback } from "react"
import { AnimatePresence } from "framer-motion"
import { GameSearch } from "./game-search"
import { QuickFilters } from "./quick-filters"
import { BoosterPack } from "./booster-pack"
import { createSession, markNotForMe } from "@/app/actions"
import { useXPToast } from "./xp-toast"
import { usePersistedDeck } from "@/hooks/use-persisted-deck"
import { GameArtwork } from "./game-artwork"
import type { Game, UserPreferences } from "@/lib/types"

interface CardDeckProps {
  games: Game[]
  preferences: UserPreferences
  onSessionCreated: () => void
  isBoosterPack?: boolean
  boosterPackStatus?: { packsOpenedToday: number; packsRemaining: number }
  onboardingComplete?: boolean
}

export function CardDeck({ games, preferences, onSessionCreated, isBoosterPack, boosterPackStatus, onboardingComplete = true }: CardDeckProps) {
  const [deck, setDeck] = usePersistedDeck(games)
  const [rejectedStack, setRejectedStack] = useState<Game[]>([])
  const [lockedGame, setLockedGame] = useState<Game | null>(null)
  const [focusedGameId, setFocusedGameId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [skipPending, startSkip] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(!onboardingComplete)
  const [packOpened, setPackOpened] = useState(false)
  const [showBoosterPack, setShowBoosterPack] = useState(false)
  const showXPToast = useXPToast()

  const handleBoosterPackOpened = useCallback((newGames: Game[]) => {
    setDeck(newGames)
    setPackOpened(true)
    setShowBoosterPack(false)
  }, [setDeck])

  // A searched game becomes a local selection; no session is written until play starts.
  const addSearchedGame = useCallback((game: Game) => {
    setDeck((prev) => [game, ...prev.filter((g) => g.id !== game.id)])
    setFocusedGameId(game.id)
    setLockedGame(game)
  }, [setDeck])

  const handleUndo = useCallback(() => {
    if (rejectedStack.length === 0) return
    const lastRejected = rejectedStack[rejectedStack.length - 1]
    setRejectedStack((prev) => prev.slice(0, -1))
    setDeck((prev) => [...prev, lastRejected])
    setFocusedGameId(lastRejected.id)
  }, [rejectedStack, setDeck])

  const handleSkip = useCallback((game: Game) => {
    setDeck((prev) => prev.filter((candidate) => candidate.id !== game.id))
    setRejectedStack((prev) => [...prev, game])
    setLockedGame((current) => current?.id === game.id ? null : current)
  }, [setDeck])

  const handleNotForMe = useCallback((game: Game) => {
    setError(null)
    startSkip(async () => {
      const result = await markNotForMe(game.id)
      if (!result.ok) {
        setError(result.error ?? "That did not go through. Try again.")
        return
      }
      setDeck((prev) => prev.filter((g) => g.id !== game.id))
      setLockedGame((current) => current?.id === game.id ? null : current)
    })
  }, [setDeck])

  const handleLockIn = useCallback((game: Game) => {
    setFocusedGameId(game.id)
    setLockedGame(game)
  }, [])

  const confirmLockIn = useCallback(() => {
    if (!lockedGame) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await createSession(lockedGame.id)
        if (result.xpAwarded) showXPToast(result.xpAwarded)
        onSessionCreated()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    })
  }, [lockedGame, onSessionCreated, showXPToast])

  const cancelLockIn = useCallback(() => {
    setLockedGame(null)
  }, [])
  const focusedGame = deck.find((game) => game.id === focusedGameId) ?? deck[0]
  const displayGame = lockedGame ?? focusedGame

  // Show booster pack overlay only after onboarding is complete and when explicitly triggered
  if (!lockedGame && onboardingComplete && ((isBoosterPack && !packOpened && deck.length === 0) || showBoosterPack)) {
    return (
      <>
        <BoosterPack
          boosterPackStatus={boosterPackStatus || { packsOpenedToday: 0, packsRemaining: 3 }}
          preferences={preferences}
          onPackOpened={handleBoosterPackOpened}
        />
        {/* Search FAB still available */}
        <GameSearch onGameSelected={addSearchedGame} />
      </>
    )
  }

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
            No games are showing right now. Undo a skip, open another pack, or update your filters.
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
            {boosterPackStatus && boosterPackStatus.packsRemaining > 0 && (
              <button
                onClick={() => setShowBoosterPack(true)}
                className={`h-12 rounded-xl px-8 text-sm font-semibold transition-colors active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2 ${
                  rejectedStack.length > 0
                    ? "glass-card text-foreground hover:bg-muted"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                Open Booster Pack ({boosterPackStatus.packsRemaining} left)
              </button>
            )}
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

        {/* Search FAB + overlay (available even when deck is empty) */}
        <GameSearch onGameSelected={addSearchedGame} />

      </>
    )
  }

  if (!displayGame) return null

  return (
    <>
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-5 px-4 pb-8 pt-5 sm:px-6 lg:grid-cols-[minmax(220px,.68fr)_minmax(0,1.32fr)] lg:gap-8 lg:px-8">
        <section aria-labelledby="recommendations-title" className="min-w-0">
          <header className="mb-4">
            <h1 id="recommendations-title" className="text-2xl font-semibold tracking-tight text-foreground">Choose a game</h1>
            <p className="mt-1 text-sm text-muted-foreground">Select a game to see its details.</p>
          </header>
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {deck.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  aria-pressed={displayGame.id === game.id}
                  onClick={() => { setFocusedGameId(game.id); if (lockedGame) setLockedGame(game) }}
                  className="flex min-h-[76px] w-full items-center gap-3 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:bg-secondary aria-pressed:border-primary/70 aria-pressed:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <GameArtwork src={game.header_image} alt="" sizes="72px" className="relative h-14 w-[72px] shrink-0 rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2 font-medium text-foreground">{game.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{game.estimated_session_length} min · {(game.genres ?? []).slice(0, 2).join(" · ") || "Game"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {rejectedStack.length > 0 ? (
              <button onClick={handleUndo} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-secondary">
                <span aria-hidden="true">↶</span> Undo skip
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => handleSkip(displayGame)}
              disabled={!!lockedGame}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25v13.5L19.5 12 5.25 5.25z" />
              </svg>
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => handleNotForMe(displayGame)}
              disabled={skipPending || !!lockedGame}
              className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
            >
              Don&apos;t suggest this game
            </button>
            {boosterPackStatus && boosterPackStatus.packsRemaining > 0 && (
              <button
                type="button"
                onClick={() => setShowBoosterPack(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                Booster pack ({boosterPackStatus.packsRemaining} left)
              </button>
            )}
          </div>
        </section>

        <section aria-label={lockedGame ? `${displayGame.name} selected` : `${displayGame.name} details`} className="relative isolate flex min-h-[22rem] min-w-0 flex-col justify-end overflow-hidden rounded-xl border border-border bg-card sm:min-h-[32rem] lg:min-h-[min(70dvh,44rem)]">
          <GameArtwork
            src={displayGame.header_image}
            alt=""
            sizes="(max-width: 1023px) 100vw, 68vw"
            priority
            className="absolute inset-0"
          />
          <div aria-hidden="true" className="absolute inset-0 z-[3] bg-gradient-to-t from-[#10130f]/95 via-[#10130f]/40 to-transparent" />
          <div className="relative z-[4] grid gap-3 p-5 sm:p-7 lg:p-9">
            <p className="text-sm font-medium text-primary">{lockedGame ? "Ready to play" : `${displayGame.estimated_session_length} min · ${(displayGame.genres ?? []).slice(0, 3).join(" · ")}`}</p>
            <h2 className="max-w-[18ch] break-words text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">{displayGame.name}</h2>
            {displayGame.description ? <p className="max-w-[58ch] text-sm leading-relaxed text-white/85 sm:text-base">{displayGame.description}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {lockedGame ? (
                <>
                  <button
                    type="button"
                    onClick={confirmLockIn}
                    disabled={isPending}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-highlight disabled:cursor-wait disabled:opacity-60"
                  >
                    {isPending ? "Starting…" : <><svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" /></svg>Start Playing</>}
                  </button>
                  <button
                    type="button"
                    onClick={cancelLockIn}
                    disabled={isPending}
                    className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/35 px-5 font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    Change game
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => handleLockIn(displayGame)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-highlight">
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10V7.5a4.5 4.5 0 019 0V10m-11.25 0h13.5A1.5 1.5 0 0120.25 11.5v8A1.5 1.5 0 0118.75 21h-13.5a1.5 1.5 0 01-1.5-1.5v-8A1.5 1.5 0 015.25 10z" />
                  </svg>
                  Lock in game
                </button>
              )}
            </div>
            {error ? <p role="alert" className="max-w-xl rounded-lg border border-destructive/50 bg-background/80 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          </div>
        </section>
      </main>
      <GameSearch onGameSelected={addSearchedGame} />
    </>
  )
}
