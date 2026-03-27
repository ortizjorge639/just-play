import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import {
  getUser,
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

  try {
    // All users open booster packs to fill their deck — no pre-fetched recommendations
    boosterPackStatus = await getBoosterPackStatus()
  } catch (error) {
    console.error("[v0] Error fetching booster pack status:", error)
  }

  return (
    <AppShell
      user={profile}
      recommendations={[]}
      activeSession={activeSession}
      activeGame={activeGame}
      sessionHistory={sessionHistory}
      playerStats={playerStats}
      isBoosterPack={true}
      boosterPackStatus={boosterPackStatus}
    />
  )
}
