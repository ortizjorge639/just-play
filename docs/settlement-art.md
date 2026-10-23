# Settlement art: what it is and what waits on it

Short answer: "settlement art" is the 3D treehouse world, the place residents live. It is not the Home tab or any current screen. Merit tiers wait on it because tiers only matter as something you can see in that world.

## What it is

The Treehouse (also called the Canopy settlement) is the world described in [treehouse-world-study.md](treehouse-world-study.md) and in the original brief that lives in the archive commit `2c06054` as `docs/canopy/treehouse-app-specs.md`.

- Every game has a Mii-like avatar. When a game meets the player's stamp, that avatar arrives and stays as a resident.
- Each arrival adds something to the treehouse: a trinket at a lower tier, a bigger piece (a room, a deck, a loft) at a higher one.
- Over time the world becomes a picture of what the player has actually played. It can also sit on screen as ambient art.

"Settlement art" means the modelled environment: the tree, rooms, decks, props, avatars and the per-game contributions, built in Blender and rendered in the app.

## Where it stands

| Piece | State |
| --- | --- |
| Product rules (arrival, permanence, tiers, postcards) | Decided. See [spec-stories-3-6.md](spec-stories-3-6.md). |
| Colour direction | Lantern Pastel palette, owner decision. |
| Blender slice | One representative slice, finished September 12. Technically complete. Approved by the owner. See [spec-story-7-settlement.md](spec-story-7-settlement.md). |
| Full settlement | Not approved. No go-ahead to expand it. |
| In the app today | A single furnished room in the Canopy nook ([canopy-nook.md](canopy-nook.md)), built from plain Three.js shapes. Not the settlement, and not tied to residents. |
| Residents, stamps, name card, emotes | Shipped as data and UI on the Home tab. They do not appear in any 3D world yet. |

The art source notes (`docs/canopy-art/`) were kept locally and are not on main.

## Why merit tiers wait

A tier changes how one resident shows up: a figurine becomes a room, a room gets a garden. With no settlement to put that in, a tier would be a label and a number. The stamps design records this: [stamps-proposal.md](stamps-proposal.md) ships hours and milestone stamps only.

Tiers also touch the rules the owner cares about most. Arrival and depth stay separate, the same resident is enriched rather than duplicated, and an earned structural piece is placed by the player with no cost or timer. Building tiers before the art exists risks guessing those rules wrong.

## What unblocks it

1. **Owner decision on the Blender slice.** Approve it, ask for changes, or drop it. Until then nothing downstream can be sized.
2. **If approved:** a go-ahead to expand from one slice to the settlement, and a scope for the first renderer integration (see the performance note in the residents spec: 50+ residents).
3. **Then tiers.** A small first slice would add up to five tiers per game, one visible contribution per tier, and no new residents.

Nothing here is built or started by this document.
