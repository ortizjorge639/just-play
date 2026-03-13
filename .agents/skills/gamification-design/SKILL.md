---
name: gamification-design
description: Gamification UX design principles for apps that reward progress without overwhelming the user. Use when building XP systems, progress bars, streak trackers, level-up animations, achievement toasts, or any "felt, not seen" reward mechanics. Triggers on tasks involving gamification, XP, leveling, streaks, progress tracking, achievement systems, or reward feedback loops. Inspired by Duolingo, Nintendo, and AFK RPG design patterns.
metadata:
  author: just-play
  version: "1.0.0"
---

# Gamification Design Skill

Design principles and implementation patterns for gamification UX — learned from building the Just Play game tracking app. The core philosophy: **gamification should be felt, not seen.** Rewards amplify the user's real goal (beating games, clearing a backlog) — they never compete with it.

## Core Philosophy

### "Felt, Not Seen" Gamification
- XP, levels, and streaks exist to make progress *feel* tangible — not to become the product
- The user's real goal is always the priority (e.g., playing a game, finishing a workout, learning a language)
- If a gamification element distracts from the core action, it's wrong — remove it or make it subtler
- Numbers should never clutter the primary interface; save detailed stats for a dedicated progress screen

### The AFK RPG Analogy
- Games (or tasks) should feel like they "grow" as the user engages with them — like an AFK RPG character gaining XP passively
- Show micro-progress on items themselves (thin progress bars on cards, subtle level indicators)
- The item-level progress reinforces that *every session counts*, even short ones

### Reward on Meaningful Milestones Only
- XP fires on *meaningful* actions: starting something new, finishing something, hitting a streak
- XP does NOT fire on every micro-interaction (pause, resume, navigate) — that cheapens the reward
- Resume/continue actions get *subtle visual feedback* (shimmer, glow) instead of XP toasts

## Visual Design Principles

### Follow Duolingo & Nintendo Patterns
These apps nail gamification UX. Steal their patterns:

1. **Centered, bold layouts** — progress screens are centered with generous whitespace, not cramped sidebars
2. **Chunky progress bars** — minimum `h-4` (16px) height, rounded-full, with visible fill even at low progress (3-4% minimum width)
3. **Warm color palette** — gold/amber for XP and rewards (`amber-500`, `amber-400`), NOT cool blues or grays. Gold = reward psychology
4. **Big level badges** — level number is a hero element (80px+), with a small "level" pill below it. Centered, not inline
5. **Streak cards** — fire emoji 🔥 for active streaks, calendar emoji 📅 for broken ones. Weekly dots for visual rhythm, spaced with `gap-3`
6. **Toast celebrations** — XP toasts appear on milestone events with confetti-style energy, not on routine actions

### Animation Philosophy
- **Micro-animations for emotional feedback** — subtle effects that make the app feel alive
- **Resume shimmer** — when a user comes back to something paused, a light gradient sweeps across the item art (0.08 opacity, 0.9s). "The game wakes up with you."
- **Progress bar fills** — CSS `transition-all duration-700 ease-out` for smooth fills. Avoid Framer Motion `initial/animate` for progress bars in SPAs (see Technical Gotchas)
- **Never distract from the core action** — if the user is about to go do the thing (play a game, start a workout), the animation should be satisfying but brief

### Color Rules
| Element | Color | Why |
|---------|-------|-----|
| XP bar fill | `amber-500` | Warm gold = reward |
| XP bar track | `white/10` or `bg-secondary` | Subtle contrast |
| Level badge number | `amber-400` | Warm, readable |
| Level pill | `bg-amber-500 text-white` | Bold, confident |
| Streak active | 🔥 emoji + warm text | Universal "fire" signal |
| XP toast | `bg-amber-500/90` | Matches XP color family |

### Layout Rules for Progress Screens
1. **Center everything** — `flex flex-col items-center` on the container
2. **Level badge on top** — hero element, above the XP bar
3. **XP bar below badge** — full width of container, chunky
4. **XP fraction below bar** — `76 / 200 XP` format, muted color, `text-sm font-semibold`
5. **Streak card** — glass-card style, centered content, weekly dots as visual rhythm
6. **Stats grid** — 3-column grid for KPIs, centered values with `items-center justify-center`
7. **History list** — compact cards with game art, duration, +XP badge

## Technical Implementation Patterns

### XP Level Curve
Use a linear scaling curve that feels achievable but rewarding:
```
Level N → N+1 costs: 100 + (N-2) × 50 XP
L1→L2: 100 XP  |  L2→L3: 150 XP  |  L3→L4: 200 XP  |  L4→L5: 250 XP
```
This gives ~15% more effort per level — enough to feel progression without being punishing.

### Progress Bar Implementation (Critical)
**DO NOT use Framer Motion `initial/animate` for progress bars in SPA tab-switching UIs.**

