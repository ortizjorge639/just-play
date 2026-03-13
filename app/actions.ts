"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { UserPreferences, SessionStatus, Game, PlayerStats } from "@/lib/types"
import { calculateSessionXP, levelFromXP, isComeback } from "@/lib/xp"
import { calculateStreak } from "@/lib/streak"

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Try to get existing profile
  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  // If profile exists, return it
  if (profile) return profile

  // Create profile for new/anonymous users
  const displayName = user.user_metadata?.display_name || 
    (user.email ? user.email.split("@")[0] : "Player")
  
  const { data: newProfile, error: insertError } = await supabase
    .from("users")
    .insert({
      id: user.id,
      display_name: displayName,
      onboarding_complete: false,
      preferences: {},
    })
    .select("*")
    .single()

  if (insertError) {
    console.error("[v0] Failed to create user profile:", insertError)
    return null
  }

  return newProfile
}

export async function savePreferences(preferences: UserPreferences) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Reset seen games when preferences change so new filters get a fresh cycle
  const { error } = await supabase
    .from("users")
    .update({ preferences, onboarding_complete: true, seen_game_ids: [] })
    .eq("id", user.id)

  if (error) throw new Error(error.message)
  revalidatePath("/")
}

export async function markTutorialComplete() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("users")
    .update({ tutorial_complete: true })
    .eq("id", user.id)

  if (error) throw new Error(error.message)
  revalidatePath("/")
}

