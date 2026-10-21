"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import type { UserPreferences, SessionStatus, Session, SessionTimingSnapshot, SessionMutationSnapshot, SessionFinishOptions, StandbyPreferences, Game, PlayerStats, Resident } from "@/lib/types"
import { DEFAULT_STANDBY_PREFERENCES } from "@/lib/types"
import { getSessionTransitionTiming } from "@/lib/session-time"
import { calculateSessionXP, levelFromXP, isComeback } from "@/lib/xp"
import { calculateStreak } from "@/lib/streak"
import { getIGDBGameById } from "@/lib/igdb"

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

export async function getStandbyPreferences(): Promise<StandbyPreferences> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await supabase
    .from("users")
    .select("standby_preferences")
    .eq("id", user.id)
    .single()
  if (error) throw new Error(`Failed to load StandBy preferences: ${error.message}`)
  if (!data) throw new Error("User profile not found")
  return { ...DEFAULT_STANDBY_PREFERENCES, ...data.standby_preferences }
}

/** Account defaults only; an existing session's record_time never changes. */
export async function saveStandbyPreferences(preferences: StandbyPreferences): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    throw new Error("StandBy preferences must be a full object of boolean settings")
  }
  const settings: StandbyPreferences = { ...DEFAULT_STANDBY_PREFERENCES }
  for (const key of Object.keys(settings) as (keyof StandbyPreferences)[]) {
    if (typeof preferences[key] !== "boolean") {
      throw new Error(`StandBy preference ${key} must be a boolean`)
    }
    settings[key] = preferences[key]
  }
  const { data, error } = await supabase
    .from("users")
    .update({ standby_preferences: settings })
    .eq("id", user.id)
    .select("id")
    .single()
  if (error) throw new Error(`Failed to save StandBy preferences: ${error.message}`)
  if (!data) throw new Error("User profile not found")
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

// A pack is a short list, so choosing never turns into scrolling
const DECK_SIZE = 3

export async function getBoosterPack() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Fetch featured games and user's seen list in parallel
  const [{ data: games, error }, { data: profile }] = await Promise.all([
    supabase.from("games").select("*").eq("featured", true),
    supabase.from("users").select("seen_game_ids").eq("id", user.id).single(),
  ])
  if (error) throw new Error(error.message)
  if (!games || games.length === 0) return []

  const seenIds = new Set<string>(profile?.seen_game_ids || [])

  // Filter out already-seen games
  let available = games.filter((g) => !seenIds.has(g.id))

  // If fewer than a full pack of unseen featured games remain, reset the cycle
  if (available.length < DECK_SIZE) {
    available = games
    seenIds.clear()
  }

  // Shuffle and take one pack
  const shuffled = available.sort(() => Math.random() - 0.5)
  const deck = shuffled.slice(0, DECK_SIZE)

  // Track newly shown games
  const newSeenIds = [...Array.from(seenIds), ...deck.map((g) => g.id)]
  await supabase
    .from("users")
    .update({ seen_game_ids: newSeenIds })
    .eq("id", user.id)

  return deck
}

export async function getBoosterPackStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { packsOpenedToday: 0, packsRemaining: 3 }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const { count, error } = await supabase
    .from("booster_pack_opens")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("opened_at", twentyFourHoursAgo)

  if (error) {
    console.error("Error fetching booster pack status:", error)
    return { packsOpenedToday: 0, packsRemaining: 3 }
  }

  const packsOpenedToday = count || 0
  return { packsOpenedToday, packsRemaining: Math.max(0, 3 - packsOpenedToday) }
}

export async function recordBoosterPackOpen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check rate limit
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("booster_pack_opens")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("opened_at", twentyFourHoursAgo)

  if ((count || 0) >= 3) {
    throw new Error("Daily booster pack limit reached. Come back tomorrow!")
  }

  const { error } = await supabase
    .from("booster_pack_opens")
    .insert({ user_id: user.id })

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

  // If fewer than a full pack of unseen games remain, reset the cycle
  if (unseen.length < DECK_SIZE) {
    unseen = scored
    seenIds.clear()
  }

  const deck = unseen.slice(0, DECK_SIZE)

  // Track newly shown games
  const newSeenIds = [...Array.from(seenIds), ...deck.map((g) => g.id)]
  await supabase
    .from("users")
    .update({ seen_game_ids: newSeenIds })
    .eq("id", user.id)

  return deck
}

