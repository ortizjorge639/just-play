# Home view: proposal and task plan

**Status:** proposal only. Nothing here is built, and nothing proceeds until the
owner answers the decisions below. It follows [residents-proposal.md](residents-proposal.md)
(shipped), [stamps-proposal.md](stamps-proposal.md),
[name-card-proposal.md](name-card-proposal.md) and
[emotes-proposal.md](emotes-proposal.md).

**A gap to flag first:** no story in [spec-stories-3-6.md](spec-stories-3-6.md)
defines a "home view". The phrase appears only in
[v1-readiness.md](v1-readiness.md), listed with stories 3 to 6. This document
proposes a definition so it can be agreed or changed before anything is built.

## The idea in one paragraph

The app promises a personal gaming home, but today the home is a few rows on
the Progress tab, under a greeting, a level badge and a stats grid. The
residents are there, but you cannot tell the place is yours. A Home view gives
them a room: one calm screen that shows whose home it is, who lives there, who
is on the way, and what keepsakes are on the shelf. It is the 2D stand-in for
the settlement until approved art and the 3D scene exist. It is read-only, has
no meters, and asks nothing of the player.

## What the code already gives us

| Fact | Where | Consequence |
| --- | --- | --- |
| Three tabs: Deck, Session, Progress | `components/bottom-nav.tsx`, `components/app-shell.tsx` | Home is a fourth tab, or replaces where residents live. |
| Progress holds greeting, level and XP, stats, history, Residents and Keepsakes | `components/progress.tsx` | It is already crowded, and the home content is buried under the stats. |
| `getResidents()` and `getPostcards()` already load in the server page | `app/page.tsx` | No new data is needed for residents and keepsakes. |
| "Invited" is derived: `game_progress.status = 'playing'` with no resident | residents proposal | "On the way" can be read without a new table. |
| The Deck tab is hidden while a session is active, to keep focus on the current game | `bottom-nav.tsx` | The Home tab must not break that focus rule. See decision 4. |
| The Canopy nook exists as a separate, opt-in 3D room and is not wired to residents | PRODUCT.md | Home does not touch 3D. It leaves a clean slot for it later. |

## Design

### Four sections, one screen

| Section | What it shows | Source |
| --- | --- | --- |
| Header | The player's name. Becomes the name card when Story 5 ships. | `users.display_name` today |
| Lives here | Residents, with the existing portraits | `getResidents()` |
| On the way | Games currently invited and not yet arrived | derived from `game_progress` |
| Keepsakes | Postcards, with Bring back and Delete as today | `getPostcards()` |

Residents and Keepsakes **move** from Progress to Home. They are not duplicated.
Progress goes back to what its name says: level, XP, stats and history. Stamps,
the name card and emotes plug into this screen later without changing its
structure.

### No new tables, no migration, no new read

Everything Home shows is already loaded. The app allows only one `playing`
game at a time (`getActiveGame` reads it with `maybeSingle`), so "On the way"
is the current game when it has no resident yet, taken from the existing
`activeGame`. Nothing in this slice needs a new Server Action or SQL.

### What the player sees

1. **Home tab** in the bottom nav, between Session and Progress. Plain label
   "Home".
2. **Calm empty state** for a new account: the player's name and one plain line,
   for example "Games you finish will live here." Not a prompt, not a checklist.
3. **Lives here** shows residents as today. **On the way** shows invited games
   as small covers with their titles, no timers or percentages. **Keepsakes**
   appears only when there is at least one.
4. **Hierarchy:** the name is the only large text. Sections use the same quiet
   headings as the rest of the app. Lantern Pastel tokens only.
5. **Motion:** the existing gentle entrance, off under reduced motion.

### Copy rules

Plain and short. No counts framed as goals ("3 of 10 residents"), no
"collect", "complete", "unlock" or "build your world". An empty home is a
complete home.

## Rules the tests must hold

1. Home renders the empty state for an account with no residents, invited
   games or keepsakes, with no error.
2. Residents, On the way and Keepsakes each appear only when they have items,
   and never on Progress as well.
3. A game that has arrived never appears under On the way. A game with a
   resident and a new session shows once, under Lives here.
4. Bring back and Delete on Keepsakes behave exactly as they do today.
5. The Home tab is reachable by keyboard and is announced as the current page
   when active.
6. With an active session, the focus-first behaviour of the other tabs is
   unchanged.
7. Opening Home changes no XP, counter, session or resident.
8. The existing Progress tests still pass after the move, with updated
   expectations only for the moved sections.

## Decisions for the owner

| # | Decision | My default |
| --- | --- | --- |
| 1 | Is "home view" the 2D Home tab described here, until the 3D settlement exists? | Yes. |
| 2 | Move Residents and Keepsakes off Progress, not copy them? | Yes. One place for each thing. |
| 3 | Show "On the way" (invited games) on Home? | Yes. The spec puts invited avatars outside the settlement, and this is a calm 2D way to show that. |
| 4 | Keep Home reachable during an active session? | Yes. It is read-only and adds no new pull. The session screen stays the default. |
| 5 | Label the tab "Home"? | Yes. |
| 6 | Build Home before stamps, name card and emotes? | Yes. It is the place the other three plug into, and it needs no migration. |

## Task plan

One PR per task. Arrows are real dependencies only.

| ID | Task | Needs | Done means |
| --- | --- | --- | --- |
| H0 | Owner answers the decisions above | none | Defaults agreed or changed |
| H1 | `HomeView` component and Home tab in nav and shell; move Residents and Keepsakes out of `Progress` | H0 | Rules 1 to 3 and 5 hold |
| H2 | Playwright coverage, keyboard and contrast pass, copy review, updated Progress tests | H1 | Rules 4 and 6 to 8 hold; lint `--max-warnings 0`, `tsc` and the standby suite pass |
| H3 | Update `v1-readiness.md` and the spec | H2 | Docs match what shipped |

## Safe rollout

No migration and no Supabase or Vercel setting changes. It is a UI and read-only
change, so it can merge whenever the owner approves, in one PR per task. Nothing
in the database is written.

## Not in this slice

The 3D settlement or nook integration, residents moving or being placed,
merit tiers, the name card (the header just uses the name for now), emote
menus, stamp controls, visitor or friend views, sharing, and account recovery.