export async function getRecommendations(preferences: UserPreferences) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Fetch games and user's seen list in parallel
  const [{ data: games, error }, { data: profile }] = await Promise.all([
    supabase.from("games").select("*"),
    supabase.from("users").select("seen_game_ids").eq("id", user.id).single(),
  ])
  if (error) throw new Error(error.message)
  if (!games || games.length === 0) return []

  const seenIds = new Set<string>(profile?.seen_game_ids || [])

  // Score all games
  const scored = games.map((game) => {
    let score = 0

    // Time filter: if time_available set, prefer games within that range
    if (preferences.time_available) {
      if (game.estimated_session_length <= preferences.time_available) {
        score += 3
      } else {
        score -= 2
      }
    }

    // Energy match: map energy to genre preferences
    if (preferences.energy === "low") {
      if (
        game.genres?.some((g: string) =>
          ["relaxing", "simulation", "farming", "social"].includes(g)
        )
      ) {
        score += 3
      }
      if (
        game.genres?.some((g: string) =>
          ["challenging", "action"].includes(g)
        )
      ) {
        score -= 1
      }
    } else if (preferences.energy === "high") {
      if (
        game.genres?.some((g: string) =>
          ["action", "challenging", "roguelike"].includes(g)
        )
      ) {
        score += 3
      }
      if (
        game.genres?.some((g: string) =>
          ["relaxing", "simulation"].includes(g)
        )
      ) {
        score -= 1
      }
    }

    // Genre preference boost
    if (preferences.genre_preferences?.length) {
      const matches = game.genres?.filter((g: string) =>
        preferences.genre_preferences!.includes(g)
      )
      score += (matches?.length || 0) * 2
    }

    // Mood boost
    if (preferences.mood === "adventurous") {
      if (
        game.genres?.some((g: string) =>
          ["metroidvania", "roguelike", "action"].includes(g)
        )
      )
        score += 2
    } else if (preferences.mood === "chill") {
      if (
        game.genres?.some((g: string) =>
          ["relaxing", "simulation", "farming"].includes(g)
        )
      )
        score += 2
    } else if (preferences.mood === "competitive") {
      if (
        game.genres?.some((g: string) =>
          ["strategy", "challenging", "4x"].includes(g)
        )
      )
        score += 2
    }

    // Discovery preference: add variance for non-curated modes
    if (preferences.discovery === "adventurous") {
      score += Math.random() * 4 - 1 // -1 to +3 random variance
    } else if (preferences.discovery === "random") {
      score = Math.random() * 10 // fully random
    }

    return { ...game, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Filter out already-seen games
  let unseen = scored.filter((g) => !seenIds.has(g.id))

  // If fewer than 10 unseen remain, reset the cycle
  if (unseen.length < 10) {
    unseen = scored
    seenIds.clear()
  }

  const deck = unseen.slice(0, 10)

  // Track newly shown games
  const newSeenIds = [...Array.from(seenIds), ...deck.map((g) => g.id)]
  await supabase
    .from("users")
    .update({ seen_game_ids: newSeenIds })
    .eq("id", user.id)

  return deck
}

export async function createSession(gameId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check for existing active session
  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (existing) {
    throw new Error("You already have an active session. Finish it first.")
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      game_id: gameId,
      status: "LockedIn" as SessionStatus,
      active: true,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  // Also create/update game_progress to track this game is being played
  const { data: existingProgress } = await supabase
    .from("game_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .maybeSingle()

  const isNewGame = !existingProgress

  if (!existingProgress) {
    await supabase
      .from("game_progress")
      .insert({
        user_id: user.id,
        game_id: gameId,
        status: "playing",
        total_sessions: 1,
        total_time_minutes: 0,
      })
  } else if (existingProgress.status !== "playing") {
    // Resume a previously abandoned game
    await supabase
      .from("game_progress")
      .update({ 
        status: "playing",
        total_sessions: existingProgress.total_sessions + 1
      })
      .eq("id", existingProgress.id)
  } else {
    // Increment session count
    await supabase
      .from("game_progress")
      .update({ total_sessions: existingProgress.total_sessions + 1 })
      .eq("id", existingProgress.id)
  }

  // Award XP for starting a session
  const { data: profile } = await supabase
    .from("users")
    .select("total_xp, last_session_date")
    .eq("id", user.id)
    .single()

  const comeback = isComeback(profile?.last_session_date ?? null)
  const xp = calculateSessionXP({
    durationMinutes: 0,
    isNewGame,
    isGameBeaten: false,
    isComeback: comeback,
  })

  const startXP = xp.base + xp.newGameBonus + xp.comebackBonus
  if (startXP > 0 && profile) {
    const newTotalXP = profile.total_xp + startXP
    const { level } = levelFromXP(newTotalXP)
    const today = new Date().toISOString().split("T")[0]

    await supabase
      .from("users")
      .update({ total_xp: newTotalXP, level, last_session_date: today })
      .eq("id", user.id)

    await supabase
      .from("sessions")
      .update({ xp_awarded: startXP })
      .eq("id", data.id)
  }

  // Update streak
  await updateUserStreak(user.id)

  revalidatePath("/")
  return {
    session: data,
    xpAwarded: { total: startXP, bonuses: xp.bonuses.filter(b => !b.includes("duration") && !b.includes("Long")) },
  }
}

export async function updateSessionStatus(
  sessionId: string,
  newStatus: SessionStatus
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Validate state transitions (with pause/resume support)
  const validTransitions: Record<string, string[]> = {
    LockedIn: ["Playing", "Finished"],
    Playing: ["Paused", "Finished"],
    Paused: ["Playing", "Finished"],
    Finished: [],
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()

  if (!session) throw new Error("Session not found")

  // If already at this status, just return silently (idempotent)
  if (session.status === newStatus) {
    return
  }

  if (!validTransitions[session.status]?.includes(newStatus)) {
    throw new Error(
      `Cannot transition from ${session.status} to ${newStatus}`
    )
  }

  const updates: Record<string, unknown> = { status: newStatus }

  // Handle pause - save elapsed time so we can resume correctly
  if (newStatus === "Paused" && session.status === "Playing") {
    const start = new Date(session.started_at)
    const elapsed = Math.round((Date.now() - start.getTime()) / 1000)
    updates.paused_elapsed_seconds = (session.paused_elapsed_seconds || 0) + elapsed
  }

  // Handle resume - reset started_at to now (elapsed is saved in paused_elapsed_seconds)
  if (newStatus === "Playing" && session.status === "Paused") {
    updates.started_at = new Date().toISOString()
  }

  if (newStatus === "Finished") {
    updates.active = false
    updates.ended_at = new Date().toISOString()
    // Calculate total duration including paused time
    const start = new Date(session.started_at)
    const currentElapsed = Math.round((Date.now() - start.getTime()) / 1000)
    const totalSeconds = (session.paused_elapsed_seconds || 0) + 
      (session.status === "Paused" ? 0 : currentElapsed)
    const durationMinutes = Math.round(totalSeconds / 60)
    updates.duration_minutes = durationMinutes

    // Award duration-based XP on finish
    const durationXP = calculateSessionXP({
      durationMinutes,
      isNewGame: false,
      isGameBeaten: false,
      isComeback: false,
    })
    const finishXP = durationXP.durationBonus + durationXP.longSessionBonus
    const finishBonuses = durationXP.bonuses.filter(b => b.includes("duration") || b.includes("Long"))
    if (finishXP > 0) {
      const { data: profile } = await supabase
        .from("users")
        .select("total_xp")
        .eq("id", user.id)
        .single()
      if (profile) {
        const newTotalXP = profile.total_xp + finishXP
        const { level } = levelFromXP(newTotalXP)
        await supabase
          .from("users")
          .update({ total_xp: newTotalXP, level })
          .eq("id", user.id)
      }
      // Add finish XP to what was already awarded at start
      updates.xp_awarded = (session.xp_awarded || 0) + finishXP
    }
  }

  const { error } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", sessionId)
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)
  revalidatePath("/")

  if (newStatus === "Finished") {
    const durationXPCalc = calculateSessionXP({
      durationMinutes: (updates.duration_minutes as number) || 0,
      isNewGame: false,
      isGameBeaten: false,
      isComeback: false,
    })
    const finishXPTotal = durationXPCalc.durationBonus + durationXPCalc.longSessionBonus
    return {
      xpAwarded: {
        total: finishXPTotal,
        bonuses: durationXPCalc.bonuses.filter(b => b.includes("duration") || b.includes("Long")),
      },
    }
  }
  return { xpAwarded: null }
}

export async function getActiveGame() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Check for game currently being played (not beaten or abandoned)
  const { data: progress, error: progressError } = await supabase
    .from("game_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "playing")
    .maybeSingle()

  if (progressError || !progress) return null

  // Get the game data
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", progress.game_id)
    .single()

  if (gameError || !game) return null

  return { ...progress, game }
}

export async function startSessionForGame(gameId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check for existing active session
  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (existing) {
    throw new Error("You already have an active session.")
  }

  // Create new session for existing game
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      game_id: gameId,
      status: "LockedIn" as SessionStatus,
      active: true,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/")
  return data
}

export async function getActiveSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // First get the active session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (sessionError || !session) return null

  // Then get the game data
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", session.game_id)
    .single()

  if (gameError || !game) return null

  return { ...session, games: game }
}

export async function updateSessionNotes(sessionId: string, notes: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("sessions")
    .update({ notes })
    .eq("id", sessionId)
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)
}

export async function updateSessionGoal(sessionId: string, goal: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("sessions")
    .update({ session_goal: goal })
    .eq("id", sessionId)
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)
}

export async function markGameBeaten(gameId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // First end any active session for this game
  await supabase
    .from("sessions")
    .update({ 
      active: false, 
      status: "Finished",
      ended_at: new Date().toISOString()
    })
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .eq("active", true)

  // Update or create game progress
  const { data: existing } = await supabase
    .from("game_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from("game_progress")
      .update({ 
        status: "beaten",
        completed_at: new Date().toISOString()
      })
      .eq("id", existing.id)
  } else {
    await supabase
      .from("game_progress")
      .insert({
        user_id: user.id,
        game_id: gameId,
        status: "beaten",
        total_sessions: 1,
        total_time_minutes: 0,
        completed_at: new Date().toISOString()
      })
  }

  // Award beat-game XP bonus
  const { data: profile } = await supabase
    .from("users")
    .select("total_xp")
    .eq("id", user.id)
    .single()
  if (profile) {
    const xp = calculateSessionXP({
      durationMinutes: 0,
      isNewGame: false,
      isGameBeaten: true,
      isComeback: false,
    })
    const newTotalXP = profile.total_xp + xp.beatGameBonus
    const { level } = levelFromXP(newTotalXP)
    await supabase
      .from("users")
      .update({ total_xp: newTotalXP, level })
      .eq("id", user.id)
  }

  revalidatePath("/")
}

export async function abandonGame(gameId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // End any active session
  await supabase
    .from("sessions")
    .update({ 
      active: false, 
      status: "Finished",
      ended_at: new Date().toISOString()
    })
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .eq("active", true)

  // Mark as abandoned
  const { data: existing } = await supabase
    .from("game_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from("game_progress")
      .update({ status: "abandoned" })
      .eq("id", existing.id)
  } else {
    await supabase
      .from("game_progress")
      .insert({
        user_id: user.id,
        game_id: gameId,
        status: "abandoned",
        total_sessions: 0,
        total_time_minutes: 0
      })
  }

  revalidatePath("/")
}

export async function getSessionHistory() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // Get sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", false)
    .order("ended_at", { ascending: false })
    .limit(50)

  if (sessionsError || !sessions || sessions.length === 0) return []

  // Get unique game IDs
  const gameIds = [...new Set(sessions.map(s => s.game_id))]
  
  // Fetch all games at once
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("*")
    .in("id", gameIds)

  if (gamesError || !games) return []

  // Create a map for quick lookup
  const gameMap = new Map(games.map(g => [g.id, g]))

  // Merge sessions with games
  return sessions.map(session => ({
    ...session,
    games: gameMap.get(session.game_id) || null
  })).filter(s => s.games !== null)
}

