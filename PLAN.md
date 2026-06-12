# Just Play v2 — Build Plan

## Stack
Next.js 16 · React 19 · TypeScript · Supabase · shadcn/ui · Tailwind v4 · Framer Motion

## Palette
- Primary: #6B4FBB
- Secondary: #FF7B54  
- Accent: #4ECDC4
- Background: #FAF8FF
- Fonts: Space Grotesk (headings) · Nunito (body)

## Screens (6)
| Route | Screen |
|-------|--------|
| `/` | Home — counts, now playing strip, add game CTA |
| `/add` | Add Game Search — IGDB search, card/list toggle |
| `/add/confirm` | Add Game Confirm — game card + avatar peek + CTAs |
| `/backlog` | Backlog — cover grid, in-progress bar |
| `/in-progress` | In Progress — full + side view |
| `/completed` | Completed — treehouse gallery |

## Data Model
```
UserGame {
  id, userId, gameId,
  status: 'backlog' | 'in_progress' | 'completed'
  playState: 'playing' | 'paused'
  addedAt, startedAt, completedAt
  goals[], completionReaction?
}
```

## Deferred (post-MVP)
- 3D treehouse renderer
- Tamagotchi AI chat
- Friend system
- Booster packs
- VGDB live ratings
