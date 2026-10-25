export interface Game {
  id: string
  name: string
  genres: string[]
  estimated_session_length: number
  time_to_beat_minutes?: number
  header_image: string
  description: string
  featured: boolean
  source: "steam" | "test" | "igdb"
  created_at: string
}

export type SessionStatus = "LockedIn" | "Playing" | "Paused" | "Finished"

export interface StandbyPreferences {
  record_time: boolean
  show_clock: boolean
  reminders: boolean
  keep_awake: boolean
}

export const DEFAULT_STANDBY_PREFERENCES: StandbyPreferences = {
  record_time: true,
  show_clock: true,
  reminders: false,
  keep_awake: false,
}

export interface SessionTimingSnapshot {
  status: SessionStatus
  started_at: string
  paused_elapsed_seconds: number
}

export interface SessionMutationSnapshot extends SessionTimingSnapshot {
  id: string
}

export type SessionEndSnapshot = SessionMutationSnapshot

export interface SessionFinishOptions {
  notes: string
}

export interface Session {
  id: string
  user_id: string
  game_id: string
  started_at: string
  ended_at: string | null
  duration_minutes: number
  paused_elapsed_seconds: number
  record_time: boolean
  status: SessionStatus
  active: boolean
  notes: string | null
  session_goal: string | null
  xp_awarded: number
  created_at: string
  games?: Game
}

// Track overall game progress across multiple sessions
export interface GameProgress {
  id: string
  user_id: string
  game_id: string
  status: "playing" | "beaten" | "abandoned"
  total_sessions: number
  total_time_minutes: number
  started_at: string
  completed_at: string | null
  created_at: string
  game?: Game
}

export interface UserProfile {
  id: string
  display_name: string | null
  steam_id: string | null
  preferences: UserPreferences
  standby_preferences: StandbyPreferences
  onboarding_complete: boolean
  tutorial_complete: boolean
  streak_enabled: boolean
  total_xp: number
  level: number
  streak_count: number
  best_streak: number
  last_session_date: string | null
  created_at: string
}

export interface PlayerStats {
  totalXP: number
  level: number
  xpInCurrentLevel: number
  xpToNextLevel: number
  progress: number
  streak: number
  bestStreak: number
  weeklyRatio: number
  weeklyDays: boolean[]
  totalSessions: number
}

export interface UserPreferences {
  mood?: string
  time_available?: number
  energy?: string
  genre_preferences?: string[]
  discovery?: string
}

export interface Resident {
  user_id: string
  game_id: string
  arrived_at: string
  arrival_source: string
  game?: Game
  last_emote?: { emote: string; emoted_at: string } | null
  minutes_played?: number
}

export type { SavedSpot } from "@/lib/settlement/types"

export interface SettlementPiece {
  game_id: string
  piece: string
  deck: number
  anchor: number
}

export interface Postcard {
  user_id: string
  game_id: string
  created_at: string
  game?: Game
}

export type StampRule =
  | { kind: "hours"; target_minutes: number; label: null; game_id: string | null }
  | { kind: "milestone"; target_minutes: null; label: string; game_id: string | null }

export type StampRuleInput =
  | { kind: "hours"; targetMinutes: number }
  | { kind: "milestone"; label: string }
  | null

export interface NameCard {
  tagline: string | null
  play_style: string | null
  favorite_game_ids: string[]
}

export interface NameCardInput {
  displayName: string
  tagline: string
  playStyle: string
  favoriteGameIds: string[]
}
