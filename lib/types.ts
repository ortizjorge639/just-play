export interface Game {
  id: string
  name: string
  genres: string[]
  estimated_session_length: number
  header_image: string
  description: string
  source: "steam" | "test"
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
  created_at: string
}

export interface UserPreferences {
  mood?: string
  time_available?: number
  energy?: string
  genre_preferences?: string[]
  play_style?: string
}

export type OnboardingStep = "mood" | "time" | "energy" | "genres" | "style"
