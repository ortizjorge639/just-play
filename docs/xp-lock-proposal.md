# Lock `total_xp` and `level` against client writes (proposal)

Status: proposal. Nothing built. Needs the captain's go-ahead, then the owner applies one migration.

## Problem

RLS policy `users_update_own` lets a signed-in user PATCH their own `users` row. Migration 026 locked `display_name`. `total_xp` and `level` are still writable, so anyone with the anon key can give themselves any XP or level.

The only existing guard, `protect_untracked_profile_xp` (018), blocks XP *increases* only for accounts with untracked session history. It does not cover new accounts, and it does not cover decreases or `level`.

## Finding that changes the plan

I earlier said the standby RPCs would need reworking first. They don't.

- The app never writes `total_xp` or `level` directly. Every write in `app/actions.ts` goes through `create_standby_session`, `transition_standby_session`, `set_standby_game_progress` or `backfill_standby_profile_xp`.
- Those RPCs already set a transaction-local flag, `just_play.atomic_xp = 'standby_v1'`, around every XP write (018 lines 94–96, 270–274). A client cannot set that flag. `set_config` is not exposed through PostgREST.

So the lock can key off the same flag. The RPCs stay SECURITY INVOKER and unchanged.

## Proposed migration: `028_lock_xp_and_level.sql`

A BEFORE UPDATE OF `total_xp`, `level` trigger on `public.users`:

- If the new value differs from the old value, and `current_user IN ('anon','authenticated')`, and the flag is not `'standby_v1'`, raise `XP and level are set by the app, not edited directly.`
- Same-value updates pass, so a client PATCH that echoes the current numbers keeps working.
- Service role, owner and migrations pass, because they are not `anon` or `authenticated`.
- Add `SET search_path = public`.

Nothing else changes: no RPC edits, no policy edits, no app code.

## Tests (PGlite, same pattern as 026)

1. Authenticated PATCH of `total_xp` is refused.
2. Authenticated PATCH of `level` is refused.
3. Authenticated PATCH that echoes current values succeeds.
4. Full standby flow still awards XP and level: create session, finish session, beat game, backfill.
5. Anon is refused.
6. Owner role can still update.
7. `display_name` lock from 026 still holds.

Then the standard gates: lint `--max-warnings 0`, `tsc`, Playwright standby suite. The suite uses mocks, so the live check is below.

## Risks

- The flag is trusted. If a future SECURITY INVOKER function sets it carelessly, it opens the lock. Mitigation: a comment in 028 and a line in `docs/v1-readiness.md`.
- Any old client still PATCHing XP directly will start getting errors. The app code on main doesn't do this; stale browser tabs from before 018 might. Those already hit the 018 guard if they have untracked history.
- Preview and production share one Supabase project, so applying 028 is live immediately.

## Owner steps (after the build PR merges)

1. Apply `scripts/028_lock_xp_and_level.sql`.
2. Smoke test: finish a short session and confirm XP and level still move. Then confirm a direct PATCH of `total_xp` from the browser console is refused.

## Decision needed

Go ahead with 028 as described?
