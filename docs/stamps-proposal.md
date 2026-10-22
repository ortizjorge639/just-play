# Stamps: proposal and task plan

**Status:** proposal only. Nothing here is built, and nothing proceeds until the
owner answers the decisions below. It builds on
[residents-proposal.md](residents-proposal.md) (shipped) and replaces the loose
parts of Story 4 in [spec-stories-3-6.md](spec-stories-3-6.md), which stays as
history.

## The idea in one paragraph

Today a game becomes a resident only when you press "Mark beaten". That works
for games with an ending and fails for the rest: open-ended games, endless
roguelikes, a 200-hour RPG you love but will never finish. A stamp is the
player's own answer to "what counts as done enough?" for a game. Reach it, and
you decide whether to let the game move in. The player is always the one who
says so. The app never moves a game in on its own.

## What the code already gives us

| Fact | Where | Consequence |
| --- | --- | --- |
| One seam for arrival: `grant_resident_arrival(user, game, source)`, idempotent, deletes the postcard | migration 023 | A stamp is a second caller. Residents, postcards and the UI do not change. |
| `residents.arrival_source` exists, today only `'beaten'` | migration 023 | Add `'stamp'`. No table shape change. |
| `game_progress.total_time_minutes` is the per-game total, counters corrected in 022 | migrations 018 to 022 | "Hours played" is already tracked. No new telemetry. |
| `grant_resident_arrival` is revoked from every client role | migration 023 | A client must never call it. Confirmation goes through its own checked RPC. |

## Design

### Smallest useful shape

Two stamp kinds, both self-confirmed:

| Kind | Example | Eligible when |
| --- | --- | --- |
| `hours` | "10 hours" | `game_progress.total_time_minutes >= target`. Checked by the database. |
| `milestone` | "Reached the second act" | The game is Invited (has `game_progress`, status `playing`). The player is vouching. |

Story-based and percentage stamps from the spec are just `milestone` with a
label. The app cannot verify them and says so honestly: it is a promise to
yourself.

### Tables

`stamp_rules(user_id, game_id NULL, kind, target_minutes NULL, label NULL)`

- `game_id IS NULL` is the user's default rule. A row with a `game_id` overrides
  it for that game.
- One default and one override per game, enforced by two partial unique indexes.
- `hours` requires `target_minutes > 0`. `milestone` requires a `label` of 1 to
  60 characters. Checked by constraints.
