const KEY = "jp-settlement-sound"

export const soundOn = () => {
  try { return localStorage.getItem(KEY) !== "off" } catch { return true }
}

const listeners = new Set<() => void>()
export const subscribeSound = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export const setSoundOn = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "on" : "off") } catch { /* private mode: stays on for this visit */ }
  listeners.forEach((fn) => fn())
}

let ctx: AudioContext | null = null

// A soft wooden thump with a short warm note on top. Made in code, so there is nothing to load.
export function playLand() {
  if (!soundOn() || typeof AudioContext === "undefined") return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === "suspended") void ctx.resume()
    const now = ctx.currentTime
    const tone = (freq: number, from: number, length: number, peak: number, type: OscillatorType) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now + from)
      if (type === "sine" && freq < 200) osc.frequency.exponentialRampToValueAtTime(60, now + from + length)
      gain.gain.setValueAtTime(0.0001, now + from)
      gain.gain.exponentialRampToValueAtTime(peak, now + from + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + from + length)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(now + from)
      osc.stop(now + from + length + 0.02)
    }
    tone(140, 0, 0.18, 0.25, "sine")
    tone(660, 0.05, 0.35, 0.06, "triangle")
  } catch { /* sound is a bonus, never a blocker */ }
}
