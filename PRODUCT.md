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
The longer-term idea is that meaningful time with a game becomes a permanent
part of a personal treehouse world.

The owner has confirmed that the product should extend beyond recommendations
and tracking into a broader gaming home. The September 10, 2026 Treehouse App
Specs and follow-up decisions supersede the initial visitor-at-the-lodge model:
starting a game invites its avatar to travel toward the settlement; meeting the
player's chosen stamp of proof grants permanent arrival. Backlogged avatars
remain outside the settlement, represented as possibilities rather than
unattended residents.

Arrival eligibility and depth of engagement are separate. The player can choose
a short playtime milestone as their arrival stamp, then enrich the same
resident's contribution by reaching later tiers. A dropped invitation leaves a
removable keepsake instead of a resident. An earned structural contribution is
placed by the player on a compatible branch, without costs or timers.

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
wayfinding; invited avatars traveling outside the settlement until their chosen
stamp is earned; permanent arrivals and tier-dependent contributions; remnants
of dropped invitations; player-placed, earned expansion; ambient viewing; a
private home with optional friend visits.

**Demo scope:** a public, no-login `/demo` with original procedural scenery and
characters, clearly fictional games, local saves, connected construction, an
enterable house, photography, and guided presentation. Demo state is independent
of real accounts. Browser ambient mode is not a native OS screensaver.

**Implemented presentation model:** the demo now uses Backlogged, Invited, and
Arrived, configurable default and per-game stamps and tiers, persistent
postcards, six original contribution themes, and player-placed earned expansion.
Invitations stay outside the settlement until proof is self-confirmed.
Version-one saves preserve residents, notes, and any already-built Fern House.
The demo supports one to five tiers and seven authored branch sites, with
open-air structural additions. No playtime, credits, or trophy verification
is claimed. See the [presenter guide](docs/demo.md) for controls and limits.

**Resolved:** "done enough" is the user's stamp, set per game or through a
default rule. Arrival is permanent even when later tiers remain unearned.
Structural additions are earned through deeper engagement and placed by the
player rather than automatically constructed.

**Still deferred:** production avatar/asset sourcing and integrations; the scope
and timing of friend visits; production policy for changing milestone rules
after achievements; and unrestricted structural placement. In the demo,
rule edits retain proof snapshots, arrival, earned depth, and placed additions;
new milestones require explicit confirmation rather than retrospective awards.

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
- Owner-supplied Treehouse App Specs and September 10 follow-up decisions,
  recorded in the [revised world-model mapping](docs/treehouse-world-study.md#september-10-revision-stamps-remnants-and-earned-contributions).

## Product Principles

1. The world should support real gaming, not become an obligation that competes
   with it.
2. Games should remain meaningful after they leave the active queue, whether
   through a permanent resident or a voluntarily retained keepsake of an attempt.
3. Exploration, personal ownership, and resident presence are central to the
   proposed world, not merely decoration around a tracker.
4. Separate current functionality, confirmed ambition, and unapproved proposals
   in every downstream design document.
5. Arrived characters share the plaza regardless of home or tier. Unfinished
   games must not create punishment, decay, or a visibly inferior neighborhood.
6. A tier measures engagement, not the dignity or permanence of a resident.
   Higher tiers enrich contributions; they do not make earlier arrivals provisional.
