# Planner mode (H5): spec

Status: spec, approved, not built. H5 in [home-facelift.md](home-facelift.md).

## Why

The owner's verb for the Settlement is plan and arrange. Today homes are laid out automatically, six to a deck, in arrival order. Only the loft can be placed, on three fixed rim spots (see [player-placement-proposal.md](player-placement-proposal.md)). Planner mode lets the player choose where homes sit.

## Rules being kept

- No cost, no timer, no pressure. Rearranging never changes who lives where in the data sense: a resident is still earned by beating a game.
- Writes go through checked Server Actions and one SECURITY DEFINER function. No client gets direct INSERT, UPDATE or DELETE.
- Plain copy. No unlock, collect or "almost there".

## What the player does

1. Taps "Arrange" in the Settlement HUD. The scene shows a snap grid on each deck and the homes become draggable.
2. Drags a home to a free grid cell. It snaps on release.
3. Rotates a home in quarter turns with a button or the R key.
4. Taps "Done". Changes save then, in one write.
5. "Undo" steps back through changes made in this Arrange session. "Reset" returns to the automatic layout.

## Decisions proposed

- **Grid:** each deck is a 6 by 6 cell grid. One home takes one cell. The loft anchors keep their current rim spots and are not on the grid.
- **Rotation:** 0, 90, 180, 270 degrees. Stored as 0 to 3.
- **Undo:** client-side only, scoped to one Arrange session. Nothing is saved until Done, so there is no server undo and a closed tab loses unsaved changes. Reset is the only saved way back.
- **Saved layout wins over automatic layout.** A home with no saved cell uses the automatic spot. A new resident always arrives in the first free cell of the last deck, and never displaces a saved home.
- **Keyboard and screen reader:** a list of homes with "Move to" choices ("Deck 1, row 2, column 3, free"), same pattern as loft placement.

## Data

One table, `settlement_layout`, owner-read only:

| Column | Rule |
| --- | --- |
| `user_id` | Owner. Foreign key to users, cascade delete. |
| `game_id` | The resident. `UNIQUE(user_id, game_id)`. |
| `deck` | Integer, 0 or more. |
| `cell` | Integer, 0 to 35. |
| `rotation` | Integer, 0 to 3. |

`UNIQUE(user_id, deck, cell)`. A function `save_layout(p_cells jsonb)` replaces the whole layout in one transaction under the per-account advisory lock. It refuses unknown games, non-residents, out-of-range values and duplicate cells. Needs a migration, so the owner applies it.

## Decision

Homes can go to any free cell on any existing deck (owner, agreed). A deck exists while it holds a home, and the first deck always exists. Empty decks are dropped and later decks renumber. The bridge layout follows the decks that exist.

## Tests the build must hold

1. Dragging to a free cell saves that cell on Done.
2. A taken cell is refused and the home returns.
3. Undo steps back one change. Reset restores the automatic layout.
4. A new resident lands in a free cell and moves no saved home.
5. The list of "Move to" choices does the same as dragging.
6. `save_layout` refuses non-residents, bad ranges and duplicates.

## Owner steps

Apply the `settlement_layout` migration when H5 is built. None for this spec.
