# Just Play

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Gamers who want to spend less time deciding what to play, stay connected to the
games they start, and retain a meaningful record of their gaming life.

The world direction discussed on September 5, 2026 centers on the owner's
personal gaming home, with optional visits from friends rather than a
public-first shared world.

## Product Purpose

Help people choose games, play them, and collect memories of the experience.
The existing README expresses the longer-term idea: completed games become
permanent residents of a personal treehouse world.

The owner has confirmed that the product should extend beyond recommendations
and tracking into a broader gaming home. Starting a game introduces a visiting
character; completing it makes that same character a permanent resident.
Backlogged games are potential adventures, not unattended characters.

The world also serves as ambient art: people can leave it on display and admire
the home they have built game by game. Watching the world must not earn gameplay
progress or create obligations.

## Operating Context

The current application authenticates users and loads a single-page interface
with a recommendation deck, a current-game/session view, and progress/history.
Discovery includes booster packs, preferences, and game search.

Sessions use `LockedIn`, `Playing`, `Paused`, and `Finished` states. Game
progress independently uses `playing`, `beaten`, and `abandoned`.
Finishing a session is not the same event as completing a game.

## Capabilities and Constraints

**Implemented foundation:** Next.js 16, React 19, Supabase authentication and
Postgres, Server Actions, game metadata, session goals and notes, progress
tracking, XP, and streaks. The current shell prioritizes one active game/session.

**Confirmed direction:** an explorable 3D tree-themed plaza;
treehouses and bridged spaces; room for additional houses; map and camera
wayfinding; visiting game characters who become permanent residents upon
completion; ambient viewing; a private home with optional friend visits.

**Demo scope:** a public, no-login `/demo` with original procedural scenery and
characters, clearly fictional games, local saves, connected construction, an
enterable house, photography, and guided presentation. Demo state is independent
of real accounts. Browser ambient mode is not a native OS screensaver.

**Open decisions:** what a house represents; how expansion is earned or enabled;
what "done" means for games without an ending; the identity and asset source of
residents; the scope and timing of friend visits.

The production database schema has no world, plot, house, resident, or
visit-permission entities. Demo domain state and 3D rendering live in separate
modules, with future account integration deliberately deferred.

## Brand Commitments

Keep the Just Play name and the relationship between real play and lasting
personal memories. The owner's reference is
[Yukagecho](https://anime.yukagecho.workers.dev/), especially its player movement,
connected spaces, style, and art direction.

The reference is inspiration for study, not permission to reuse its code, art,
or game-character assets.

## Evidence on Hand

- [README](README.md): existing product narrative and v2-in-progress status.
- [Domain types](lib/types.ts): games, sessions, game progress, users, and stats.
- [Application shell](components/app-shell.tsx): current navigation and behavior.
- [Server Actions](app/actions.ts): current mutations and game/session semantics.
- [Game-progress migration](scripts/008_add_game_progress.sql): persisted status
  values and per-user game records.
- Owner's discovery answers in the September 5, 2026 treehouse-world study:
  broader gaming home, house meaning left open, completed-game residents,
  private-first with optional friend visits.

## Product Principles

1. The world should support real gaming, not become an obligation that competes
   with it.
2. Completed games should remain meaningful after they leave the active queue.
3. Exploration, personal ownership, and resident presence are central to the
   proposed world, not merely decoration around a tracker.
4. Separate current functionality, confirmed ambition, and unapproved proposals
   in every downstream design document.
5. Characters share the plaza regardless of where they live. Incomplete games
   must not create punishment, decay, or a visibly inferior neighborhood.
