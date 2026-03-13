// Streak engine — pure functions, no DB calls
// Dual display: weekly activity ratio + consecutive day streak

export interface StreakInfo {
  /** Current consecutive days with a session */
  consecutive: number
  /** Best consecutive streak ever */
  bestStreak: number
  /** Days active in the current Mon-Sun week (0-7) */
  weeklyRatio: number
  /** Which days of the current week had activity (Mon=0 ... Sun=6) */
  weeklyDays: boolean[]
}

/**
 * Calculate streak info from an array of session start dates.
 * Dates should be ISO strings or Date objects.
 * "today" param allows testing with a fixed date.
 */
export function calculateStreak(
  sessionDates: (string | Date)[],
  today: Date = new Date()
): StreakInfo {
  if (sessionDates.length === 0) {
    return { consecutive: 0, bestStreak: 0, weeklyRatio: 0, weeklyDays: Array(7).fill(false) }
  }

  // Normalize to unique calendar dates (YYYY-MM-DD) in user's local time
  const uniqueDays = new Set<string>()
  for (const d of sessionDates) {
    const date = typeof d === "string" ? new Date(d) : d
    uniqueDays.add(toDateKey(date))
  }

  const sortedDays = [...uniqueDays].sort().reverse() // newest first

  // --- Consecutive streak ---
  const todayKey = toDateKey(today)
  const yesterdayKey = toDateKey(addDays(today, -1))

  let consecutive = 0

  // Streak counts if user played today OR yesterday (grace for "haven't played yet today")
  if (sortedDays.includes(todayKey)) {
    consecutive = countConsecutiveBackward(sortedDays, todayKey)
  } else if (sortedDays.includes(yesterdayKey)) {
    consecutive = countConsecutiveBackward(sortedDays, yesterdayKey)
  }

  // --- Best streak ever ---
  const ascDays = [...sortedDays].reverse() // oldest first
  let bestStreak = 0
  let currentRun = 1
  for (let i = 1; i < ascDays.length; i++) {
    const prev = new Date(ascDays[i - 1])
    const curr = new Date(ascDays[i])
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diffDays === 1) {
      currentRun++
    } else {
      bestStreak = Math.max(bestStreak, currentRun)
      currentRun = 1
    }
  }
  bestStreak = Math.max(bestStreak, currentRun, consecutive)

  // --- Weekly ratio (Mon-Sun) ---
  const weekStart = getMonday(today)
  const weeklyDays: boolean[] = Array(7).fill(false)
  for (let i = 0; i < 7; i++) {
    const dayKey = toDateKey(addDays(weekStart, i))
    weeklyDays[i] = uniqueDays.has(dayKey)
  }
  const weeklyRatio = weeklyDays.filter(Boolean).length

  return { consecutive, bestStreak, weeklyRatio, weeklyDays }
}

// --- Helpers ---

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // getDay(): 0=Sun, 1=Mon... shift so Mon=0
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function countConsecutiveBackward(
  sortedDaysDesc: string[],
  startKey: string
): number {
  let count = 1
  let current = new Date(startKey)

  while (true) {
    current = addDays(current, -1)
    const key = toDateKey(current)
    if (sortedDaysDesc.includes(key)) {
      count++
    } else {
      break
    }
  }
  return count
}
