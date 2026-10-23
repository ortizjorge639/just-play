# Settlement slice 2: approved art into the app (plan)

Slice 2 of [spec-story-7-settlement.md](spec-story-7-settlement.md). This is analysis and a plan. No code is written.

## What the approved art actually is

The Blender slice (v003, September 12) is one authored world, not a parts kit. From its asset manifest:

| Export | Size | What it is |
| --- | --- | --- |
| `environment.glb` | 8.9 MB | Gathering tree, grove, furnished interior. Fixed world coordinates. |
| `hearth-deck.glb` | 1.7 MB | One earned deck, shelter and bridge. Already placed at one site. |
| `hearth-enrichment.glb` | 30 KB | Extra planting and a journal for that hearth. |
| `ember-small.glb` | 25 KB | A small arrival trinket. |
| `rain-postcard.glb` | 16 KB | A postcard remnant. |
| `pip.glb`, `sol.glb` | ~290 KB each | Two named characters with idle, walk, greeting. |
| `collision-proxies.glb`, `cameras.glb` | small | Diagnostic and camera data. Never rendered as scenery. |

Only the three small files (ember, enrichment, postcard) could work as repeatable parts. Nothing was modelled for the ten catalogue parts (`cozy-plant`, `fantasy-chest` and so on).

## The mismatch

Our layout is generic. Every resident gets a deck, a slot and a part, for any number of games. The art is specific: two named characters at fixed sites, with seven reserved attachment markers for expansion. Slice 2 as first written ("fill the catalogue's asset field") has almost nothing to fill it with.

Also: the environment file alone is 8.9 MB, and the manifest warns it does not scale unchanged to a full world.

## Options

A. **Reuse the deck.** Render one `hearth-deck.glb` per layout deck, placed by the layout, with `ember-small.glb` standing in for every trinket until more art exists. Fits the generic layout and the master plan. The deck mesh is 1.7 MB, loaded once and instanced.

B. **Show the authored world as is.** Load `environment.glb` as a backdrop for the first deck and ignore the layout beyond that. Looks closest to the approved renders, but costs 8.9 MB, and it does not grow.

C. **Wait for more art.** Request part models per family from the art side first.

Recommended: A, with B's environment as an optional backdrop later. A is the only one that keeps the "any number of homes" promise and uses what is approved.

## Plan for A

1. Copy `hearth-deck.glb` and `ember-small.glb` into `public/canopy/` with content hashes in the filenames, as `r1` already is.
2. Set `asset` on the catalogue entries that use them. Parts without art stay stand-ins.
3. A lazy-loaded 3D deck view behind the existing Settlement toggle. The 2D view stays the fallback, and the default if 3D fails, is off, or reduced motion is set.
4. One loaded deck mesh, instanced per layout deck. One trinket mesh, instanced per placement.
5. Tests: layout to transform mapping in plain unit tests, the 2D fallback in the standby suite, and a load-failure test.

## Risks

- Part picks must be frozen before any catalogue growth ([decision 1](spec-story-7-settlement.md#decisions)).
- The deck was authored at one site with a bridge. Chaining decks needs the bridge endpoints, which are in the manifest but unverified for reuse.
- Pip and Sol are named characters. Residents here are games, so characters stay out of this slice.
- Lighting does not carry over from Blender. The viewer must recreate the hemisphere fill, key and lantern lights.

## Needed from the owner

1. Option A, B or C.
2. Whether the art files may be copied into the repo (about 1.7 MB for option A).
