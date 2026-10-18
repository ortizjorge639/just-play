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

### Deployment and verification

Apply `scripts/018_standby.sql` **before deploying this application version**, after
the preceding numbered migrations. It adds account preferences and immutable
session recording flags, authenticated mutation RPCs, and timing/XP invariants.
New atomic XP awards are transaction-locally gated to the new RPC path, so applying
the migration does not add a second award to old clients' direct writes. Review
and apply it through the normal Supabase migration process; the app does not
automatically migrate a shared database. Deploy the migration and app together
before permitting multi-device testing.

For a database that already received migration 018, apply
`scripts/019_restrict_standby_rpc_execute.sql` separately after authorization;
do not rerun the entire feature migration just to correct permissions. New
installations should apply both migrations in order. The correction explicitly
revokes the four RPCs' anonymous-role execution grants, which Supabase default
privileges can grant separately from `PUBLIC`, while retaining authenticated
execution and the RPCs' `auth.uid()` checks. Verify that `anon` does not inherit
execution through another granted role; removing unrelated role memberships or
permissions requires separate review. An unexpected execute grant alone does not
demonstrate an anonymous mutation.

```bash
pnpm exec tsx --test lib/session-time.test.ts
node --test scripts/standby-actions.test.mjs
npx --yes --package=@electric-sql/pglite@0.5.10 -- node --test scripts/standby-migration.test.mjs
pnpm exec playwright install chromium firefox webkit
pnpm test:standby
```

Browser tests run the real companion/session components and reconciliation hook in
an isolated local harness, with mocked Server Actions, artwork, fullscreen and
wake-lock capabilities. They cover keyboard/focus, portrait/landscape/tablet/desktop
layouts, reduced motion, independent settings, reminders without auto-pause,
pause/resume/finish, remote end, reconnect and errors. They do not establish real
two-device Supabase behavior, physical iOS/Android wake behavior, or that people
actually scroll less or play more. Those are separate release checks and usability
outcomes, not claims inferred from passing technical tests.

The Server Action suite uses mocked Supabase responses to verify request guards
and authoritative results. The optional pinned PGlite command runs the actual
migration against an isolated PostgreSQL engine, including RLS, recording,
transactional XP rollback and stale-snapshot/finish regressions. Its serialized
statements do not establish real multi-connection lock contention. Game-progress
updates after session finalization are separate guarded statements, not a single
cross-entity transaction.
Legacy clients keep their original concurrency limitations. After an account has
created an unrecorded session, ungated old-client XP writes are rejected, including
delayed writes after that session ends, rather than leaking duration XP. Reload/
update old clients before using recording opt-out. The new RPC path's atomicity
does not make all overlapping legacy manual-write sequences idempotent.

---

*Built by [@jojiguy639](https://x.com/jojiguy639)*
