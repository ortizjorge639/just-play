"use client"

import { useState, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CardDeck } from "./card-deck"
import { ActiveSession } from "./active-session"
import { CurrentGame } from "./current-game"
import { Progress } from "./progress"
import { XPToastProvider } from "./xp-toast"
import { BottomNav } from "./bottom-nav"
import { QuickFilters } from "./quick-filters"
import { Settings } from "./settings"
import { signout } from "@/app/auth/actions"
import { FilterTip } from "./filter-tip"
import type { UserProfile, Game, Session, GameProgress, PlayerStats } from "@/lib/types"

type Tab = "deck" | "session" | "progress"

interface AppShellProps {
  user: UserProfile
  recommendations: Game[]
  activeSession: (Session & { games: Game }) | null
  activeGame: (GameProgress & { game: Game }) | null
  sessionHistory: (Session & { games: Game })[]
  playerStats: PlayerStats | null
  isBoosterPack: boolean
  boosterPackStatus: { packsOpenedToday: number; packsRemaining: number }
}

export function AppShell({
  user,
  recommendations,
  activeSession: initialSession,
  activeGame,
  sessionHistory: initialHistory,
  playerStats,
  isBoosterPack,
  boosterPackStatus,
}: AppShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>(
    initialSession || activeGame ? "session" : "deck"
  )
  const [activeSession, setActiveSession] = useState(initialSession)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [filterTipDismissed, setFilterTipDismissed] = useState(user.tutorial_complete)

  const handleSessionCreated = useCallback(() => {
    setNeedsRefresh(true)
    // Full reload to get the new active session from the server
    window.location.reload()
  }, [])

  const handleSessionUpdated = useCallback((updates: Partial<Session>) => {
    setActiveSession(prev => prev ? { ...prev, ...updates } : prev)
  }, [])

  const handleSessionFinished = useCallback(() => {
    setActiveSession(null)
    setActiveTab("progress")
    setNeedsRefresh(true)
    // Full reload to get updated history
    window.location.reload()
  }, [])

  const handleTabChange = useCallback((tab: Tab) => {
    if (needsRefresh) {
      window.location.reload()
      return
    }
    // If there's an active session or active game and they try to go to deck, redirect to session
    if (tab === "deck" && (activeSession || activeGame)) {
      setActiveTab("session")
      return
    }
    setActiveTab(tab)
  }, [needsRefresh, activeSession, activeGame])

  return (
    <XPToastProvider>
    <div className="flex min-h-dvh flex-col pb-16">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 pt-6 pb-2 bg-background/80 backdrop-blur-lg">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-foreground">Just Play</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "deck" && !activeSession && (
            filterTipDismissed ? (
              <button
                onClick={() => setShowFilters(true)}
                className="flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary min-h-[44px] min-w-[44px]"
                aria-label="Update filters"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </button>
            ) : (
              <FilterTip onDismiss={() => setFilterTipDismissed(true)}>
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary min-h-[44px] min-w-[44px]"
                  aria-label="Update filters"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                </button>
              </FilterTip>
            )
          )}
          {activeTab === "progress" && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary min-h-[44px] min-w-[44px]"
              aria-label="Settings"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <form action={signout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary min-h-[44px]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {activeTab === "deck" && !activeSession && (
          <motion.div
            key="deck"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            <CardDeck
              games={recommendations}
              preferences={user.preferences || {}}
              onSessionCreated={handleSessionCreated}
              isBoosterPack={isBoosterPack}
              boosterPackStatus={boosterPackStatus}
            />
          </motion.div>
        )}

        {activeTab === "session" && (
          <motion.div
            key="session"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            {activeSession ? (
              <ActiveSession
                session={activeSession}
                onFinished={handleSessionFinished}
                onSessionUpdated={handleSessionUpdated}
              />
            ) : activeGame ? (
              <CurrentGame
                gameProgress={activeGame}
                onSessionStarted={handleSessionCreated}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                  <svg
                    className="h-10 w-10 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground">No active session</h2>
                <p className="text-muted-foreground text-base max-w-xs">
                  Head to the deck and lock in a game to start playing.
                </p>
                <button
                  onClick={() => setActiveTab("deck")}
                  className="mt-2 h-12 rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] min-h-[44px]"
                >
                  Browse Games
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "progress" && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            <Progress
              sessions={initialHistory}
              displayName={user.display_name}
              playerStats={playerStats}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav
        active={activeTab}
        onChange={handleTabChange}
        hasActiveSession={!!activeSession || !!activeGame}
      />

      {/* Quick Filters Modal */}
      <AnimatePresence>
        {showFilters && (
          <QuickFilters
            currentPreferences={user.preferences || {}}
            onApply={() => {
              setShowFilters(false)
              window.location.reload()
            }}
            onCancel={() => setShowFilters(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <Settings
            displayName={user.display_name}
            onClose={() => setShowSettings(false)}
            onEditPreferences={() => {
              setShowSettings(false)
              setShowFilters(true)
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </XPToastProvider>
  )
}
