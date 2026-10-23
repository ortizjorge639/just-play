# Merit tiers: proposal

Status: proposal, not built. Decided on the owner's "decide". Nothing here needs a migration.

## What a tier is

A tier is how deeply you have played one game. It enriches the home of a game that already lives in the settlement. It never adds a resident, never removes one, and never changes when a game arrived.

## Why no new table

`game_progress.total_time_minutes` is already tracked per game, and it only grows. A tier can be a pure function of those minutes, worked out when Home loads. That means:

- No write path, no RPC, nothing for a client to forge beyond what hours already allow.
- No XP, no counters, no timers. Same rules as stamps.
- Nothing to apply. The owner has no steps.

If a player later wants tiers that mean something other than hours, that is a stored design of its own. This proposal does not close that door.

## The tiers

Fixed in code, in `lib/settlement/tiers.ts`:

| Tier | Name | Minutes played | What the home gains |
| --- | --- | --- | --- |
| 0 | Moved in | arrival | The trinket every resident already has. |
| 1 | Settled | 120 (2 h) | A small companion piece beside the trinket. |
| 2 | At home | 600 (10 h) | A second companion piece. |
| 3 | Elder | 3000 (50 h) | A third companion piece and a warmer tint. |

Three steps above arrival, not five. The spec allows up to five; more can be appended later.

## Rules

1. **Frozen thresholds.** Once shipped, a tier's minutes never change. Tiers may only be appended. Otherwise changing a number would move every existing home.
2. **Depth is separate from arrival.** A game with no hours still lives here. Tier 0 is a full resident.
3. **Same slot.** Companion pieces sit around the same trinket position. They do not take slots, so deck capacity and layout stay untouched.
4. **No decay.** Minutes never go down, so a tier never goes down.
5. **Structural pieces are not here.** Rooms, lofts and decks the player places themselves wait for player placement (slice 6), which needs its own table and proposal.
6. **Companion picks follow the frozen-picks rule.** Each companion is chosen from the same catalog by game id, with the same `availableFrom` guard.

## What the player sees

- The settlement home grows a little as hours pass. Nothing announces it.
- The resident portrait gets one quiet line under the arrival date: "Settled" or "At home". No bar, no number to chase, no countdown.
- Tier 0 shows no line at all.

Copy never says unlock, level, streak, collect or "almost there".

## First slice

1. `lib/settlement/tiers.ts`: `tierFor(minutes)` and the table, with boundary tests (119 vs 120, 599 vs 600, 2999 vs 3000, negative and null treated as 0).
2. Home loads `total_time_minutes` for each resident through the existing server fetch (no new action, no schema change).
3. Renderer places up to three family-tinted spheres around the trinket per tier, until companion art exists.
4. Portrait line for tiers 1 to 3.
5. Standby tests for the line and for companion counts.

## Open points, with my defaults

| # | Question | Default |
| --- | --- | --- |
| 1 | Are hours the only signal? | Yes for now. |
| 2 | Do tiers count minutes from before the game arrived? | Yes, total minutes. |
| 3 | Does a stamp rule's hour target interact with tiers? | No. Stamps decide arrival; tiers read depth. |
