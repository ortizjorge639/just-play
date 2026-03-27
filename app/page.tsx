import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import {
  getUser,
  getRecommendations,
  getActiveSession,
  getActiveGame,
  getSessionHistory,
  getPlayerStats,
  getBoosterPackStatus,
  backfillXP,
} from "./actions"
import { AppShell } from "@/components/app-shell"
import type { PlayerStats } from "@/lib/types"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Handle auth callback code if present (email confirmation redirect)
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code)
    if (!error) {
      // Redirect to clean URL after successful auth
      redirect("/")
    }
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect("/auth/login")
  }

  let profile = null
  let activeSession = null
  let activeGame = null
  let sessionHistory: Awaited<ReturnType<typeof getSessionHistory>> = []
  let recommendations: Awaited<ReturnType<typeof getRecommendations>> = []
  let playerStats: PlayerStats | null = null

  try {
    const results = await Promise.all([
      getUser(),
      getActiveSession(),
      getActiveGame(),
      getSessionHistory(),
      getPlayerStats(),
    ])
    profile = results[0]
    activeSession = results[1]
    activeGame = results[2]
    sessionHistory = results[3]
    playerStats = results[4]
  } catch (error) {
    console.error("[v0] Error fetching user data:", error)
  }

  if (!profile) {
    redirect("/auth/login")
  }

  // Backfill XP for existing users who haven't earned any yet
  if (playerStats && playerStats.totalXP === 0 && playerStats.totalSessions > 0) {
    await backfillXP()
    playerStats = await getPlayerStats()
  }

  let boosterPackStatus = { packsOpenedToday: 0, packsRemaining: 3 }
  const isBoosterPack = !profile.onboarding_complete

  try {
    // Always fetch booster pack status (available in empty deck state for all users)
    boosterPackStatus = await getBoosterPackStatus()

    // Only fetch recommendations if user has set preferences
    if (profile.onboarding_complete) {
      recommendations = await getRecommendations(profile.preferences || {})
    }
  } catch (error) {
    console.error("[v0] Error fetching recommendations:", error)
  }

  return (
    <AppShell
      user={profile}
      recommendations={recommendations}
      activeSession={activeSession}
      activeGame={activeGame}
      sessionHistory={sessionHistory}
      playerStats={playerStats}
      isBoosterPack={isBoosterPack}
      boosterPackStatus={boosterPackStatus}
    />
  )
}