// ── Game Search ───────────────────────────────────────────────────────

export async function addSearchedGame(gameData: {
  igdbId: number
  name: string
  coverUrl: string | null
  genres: string[]
  estimatedSessionLength: number
  description: string
}): Promise<Game> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const gameId = `igdb-${gameData.igdbId}`

  // Check if game already exists (SELECT uses regular client — RLS allows reads)
  const { data: existing } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle()

  if (existing) return existing as Game

  // Insert new game (RLS INSERT policy allows authenticated users)
  const { data: game, error } = await supabase
    .from("games")
    .insert({
      id: gameId,
      name: gameData.name,
      genres: gameData.genres.length > 0 ? gameData.genres : ["indie"],
      estimated_session_length: gameData.estimatedSessionLength,
      header_image: gameData.coverUrl || "",
      description: gameData.description,
      source: "igdb",
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/")
  return game as Game
}

// ── Gamification ──────────────────────────────────────────────────────

async function updateUserStreak(userId: string) {
  const supabase = await createClient()

  // Fetch all session start dates for streak calculation
  const { data: sessions } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })

  if (!sessions || sessions.length === 0) return

  const dates = sessions.map((s) => s.started_at)
  const streak = calculateStreak(dates)

  await supabase
    .from("users")
    .update({
      streak_count: streak.consecutive,
      best_streak: streak.bestStreak,
    })
    .eq("id", userId)
}

