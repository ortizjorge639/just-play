---
name: canvas-particle-effects
description: "Canvas-based particle burst effects for React apps — golden orbs, confetti, sparkles, and celebration animations. Use when the user asks for particle effects, confetti, sparkles, celebration animations, visual feedback on actions (XP earned, level up, achievement unlocked), loot/reward animations, or any 'burst' or 'explosion' visual effect. Also trigger when adding gamification feedback that needs to feel satisfying — like progress bar completions, streak milestones, or unlocks."
---

# Canvas Particle Effects

Patterns for building performant, zero-dependency canvas particle systems in React. These patterns come from production code in this project — see `components/xp-particles.tsx` for the reference implementation.

## Core Architecture

### The Particle Component Pattern

A particle burst is a React component that:
1. Renders a fixed-position `<canvas>` overlay (full viewport, `pointer-events: none`)
2. Creates N particles on mount with randomized physics
3. Animates via `requestAnimationFrame` until all particles fade
4. Calls `onComplete` to unmount itself (the parent controls visibility)

This is intentionally a "fire and forget" component — mount it, it plays, it cleans up.

### Particle Physics Model

Each particle has: position (`x`, `y`), velocity (`vx`, `vy`), `size`, `alpha`, `decay`, and `color`.

Per frame:
```
x += vx
y += vy
vy += gravity     (0.08 is a good default — subtle pull)
vx *= drag        (0.99 — gradual slowdown)
alpha -= decay    (random per particle for organic staggered fadeout)
```

Particles are "dead" when `alpha <= 0`. When all are dead, fire `onComplete`.

**Upward bias**: Subtract from initial `vy` (e.g., `vy - 2`) so particles burst upward before gravity pulls them down. This creates the satisfying arc that makes it feel like something was released.

### Spawn Randomization

For each particle, pick a random angle (full 360°) and a random velocity magnitude within a range:
```
angle = random() * PI * 2
velocity = (random() * 0.6 + 0.4) * spread
```

The `0.6 + 0.4` range prevents particles from clustering at the center (minimum 40% of max speed) while still having variety.

**Decay variation** is critical for organic feel: `random() * 0.015 + 0.008` means some particles vanish quickly and others linger, avoiding the "everything disappears at once" look.

## Presets and Tuning

### Small accent burst (toast, badge, button)
- `count`: 16–24
- `spread`: 5–6
- `colors`: warm palette matching the UI element
- Use case: XP toast, achievement unlock, small milestones

### Medium celebration (level up, streak milestone)
- `count`: 40–60
- `spread`: 8–10
- `colors`: richer palette, maybe add white sparkle
- Use case: Level up, weekly goal hit, first-time events

### Large celebration (rare achievements)
- `count`: 80–120
- `spread`: 12–15
- `colors`: multi-color confetti palette
- Use case: Huge milestones, completion screens

### Color palettes
- **Gold/XP**: `["#F59E0B", "#FBBF24", "#FCD34D", "#F97316", "#FDE68A"]`
- **Success**: `["#10B981", "#34D399", "#6EE7B7", "#A7F3D0"]`
- **Confetti**: `["#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981"]`
- **Ice/Blue**: `["#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"]`

## Integration Patterns

### Pattern 1: Burst from a UI element

Track the element's position with a ref and `getBoundingClientRect()`:
```tsx
const elRef = useRef<HTMLDivElement>(null)
const [burst, setBurst] = useState<{ x: number; y: number } | null>(null)

const triggerBurst = () => {
  const rect = elRef.current?.getBoundingClientRect()
  if (rect) {
    setBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }
}

// In JSX:
{burst && (
  <XPParticles
    originX={burst.x}
    originY={burst.y}
    count={24}
    onComplete={() => setBurst(null)}
  />
)}
```

### Pattern 2: Burst across page reloads (sessionStorage bridge)

When the app does a full page reload between the trigger event and the animation target (e.g., earning XP on one page, animating the progress bar on another), use `sessionStorage` to bridge the state:

1. **Before reload**: Stash the "old" state and the delta
```tsx
sessionStorage.setItem("pendingReward", JSON.stringify({
  amount: 50,
  previousValue: currentXP,
  timestamp: Date.now(),
}))
```

2. **On mount of target page**: Read, validate (expire after ~10s), animate from old → new, fire particles at the end
```tsx
useEffect(() => {
  const raw = sessionStorage.getItem("pendingReward")
  if (!raw) return
  const data = JSON.parse(raw)
  if (Date.now() - data.timestamp > 10000) return // expired
  sessionStorage.removeItem("pendingReward")
  // animate from data.previousValue → currentValue
  // fire particles when animation completes
}, [])
```

### Pattern 3: Tiered intensity based on magnitude

Adjust particle count and spread based on how significant the event is:
```tsx
const isLevelUp = xpEarned >= xpToNextLevel
const count = isLevelUp ? 60 : 28
const spread = isLevelUp ? 10 : 7
const duration = isLevelUp ? 3000 : 2000
```

### Pattern 4: Animated count-up with particle finale

Pair a number count-up animation with a particle burst at the end for "treasure chest" feel:

```tsx
function useCountUp(target: number, from: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(enabled ? from : target)
  useEffect(() => {
    if (!enabled || from === target) { setValue(target); return }
    const start = performance.now()
    const diff = target - from
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(Math.round(from + diff * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    setTimeout(() => requestAnimationFrame(tick), 400) // delay for page settle
    return () => { /* cleanup raf */ }
  }, [target, from, duration, enabled])
  return value
}
```

Fire particles after the count-up finishes (duration + delay + buffer):
```tsx
setTimeout(() => setShowParticles(true), 1800)
```

## Performance Notes

- Canvas particles are very cheap — hundreds of circles at 60fps is trivial for modern GPUs
- The `pointer-events: none` + `fixed inset-0` overlay means zero layout impact
- Always clean up with `cancelAnimationFrame` in the useEffect return
- Use the `alive` flag pattern to prevent animation after unmount:
  ```tsx
  let alive = true
  const animate = () => { if (!alive) return; /* ... */ }
  return () => { alive = false; cancelAnimationFrame(animFrame) }
  ```
- Don't resize canvas on window resize for burst effects — they're too short-lived to matter

## Anti-patterns

- **Don't use DOM elements for particles** — dozens of animated divs cause layout thrashing. Canvas is the right tool.
- **Don't use external particle libraries** for simple bursts — they add bundle weight for features you won't use. The core implementation is ~100 lines.
- **Don't fire particles on every micro-interaction** — reserve them for moments that matter. If everything sparkles, nothing feels special. The "felt, not seen" principle: particles should reinforce meaningful progress, not decorate routine actions.
- **Don't block user interaction** — always use `pointer-events: none` on the canvas overlay.