function isMissingStandbyFunction(error: { code?: string }) {
  return error.code === "PGRST202" || error.code === "42883"
}

function standbyMutationError(error: { code?: string; message: string }) {
  if (isMissingStandbyFunction(error)) {
    return new Error(
      "StandBy atomic writes are unavailable. Database migration 020 and an up-to-date API schema cache are required. No session or progress changes were made."
    )
  }
  return new Error(error.message)
}

export async function createSession(gameId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check for existing active session
  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) {
    throw new Error("You already have an active session. Finish it first.")
  }

  const [{ data: existingProgress, error: progressError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("game_progress").select("*").eq("user_id", user.id).eq("game_id", gameId).maybeSingle(),
    supabase.from("users").select("last_session_date").eq("id", user.id).single(),
  ])
  if (progressError) throw new Error(progressError.message)
  if (profileError) throw new Error(profileError.message)
  const isNewGame = !existingProgress
  const xp = calculateSessionXP({
    durationMinutes: 0,
    isNewGame,
    isGameBeaten: false,
    isComeback: isComeback(profile?.last_session_date ?? null),
  })
  const startXP = xp.base + xp.newGameBonus + xp.comebackBonus
  const { data, error } = await supabase
    .rpc("create_standby_session_with_progress", { p_game_id: gameId, p_start_xp: startXP })
    .returns<Session[]>()
    .single()

  if (error) throw standbyMutationError(error)

  // Migration 020 commits session, start XP and progress bookkeeping together.

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
  newStatus: SessionStatus,
  expected?: SessionTimingSnapshot,
  finishOptions?: SessionFinishOptions
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  return transitionSession(supabase, user.id, sessionId, newStatus, expected, finishOptions)
}