- Applies to **new confirmations only**. Changing a rule never touches
  residents already arrived (the spec's rule, and the cheapest one to hold).

`stamp_proofs(user_id, game_id, confirmed_at, rule_snapshot jsonb, minutes_at_confirm)`

- Written once, by `confirm_stamp`, in the same transaction as the arrival.
- `UNIQUE(user_id, game_id)`. No UPDATE or DELETE policy for any client role.
  The snapshot is what the rule said at that moment, so later edits cannot
  rewrite history.

### One checked write path

`confirm_stamp(p_game_id)`, SECURITY DEFINER, `search_path` pinned, EXECUTE only
for `authenticated`:

1. Require `auth.uid()`. Take the same per-account advisory lock the finish path
   uses, so it cannot race "Mark beaten".
2. Resolve the rule: the game override, else the user's default, else refuse
   (no rule means the old "Mark beaten" path is the only way in).
3. For `hours`, refuse unless `total_time_minutes` meets the target. For
   `milestone`, require an Invited game.
4. Insert the proof (`ON CONFLICT DO NOTHING`), then call
   `grant_resident_arrival(user, game, 'stamp')`.
5. Return whether a resident newly arrived, so the UI can show the arrival card
   once.

Confirming twice, or confirming a game that is already a resident, changes
nothing. Beating a game that already arrived by stamp adds nothing either
(arrival is already idempotent).

Rule writes use a second small RPC, `set_stamp_rule`, with the same validation,
so a client never gets table write access. Clearing a rule is the same RPC with
no rule.

### What the player sees

1. **Settings:** one row, "When does a game move in?" Options: "When I mark it
   beaten" (default, no rule), "After a set number of hours", "When I say so".
   Hours takes a number. This is the default rule.
2. **Game screen:** a quiet line under the resident status. "2 of 10 hours" or
   "Your own mark: second act". A small "Change for this game" link opens the
   same choices for one game. No bar, no percentage, no countdown.
3. **Ready state:** when an hours target is met, the line becomes "You've played
   10 hours." with one button, "Let it move in". Nothing fires by itself, and no
   badge or push appears elsewhere. Milestone games show the button always, with
   the label.
4. **Arrival:** the existing arrival card. Same copy, no XP, reduced motion
   respected.

### Copy rules

Same as residents: plain, short, never "unlock", "streak", "collect",
"almost there" or "don't lose". Progress is information, not pressure. A game
with a rule that is never confirmed just stays Invited, and that is fine.

## Rules the tests must hold

1. Confirming is idempotent: one resident, one proof, however many calls.
2. An `hours` stamp refuses below target and accepts at target (boundary test).
3. Confirming a milestone on a game that is not Invited is refused.
4. A user cannot confirm, read or write another user's rules or proofs, and
   cannot write `stamp_proofs` or `residents` directly.
5. Changing or clearing a rule does not remove a resident or alter an existing
   proof.
6. A stamp arrival deletes the game's postcard, the same as "beaten".
7. Confirming adds no XP and changes no counters.
8. Confirm racing "Mark beaten" on one game yields one resident and no error.
9. A game override beats the default; no rule means confirm is refused.
10. Applying the migration twice changes nothing.

## Decisions for the owner

| # | Decision | My default |
| --- | --- | --- |
| 1 | Does the player always press the button, with no automatic arrival at the target? | Yes. |
| 2 | Slice 1 has hours and milestone kinds only, no merit tiers? | Yes. Tiers wait for the settlement art, because there is nothing to enrich yet. |
| 3 | Can the player confirm immediately after reaching the target (no delay)? | Yes. The spec's "next session" delay adds friction and verifies nothing. |
| 4 | Should a rule change ever re-check existing residents? | No. Grandfathered, as the spec leans. |
| 5 | Is "no rule" the default, so "Mark beaten" stays the only path until the player opts in? | Yes. Nothing changes for existing accounts. |
| 6 | Show the confirmed date on the resident? | Yes, read-only. The recorded time is never editable. |

## Task plan

One PR per task. Arrows are real dependencies only.

| ID | Task | Needs | Done means |
| --- | --- | --- | --- |
| S0 | Owner answers the decisions above | none | Defaults agreed or changed |
| S1 | Migration 024: `stamp_rules`, `stamp_proofs`, `confirm_stamp`, `set_stamp_rule`, RLS, extend `arrival_source`, plus PGlite tests for rules 1 to 10 using the real SQL file and real roles | S0 | Tests pass. **Owner applies it.** |
| S2 | Server actions `getStampRules`, `setStampRule`, `confirmStamp`, types, error handling in plain voice | S1 applied | Failures show a visible message |
| S3 | Settings row and per-game "change" control | S2 | Rule saves, clears and survives reload |
| S4 | Game-screen progress line, ready state and confirm, arrival card reuse | S2 | Confirm arrives once; no change to XP |
| S5 | Playwright coverage, keyboard and contrast pass, copy review | S3, S4 | Lint `--max-warnings 0`, `tsc` and the standby suite pass |
| S6 | Update `v1-readiness.md` and the spec | S5 | Docs match what shipped |

S3 and S4 can run in parallel once S2 lands.

## Safe rollout

Preview and production share one Supabase project, so the migration is a live
change. It is additive and idempotent, and nothing reads the new tables until
S2 ships. Order: merge S1 and the owner applies it, then the app PRs. No Vercel
or Supabase settings change. Existing accounts see no difference until they set
a rule.

## Not in this slice

Merit tiers and contribution levels, story-API or achievement detection,
cross-device sync, XP or rewards for stamps, notifications about reaching a
stamp, the name card, emotes, the 3D settlement, and account recovery.