Framer Motion's `initial={{ width: 0 }}` + `animate={{ width: "X%" }}` won't re-trigger when a component stays mounted but receives new props (e.g., tab switching in an SPA). The animation fires once on mount and then the bar stays at its last animated value.

**DO use CSS transitions with inline styles:**
```tsx
<div className="relative h-4 w-full rounded-full bg-white/10 overflow-hidden">
  <div
    className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-all duration-700 ease-out"
    style={{ width: `${Math.max((current / total) * 100, 3)}%` }}
  />
</div>
```

Key details:
- `Math.max(..., 3)` ensures the bar is always slightly visible (prevents "empty" look at very low XP)
- Compute width directly from raw values (`current / total`), not from a pre-computed `progress` field
- Use explicit colors (`amber-500`), not theme variables (`chart-1`) — theme variables can fail to resolve and render as invisible/gray

### Avoid Theme Variable Colors for Gamification Elements
Theme CSS variables (e.g., `bg-chart-1` in Tailwind v4) can fail to render:
- `.dark` class may not be applied
- Variable resolution chain can break (`--chart-1` → `--color-chart-1` → `bg-chart-1`)
- Result: the bar renders as transparent or gray

**Always use explicit Tailwind colors for critical gamification UI** — `amber-500`, `emerald-500`, `violet-500` etc. These compile to real hex values and always work.

### XP Award Points
Calibrate XP rewards to feel proportional to effort:
| Action | XP | Rationale |
|--------|------|-----------|
| Start new game/task | 25 | Encourages beginning |
| Complete/beat game | 50 | Big milestone reward |
| First session ever | 10 | Onboarding bonus |
| Daily streak day | Implicit via sessions | Consistency reward |

### Resume vs. Start Feedback
| Action | Feedback | Why |
|--------|----------|-----|
| Start new | XP toast + celebration | Meaningful milestone |
| Resume/unpause | Subtle shimmer on artwork | "Welcome back" without distraction |
| Finish | XP toast + bigger celebration | The big payoff |
| Pause | None | Don't reward stopping |

### Shimmer Animation Pattern
For "welcome back" feedback on resume actions:
```tsx
const [shimmer, setShimmer] = useState(false);

// Trigger on resume
setShimmer(true);
setTimeout(() => setShimmer(false), 1200);

// Overlay on cover art
<AnimatePresence>
  {shimmer && (
    <motion.div
      className="absolute inset-0 z-10 overflow-hidden rounded-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-y-0 w-1/3"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        }}
        initial={{ left: "-33%" }}
        animate={{ left: "133%" }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
      />
    </motion.div>
  )}
</AnimatePresence>
```

## Anti-Patterns

### ❌ Numbers Everywhere
Don't show XP, level, streak count, session count all in the header at once. It becomes "a lot of numbers to juggle and takes away from smooth tracking."

**Fix:** Show only level badge in the header. Save detailed stats for the progress screen.

### ❌ Cold Colors for Rewards
Blue or gray progress bars feel clinical, not rewarding. Gamification is emotional design.

**Fix:** Use warm gold/amber. If your theme variable renders gray, switch to explicit colors immediately.

### ❌ Rewarding Everything
If every action gives XP, nothing feels special. Pause → XP? Resume → XP? Navigate → XP? This cheapens the entire system.

**Fix:** XP on meaningful milestones only. Use micro-animations (shimmer, glow) for everything else.

### ❌ Thin Progress Bars
A 2px progress bar is invisible at low percentages and doesn't feel satisfying to fill.

**Fix:** Minimum `h-4` (16px). Chunky is Duolingo. Chunky feels rewarding.

### ❌ Framer Motion for Static Progress
Using `initial/animate` for progress bars that should reflect current data (not animate once on mount).

**Fix:** CSS transitions with inline styles. They always reflect the current prop value.

## Future Patterns (Planned)

### Quest System
- **Main storyline quests**: Beat your backlog — the core loop
- **Side quests**: Build a genre collection, explore a trilogy, play something outside your comfort zone
- **Achievement quests**: "Seasoned Gamer" — complete N games across N genres
- Quests are optional — beating your current game is always the micro-step priority
- The bigger picture: beat your backlog → make room for new stories

### Streak Freeze / Gentle Recovery
- Missing a day shouldn't punish — offer "streak freeze" items or gentle recovery mechanics
- Duolingo-style: "Welcome back! Your streak is safe" messaging

## Checklist for Gamification PRs

When reviewing or building gamification features, verify:

- [ ] Does this serve the user's real goal, or just add numbers?
- [ ] Is the feedback proportional to the action's importance?
- [ ] Are warm colors (gold/amber) used for reward elements?
- [ ] Are progress bars chunky (≥16px) and always slightly filled?
- [ ] Is the layout centered with generous whitespace on progress screens?
- [ ] Are explicit colors used (not theme variables) for critical gamification UI?
- [ ] Does the animation feel satisfying but brief (under 1.5s)?
- [ ] Is XP only awarded on meaningful milestones?
- [ ] Does the header stay clean (no number overload)?
