"use client"

import { useState, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Onboarding } from "./onboarding"
import { Tutorial } from "./tutorial"
import { CardDeck } from "./card-deck"
import { ActiveSession } from "./active-session"
import { CurrentGame } from "./current-game"
import { Progress } from "./progress"
import { BottomNav } from "./bottom-nav"
import { QuickFilters } from "./quick-filters"
import { Settings } from "./settings"
import { signout } from "@/app/auth/actions"
import { markTutorialComplete } from "@/app/actions"
import type { UserProfile, Game, Session, GameProgress } from "@/lib/types"

type Tab = "deck" | "session" | "progress"

interface AppShellProps {
  user: UserProfile
  recommendations: Game[]
  activeSession: (Session & { games: Game }) | null
  activeGame: (GameProgress & { game: Game }) | null
  sessionHistory: (Session & { games: Game })[]
}

export function AppShell({
  user,
  recommendations,
  activeSession: initialSession,
  activeGame,
  sessionHistory: initialHistory,
}: AppShellProps) {
  const [showTutorial, setShowTutorial] = useState(!user.tutorial_complete && user.onboarding_complete)
  const [showOnboarding, setShowOnboarding] = useState(!user.onboarding_complete)
  const [activeTab, setActiveTab] = useState<Tab>(
    initialSession || activeGame ? "session" : "deck"
  )
  const [activeSession, setActiveSession] = useState(initialSession)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    // Show tutorial after onboarding
    setShowTutorial(true)
  }, [])

  const handleTutorialComplete = useCallback(async () => {
    setShowTutorial(false)
    await markTutorialComplete()
    // Force a full reload to get fresh recommendations
    window.location.reload()
  }, [])

  const handleSessionCreated = useCallback(() => {
    setNeedsRefresh(true)
    // Full reload to get the new active session from the server
    window.location.reload()
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

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  if (showTutorial) {
    return <Tutorial onComplete={handleTutorialComplete} />
  }

  return (
    <div className="flex min-h-dvh flex-col pb-16">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-foreground">Just Play</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "deck" && !activeSession && (
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary min-h-[44px] min-w-[44px]"
              aria-label="Update filters"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
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
              onBack={() => setActiveTab("deck")}
              onOpenSettings={() => setShowSettings(true)}
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
            onReplayTutorial={() => {
              setShowSettings(false)
              setShowTutorial(true)
            }}
            onEditPreferences={() => {
              setShowSettings(false)
              setShowFilters(true)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
