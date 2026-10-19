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

Help people choose a game, stay present with it, enjoy the experience, and build
a repertoire of games they have meaningfully played and completed, brick by
brick. Just Play should reduce unwanted deciding and scrolling, not replace
them with another application that demands attention.

The October 18, 2026 real-play conversation clarifies the broader direction:
the phone or second monitor can become an optional, quiet Just Play companion
instead of competing video or social content. The game remains the main
experience. More enjoyable play and more follow-through are intended outcomes;
faster completion is a hypothesis to evaluate, not a promise or a reason to rush.

### One journey, two complementary views

The primary journey is **Backlog -> In Progress -> Completed**, with healthy
options to pause, set a game aside, or return later. The completed repertoire
preserves the player's history; it is not a race to maximize finished titles.
The simple artwork/StandBy view and metaphorical Canopy view are both valid
choices. Neither world viewing nor companion interaction is required to play,
record progress, or belong.

Canopy gives this same real gaming journey emotional continuity: meaningful
moments can eventually become memories, original residents, and contributions
to a personal home. It is a supporting expression of the journey, not a second
game that must be maintained while the player is trying to finish the first.

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

### Healthy backlog flow

The owner selected **both completion pace and net unfinished-backlog change**
as the meaning of "burn rate". These are optional trends for reflection, not
quotas, leaderboards, deadlines, or targets displayed over active play.

| Measure | Intended definition |
| --- | --- |
| Completion pace | Distinct games first marked completed by the player during the selected period. Keep replays and corrections separate rather than inflating the count. |
| Net unfinished-backlog change | The ending unfinished inventory compared with the beginning, including both queued and in-progress games. Explain additions/returns, completions, and games deliberately set aside or removed as separate flows. |

Moving a game from queued to in progress does not itself reduce unfinished
work. Setting one aside is a legitimate choice, not a completed game. With no
other changes, completing three games while adding five means three completions
and an unfinished backlog that grew by two. Neither number is a moral score.
Long games, slow play, breaks, and choosing not to finish must not be penalized.

A finished session, a completed game, and a Canopy arrival are different events.
The existing player-defined arrival stamp may be earned before game completion,
and later engagement may enrich the same resident. Do not relabel an arrival,
elapsed timer, idle display, or companion conversation as a completed game.

These metric definitions are product requirements, not implemented analytics.
Existing game-progress records are not a complete backlog-flow history. A
future implementation needs authoritative records and explicit handling of
returns, removals, replays, and corrections; missing history must not appear as
a measured zero or an invented trend.

### Companionship without competing for attention

During play, the companion should offer quiet presence, not urgent dialogue,
chores, or a reward queue. Interaction belongs at voluntary, natural breaks;
reflection and recognition can happen after play without becoming homework.
Meaningful progress may earn a lasting contribution under the chosen stamp
rules. Clicking, chatting, checking the app, or leaving it open must not earn
progress merely to make the companion more engaging.

The longer-term experience can include an unfolding, game-related story and
familiar residents who acknowledge moments the player chooses to share.
Voluntary interaction can deepen familiarity without making relationship
maintenance a condition of progress or belonging.

Future game-related responses must distinguish what the app knows from what
the player has actually shared. A selected title, session, goal, and note do
not reveal a boss fight, plot event, emotional reaction, or what is on another
monitor. Use explicit player context and, only if separately approved, opt-in
supported integrations with clear provenance and controls. No silent screen
monitoring, invented achievements, or unrequested spoilers.

Eventual community can let people share a gaming legacy, visit homes, or enjoy
deliberate co-presence: a new couch-co-op feeling without requiring the same
game. Keep it private by default and chosen by the player, not an infinite
feed, public hours ranking, neglect penalty, or social obligation.

## Operating Context

The current application authenticates users and loads a single-page interface
with a recommendation deck, a current-game/session view, and progress/history.
Discovery includes booster packs, preferences, and game search.

Sessions use `LockedIn`, `Playing`, `Paused`, and `Finished` states. Game
progress independently uses `playing`, `beaten`, and `abandoned`.
Finishing a session is not the same event as completing a game.

The backlog-to-completed journey above is product vocabulary, not a new database
enum. It does not add a persisted backlog or world state by documentation alone.
The local-first fictional `/demo` remains separate from real-account progress.

