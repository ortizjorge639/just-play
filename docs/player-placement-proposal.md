# Player-placed pieces: proposal

Status: proposal, not built. This is the one slice that needs a migration, so the owner applies it.

## The rule being kept

An earned structural piece is placed by the player, on a compatible spot, with no cost, no timer and no pressure. A piece never changes who lives here or where they live.

## What is earned

A game that reaches the Elder tier (50 hours, see [merit-tiers-proposal.md](merit-tiers-proposal.md)) earns one piece. The tier is read from play minutes, so "earned" is also derived: no award is stored, and no counter is kept. One piece per game, ever.

First piece shape: a small **loft** for that game's home. More shapes (a garden, a lookout) are catalogue additions later, appended only, same as parts.

## Where pieces go

Each deck has a fixed set of **anchors**: 3 spots on its outer rim, away from the bridge. Anchor numbers are fixed per deck shape and versioned with `LAYOUT_VERSION`. A piece sits on one anchor of one existing deck. Anchors never move, because decks never move.

## Data

One table, `settlement_pieces`:

| Column | Rule |
| --- | --- |
| `user_id` | The owner. Foreign key to users, cascade delete. |
| `game_id` | The game that earned it. `UNIQUE(user_id, game_id)`: one piece per game. |
| `piece` | Text, checked against a short list (`loft`). |
| `deck` | Integer, 0 or more. |
| `anchor` | Integer, 0 to 2. |
| `placed_at`, `updated_at` | Timestamps. |

`UNIQUE(user_id, deck, anchor)`: one piece per anchor.

RLS: a user can read only their own rows. No client has INSERT, UPDATE or DELETE.

## One checked write path

`place_piece(p_game_id, p_deck, p_anchor)`, SECURITY DEFINER, `search_path` pinned, EXECUTE for `authenticated` only:

1. Require `auth.uid()`. Take the per-account advisory lock the other write paths use.
2. Require the game to be a resident and its `game_progress.total_time_minutes` to be at least 3000.
3. Require the deck to exist: `p_deck < ceil(resident count / 6)`, with the first deck always valid.
4. Require `p_anchor` between 0 and 2.
5. Upsert on `(user_id, game_id)`. This is a move if the player already placed it. Refuse if another piece holds that anchor.
6. Return the row.

`remove_piece(p_game_id)` takes it back off the deck. The piece is still earned and can be placed again. No cost either way.

The thresholds live in the function and in `lib/settlement/tiers.ts`. A test keeps them equal.

## What the player sees

- On the Elder resident's portrait: a quiet line, "Has a loft to place", and one button, "Place it".
- In the settlement view, spots on the rim of each deck show as small outlines while placing. Tap a spot to put the loft there. Tap the loft later to move or take it back.
- Keyboard and screen reader: the same choices as a list ("Deck 1, spot 2, free"), next to the homes list.
- No toast, no badge, no countdown. Copy never says unlock, collect or "almost there".

## Rules the tests must hold

1. Placing below 3000 minutes is refused, and 3000 is accepted (boundary).
2. A game that is not a resident cannot place.
3. A deck that does not exist, and an anchor outside 0 to 2, are refused.
4. One piece per game and one per anchor, even under concurrent calls.
5. A user cannot read, write or move another user's pieces, and cannot write the table directly.
6. Moving and removing change no resident, no `arrived_at` and no layout.
7. Adding or removing a piece changes no XP and no counters.
8. Applying the migration twice changes nothing.
9. The renderer draws a piece on the anchor it names and nowhere else, at 1 deck and at 200.

## Slices

1. Migration and RPC tests (owner applies it).
2. Read pieces on Home, draw them as placeholders on anchors.
3. Place, move and remove, with the portrait line and the accessible list.

## Decisions I made, for the owner to overrule

| # | Decision | Default |
| --- | --- | --- |
| 1 | What earns a piece? | Elder tier, one per game. |
| 2 | Can a player move or remove a piece? | Yes, freely. |
| 3 | How many anchors per deck? | 3, on the outer rim. |
| 4 | Does placing need a saved layout version? | No. Anchors depend only on deck index. |

## Not in this proposal

Piece art, themes per deck, sharing a settlement with others, and any piece that costs or expires.
