// How deeply a game has been played, read from minutes already tracked per game.
// Thresholds are frozen once shipped. Tiers may only be appended, never changed, or every
// existing home would move.
export interface Tier {
  tier: number
  name: string
  minutes: number
}

export const TIERS: readonly Tier[] = [
  { tier: 1, name: "Settled", minutes: 120 },
  { tier: 2, name: "At home", minutes: 600 },
  { tier: 3, name: "Elder", minutes: 3000 },
]

// Tier 0 is a resident with no extra depth. Missing or bad minutes count as 0.
export function tierFor(minutes: number | null | undefined): number {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return 0
  let reached = 0
  for (const t of TIERS) if (minutes >= t.minutes) reached = t.tier
  return reached
}

export function tierName(tier: number): string | null {
  return TIERS.find((t) => t.tier === tier)?.name ?? null
}
