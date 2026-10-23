# Growing the settlement: logic first (proposal)

Status: proposal. Nothing built. Written after the owner said to start small, and to make sure the code can take more residents and homes as completed games come in, without knowing yet how many games people will add.

## The problem, stated plainly

We do not know the scale. One player might finish 5 games, another 500. Games come from IGDB and Steam, so we cannot draw art for each one. Any design that needs a person to author something per game fails the first time a stranger finishes a game we have never seen.

So the settlement has to be built from a small, finite kit of parts, with logic that decides which parts a game gets and where they go. The art can start with a handful of parts and grow without the logic changing.

## What exists today

- `residents` has one row per player and game: `user_id`, `game_id`, `arrived_at`, `arrival_source` (migration 023). Rows are only ever added.
- `Game.genres` is a string list on every game.
- The Home tab lists residents as portraits. It has no sense of place or capacity.
- The Canopy nook is one fixed room in plain Three.js (`components/canopy/`). It does not know about residents.
- The Blender slice (see [settlement-art.md](settlement-art.md)) shows round decks linked by bridges, a cottage, and a shrine. It is not in the app.

## Proposal: three small, separate pieces

All pure TypeScript in `lib/settlement/`. No database change, no UI change, no 3D.

### 1. A kit of parts (`catalog.ts`)

A short list of parts. Each has an id, a family, a depth (`trinket` now; room and deck later), and an optional asset key.

- The asset key is empty until art exists. A part with no asset falls back to a generic stand-in. This is how new art lands later without touching logic.
- Families come from a genre map, for example cozy and farming, fantasy and adventure, puzzle, action, other. Unknown or missing genres go to `other`. IGDB genre data is uneven, so the fallback is a real path, not an edge case.
- A game's part is picked deterministically from its id and genres, the same way `pickEmoteLine` picks an emote line. No table, no per-game rows, and the same game always gets the same part for every player.

### 2. A layout function (`layout.ts`)

`layoutSettlement(residents)` returns where everything goes: decks, and for each resident a deck and a slot on it.

- Residents are ordered by `arrived_at`, with `game_id` as the tiebreak. Because rows are only added, a new arrival goes at the end and never moves anyone already placed. That stability is the main rule and gets its own tests.
- A deck holds a fixed number of residents. Start at 6, kept as one named constant. When one is full, the next deck opens and connects to an earlier one. The shape of the settlement is generated, not stored.
- It works for any count, including zero. Tests run 0, 1, 6, 7, 50 and 5,000, and check that no two residents share a slot.
- It carries a `LAYOUT_VERSION`. If the placement rules ever change, old and new layouts can be told apart instead of silently shifting everyone's home.

### 3. A renderer seam (`types.ts`)

One shape both views accept: the layout plus a callback for selecting a resident.

- The text list on Home stays as the accessible version and the fallback when 3D fails or is off.
- The current room and the future Blender world would each be a second implementation of the same shape.
- Large settlements: the layout returns decks, so a renderer can draw nearby decks in full and far ones simply. That is for the renderer to do later. The logic only needs to make it possible.

## What this deliberately leaves out

- **Merit tiers.** The catalog has the depth field, set to `trinket`, so tiers slot in later. Nothing else about them is built.
- **Player-chosen placement.** The owner's rules say a player places an earned structural piece on a compatible branch. This slice places automatically. Saving a player's choices would need a new table and a migration, and I would not add that until the art approval is settled.
- **Any 3D, art, or UI.** There is no visible change in the app from this slice.

## Tradeoffs worth knowing

- **Dead code risk.** With no UI change, the logic does nothing a player can see until something uses it. I think that is acceptable for one slice, because it is small and tested, but it is a real cost. The alternative is a tiny read-only "decks" summary on Home so the logic is exercised. Your call.
- **Genre quality.** The kit is only as good as IGDB's genres. Many games will land in `other` at first. That is fine for a trinket and gets less fine as parts get bigger.
- **Layout is a promise.** Once players have homes, changing the rules moves things people have seen. Hence the version field and the append-only rule.

## Plan

| # | Task | Output | Owner steps |
| --- | --- | --- | --- |
| 1 | Types, catalog, genre map | `lib/settlement/types.ts`, `catalog.ts`, tests for fallback and determinism | None |
| 2 | Layout function | `layout.ts`, tests for stability, capacity growth, uniqueness, scale | None |
| 3 | Optional: read-only deck summary on Home | Exercises the logic; Playwright check | None |

One PR each. Lint with `--max-warnings 0`, `tsc`, unit tests with tsx, and the standby suite for item 3.

## Decisions needed from the owner

1. Automatic placement for this slice, with saved player placement later behind its own proposal? I recommend yes.
2. Six residents per deck as the starting number? It is one constant, so it is easy to change.
3. Include the Home summary (task 3), or logic only?
