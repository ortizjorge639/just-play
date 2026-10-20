# Bounded overnight results - October 19, 2026 UTC

**Not released. Local review-ready evidence only; owner gates remain pending.**

Implementation owner: Copilot, sole writer in `/home/azureuser/just-play-overnight`,
branch `work/standby-delivery-20261019`. Baseline
`bb3a289688e25a162daee14fa70dc80711bd6ade` descends from accepted
`d19672df239ba020fae728fa3245ebd8d3162812`. This receipt and tests are scoped
additions; production application code, SQL, auth, assets and lockfile are unchanged.
The exact enclosing commit is recorded in the external `RESULTS.md`; resolve it
locally with `git log -1 --format=%H -- docs/standby-overnight-results.md`.
Actual action blob remains `be27972122642dd11c55a7bd48b42a9e13205300`.

## A-E disposition

| Item | Classification | Actual evidence / remaining gate |
| --- | --- | --- |
| A: saved-record trust | blocked for full acceptance; local subset passed | Actual Server Actions against disposable PostgreSQL verify notes, pause/resume, opt-out, final empty draft, and commit-then-lost-response reconciliation for finish/beaten/abandoned. Fresh independent SQL reads agree. Transport/auth seams remain synthetic; no approved shared-account fixture or actual Next/PostgREST journey. |
| B: physical phone + desktop | blocked, not attempted physically | Owner devices and A fixture needed. Ten targeted existing Chromium UI cases passed with mocked actions; these are not physical-device/background/sleep proof. |
| C: account recovery | blocked, not attempted with an account | Existing mocked action/callback guidance checks pass. No mail sent, account used, PKCE browser credentials handled or allowlist changed. Owner must designate account/origin and enter credentials personally. |
| D: simultaneous DB changes | local PostgreSQL subset passed; full Supabase fidelity blocked | Real two-connection barriers, lock waits, final rows and rewards observed. Synthetic auth/catalog/transport limits below prevent reporting full D acceptance. |
| E: release coordination | report prepared; release blocked, not attempted | Read-only PR/base metadata checked. A-D acceptance or explicit owner narrowing, fresh review and separate release authorization still required. |

## Real concurrency evidence

`node --test scripts/standby-postgres.test.mjs` passed **28 Node test entries**
(27 child cases plus the parent). No skipped tests or retries. This harness uses
Docker and existing Node/TypeScript tooling, with no added dependencies.

Every race holds the first transaction open after its statement returns, invokes
the second connection, and requires `pg_stat_activity` to show a `Lock` wait with
the first backend in `pg_blocking_pids` before allowing the first COMMIT. It then
awaits the second outcome and reads final rows on another authenticated connection.
JSON diagnostics retain backend PIDs, barrier ordering, rejection details, rows,
profile XP, source hashes, migration hashes and environment.

Coverage includes:

- Both note-before-end and end-before-note for finish, beaten and abandoned;
  finished-note immutability and exact duration/completion reward accounting.
- Competing finishes, duplicate latest-mode completion, and both session-finish
  versus displayed game-completion orderings; stale losers cannot overwrite notes
  or gain another reward.
- Creation versus asserted absence and direct legacy terminal progress in both
  orders; no terminal game progress remains alongside a same-game active session.
- Pause versus finalization, stale full-CAS draft rollback, finalization versus
  pause, delayed legacy XP after opt-out finish, both privileged maintenance-fence
  orderings, and explicit rejection of repeatable-read writes.
- Real action-source creation, notes, pause/resume, opt-out, separate session/game
  completion, lost note response, explicit empty final notes and lost terminal
  responses. Injected errors remain errors after a real commit; a fresh context
  reconciles without fabricating rollback or duplicate completion.

No production defect was demonstrated; no speculative runtime fix was made.
The existing action-module loader was extracted unchanged into
`scripts/standby-action-fixture.mjs` for reuse by both database suites.

### Environment and limits

Docker 29.5.2; PostgreSQL **17.11**, Debian x86_64; READ COMMITTED.
Image `postgres:17`, exercised digest
`sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3`.
Each run creates its own UUID-named `--network none` container, publishes no
ports, uses container-internal loopback psql, and removes that container/volume.
No host packages or shared containers were changed.

Exact repository migrations 001, 002, 008, 009, 014, 018, 019 and 020 establish
the relevant schema, policies, indexes, routines and triggers. Migration 020
SHA-256 is `e87bdbf448d0d3039281e6c6cb7d2b77fa12a075791df40ca5d23ac7824c5bbf`.
These scripts ran **only inside the disposable container**, not the shared project.

Fixtures use an empty synthetic `auth.users(id)` table, a claim-backed
`auth.uid()`, current-role `auth.role()`, and non-superuser/NOBYPASSRLS
`authenticated` and `anon` roles. RLS is enabled from repository SQL; foreign
reads/writes and effective RPC grants are checked. Authenticated execution uses
invoker privileges, not the setup superuser. Privileged maintenance cases are
explicitly separate. Table grants mirror the existing test fixture; anonymous
default function grants are installed before migrations to exercise their revokes.

