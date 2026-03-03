import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import {
  getUser,
  getRecommendations,
  getActiveSession,
  getActiveGame,
  getSessionHistory,
} from "./actions"
import { AppShell } from "@/components/app-shell"

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

  try {
    const results = await Promise.all([
      getUser(),
      getActiveSession(),
      getActiveGame(),
      getSessionHistory(),
    ])
    profile = results[0]
    activeSession = results[1]
    activeGame = results[2]
    sessionHistory = results[3]
  } catch (error) {
    console.error("[v0] Error fetching user data:", error)
  }

  if (!profile) {
    redirect("/auth/login")
  }

  // Get recommendations based on user preferences
  try {
    recommendations = profile.onboarding_complete
      ? await getRecommendations(profile.preferences || {})
      : []
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
    />
  )
}
