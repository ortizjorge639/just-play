# Story 7: the settlement (spec and master plan)

Owner decisions: the settlement is story 7. The Blender slice is approved. The design must plan for many more residents and homes over a long time, the way a master-planned neighbourhood does. It is a spec, not a build order. Nothing here is started.

## The story

A player who has beaten and stamped games sees a treehouse settlement that is a picture of what they have played. Each resident has a home in it. It grows as they do, and it never takes anything away.

## Master plan principles

1. **Plan the whole, build a lot at a time.** The layout is a plan that can hold far more homes than exist today. Art for a lot arrives later; the lot is already reserved.
2. **Append only.** A resident's place never moves once given. New residents take the next free lot. This is what `lib/settlement/layout.ts` already guarantees.
3. **Districts, not one pile.** Decks fill in order and bridge outward from the first. Later, a deck can be tied to a theme (cozy, fantasy, puzzle, action) without moving anyone already placed. That needs a layout version bump and a rule for old residents; see "Growth".
4. **Kit of parts.** Homes and props come from a catalogue. Adding a part is a catalogue entry plus an asset, with no change to the layout or the database.
5. **Placeholders are first class.** A lot with no art yet shows a stand-in. The settlement is never blocked on the next model.
6. **Same rules as everything else.** Plain copy. No unlock, streak, collect or countdown language. Nothing expires. The game stays in the foreground.

## What is built

| Piece | State |
| --- | --- |
| Residents, stamps, name card, emotes | Shipped. |
| Layout and catalogue (`lib/settlement/`) | Shipped, pure and tested. 6 homes per deck, deterministic, append only. |
| Home line "N homes on M decks" | Shipped. |
| Blender slice | Approved by the owner. |
| Settlement in the app | Not built. |

## Slices, in order

Each slice ships on its own and leaves the app working.

1. **Deck view, 2D.** A read-only view of decks, bridges and homes drawn from `layoutSettlement`, with stand-ins for every part. Proves the plan on real residents. No new data, no migration.
2. **Approved slice into the app.** Replace stand-ins with the approved Blender parts through the `asset` field in the catalogue, loaded lazily. Budget for 50+ residents: instanced parts, one draw path per part, no per-resident scene graph.
3. **Tap a home.** Opens the same resident portrait and emote menu used on Home.
4. **Expand the art.** More parts per family and more deck shapes, added to the catalogue. Needs an owner go-ahead on scope per batch.
5. **Merit tiers.** A tier enriches one existing resident (figurine to room, room to garden). Needs a data design of its own.
6. **Player-placed pieces.** Earned structural pieces are placed by the player. Needs a placement table and a migration, and its own proposal.

Slices 5 and 6 are not scoped here.

## Growth: what the plan must survive

- **Hundreds of residents.** Deck count is derived, so there is no cap. The renderer must cull and instance, and the view must be usable at 5 homes and at 500.
- **New parts.** Appending to the catalogue must not change `partFor` for existing games. Today the pick depends on the catalogue size within a family, so adding parts to a family would reshuffle homes. Before the catalogue grows, either freeze existing picks by bumping `LAYOUT_VERSION` with a rule for old players, or store each resident's part once. This is the main open design risk.
- **New deck shapes.** `LAYOUT_VERSION` marks which rules produced a layout. A new version applies to new residents only, or players see homes move.
- **New families.** Genres that map to `other` today can be given a family later with the same care.
- **Imported games.** `arrived_at` must never be backdated. Any import path respects that.

## Acceptance criteria

- A player with 0, 1, 7 and 60 residents sees a valid settlement, with no overlap and every resident reachable.
- Beating a new game never moves an existing home.
- A lot with no art shows a stand-in and nothing errors.
- Adding a catalogue part leaves every existing player's layout unchanged.
- The view works with keyboard and screen reader, and honours reduced motion.
- No new copy uses unlock, streak, collect or countdown language.

## Non-goals

- Visits to other players' settlements.
- Sharing the settlement outside the app.
- Time-based decay, expiry or upkeep.
- Account recovery.

## Open questions for the owner

1. Is the part catalogue allowed to change existing players' homes, or must existing homes be frozen? I recommend frozen.
2. Should the first view live on Home, or be its own tab?
3. Which family of parts should get art first?
