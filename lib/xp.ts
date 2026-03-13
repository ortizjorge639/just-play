// XP engine — pure functions, no DB calls
// The core math behind the AFK RPG progression system

export interface XPBreakdown {
  base: number
  durationBonus: number
  longSessionBonus: number
  newGameBonus: number
  beatGameBonus: number
  comebackBonus: number
  total: number
  bonuses: string[]
}

export interface LevelInfo {
  level: number
  xpInCurrentLevel: number
  xpToNextLevel: number
  progress: number // 0-1 percentage
}

// --- XP Calculation ---

const BASE_XP = 10
const XP_PER_5_MIN = 1
const LONG_SESSION_THRESHOLD = 60 // minutes
const LONG_SESSION_BONUS = 10
const NEW_GAME_BONUS = 15
const BEAT_GAME_BONUS = 50
const COMEBACK_BONUS = 10
const COMEBACK_THRESHOLD_DAYS = 3

export function calculateSessionXP(opts: {
  durationMinutes: number
  isNewGame: boolean
  isGameBeaten: boolean
  isComeback: boolean
}): XPBreakdown {
  const bonuses: string[] = []

  const base = BASE_XP
  const durationBonus = Math.floor(opts.durationMinutes / 5) * XP_PER_5_MIN

  let longSessionBonus = 0
  if (opts.durationMinutes >= LONG_SESSION_THRESHOLD) {
    longSessionBonus = LONG_SESSION_BONUS
    bonuses.push(`⏱️ Long session +${LONG_SESSION_BONUS}`)
  }

  let newGameBonus = 0
  if (opts.isNewGame) {
    newGameBonus = NEW_GAME_BONUS
    bonuses.push(`🆕 New game +${NEW_GAME_BONUS}`)
  }

  let beatGameBonus = 0
  if (opts.isGameBeaten) {
    beatGameBonus = BEAT_GAME_BONUS
    bonuses.push(`🏆 Beat it! +${BEAT_GAME_BONUS}`)
  }

  let comebackBonus = 0
  if (opts.isComeback) {
    comebackBonus = COMEBACK_BONUS
    bonuses.push(`🔙 Comeback +${COMEBACK_BONUS}`)
  }

  const total =
    base + durationBonus + longSessionBonus + newGameBonus + beatGameBonus + comebackBonus

  return {
    base,
    durationBonus,
    longSessionBonus,
    newGameBonus,
    beatGameBonus,
    comebackBonus,
    total,
    bonuses,
  }
}

// --- Level Curve ---
// Level N → N+1 costs: 100 + (N-1) × 50
// L1→L2: 100, L2→L3: 150, L3→L4: 200, L4→L5: 250...

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  return 100 + (level - 2) * 50
}

/** Cumulative XP needed to reach a given level */
export function cumulativeXPForLevel(level: number): number {
  let total = 0
  for (let i = 2; i <= level; i++) {
    total += xpRequiredForLevel(i)
  }
  return total
}

/** Given total XP, determine level + progress toward next */
export function levelFromXP(totalXP: number): LevelInfo {
  let level = 1
  let xpRemaining = totalXP

  while (true) {
    const needed = xpRequiredForLevel(level + 1)
    if (xpRemaining < needed) {
      return {
        level,
        xpInCurrentLevel: xpRemaining,
        xpToNextLevel: needed,
        progress: needed > 0 ? xpRemaining / needed : 0,
      }
    }
    xpRemaining -= needed
    level++
  }
}

/** Check if a user qualifies for a comeback bonus */
export function isComeback(
  lastSessionDate: string | null,
  now: Date = new Date()
): boolean {
  if (!lastSessionDate) return false
  const last = new Date(lastSessionDate)
  const diffMs = now.getTime() - last.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= COMEBACK_THRESHOLD_DAYS
}
