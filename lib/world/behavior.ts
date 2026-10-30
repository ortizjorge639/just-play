export type AmbientActivity = "rest" | "look" | "greeting" | "stroll"
export interface AmbientPose { activity: AmbientActivity; distance: number; facing: number }

// Visible simulation seconds only: no dates, saved state, rewards or missed-day logic.
export function ambientBehavior(gameId: string, visibleSeconds: number, depth: number): AmbientPose {
  let seed = 0
  for (const char of gameId) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0
  const time = Number.isFinite(visibleSeconds) && visibleSeconds > 0 ? visibleSeconds : 0
  const tier = Number.isFinite(depth) ? Math.min(3, Math.max(0, Math.floor(depth))) : 0
  const phase = ((time % 96) + seed % 96) % 96
  if (tier >= 2 && phase >= 40 && phase < 56) {
    const progress = (phase - 40) / 16
    return { activity: "stroll", distance: Math.sin(Math.PI * progress) * 0.9, facing: progress < 0.5 ? 1 : -1 }
  }
  if (tier >= 1 && phase >= 72 && phase < 76) return { activity: "greeting", distance: 0, facing: 1 }
  if (phase >= 16 && phase < 22 || tier >= 3 && phase >= 86 && phase < 90) return { activity: "look", distance: 0, facing: 1 }
  return { activity: "rest", distance: 0, facing: 1 }
}
