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

export interface Session {
  id: string
  user_id: string
  game_id: string
  started_at: string
  ended_at: string | null
  duration_minutes: number
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