async function transitionSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string,
  newStatus: SessionStatus,
  expected?: SessionTimingSnapshot,
  finishOptions?: SessionFinishOptions
) {
  if (finishOptions !== undefined && (
    !finishOptions || typeof finishOptions.notes !== "string" || newStatus !== "Finished"
  )) {
    throw new Error("Final notes must be a string and are accepted only for a Finished transition.")
  }
  const validTransitions: Record<string, string[]> = {
    LockedIn: ["Playing", "Finished"],
    Playing: ["Paused", "Finished"],
    Paused: ["Playing", "Finished"],
    Finished: [],
  }

  const { data: session, error: readError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single()

  if (readError) throw new Error(`Failed to load session: ${readError.message}`)
  if (!session) throw new Error("Session not found")
  if (expected && (
    expected.status !== session.status ||
    expected.started_at !== session.started_at ||
    expected.paused_elapsed_seconds !== (session.paused_elapsed_seconds ?? 0)
  )) {
    throw new Error("Session changed. Refresh before trying again.")
  }

  if (!session.active || !validTransitions[session.status]?.includes(newStatus)) {
    throw new Error(
      `Cannot transition from ${session.status} to ${newStatus}`
    )
  }

  const updates = getSessionTransitionTiming(session, newStatus)
  // Migration 018 awards duration XP atomically with the guarded transition.

  // Include every timing/state field, not just status: a pause/resume round trip
  // must invalidate an in-flight finish based on the previous playing segment.
  const snapshot: Record<string, unknown> = {}
  for (const key of [
    "status", "active", "started_at", "ended_at", "paused_elapsed_seconds",
    "duration_minutes", "record_time", "xp_awarded",
  ]) {
    snapshot[key] = session[key] ?? null
  }
  const args = {
    p_session_id: sessionId, p_expected: snapshot, p_updates: updates,
  }
  const result = newStatus === "Finished"
    ? await supabase.rpc("finish_standby_session_with_notes", {
      ...args, p_final_notes: finishOptions?.notes ?? session.notes ?? "",
    }).returns<Session[]>().maybeSingle()
    : await supabase.rpc("transition_standby_session", args).returns<Session[]>().maybeSingle()
  const { data: updated, error } = result
  if (error) throw standbyMutationError(error)
  if (!updated) throw new Error("Session changed. Refresh before trying again.")
  revalidatePath("/")

  if (newStatus === "Finished") {
    const durationXPCalc = calculateSessionXP({
      durationMinutes: updated.record_time === false ? 0 : updated.duration_minutes || 0,
      isNewGame: false,
      isGameBeaten: false,
      isComeback: false,
    })
    const finishXPTotal = Math.max(0, (updated.xp_awarded || 0) - (session.xp_awarded || 0))
    return {
      session: updated as Session,
      xpAwarded: {
        total: finishXPTotal,
        bonuses: durationXPCalc.bonuses.filter(b => b.includes("duration") || b.includes("Long")),
      },
    }
  }
  return { session: updated as Session, xpAwarded: null }
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

  if (progressError) throw new Error(`Failed to load current game: ${progressError.message}`)
  if (!progress) return null

  // Get the game data and finished sessions in parallel
  const [gameResult, sessionsResult] = await Promise.all([
    supabase
      .from("games")
      .select("*")
      .eq("id", progress.game_id)
      .single(),
    supabase
      .from("sessions")
      .select("duration_minutes")
      .eq("user_id", user.id)
      .eq("game_id", progress.game_id)
      .eq("active", false)
      .eq("status", "Finished"),
  ])

  if (gameResult.error) throw new Error(`Failed to load current game details: ${gameResult.error.message}`)
  if (!gameResult.data) return null
  if (sessionsResult.error) throw new Error(`Failed to load current game sessions: ${sessionsResult.error.message}`)

  // Derive total_sessions and total_time_minutes from finished sessions
  const total_sessions = sessionsResult.data?.length ?? 0
  const total_time_minutes = sessionsResult.data?.reduce((sum, r) => sum + Math.max(0, r.duration_minutes ?? 0), 0) ?? 0

  return { 
    ...progress, 
    game: gameResult.data,
    total_sessions,
    total_time_minutes,
  }
}

export async function startSessionForGame(gameId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check for existing active session
  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) {
    throw new Error("You already have an active session.")
  }

  // Create new session for existing game
  const { data, error } = await supabase
    .rpc("create_standby_session_with_progress", { p_game_id: gameId, p_start_xp: 0 })
    .returns<Session[]>()
    .single()

  if (error) throw standbyMutationError(error)
  revalidatePath("/")
  return data
}

export async function getActiveSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // First get the active session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (sessionError) throw new Error(`Failed to load active session: ${sessionError.message}`)
  if (!session) return null

  // Fetch game data and game progress in parallel
  const [gameResult, progressResult] = await Promise.all([
    supabase
      .from("games")
      .select("*")
      .eq("id", session.game_id)
      .single(),
    supabase
      .from("sessions")
      .select("duration_minutes")
      .eq("user_id", user.id)
      .eq("game_id", session.game_id)
      .eq("active", false)
      .eq("status", "Finished"),
  ])

  if (gameResult.error) throw new Error(`Failed to load active session game: ${gameResult.error.message}`)
  if (!gameResult.data) throw new Error("Active session game not found")
  if (progressResult.error) throw new Error(`Failed to load active session progress: ${progressResult.error.message}`)

  return {
    ...session,
    games: gameResult.data,
    progress: progressResult.data && progressResult.data.length > 0
      ? {
          total_sessions: progressResult.data.length,
          total_time_minutes: progressResult.data.reduce((sum, r) => sum + Math.max(0, r.duration_minutes ?? 0), 0),
        }
      : null,
  }
}

export async function updateSessionNotes(sessionId: string, notes: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("sessions")
    .update({ notes })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("active", true)
    .neq("status", "Finished")
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Active session not found. Finished session notes cannot be changed.")
}

export async function updateSessionGoal(sessionId: string, goal: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("sessions")
    .update({ session_goal: goal })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("active", true)
    .neq("status", "Finished")
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Active session not found. Finished session goals cannot be changed.")
}

