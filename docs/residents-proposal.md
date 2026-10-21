# Residents: proposal and task plan

**Status:** draft for owner review. Nothing here is built. It replaces the
"Proposed first vertical slice" section of
[spec-stories-3-6.md](spec-stories-3-6.md), which stays as history. Product
rules come from [PRODUCT.md](../PRODUCT.md) and the accepted vocabulary in the
[world study](treehouse-world-study.md). Art direction follows that study mixed
with the Lantern Pastel palette ([DESIGN.md](DESIGN.md)); final avatar and
asset approval is still the owner's.

## The idea in one paragraph

You finish a game. Something quietly stays behind: a small person who belongs
to that game, living in your home from now on. They never ask for anything.
They don't get hungry, they don't leave, and looking at them earns nothing. They
are a keepsake of games you actually played, so the home slowly becomes a
record of your own taste. The game stays the star. The resident is the
memory it leaves.

## What changes from the first draft, and why

The first draft proposed two new tables, three client-callable actions and a
"Mark arrived (test)" button. Reading the real schema shows that design would
cause four problems.

| First draft | Problem found in the code | This proposal |
| --- | --- | --- |
| Store a `backlogged` row per game | The app has no per-user backlog table. Backlogged is just "no record yet". | Do not store it. No row means backlogged. |
| Derive nothing, copy status | `create_standby_session_with_progress` sets `game_progress.status = 'playing'` again on replay (`ON CONFLICT ... DO UPDATE SET status = 'playing'`). Residency read from `game_progress` would be revoked by a replay, which the accepted rules forbid. | A permanent `residents` row that nothing can un-set. |
| Client can UPDATE its own resident to `arrived` | The Supabase anon key is public. A direct client write could self-arrive any game, which makes the arrival meaningless. | No client write policies. Arrival is written by a database trigger inside the same transaction as the real event. |
| Postcard on every session end before arrival | Many games take many sessions. A finished session is not an ended invitation. Every pause-and-finish would leave a postcard. | Postcard only when the player sets the game aside (`game_progress` becomes `abandoned`) with no resident yet. |
| "Mark arrived (test)" button | A production backdoor, plus a second path to arrival. | None. The default stamp is the existing "Mark beaten" action. |

The draft's sample code also did not match the repo (`createServerClient`,
`now()`, `.onConflict().update()`). All new code follows the existing pattern:
a fresh client from `lib/supabase/server.ts`, `auth.getUser()` first, a Server
Action, then `revalidatePath("/")`.

## Design

### Three states, two small tables

| State | How it is known | Stored where |
| --- | --- | --- |
| Backlogged | A library game with no `game_progress` row | Nowhere (absence) |
| Invited | `game_progress.status = 'playing'` and no resident row | Derived |
| Arrived | A row in `residents` | `residents`, permanent |
| Postcard | A row in `postcards`, only while no resident exists | `postcards` |

`residents(user_id, game_id, arrived_at, arrival_source)` with
`UNIQUE(user_id, game_id)`. `arrival_source` is `'beaten'` today. Story 4
(stamps) adds other values and a proof reference without changing the shape.

`postcards(user_id, game_id, created_at)` with `UNIQUE(user_id, game_id)`.

### One seam for arrival

A single SECURITY DEFINER function, `grant_resident_arrival(user, game, source)`,
does everything arrival means: insert the resident (`ON CONFLICT DO NOTHING`, so
replays and double calls change nothing) and delete any postcard for that game.
Today a trigger on `game_progress` calls it when a game becomes `beaten`.
Story 4 only adds a second caller. Nothing else in the app changes.

Because the trigger runs inside `complete_standby_game`, which already holds the
per-account advisory lock, arrival is atomic with finishing the game and cannot
race.

### Postcards

A second trigger fires when `game_progress` becomes `abandoned`. If no resident
exists for that game it inserts a postcard. Re-inviting (the game goes back to
`playing`) leaves the postcard alone. Arrival deletes it. The player can delete
one at any time through a restricted RPC `delete_postcard(game_id)`. Deleting a
postcard never touches game history or XP.

If a game that already has a resident is set aside later, no postcard appears.
The resident was earned and stays.

### Existing accounts

Migration 023 backfills so nobody opens an empty home:

- A game with `completed_at IS NOT NULL` becomes a resident (`arrived_at =
  completed_at`, source `'beaten'`). This covers a beaten game that is playing
  again, because every path that writes `game_progress` (018, 020, 022) keeps
  `completed_at` unless the new status is `beaten`. A test must still pin this.
- A game currently `abandoned` with no `completed_at` gets a postcard.
- A game currently `playing` needs nothing; it reads as Invited.

The backfill is idempotent, so a re-run changes nothing.

### Writes and security

