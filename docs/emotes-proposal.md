# Emotes: proposal and task plan

**Status:** proposal only. Nothing here is built, and nothing proceeds until the
owner answers the decisions below. It follows
[residents-proposal.md](residents-proposal.md) (shipped),
[stamps-proposal.md](stamps-proposal.md) and
[name-card-proposal.md](name-card-proposal.md), and narrows Story 6 in
[spec-stories-3-6.md](spec-stories-3-6.md), which stays as history.

## The idea in one paragraph

A resident is a memory a game left behind. An emote is a moment of saying hi to
it: you wave, and a short authored line answers. That is the whole exchange.
Nothing is earned, nothing decays, nothing waits for you, and nobody is hurt if
you never do it. The point is warmth, not engagement.

## What the code already gives us

| Fact | Where | Consequence |
| --- | --- | --- |
| Residents render as cards on the Progress tab | `components/resident-portrait.tsx`, `components/progress.tsx` | That is where a player can already tap a resident. |
| There is no 3D or animated resident scene | Canopy is not wired to residents; art is not approved | "Resident plays a 0.5 to 2 second animation" is out of reach. Slice 1 is text first, with at most a tiny 2D motion that turns off under reduced motion. |
| `residents` is trigger-written; clients cannot write it | migration 023 | Emote history must be its own table, written by a checked RPC. |
| Placeholder portrait is seeded from the game id | R2 | A resident's look is stable; flavor can be stable per game too. |
| Session notes already exist as a way to say something about a game | notes work | "Share thought" overlaps with notes and PRODUCT.md's sharing rules. Leave it out of slice 1. |

## Design

### The emote set

Four emotes, the same for every player, nothing to unlock:

| Emote | Meaning |
| --- | --- |
| Wave | Hello. |
| Celebrate | Good job. |
| Rest | Sit together for a moment. |
| Check in | How are you? |

"Share thought" from the spec is deferred. It needs text input, storage and
moderation thinking, and it would duplicate session notes.

### Flavor lines

Short, authored by hand, stored in the repo in one file (`lib/emotes.ts`), not
generated at runtime and not written by a model. Each emote has a small pool of
lines that make sense for any game, written in the app's plain voice. Which line
shows is picked on the server from a stable hash of the game id and the emote,
so it is the same for the same resident and never random during render.

The owner approves the exact lines before they ship. No resident ever says
anything that implies need, loneliness, guilt or a deadline.

### Storage

`resident_emotes(user_id, game_id, emote, emoted_at)`

- Primary key `(user_id, game_id)`: **one row per resident, overwritten each
  time.** It records the most recent emote only, which is all the spec's
  "last interaction" needs. No log, no counts, no streaks.
- Foreign key `(user_id, game_id)` to `residents`, cascade on delete. An emote
  can only exist for a resident who has arrived.
- `emote` constrained to the four values.
- RLS on, SELECT own rows only, no client write policy.

### One checked write path

`record_emote(p_game_id, p_emote)`, SECURITY DEFINER, `search_path` pinned,
EXECUTE only for `authenticated`:

1. Require `auth.uid()`.
2. Require that the resident exists for that user and game; otherwise refuse.
3. Require `p_emote` to be one of the four.
4. Upsert the single row with `now()`.
5. Return the saved emote and time.

It touches no XP, counter, session, postcard or resident row. There is no
cooldown in slice 1. Because only one row per resident is ever kept, spamming
changes nothing and costs nothing, so a cooldown would add friction for no gain.

### What the player sees

1. **Residents section, Progress tab:** each resident card becomes a button.
   Tapping it opens a small menu of the four emotes. It is a real list of
   buttons, reachable and operable by keyboard, closed with Escape, with
   focus returned to the card.
2. **The answer:** one line of flavor text appears under the name, announced
   politely to screen readers. It stays until the next tap or until leaving the
   tab. A small "Last: Waved, 2 days ago" note shows under the name once there
   is history.
3. **Motion:** at most a small nod on the portrait. Under reduced motion it is
   off, and the text line is the only feedback. Nothing depends on the motion.
4. **Failure:** if saving fails the line still shows, and a quiet second line
   says "Couldn't save that one." Emoting does not need the network to feel
   right.
5. **Session screen:** unchanged in slice 1. Residents only appear there as a
   status line today.

### Copy rules

Same as every slice: plain, short, no "bond", "level", "streak", "don't forget",
"they miss you". An unused emote is not a missed one.

## Rules the tests must hold

1. Recording an emote for an arrived resident stores one row; a second emote on
   the same resident overwrites it, never adds a row.
2. A game with no resident is refused, and nothing is written.
3. An emote outside the four values is refused.
4. A user cannot read or write another user's emotes, and cannot write
   `resident_emotes` directly.
5. Emoting adds no XP, changes no counters, and leaves residents, postcards,
   sessions and stamps untouched.
6. Deleting the user, the game or the resident removes its emote row.
7. The same resident and emote always return the same flavor line.
8. Applying the migration twice changes nothing.
9. UI: the menu opens and closes by keyboard, restores focus, shows the line
   once per tap, and works with reduced motion.

## Decisions for the owner

| # | Decision | My default |
| --- | --- | --- |
| 1 | Four emotes, with "Share thought" left out for now? | Yes. Notes already cover saying something about a game. |
| 2 | Store only the last emote per resident, not a log? | Yes. Enough for "last time you said hi", with nothing to farm. |
| 3 | No cooldown? | Yes. One overwritten row means there is nothing to protect. |
| 4 | Text first, with no resident animation until art is approved? | Yes. |
| 5 | Generic flavor lines for any game, written by hand and approved by you? | Yes. Per-game lines do not scale and risk spoilers. |
| 6 | Only on the Progress tab in slice 1, not the session screen? | Yes. Keeps the session screen focus-first. |

## Task plan

One PR per task. Arrows are real dependencies only.

| ID | Task | Needs | Done means |
| --- | --- | --- | --- |
| E0 | Owner answers the decisions and approves the flavor lines | none | Defaults agreed and copy signed off |
| E1 | Next free migration: `resident_emotes`, `record_emote`, RLS, plus PGlite tests for rules 1 to 6 and 8 using the real SQL file and real roles | E0 | Tests pass. **Owner applies it.** |
| E2 | `lib/emotes.ts` (emote set and approved lines, stable pick), `recordEmote()` action, `resident_emotes` read in `getResidents()` | E1 applied | Pick is deterministic; failure is non-fatal |
| E3 | Emote menu on resident cards, flavor line, last-emote note | E2 | Rule 9 holds in Playwright |
| E4 | Keyboard, contrast and reduced-motion pass, copy review | E3 | Lint `--max-warnings 0`, `tsc` and the standby suite pass |
| E5 | Update `v1-readiness.md` and the spec | E4 | Docs match what shipped |

## Safe rollout

Preview and production share one Supabase project, so the migration is a live
change. It is additive and idempotent, and nothing reads the new table until E2
ships. Order: merge E1 and the owner applies it, then the app PRs. No Vercel or
Supabase settings change. Existing accounts look the same until they tap a
resident.

## Not in this slice

Share-thought notes, resident animation or sound, a cooldown, emote logs or
counts, mood or memory in residents, dialogue, emoting at several residents at
once, visitor or friend emotes, the session-screen entry point, home view, and
account recovery.
