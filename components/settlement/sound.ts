const KEY = "jp-settlement-sound"
let visitSound = false
let storageWriteFailed = false

export const soundOn = () => {
  if (storageWriteFailed) return visitSound
  try { return localStorage.getItem(KEY) === "on" } catch { return visitSound }
}

const listeners = new Set<() => void>()
export const subscribeSound = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export const setSoundOn = (on: boolean) => {
  visitSound = on
  try {
    localStorage.setItem(KEY, on ? "on" : "off")
    storageWriteFailed = false
  } catch { storageWriteFailed = true } // The explicit choice wins over stale storage for this visit.
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

// A quiet bed for the settlement: low wind and the odd small bird. Follows the sound toggle live.
export function startAmbient(): () => void {
  if (typeof AudioContext === "undefined") return () => {}
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let master: GainNode | null = null
  let source: AudioBufferSourceNode | null = null
  try {
    ctx ??= new AudioContext()
    const audio = ctx
    if (audio.state === "suspended") void audio.resume()
    master = audio.createGain()
    master.gain.value = soundOn() ? 1 : 0
    master.connect(audio.destination)

    const length = audio.sampleRate * 2
    const buffer = audio.createBuffer(1, length, audio.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5 }
    source = audio.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = audio.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 420
    const wind = audio.createGain()
    wind.gain.value = 0.05
    const sway = audio.createOscillator()
    const swayDepth = audio.createGain()
    sway.frequency.value = 0.12
    swayDepth.gain.value = 0.025
    sway.connect(swayDepth).connect(wind.gain)
    source.connect(filter).connect(wind).connect(master)
    source.start()
    sway.start()

    const chirp = () => {
      if (stopped) return
      if (soundOn()) {
        const now = audio.currentTime
        const base = 2200 + Math.random() * 900
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
          const osc = audio.createOscillator()
          const gain = audio.createGain()
          const at = now + i * 0.16
          osc.type = "sine"
          osc.frequency.setValueAtTime(base, at)
          osc.frequency.exponentialRampToValueAtTime(base * 1.35, at + 0.09)
          gain.gain.setValueAtTime(0.0001, at)
          gain.gain.exponentialRampToValueAtTime(0.018, at + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
          osc.connect(gain).connect(master!)
          osc.start(at)
          osc.stop(at + 0.13)
        }
      }
      timer = setTimeout(chirp, 5000 + Math.random() * 7000)
    }
    timer = setTimeout(chirp, 2500)
    const unsubscribe = subscribeSound(() => { if (master) master.gain.setTargetAtTime(soundOn() ? 1 : 0, audio.currentTime, 0.15) })
    return () => {
      stopped = true
      clearTimeout(timer)
      unsubscribe()
      try { source?.stop(); sway.stop(); master?.disconnect() } catch { /* already stopped */ }
    }
  } catch {
    return () => { stopped = true; clearTimeout(timer) }
  }
}