- `residents` and `postcards` have RLS on, with SELECT own rows only.
- No INSERT, UPDATE or DELETE policy for `authenticated` or `anon`.
- Only the two triggers and `delete_postcard` write. Revoke EXECUTE from
  `PUBLIC` and `anon`, grant to `authenticated`, matching 018 to 020.
- Both tables cascade on user and game delete.

### What the player sees in slice 1

1. **Session screen:** one calm line under the game title. "Not moved in yet",
   "On the way" or "Lives here". No buttons, no progress bar.
2. **Arrival moment:** when "Mark beaten" succeeds and a resident newly
   arrives, one quiet card on the finish screen: "{Game} has a home here now."
   It dismisses with a tap, respects reduced motion, and awards no XP.
3. **Residents section on the Progress tab:** three groups. Lives here, On the
   way, Postcards (each with Delete). Plain list, no counters.
4. **A portrait for every resident:** a small generated figure seeded from the
   game id, using only the Lantern Pastel tokens. It is a placeholder that
   keeps each game's figure stable until approved art replaces it. It sits in
   one `ResidentPortrait` component so the swap is a single change.
5. **A read contract for later:** `getResidents()` returns a typed list that the
   Canopy nook can consume when art is approved. Slice 1 does not touch the 3D
   scene.

### Copy rules

Plain and short. No "unlock", "streak", "collect", "don't lose" or countdowns.
Nothing implies a resident is waiting for the player.

## Rules the tests must hold

1. Arrival is idempotent. Beating a game twice gives one resident.
2. A replay never removes a resident.
3. Arrival deletes the postcard. Re-inviting keeps it.
4. Setting aside a game that already has a resident makes no postcard.
5. A user cannot read or write another user's rows, and cannot write their own
   directly.
6. Arrival, viewing and deleting a postcard add no XP and change no counters.
7. Applying the migration twice changes nothing.
8. An account with no `game_progress` rows sees an empty, calm Residents
   section, not an error.

## Decisions for the owner

| # | Decision | My default |
| --- | --- | --- |
| 1 | Is "beaten" the default stamp for slice 1? | Yes. Hour and milestone stamps are Story 4. |
| 2 | Does a postcard come from "set aside", not "finished a session"? | Yes. |
| 3 | Backfill existing beaten games as residents? | Yes, so no one starts empty. |
| 4 | Placeholder generated portraits until art is approved? | Yes. |
| 5 | Open-ended games with no ending: how do they arrive? | Story 4, through a chosen hours stamp. They stay Invited until then. |
| 6 | One neutral R1 caretaker across games, alongside per-game residents? | Later. The study calls it an open narrative idea. |

## Task plan

One PR per task, each with its own owner and worktree. Arrows are real
dependencies only.

| ID | Task | Needs | Done means |
| --- | --- | --- | --- |
| R0 | Owner answers the decisions above | none | Answers recorded here |
| R1 | Migration 023: tables, triggers, backfill, RLS, `delete_postcard`, plus PGlite tests for rules 1 to 8, same style as `migration-022-counters.test.mjs` | R0 | Tests pass. **Owner applies it.** |
| R2 | `getResidents()` action, types, `ResidentPortrait`, read-only Residents section on the Progress tab | R1 applied | Lists render for an account with and without data |
| R3 | Session-screen line and the arrival moment on "Mark beaten" | R1 applied | A beaten game shows the card once, no XP change |
| R4 | Postcard delete from the list; set-aside and re-invite behaviour verified end to end | R1 applied, R2 | Delete works, history untouched |
| R5 | Playwright coverage, keyboard and contrast pass, copy review | R2, R3, R4 | Lint with `--max-warnings 0`, `tsc` and the standby suite pass |
| R6 | Update `v1-readiness.md`; mark the old slice superseded | R5 | Docs match what shipped |

R2, R3 and R4 can run in parallel once R1 is applied.

## Safe rollout

Preview and production share one Supabase project, so the migration is a live
change. It is additive and idempotent, and nothing reads the new tables until
R2 ships. Order: merge R1 and apply the migration, check the backfill counts,
then merge the app PRs. No Vercel or Supabase settings change.

## After slice 1

1. **Story 4, stamps:** a per-game or default rule (hours, a milestone, the
   credits) calling `grant_resident_arrival`. Proof snapshots stay immutable.
2. **Canopy read:** residents appear in the nook once the art is approved.
3. **Story 5, name card, then Story 6, emotes:** after residents are visible.
4. **Merit tiers and contributions:** later tiers enrich the same resident's
   contribution. Placement waits for the art.

## Not in slice 1

Stamps and tiers, contributions and placement, the 3D settlement, the name
card, emotes, sharing or visiting, and account recovery.
