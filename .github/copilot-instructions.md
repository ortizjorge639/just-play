# Just Play — Copilot Instructions

## What this app does

"Just Play" helps gamers stop scrolling their library and start playing. It recommends 1–3 games based on mood, energy, and available time using a swipeable card deck UI. Users lock in a game, track play sessions with a state machine, and build a session history.

## Commands

```bash
pnpm dev          # Start dev server (Next.js 16)
pnpm build        # Production build (TS errors are ignored via next.config.mjs)
pnpm lint         # ESLint (flat config, core-web-vitals + React 19 rules)
```

## Tech stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Supabase** for auth (email/password + anonymous) and Postgres database
- **Tailwind CSS v4** with `@tailwindcss/postcss` (no `tailwind.config` file — config is in `globals.css`)
- **shadcn/ui** (new-york style, RSC-enabled) — components in `components/ui/`
- **Framer Motion** for animations (card swiping, page transitions)
- **ESLint 9** with `eslint-config-next/core-web-vitals` flat config — enforces React 19 rules (no setState in effects, no refs during render, no impure functions in render)
- **pnpm** as package manager

## Architecture

### Data flow

The root page (`app/page.tsx`) is a **Server Component** that authenticates, fetches all initial data via `Promise.all`, and passes it as props to `AppShell` — the single client component that manages all UI state. There are no nested routes; the entire app is a single-page SPA within the App Router shell.

### Supabase client pattern

Three Supabase client factories in `lib/supabase/` — always create a fresh client per request (required for Next.js Fluid compute):

- `server.ts` → Server Components and Server Actions (uses `cookies()`)
- `client.ts` → Client Components (browser-side)
- `proxy.ts` → Middleware session refresh (used in `middleware.ts`)

### Server Actions

All data mutations go through Server Actions, not API routes:

- `app/actions.ts` — Core game logic: recommendations, sessions, game progress
- `app/auth/actions.ts` — Auth flows: login, signup, signout, admin bypass

Every action calls `revalidatePath("/")` after mutations. Every action creates its own Supabase client and verifies `auth.getUser()` before proceeding.

### Session state machine

```
LockedIn → Playing → Paused → Finished
                  ↘           ↗
                    Finished
```

Pause/resume tracks elapsed time via `paused_elapsed_seconds`. The `active` boolean column plus a unique partial index enforces one active session per user at the database level.

### Game progress lifecycle

Games have a separate progress tracker (independent from sessions): `playing` → `beaten` or `abandoned`. A game can be resumed after abandonment.

## Key conventions

### Styling

- **Dark-only theme** — Discord-inspired palette defined as CSS custom properties in `globals.css`. No light mode.
- Use the `cn()` helper from `lib/utils.ts` to merge Tailwind classes.
- Custom `.glass-card` utility class for frosted glass effects.
- The `@/*` path alias maps to the project root.

### Components

- Feature components live in `components/` (e.g., `app-shell.tsx`, `card-deck.tsx`, `game-card.tsx`).
- shadcn/ui primitives live in `components/ui/` — add new ones via `npx shadcn@latest add <component>`.
- Client components use `"use client"` directive. Keep Server Components as the default.

### Database

- SQL migrations are in `scripts/`, numbered sequentially (`001_create_tables.sql`, `002_rls_policies.sql`, etc.).
- All tables have RLS enabled. Users can only access their own rows; games are read-only for authenticated users.
- The `users` table extends `auth.users` via foreign key on `id`.
- Types for all database entities are in `lib/types.ts`.

### Auth

- Middleware redirects unauthenticated users to `/auth/login` (except `/auth/*` routes).
- Email confirmation redirects go through `/auth/callback` (PKCE code exchange).
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