export async function getPlayerStats(): Promise<PlayerStats | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: sessions }] = await Promise.all([
    supabase
      .from("users")
      .select("total_xp, level, streak_count, best_streak, last_session_date")
      .eq("id", user.id)
      .single(),
    supabase
      .from("sessions")
      .select("started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false }),
  ])

  if (!profile) return null

  const levelInfo = levelFromXP(profile.total_xp)
  const sessionDates = (sessions || []).map((s) => s.started_at)
  const streak = calculateStreak(sessionDates)
  const totalSessions = sessionDates.length

  return {
    totalXP: profile.total_xp,
    level: levelInfo.level,
    xpInCurrentLevel: levelInfo.xpInCurrentLevel,
    xpToNextLevel: levelInfo.xpToNextLevel,
    progress: levelInfo.progress,
    streak: streak.consecutive,
    bestStreak: streak.bestStreak,
    weeklyRatio: streak.weeklyRatio,
    weeklyDays: streak.weeklyDays,
    totalSessions,
  }
}

export async function backfillXP() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from("users")
    .select("total_xp")
    .eq("id", user.id)
    .single()

  // Only backfill if user has no XP yet
  if (!profile || profile.total_xp > 0) return

  // Get all finished sessions that haven't been awarded XP
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, duration_minutes, game_id, started_at, xp_awarded")
    .eq("user_id", user.id)
    .eq("active", false)
    .order("started_at", { ascending: true })

  if (!sessions || sessions.length === 0) return

  let totalXP = 0
  const seenGames = new Set<string>()

  for (const session of sessions) {
    if (session.xp_awarded > 0) {
      totalXP += session.xp_awarded
      seenGames.add(session.game_id)
      continue
    }

    const isNewGame = !seenGames.has(session.game_id)
    seenGames.add(session.game_id)

    const xp = calculateSessionXP({
      durationMinutes: session.duration_minutes || 0,
      isNewGame,
      isGameBeaten: false,
      isComeback: false,
    })

    totalXP += xp.total

    // Mark session with awarded XP
    await supabase
      .from("sessions")
      .update({ xp_awarded: xp.total })
      .eq("id", session.id)
  }

  // Check for beaten games bonus
  const { data: beatenGames } = await supabase
    .from("game_progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "beaten")

  if (beatenGames) {
    totalXP += beatenGames.length * 50
  }

  const { level } = levelFromXP(totalXP)
  const lastSession = sessions[sessions.length - 1]
  const lastDate = lastSession?.started_at
    ? new Date(lastSession.started_at).toISOString().split("T")[0]
    : null

  await supabase
    .from("users")
    .update({ total_xp: totalXP, level, last_session_date: lastDate })
    .eq("id", user.id)

  // Also update streak
  await updateUserStreak(user.id)
}