async function completeGame(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
  status: "beaten" | "abandoned",
  expected?: SessionMutationSnapshot | null,
  finalNotes?: string
) {
  if (finalNotes !== undefined && typeof finalNotes !== "string") {
    throw new Error("Final notes must be a string.")
  }
  // Preserve undefined's deliberate "latest" behavior; null asserts absence.
  const { data, error } = await supabase.rpc("complete_standby_game", {
    p_game_id: gameId,
    p_status: status,
    p_expected_session: expected === undefined ? { mode: "latest" } : expected,
    p_final_notes: finalNotes ?? null,
  }).maybeSingle()
  if (error) throw standbyMutationError(error)
  if (!data) throw new Error("Game progress changed. Refresh before trying again.")
  revalidatePath("/")
}

export async function markGameBeaten(gameId: string, expectedSession?: SessionMutationSnapshot | null, finalNotes?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await completeGame(supabase, gameId, "beaten", expectedSession, finalNotes)
}

export async function abandonGame(gameId: string, expectedSession?: SessionMutationSnapshot | null, finalNotes?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await completeGame(supabase, gameId, "abandoned", expectedSession, finalNotes)
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

  if (sessionsError) throw new Error(`Failed to load session history: ${sessionsError.message}`)
  if (!sessions || sessions.length === 0) return []

  // Get unique game IDs
  const gameIds = [...new Set(sessions.map(s => s.game_id))]
  
  // Fetch all games at once
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("*")
    .in("id", gameIds)

  if (gamesError) throw new Error(`Failed to load history games: ${gamesError.message}`)
  if (!games) return []

  // Create a map for quick lookup
  const gameMap = new Map(games.map(g => [g.id, g]))

  // Merge sessions with games
  return sessions.map(session => ({
    ...session,
    games: gameMap.get(session.game_id) || null
  })).filter(s => s.games !== null)
}

// ── Game Search ───────────────────────────────────────────────────────

export async function addSearchedGame(gameData: { igdbId: number }): Promise<Game> {
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

  // Metadata comes from IGDB, never from the caller, so one user can't write
  // arbitrary titles or image URLs into the shared catalog.
  const canonical = await getIGDBGameById(gameData.igdbId)
  if (!canonical) throw new Error("Game not found")

  // With the service key set, writes bypass RLS so the open insert policy can be dropped (migration 021)
  const writer = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
  const { data: game, error } = await writer
    .from("games")
    .insert({
      id: gameId,
      name: canonical.name,
      genres: canonical.genres.length > 0 ? canonical.genres : ["indie"],
      estimated_session_length: canonical.estimatedSessionLength,
      time_to_beat_minutes: canonical.timeToBeatMinutes,
      header_image: canonical.coverUrl || "",
      description: canonical.description,
      source: "igdb",
    })
    .select("*")
    .single()

  if (error) {
    // 23505: another request inserted the same game first
    if (error.code === "23505") {
      const { data: raced, error: racedError } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle()
      if (raced && !racedError) return raced as Game
    }
    throw new Error(error.message)
  }
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

  const [{ data: profile, error: profileError }, { data: sessions, error: statsSessionsError }] = await Promise.all([
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

  if (profileError) throw new Error(`Failed to load stats: ${profileError.message}`)
  if (statsSessionsError) throw new Error(`Failed to load stats: ${statsSessionsError.message}`)
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
    .select("id, duration_minutes, game_id, started_at, xp_awarded, record_time")
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
      durationMinutes: session.record_time === false ? 0 : session.duration_minutes || 0,
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

  const lastSession = sessions[sessions.length - 1]
  const lastDate = lastSession?.started_at
    ? new Date(lastSession.started_at).toISOString().split("T")[0]
    : null

  const { error: backfillError } = await supabase.rpc("backfill_standby_profile_xp", {
    p_total_xp: totalXP, p_last_session_date: lastDate,
  })
  if (backfillError) throw new Error(backfillError.message)

  // Also update streak
  await updateUserStreak(user.id)
}

export async function getResidents(): Promise<Resident[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  try {
    const { data, error } = await supabase
      .from("residents")
      .select("user_id, game_id, arrived_at, arrival_source")

    if (error) {
      console.warn("[residents] Query failed (table missing?):", error.message)
      return []
    }

    return data || []
  } catch (err) {
    console.warn("[residents] Catch error:", err)
    return []
  }
}
