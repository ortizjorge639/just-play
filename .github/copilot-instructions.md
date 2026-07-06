# Just Play — Copilot Instructions

> Rewritten 2026-07-06 for the v2 architecture, which now lives on both `main` and `v2`.
> **Read `AGENTS.md` at the repo root first** — it is the source of truth for branch
> state, the merge gate (no merges into `main` without Jorge's explicit approval),
> and the status-check workflow. This file only summarizes the codebase.

## What this app does

"Just Play" is Jorge's game backlog / completion tracker. Users add games (IGDB
search), track what they're playing, mark games beaten, and every finished game
becomes a buddy living in a 3D treehouse world on the Completed screen.

## Commands

```bash
pnpm dev          # Start dev server (Next.js 16)
pnpm build        # Production build (TS errors are ignored via next.config.mjs)
pnpm lint         # ESLint (flat config, core-web-vitals + React 19 rules)
```

There is no test suite (as of 2026-07-06). Verify changes by running the app.

## Tech stack

- **Next.js 16** (App Router, React 19) · **TypeScript** · **pnpm**
- **Supabase** — auth (email/password + a pre-confirmed test account behind the
  login page's "Quick Play (Test Mode)" button) and Postgres (`games`,
  `game_progress`, `sessions`, `users` tables, RLS-enforced)
- **Tailwind CSS v4** + **shadcn/ui** (`components/ui/`) + **Framer Motion**
- **IGDB** via `lib/igdb.ts` (Twitch OAuth) behind `app/api/search-games`
- **Three.js r128** (vanilla, CDN-loaded) for the treehouse scene — no React
  Three Fiber, no npm `three` package. See the retrospective in `AGENTS.md`.

## Architecture — 6-screen routed app

Unlike v1 (single-page card-deck SPA — that architecture is gone), v2 is routed:

- `app/(v2)/page.tsx` — home: current game, session start, XP/streaks
- `app/(v2)/add/` + `add/confirm/` — IGDB search and add flow
- `app/(v2)/backlog/`, `app/(v2)/in-progress/`, `app/(v2)/avatars/`
- `app/(v2)/completed/` — server component (`page.tsx`) fetches real
  `game_progress` rows via `lib/treehouse.ts`, renders `completed-client.tsx`
  + the 3D scene in `components/treehouse-world.tsx`
- `app/(v2)/layout.tsx` wires `BottomNav`; `middleware.ts` redirects all routes
  except `/auth/*` and `/welcome` to login without a valid Supabase session

Server state lives in Server Actions (`app/actions.ts` — `addSearchedGame`,
`markGameBeaten`, session/XP logic) and `app/auth/actions.ts` (login/signup/
Quick Play). Supabase client factories: `lib/supabase/server.ts` (RSC/actions),
`client.ts` (browser), `proxy.ts` (middleware) — always create per request.

## Versioning

The tab title is `Just Play v<major.minor>.<buildPatch>`. `major.minor` comes
from `package.json`; the patch is the UTC build timestamp (`yymmddHHMM`)
computed in `next.config.mjs` at build time, so every deploy shows a new patch
number. Check the deployed title to confirm a deploy landed.

## Known sharp edges (verified 2026-07-06, see AGENTS.md for detail)

- `app/api/search-games` 401s without a Supabase session — expected, not a bug.
- The add-flow confirm page's "Add to Backlog" / "Just Play" buttons have **no
  onClick handlers yet** — the UI is unwired; the server actions exist and work.
- The Completed screen's status ticker (`completed-client.tsx` ~line 276) is
  hardcoded POC text, not real data.
- The three.js CDN scripts must load in order — they're injected sequentially
  (`async=false`) in `treehouse-world.tsx`. Don't convert them back to async
  `<Script>` tags; that reintroduces a black-screen race.
- `middleware.ts` uses the deprecated `middleware` convention (Next wants
  `proxy`) — warning only, works today.
- No `.env` committed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  and IGDB creds come from the deploy environment or `.env.local`.