StandBy and the optional real-session Canopy nook are implemented as bounded,
reviewed preview slices in [PR #2](https://github.com/ortizjorge639/just-play/pull/2)
at `b19bf48` and [PR #3](https://github.com/ortizjorge639/just-play/pull/3) at
`d19672d`. Both are unmerged at this documentation update, not a main-release
claim. The nook contains a fixed furnished room and a neutral R1 using only its
Idle animation; it is not an earned resident, selected-game personification,
conversational agent, or persistent settlement. The app has session context; R1 does not
interpret gameplay or observe the other screen. Viewer selection currently
lasts for the StandBy visit, not as an account-backed preference.

The phone and desktop should support the same account-backed journey, with
responsive, accessible presentation and a simpler fallback where appropriate.
Cross-device persistence and safe reconciliation require their own evidence;
browser-local demo saves and layout tests are not proof of those guarantees.

## Capabilities and Constraints

**Implemented foundation:** Next.js 16, React 19, Supabase authentication and
Postgres, Server Actions, game metadata, session goals and notes, progress
tracking, XP, and streaks. The current shell prioritizes one active game/session.

**Confirmed direction:** an explorable 3D tree-themed plaza;
treehouses and bridged spaces; room for additional houses; map and camera
wayfinding; invited avatars traveling outside the settlement until their chosen
stamp is earned; permanent arrivals and tier-dependent contributions; remnants
of dropped invitations; player-placed, earned expansion; ambient viewing; a
private home with optional friend visits. The focus-first companion and healthy
backlog metrics above ground that world in the player's actual gaming life.

**Demo scope:** a public, no-login `/demo` with original procedural scenery and
characters, clearly fictional games, local saves, connected construction, an
enterable house, photography, and guided presentation. Demo state is independent
of real accounts. Browser ambient mode is not a native OS screensaver.

**Separate prototype, not this checkout:** the demo and art studies below are
preserved at original source commit
`6a4370096092c9225578c3462a06d66b854ab133`. They are not imported into the
accepted session runtime or this handoff branch. That source is retained in
the original local overview/art workspace, not published by this handoff.
Archive paths below identify provenance, not available checkout files or
promised public downloads. Current execution scope is in the
[handoff plan](docs/standby-canopy-handoff.md).

**Implemented presentation model:** the demo now uses Backlogged, Invited, and
Arrived, configurable default and per-game stamps and tiers, persistent
postcards, six original contribution themes, and player-placed earned expansion.
Invitations stay outside the settlement until proof is self-confirmed.
Version-one saves preserve residents, notes, and any already-built Fern House.
The demo supports one to five tiers and seven authored branch sites, with
open-air structural additions. No playtime, credits, or trophy verification
is claimed. The separate prototype's presenter guide is `docs/demo.md` at the
original local source commit; it is not required to run this handoff.

**Resolved:** "done enough" is the user's stamp, set per game or through a
default rule. Arrival is permanent even when later tiers remain unearned.
Structural additions are earned through deeper engagement and placed by the
player rather than automatically constructed.

**Still deferred:** account-backed world progression and memories; companion
dialogue, relationships, and game-context interpretation; production avatar/asset
sourcing and integrations; the scope and timing of friend visits; backlog-flow
metrics; production policy for changing milestone rules after achievements;
and unrestricted structural placement. In the demo,
rule edits retain proof snapshots, arrival, earned depth, and placed additions;
new milestones require explicit confirmation rather than retrospective awards.

The production database schema has no world, plot, house, resident, or
visit-permission entities. Demo domain state and 3D rendering live in separate
modules, with future account integration deliberately deferred.

**Current demo cast:** the player and arrived neighbors use the shared original
R1 rig with resident-specific colors. This fictional, locally saved cast is
not an account-backed resident system. The earlier Pip/Sol previews are art
history, not the current companion's identity or approval of the archived
Blender environment. Its controls are recorded in the separate local
prototype's `docs/demo.md`, not a route or guide included here.

**Reference-led art study:** `/demo/study` reviews a new original Pip, four
animation clips, and a furnished nook against `design.json`. It is separate
from progression and from the current settlement renderer; richer materials,
cast-wide refinement, and environment integration remain review-gated.

**Open narrative decision:** a continuing R1 caretaker/host who helps make a
home from the player's journeys is a candidate, not approved canon. How that
starter relates to the already-approved game-linked resident model, what it
remembers, and how interaction works remain to be decided. This documentation
does not authorize AI, monitoring, a new reward economy, or social implementation.

## Brand Commitments

Keep the Just Play name and the relationship between real play and lasting
personal memories. The owner's reference is
[Yukagecho](https://anime.yukagecho.workers.dev/), especially its player movement,
connected spaces, style, and art direction.

The reference is inspiration for study, not permission to reuse its code, art,
or game-character assets.

The promise is more presence and enjoyment in the chosen game, not more time
inside Just Play. A lasting home should recognize that life, not make the
player feel they owe it attention.

## Evidence on Hand

- October 18 real-play discovery: the owner endorsed simple and metaphorical
  viewers, described the companion/community vision, and reported not checking
  their phone during one organic gaming episode. This is early qualitative
  feedback, not measured phone use, a baseline comparison, proof of faster
  completion, or evidence of treating addiction.
- Separate local Canopy art archive, `docs/canopy-art/README.md` at original
  source `6a4370096092c9225578c3462a06d66b854ab133`: September 12 representative
  Blender slice, original brief, current scope, portable source, and verification.
  Archived September 26; technically complete, visual approval pending, and
  separate from application integration or approval of a full settlement.
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
3. Exploration, personal ownership, and resident presence give the optional
   world meaning; they never replace playing the chosen game as the core job.
4. Separate current functionality, confirmed ambition, and unapproved proposals
   in every downstream design document.
5. Arrived characters share the plaza regardless of home or tier. Unfinished
   games must not create punishment, decay, or a visibly inferior neighborhood.
6. A tier measures engagement, not the dignity or permanence of a resident.
   Higher tiers enrich contributions; they do not make earlier arrivals provisional.
7. Support healthy stopping, returning, and setting games aside. No guilt,
   decay, expiring rewards, or play-longer pressure to keep a companion happy.
8. Judge success by presence, enjoyment, meaningful progress, and less unwanted
   checking, not app dwell time, message volume, or maximum gaming hours.
9. Keep context honest and community voluntary. Never solve doomscrolling by
   building another feed or an attention-demanding relationship.
