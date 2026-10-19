# Just Play: focused delivery handoff

**Branch:** `standby-canopy-handoff`

**Packaging scope:** one ready code-and-plan baseline; no agent is started.

**Immediate mission:** finish delivering the existing quiet companion, not
build the entire future world.

## Product goal

Help someone choose a real game, stay present with it, enjoy the experience,
and build a completed repertoire, brick by brick. A phone or second monitor
can offer company instead of competing content. Just Play succeeds when the
player can leave it alone, not when they spend more time interacting with it.

Both Artwork and Canopy are valid optional viewers. No companion chores,
neglect penalties, expiring rewards, infinite feed, or pressure to rush games.
See [PRODUCT.md](../PRODUCT.md) for the canonical direction and
[the world study](treehouse-world-study.md) for accepted stamp/resident rules
and historical context. This plan is the delivery entry point, not a competing
product specification.

## What this branch actually contains

| Area | State at preparation |
| --- | --- |
| StandBy foundation | Accepted source `b19bf481099f8593aca53e7f703eaad2e3dd5a9f`, [PR #2](https://github.com/ortizjorge639/just-play/pull/2) targeting main; open and unmerged. |
| Combined Canopy | Accepted source `d19672df239ba020fae728fa3245ebd8d3162812`, [PR #3](https://github.com/ortizjorge639/just-play/pull/3) targeting the foundation; open and unmerged. This source already includes b19. |
| This handoff | A documentation-only descendant of d196. Application code, tests, assets, SQL and dependency manifests are unchanged. |
| Live schema | Required migration 020 was separately authorized, applied once and independently catalog-verified. It must not be reapplied to the shared project. |
| Current R1 | Neutral starter using Idle in one fixed furnished room; not an earned resident, game personification, chat agent or observer of another screen. |
| World/art prototype | Separate original source `6a4370096092c9225578c3462a06d66b854ab133`; not merged into this runtime. The full historical study is retained as documentation only. |
| New backlog metrics | Approved definitions, not implemented flow analytics. |
| Permanent home/memories and community | Future direction, not delivered account-backed features. |

The previous documentation edits on the overview/art branch are preserved.
This branch ports that agreement without importing its experimental application
or demo implementation. Historical prototype paths identify the original
locally retained source; a GitHub lookup of 6a was unavailable at packaging.
This branch does not publish that archive or advertise its routes. All
required current product rules and the accepted runtime are included here.

## How to pick up the work

1. Read this plan and PRODUCT.md. Resolve and record the current handoff commit,
   then confirm it descends from exact d196 and inspect any later changes.
2. Choose one authorized task below. Create a task-specific worktree/branch
   from this handoff baseline using the app's normal workspace controls.
   Do not have multiple agents write to this baseline or an existing owner's
   worktree. Keep one owner per task and reuse existing PR owners when suitable.
3. Record the objective, owner, prerequisite status, approved environment/data,
   expected result and evidence location before execution. Reading this plan
   is not authorization for live writes, account changes or release.
4. At handoff, report `passed`, `failed`, `blocked`, or `not attempted` for each
   acceptance item, with the exact source and environment actually exercised.
   Do not substitute a reassuring summary or a green build for missing evidence.

No automation, workflow, agent, new application route, or test account is
installed or launched by this plan.

## Immediate workstreams

All execution owners are **unassigned**. No workstream is running.

| ID | Bounded objective | Prerequisite / authority needed | Done means | Initial state |
| --- | --- | --- | --- | --- |
| A: saved-record trust | Prove notes and session/game finalization through the real application/backend, including explicit uncertainty and recovery from a lost response. Preserve pause/resume and recording opt-out. | Approved fixture account/data and scoped permission for those mutations; source/environment identified. Do not use personal history as a stress fixture. | An independent fresh read matches the intended saved record; no false saved/finished claim, lost final note or duplicate completion reward. Session finish and game completion remain distinct. | Not started. |
| B: real phone + desktop | Exercise the same approved session on physical devices: reload, return from background/sleep, cross-device observation, portrait/landscape, both viewers and usable recovery. | A's approved fixture and known saved-record path. Device access and permission for any focus-dependent interaction. | The saved record agrees across devices; remote end is recognized; unsupported/denied fullscreen or wake-lock has an honest usable fallback; no claimed native always-on behavior. | Not started; follows A. |
| C: account recovery | Complete the real sign-in/recovery journey using a specifically approved origin and designated account. | Separate permission to send recovery mail/use the account. The user performs credential entry; do not extract passwords, cookies, codes or tokens. | Fresh-link/same-browser PKCE flow works or a specific reproducible blocker is documented, without widening redirect allowlists or bypassing protection. | Not started. |
| D: simultaneous database changes | Exercise actual concurrent connections and inspect final rows/lock outcomes for the existing invariants. | An approved disposable real PostgreSQL environment. No shared-production stress testing or installation assumed. | Barrier-controlled, two-connection evidence covers the relevant orderings and final invariants. Serialized PGlite or mocked requests are not reported as this result. | Not started; environment required. |
| E: release coordination | Reconcile A-D and prepare dependency-ordered release of the existing companion. | A-D complete, or an explicit user decision on an unresolved gate with correspondingly narrower claims, never a fabricated pass; fresh PR/base review and explicit release authorization. | Foundation lands before Canopy, the latter's base/diff is rechecked, and the resulting deployment is verified before calling it released. Without approval, stop at a ready-to-release report. | Not started; follows A-D and approval. |

C and D can be independent of A. B follows A; E follows the applicable gates.
Any parallel work must use isolated fixtures/environments and clear ownership.
Do not run multiple writers against one personal account or share a foreground
device without coordination.

This is not a requirement for the user to perform a prescribed gaming routine.
Controlled technical checks belong to the implementation owner. Organic play
and optional feedback supply a different kind of evidence.

## Evidence already available, and its limits

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Fresh d196 browser matrix | 312/312 cases, 104 each Chromium/WebKit/Firefox; one worker, no retries/skips/flaky cases; original assertions, clocks and deadlines. All traces and source-bound histories retained. | Browser actions were mocked. This is not live Supabase, physical-device, concurrent-connection, or usefulness proof. It was not rerun for this documentation-only branch. |
| Reviewed reliability fixes | Atomic final-draft handling; truthful note acknowledgement; pending/failed draft survival across in-app remounts; clean authoritative-note adoption; lifecycle reads continue during held note responses. | In-memory drafts do not survive browser/process failure by promise. There is no universal latest-human-intention guarantee or instant synchronization. |
| Migration 020 application | Canonical 13,642 Git bytes; SHA-256 `e87bdbf448d0d3039281e6c6cb7d2b77fa12a075791df40ca5d23ac7824c5bbf`. Fresh catalog check confirmed 12 exact routines, seven restricted RPCs and ten enabled triggers; original definitions/ACLs, RLS/policies and indexes preserved. | No personal application-row mutation or mutation-RPC smoke test was performed by that catalog verification. |
| Organic play feedback | The owner endorsed viewer choice, described a sense of potential companionship and reported not checking the phone during one episode. | Not measured phone use, a controlled baseline, sustained benefit, faster completion or addiction-treatment evidence. |

Earlier failed/interrupted runs and the separate Firefox follow-up remain
qualified historical receipts. The fresh full pass does not rewrite them or
explain every prior failure. No Windows power settings were changed.

The raw packets are retained outside Git by the existing owners/coordinator:
`canopy-d196-uninterrupted`, `020-live-application`, earlier diagnostic packets,
and source/interaction review receipts. Current PR descriptions summarize the
head-bound evidence. Large traces, private browser captures, account data and
credentials are not included in this branch. If a packet is unavailable on a
new machine, say so and request its scoped transfer; do not invent a new audit.

The [README](../README.md) contains the detailed session/deployment contract.
The [Canopy contract](canopy-nook.md) separates current and historical status.
Existing production builds skip type validation; the documented baseline
cookie-type errors are not resolved by this documentation package.

## Database and environment guardrails

- At the recorded checkpoint, Vercel preview and production environments shared
  one Supabase project. A preview URL is not an isolated test database. Confirm
  the actual project/environment mapping before any approved mutations.
- The shared project's 018/019/020 installation is already complete.
  Do not execute migration scripts merely because an older checkpoint says
  unapplied. The actual shared-project application is a separate operational
  fact from the immutable source commit.
- A different database needs a fresh catalog assessment and separate
  authorization. Do not create a replacement environment or alter production
  permissions, auth settings, redirect origins or protection silently.
- Keep the approved callback origin distinct from the unique build URL.
  A successful preview build does not automatically allow password recovery
  there. The app's authenticated startup can perform profile/XP bookkeeping;
  do not promise that every visit is read-only.
- Do not reload or alter an active personal game just to inspect the UI.
  Ask for required permissions/access rather than looping through login or
  using Quick Play, signup, test modes or a new public bypass.

## Definition of done and stop conditions

For the immediate mission, the player can use either quiet viewer in the
ordinary released app and trust their saved notes and game/session record on
phone and desktop. That requires E's release approval and deployment outcome;
a preview, catalog check or prepared branch alone is not that result.

For each task:

- State the exact expected result and smallest observation that can refute it.
  Reuse prior evidence only when the relevant source is unchanged.
- Add or run the smallest checks that close the named gap. Do not repeat full
  matrices, extend deadlines, add retries, drop assertions or change runtime
  speculatively to manufacture green.
- On failure, retain the raw result and identify a bounded, evidence-backed
  correction. Do not launch an open-ended retry fleet or publish acceptance
  for a different source.
- If permissions, device access, environment or a required receipt are missing,
  mark the task blocked and state exactly what is needed. Do not quietly
  replace a live check with a mock or ask the user to supervise an idle app.
- Do not edit PR #2/#3 branches, bodies, stack relationships, auto-merge or
  deployment settings as part of this packaging. Later source/release changes
  require their own explicit assignment and coordination.

## Later milestones: proposed, not authorized execution

| Milestone | Concrete outcome | Boundaries |
| --- | --- | --- |
| F: healthy repertoire | Account-backed queued, in-progress and completed records, with optional completion pace and net unfinished-backlog change. | Queued plus in-progress is unfinished inventory. Starting a game does not clear it; setting it aside is not completion. Keep additions/returns, removals, replays and corrections visible. Missing history is not zero. No quotas or ranking by hours. |
| G: one lasting Canopy moment | One player-confirmed chosen stamp earns one permanent original resident/contribution and optional memory, visible across devices. | Preserve permanent arrival and later enrichment of that same game's contribution. Arrival, game completion and session finish are different. Do not infer a stamp from idling or chatting. |
| H: personality and eventual community | Truthful voluntary company and, later, deliberate private-first visits or co-presence. | R1-as-continuing-host is a proposal, not accepted canon. Resolve role/context/memory first; no silent screen monitoring, invented gameplay, unwanted spoilers or endless feed. |

F then G is the proposed product sequence, not a claim that either is already
built or permission to begin both. Personality, AI, social systems, a new
economy, full settlement construction and storefront/library integrations
are not part of the immediate delivery assignment.

## Completion receipt template

```text
Task ID and owner:
Objective and dependencies:
Source commit and actual environment:
Approved data/actions:
Expected result:
Observed result: passed / failed / blocked / not attempted
Evidence location and scope:
Source changes, if any:
Remaining uncertainty / permission needed:
Release state: not released / ready for approval / approved and verified live
```