This is not the full Supabase catalog/default-role hierarchy or full migration
history. There is no Auth service, signed JWT verification, PostgREST/schema cache,
real Next HTTP action transport, PKCE-cookie journey or device test. The action
adapter executes real SQL and action code but scripts request/response boundaries;
post-commit loss is injected, not an observed network outage. Draft uncertainty
UI evidence comes from separate mocked-action browser cases, not a unified
real-backend browser run. No universal latest-human-intention or reload-draft
durability guarantee is added.

## Checks and retained failures

| Command / evidence | Exit / result |
| --- | --- |
| `node --test scripts/standby-actions.test.mjs scripts/auth-recovery.test.mjs` | 0; 47 passed |
| `node_modules/.bin/tsx --test lib/session-time.test.ts` | 0; 7 passed |
| Pinned `npx --yes --package=@electric-sql/pglite@0.5.10 -- node --test scripts/standby-migration.test.mjs scripts/standby-interruption.test.mjs` | 0; 58 passed; serialized, not D |
| New real PostgreSQL suite above | 0; 28 passed |
| Targeted existing Chromium notes/remount/reconciliation cases, one worker | 0; 10 passed, no retries |
| ESLint on the three changed/new test modules | 0 |
| `npm run lint` | 1; existing 5 errors / 3 warnings, byte-identical baseline diagnostics |
| `node_modules/.bin/tsc --noEmit` | 2; existing 10 cookie-type diagnostics, byte-identical baseline |
| `npm run build` with dummy loopback-only Supabase config | 0; existing type validation skip remains |

Existing lint failures are in booster-pack/card-deck/progress components; types
fail in `lib/supabase/proxy.ts` and `server.ts`. They were not broadened into
this mission. Build success is not clean type-check or release approval.

Initial PostgreSQL harness startup failed because the image's temporary
initialization socket was mistaken for readiness. The harness now requires the
final TCP listener; no invariant timeout/assertion/retry was relaxed. Initial
browser cases failed to launch because Chromium was missing; user-local browser
installation resolved that environment prerequisite. Both failed logs and launch
traces are retained. pnpm 11's initial install exited 1 on blocked dependency
scripts; frozen install with `--ignore-scripts` succeeded without changing the
lockfile or approving scripts. No production implementation RED/GREEN fix was
needed or claimed.

The historical 312-case browser matrix and shared 020 catalog check remain
historical, source-bound evidence. Their original raw packets were not available
here and were not re-created or relabeled.

no-mistakes was **not run/passed**: home/status resolved the original repository
rather than proving isolated-worktree confinement, and the specified Hermes
skill path was denied. The unrelated existing failed run was left untouched.
No init, active-gate response, shared settings edit or unsafe pipeline launch
was attempted. Direct checks and independent read-only review are separate.

Raw logs, failed traces, acceptance matrix, findings, command statuses and final
commit receipt are outside Git in `/home/azureuser/just-play-overnight-operation`.

## Independent-review follow-up

The independent `REVIEW.md` found no demonstrated product or blocking test
defect. Its feasible evidence gap was command-status provenance: an empty lint
log alone cannot establish success. No runtime, adapter, SQL or assertion was
changed to address a problem that was not demonstrated. In particular, the
adapter's ignored projection and simplified single-row behavior remain explicit
limits, not PostgREST fidelity evidence.

On October 19, 03:38-03:44 UTC, fresh commands exercised unchanged source
`d0afafd00bb18d816e77a89fb8c1a9f041a4c720`. Each execution log in the table contains the
source HEAD, command, UTC timestamps and explicit numeric exit status. Logs
below are relative to `/home/azureuser/just-play-overnight-operation/` and use
the prefix `review-followup-20261019-`.

| Command | Actual result | Log suffix |
| --- | --- | --- |
| `node --test scripts/standby-actions.test.mjs scripts/auth-recovery.test.mjs` | exit 0; 47 passed | `actions-auth.log` |
| `node_modules/.bin/tsx --test lib/session-time.test.ts` | exit 0; 7 passed | `time.log` |
| Pinned PGlite command from the checks table | exit 0; 58 passed; serialized only | `pglite.log` |
| `node --test scripts/standby-postgres.test.mjs` | exit 0; 27 child cases plus parent, no skips/retries | `db.log` |
| Targeted Chromium command recorded in external RESULTS.md | exit 0; 10 passed, one worker, no retries | `browser.log` |
| ESLint on the three test modules from the checks table | exit 0; no diagnostics | `eslint-specific.log` |
| `npm run lint` | exit 1; existing 5 errors / 3 warnings | `lint.log` |
| `node_modules/.bin/tsc --noEmit` | exit 2; existing 10 cookie-type errors | `types.log` |
| Dummy loopback-only build from external RESULTS.md | exit 0; type validation still skipped | `build.log` |

