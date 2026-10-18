# Just Play

> *You don't track games. You collect proof that you showed up.*

Just Play is a game tracker built around a simple idea: every game you finish becomes a permanent part of your world. Not a spreadsheet. Not a list. A treehouse full of characters that grew from every hour you put in.

---

## What it does

- **Backlog** — your queue. Add games, keep the pile honest.
- **In Progress** — one game at a time. Track sessions, set goals, stay in it.
- **Completed** — every finished game becomes a character in your treehouse. They live there.

---

## Stack

- [Next.js 16](https://nextjs.org/) + React 19 + TypeScript
- [Supabase](https://supabase.com/) — auth + database
- [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4
- [Framer Motion](https://www.framer.com/motion/) — animations
- [IGDB](https://www.igdb.com/api) — game metadata

---

## Status

**v2 in progress** — full redesign. Building in public.

Follow the build → [@jojiguy639](https://x.com/jojiguy639)

---

## Running locally

```bash
pnpm install
pnpm dev
```

Requires a `.env.local` with Supabase and IGDB credentials.

### Password recovery

Request recovery from the app origin and browser where you will finish it. Reset
links return to that initiating origin, not a potentially stale canonical
`NEXT_PUBLIC_SITE_URL`. Public origins must use HTTPS and exactly match the
configured site origin or Vercel's server-provided `VERCEL_BRANCH_URL`,
`VERCEL_URL` or `VERCEL_PROJECT_PRODUCTION_URL`; only local development permits
loopback origins. Missing or mismatched origin/host configuration fails explicitly
before sending email. This is not a wildcard trust rule for other Vercel apps.

Supabase must allow the exact initiating origin's `/auth/callback` and
`/auth/callback?next=/auth/update-password` URLs (literal slashes in `next`).
Trusting a deployment host in application code does not add it to Supabase's
redirect allowlist. Use the approved branch preview URL, not an unlisted unique
deployment URL. Callback destinations are limited to home and password recovery.
Normal signup redirect configuration is unchanged.

After a new deployment or redirect configuration change, request a **fresh**
email. Open its newest link in the **same browser** that requested it, not another
device or an email app's embedded browser: PKCE requires that browser's verifier
cookie. Callback failures provide fresh-link guidance without exposing codes or
provider diagnostics. These checks never change a password automatically.

`node --test scripts/auth-recovery.test.mjs` exercises the actual recovery action,
callback and guidance pages with mocked Next/Supabase boundaries. It sends no
emails and does not prove successful personal recovery, cookie handling on real
devices, or deployment-access readiness.

---

## StandBy companion

Start or resume a session, then choose **Enter StandBy**. The full-window companion
shows the game's artwork, name, optional elapsed clock and session goal, without
discovery navigation or reward popups. Pause, resume and finish use the same session
as the normal screen. Exit StandBy (or press Escape) to return; exiting does not
pause or end play. This is a browser view, not native Apple StandBy or game telemetry.

**Time & StandBy preferences** are available before and during a session and in
Settings. They are saved to the account separately from discovery filters:

- Recording is captured when a session is **created**, including lock-in. Changes
  apply to the next session, not the current one. Existing sessions remain recorded.
  Unrecorded sessions save no played duration and earn no duration XP; session
  completion, game-completion rewards and lifecycle timestamps can still remain.
- Clock visibility is independent: hiding it never disables recording. Unrecorded
  sessions do not show an elapsed clock.
- StandBy break reminders default off. When enabled, a quiet reminder appears
  after one recorded hour; it never pauses play or asks for an answer. The existing
  normal-screen long-session prompts and their auto-pause behavior remain outside
  StandBy.
- Keep-awake defaults off and is best effort, with explicit active, released,
  denied and unavailable states. It only applies while StandBy is visible. It cannot
  keep a locked device or background tab awake. Fullscreen is a separate explicit
  button; denied or unsupported fullscreen leaves full-window mode usable.

Visible session state is checked every 20 seconds, and again on focus, return to
the tab or reconnect. Controls are blocked during return verification and after
offline, timeout or fetch errors. A remote end closes StandBy. This is bounded
polling, not instant live synchronization; account preference persistence is not
live preference synchronization. No mutations are queued offline.

Session notes autosave with acknowledged responses ordered. Local **Done for Today**, StandBy finish,
**I Beat This Game!** and **Abandon Game** first await any older note write and the
latest pre-finish draft. Editing is disabled while ending; a failed note save
blocks finalization and keeps the draft and error visible for retry. Every failed
response makes the write uncertain: even reverting to the previous saved value
requires an acknowledged overwrite. A later acknowledgement does not prove that
the failed request cannot still execute. With migration 020, ending atomically
saves the current final draft and finishes the session; an older request either
executes before that boundary and is overwritten, or reaches an immutable finished
session and is rejected. The client queue alone does not establish server execution
order after a lost response. Drafts, acknowledged values, pending writes and errors
live together in the AppShell's in-memory notes queue, so Progress/back can remount
the editor without treating optimistic text as saved or dropping its error. This
does not persist drafts across browser reloads or sign-out. Leaving the screen or closing the browser is
not an awaited save guarantee; navigation cleanup is only best effort, not
offline synchronization or a promise to recover drafts after a remote finish.

### Deployment and verification

Apply `scripts/018_standby.sql`, `scripts/019_restrict_standby_rpc_execute.sql` and
`scripts/020_atomic_standby_game_completion.sql` in order after the preceding
numbered migrations, with separate authorization for the target database.
Migration 018 adds account preferences and immutable session recording flags,
authenticated mutation RPCs, and timing/XP invariants.
New atomic XP awards are transaction-locally gated to the new RPC path, so applying
the migration does not add a second award to old clients' direct writes. Review
and apply it through the normal Supabase migration process; the app does not
automatically migrate a shared database. Deploy the migration and app together
before claiming the complete new flow is ready for multi-device testing.

For a database that already received migration 018, apply
`scripts/019_restrict_standby_rpc_execute.sql` separately after authorization;
do not rerun the entire feature migration just to correct permissions. New
installations should apply all three migrations in order. The correction explicitly
revokes the four RPCs' anonymous-role execution grants, which Supabase default
privileges can grant separately from `PUBLIC`, while retaining authenticated
execution and the RPCs' `auth.uid()` checks. Verify that `anon` does not inherit
execution through another granted role; removing unrelated role memberships or
permissions requires separate review. An unexpected execute grant alone does not
demonstrate an anonymous mutation.

Migration 020 adds `create_standby_session_with_progress(text,integer)`,
`complete_standby_game(text,text,jsonb,text)` and
`finish_standby_session_with_notes(uuid,jsonb,jsonb,text)`. Creation with start XP commits session,
progress bookkeeping, date and XP together; the existing zero-start-XP path
retains session-only behavior. Completion asserts the displayed session (or
explicit absence), finalizes it, and changes game progress/XP in one transaction.
An undefined session-selection argument explicitly selects the latest same-game
session. Completion's optional final-notes argument preserves notes when omitted
or null; an explicit empty string clears them. The dedicated finish RPC writes
the final draft and invokes the existing 018 transition in one transaction; a
stale snapshot rolls back both notes and lifecycle/XP changes.
Account locks are shared with direct/legacy writers before row locks; writes
require READ COMMITTED. Deadlocks/errors propagate without automatic replay.

020 preserves the four existing RPC definitions/grants and safe main-style
creation, bookkeeping and completion flows. It rejects a terminal progress
write while a same-game session is active, rather than banning all old writes
or requiring a global production cutover. Old multi-request flows still are not
atomic: they cannot carry a displayed snapshot across requests, and old manual
XP writes retain their concurrency limitations. The 018 untracked-history XP
barrier still applies. New-RPC guarantees do not retrofit those old callers.

**Without 020**, this version's creation and every finish/beaten/abandon action fail visibly
before session/progress writes, with migration/schema-cache guidance and no
old-RPC fallback. Reads, existing-session pause/resume, notes, preferences and
presentation/StandBy exit remain available with 018/019. Ordinary finish always
requires the 020 atomic final-draft RPC, even with a clean draft, after a tab remount,
or when the caller omits final notes. A matching server read or a client uncertainty
flag cannot prove that another context's older write will not execute before a
separate legacy finish. Missing 020 retains the editable draft and active status;
there is no new-caller legacy finish fallback. Existing main/018 callers are not
globally disabled or rewritten. A rebuilt
preview is therefore **not full-dogfood-ready** merely because it compiles.
020 has not been applied by this code change; never rerun 018/019 as its upgrade.

020 installs under a short `SHARE ROW EXCLUSIVE ... NOWAIT` table lock: ordinary
readers remain allowed, while busy writers fail the migration rather than waiting
with a partially acquired lock set. On failure, roll back and retry the whole
migration after review; do not apply fragments. No production merge/deploy,
all-environments maintenance or live schema application is implied. Review the
catalog-only `approval020SQL` bundle in `scripts/standby-migration.test.mjs`
before/after an authorized application: five new routines absent/present,
seven RPCs with authenticated execution and no effective anon/PUBLIC execution,
six new enabled statement/row triggers, existing RLS/policies/unique indexes
and original RPC definitions/grants unchanged.

```bash
pnpm exec tsx --test lib/session-time.test.ts
node --test scripts/standby-actions.test.mjs
npx --yes --package=@electric-sql/pglite@0.5.10 -- node --test scripts/standby-migration.test.mjs
npx --yes --package=@electric-sql/pglite@0.5.10 -- node --test scripts/standby-interruption.test.mjs
pnpm exec playwright install chromium firefox webkit
pnpm test:standby
```

Browser tests run the real companion/session components and reconciliation hook in
an isolated local harness, with mocked Server Actions, artwork, fullscreen and
wake-lock capabilities. They cover keyboard/focus, portrait/landscape/tablet/desktop
layouts, reduced motion, independent settings, reminders without auto-pause,
pause/resume/finish, ordered acknowledgements, commit-then-lost-response recovery,
late execution around the final-draft boundary and failure-blocked finalization,
actual AppShell Progress/back remounts (including pending/failed save truth),
remote end, reconnect and errors. Pointer tests wait for completed layout/sheet
animations, not arbitrary delays or keyboard substitution. Set `STANDBY_TEST_PORT` to an unused port if a
different harness is already running. They do not establish real
two-device Supabase behavior, physical iOS/Android wake behavior, or that people
actually scroll less or play more. Those are separate release checks and usability
outcomes, not claims inferred from passing technical tests.

The Server Action suite uses mocked Supabase responses to verify request guards
and authoritative results. The optional pinned PGlite command runs the actual
migrations against an isolated PostgreSQL engine, including RLS, recording,
transactional XP rollback, committed post-read replacement/absence races,
new-code/018-019 missing-function safety and old-main/020 compatibility. Its serialized
statements do not establish real multi-connection lock contention. Game-progress
updates in the new completion RPC are in the same transaction as finalization.
The interruption suite executes the actual action source against real isolated
PostgreSQL rows through a scripted request/response adapter. Its negative control
pins unsafe `09bda0541852efd88a03d2224d2897f308280741`: a clean matching read,
external note commit, missing 020 and legacy fallback finish violate the required
final-draft invariant. Corrected source rejects instead. With 020, it checks
execution before/after finalization, stale rollback and a terminal commit whose
response is lost: a fresh-context retry/reconciliation must preserve one finished
record, its final notes and one XP award. JSON diagnostics identify source SHA/blob,
oracle type, operation/attempt/context IDs and causal barrier sequence, not
cross-device clock order. Server commit, ACK/error/unknown and caller outcome are
distinct. Browser receipts are mocked-action observations, not database commits.
No production telemetry is added. An available disposable two-connection
PostgreSQL service is a separate release gate; serialized PGlite is not that proof.
Legacy clients keep their original concurrency limitations. After an account has
created an unrecorded session, ungated old-client XP writes are rejected, including
delayed writes after that session ends, rather than leaking duration XP. Reload/
update old clients before using recording opt-out. The new RPC path's atomicity
does not make all overlapping legacy manual-write sequences idempotent.

---

*Built by [@jojiguy639](https://x.com/jojiguy639)*