Fresh lint/type diagnostic lines match their baseline receipts exactly; their
nonzero exits remain failures, not approvals.

The database log includes harness/loader/action/migration hashes, actual lock
barriers, final rows, removal of its own UUID container and a subsequent
exit-0 Docker inspection with no labeled containers listed. The browser log
includes test/harness hashes; its output directory is
`review-followup-20261019-browser-artifacts/` outside Git. Historical failures
and all earlier receipts remain intact; these are new observations, not
retroactive certification of historical command exits.

`review-followup-20261019-gates-scope.log` records fresh home/status and
unchanged runtime-scope inspection. no-mistakes still resolves the original
checkout and reports only the unrelated failed run
`01KWWEW11ZGWRDQCMRFFY0ZP2S`, not an active current-branch run. Status also emits
`error: daemon shutting down` despite command exit 0; that diagnostic is
retained, not treated as pipeline success. No run, response, abort, gate
approval, configuration change or service restart was attempted. Safe pipeline
confinement remains unestablished; no-mistakes remains not run/not passed.

This closes only the feasible provenance gap. Full A, physical B, personal C,
Supabase-fidelity D and release E remain blocked as described above. The
owner must supply the existing permissions or explicitly narrow acceptance;
this follow-up grants neither.

## Owner decisions and dependency-ordered release

Read-only GitHub metadata on October 19 confirmed #2 OPEN at
`b19bf481099f8593aca53e7f703eaad2e3dd5a9f`, base `main`, and #3 OPEN at
`d19672df239ba020fae728fa3245ebd8d3162812`, base
`ortizjorge639-standby-gaming-companion`. Both were reported MERGEABLE; that is
not human review, CI/release acceptance, or a future merge guarantee.
The read-only main lookup returned
`b0ecead4e141b27749ef5327c00ca0d05d5d78b4`; recheck at release time.

1. Jorge designates an approved fixture account/data and origin, authorizes the
   specific app mutations, and decides whether local D evidence is sufficient or
   a separately authorized Supabase-fidelity disposable environment is required.
   Do not reapply shared migrations 018/019/020.
2. Complete A through the actual approved app/backend, independently reading
   saved records after lost responses. Jorge may optionally use that fixture on
   phone and desktop: either viewer, reload/return, rotate, observe remote finish,
   and confirm usable denied/unavailable fullscreen/wake-lock recovery. No
   prescribed gaming routine; organic play is not controlled technical proof.
3. For C, Jorge separately authorizes mail/account/origin use and personally
   requests and opens the newest recovery link in the same browser. Retain a
   precise origin/cookie/protection blocker if it fails; do not extract secrets,
   widen redirect lists or bypass access protection.
4. Original PR owners review these local test/docs commits and coordinate their
   integration without replacing either PR's ownership/stack. After applicable
   A-D gates or an explicit narrower owner acceptance, freshly review #2 against
   current main, obtain release authorization, and land the foundation first.
5. After foundation lands, the Canopy owner updates/reviews #3's resulting base
   and complete diff against the newly landed foundation. Re-run relevant checks
   on that exact source; a previous stacked-base MERGEABLE flag is insufficient.
   Review any conflicts or changed contracts before separate merge authorization.
6. Authorized deployer verifies the resulting deployment/source and approved
   account-backed save/recovery behavior before calling it released. Until then
   this branch remains a local review handoff, not release consent.

## Owner dogfooding record - October 19, 2026

Owner-run on the PR #3 preview (Canopy source `d19672d`), desktop and phone.
Observations are the owner's, not independently reproduced.

| Item | Result |
| --- | --- |
| A: saved-record trust | passed (sessions/saved records) |
| B: phone + desktop | passed with notes |
| C: account recovery | deferred by owner; not attempted |
| D: simultaneous DB changes | local PostgreSQL suite accepted as sufficient by owner; Supabase-fidelity run not pursued |
| E: release | not started; review #2 then #3, with separate release authorization |

B notes: iOS Safari fullscreen did not visibly react (the Fullscreen API is
unsupported there); the unavailable message now suggests Add to Home Screen.
In landscape, Safari's top bar overlaps the Canopy view (minor). No screen sleep
was noticed. Backlog: home-screen/PWA setup with clear in-app communication.
Release claims must state that account recovery (C) was not verified end to end.

### PR #2 regression pass

Owner-run on the PR #2 preview (foundation source `b19bf481099f8593aca53e7f703eaad2e3dd5a9f`,
Artwork viewer only; no Canopy expected). Entry, notes, pause/resume, recording
opt-out, lost-response reconciliation, phone + desktop, fullscreen/wake and
unattended play: **all steps passed** per the owner. Owner observation, not
independently reproduced; C remains deferred.
