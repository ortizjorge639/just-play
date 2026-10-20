# v1 readiness

Status after two independent audit rounds (separate model, read-only).
Auditor confidence, not a test count: **full spec 35%, narrowed release 70%**.
Narrowed release = session tracker plus neutral StandBy/Canopy preview, no residents.
Target was 95%. It is not reached.

## Done in the v1 hardening work

- Removed the hardcoded test login and its public button.
- Type errors fixed; the build checks types again.
- `npm run lint` passes with `--max-warnings 0`.
- Game metadata for searched games now comes from IGDB on the server, not from the caller.
- Zoom allowed; reduced motion skips the XP particles.
- Copy rewritten in several places to plain voice.
- Fullscreen status shows beside the controls; Add to Home Screen hint.
- Owner dogfooding: A and B passed on the PR #3 preview, PR #2 regression passed. C deferred.

## Still blocking (cannot be closed from this branch)

| Gate | Needed |
| --- | --- |
| Environments | One Supabase project serves preview and production (accepted for v1). A separate preview project is optional later. |
| Anonymous sign-ins | Allowed for people who want to stay anonymous. Enforcement in Supabase and the app is not written down yet. |
| Account recovery (C) | Deferred by the owner. Run it on the approved origin, or record the precise blocker. |

## Done since the last audit (not yet re-audited)

- Active-session totals are derived from finished session rows, not the stored counters. The stored counters and migration 020 are unchanged.
- Failed reads of the current game, history and stats raise an error, and `app/error.tsx` shows a retry screen instead of an empty app.
- Recommendation cards take keyboard input: Enter or Up to play, Down to skip, I for details.

## Closed since

- PR #4 merged to main. Game search works in production (IGDB variables set in Vercel).
- Test account `test@justplay.dev` deleted from Supabase Auth.
- `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel, and `scripts/021_close_games_insert_policy.sql` is applied. Search-add still works with the open insert policy gone.
- Next.js upgraded to 16.4.2, which patches GHSA-p3m5-59mp-jv5r. Lint rules from the newer config were satisfied.
- A pack holds 3 games. The deck no longer scrolls through 10.
- One Supabase project serves preview and production. That works. Preview writes land in live data, so use test accounts and clear them, or add a second project later.

## Still blocking (code)

1. The Game screen still reads the stored progress counters, which stay wrong until migration 020 is corrected.
2. Quick filter save failures are not handled.
3. First run is still a slideshow. The spec wants an action-based start.

## Not in the narrowed release

Residents, stamps, name card, emotes and home view (spec stories 3-6). Spec story 7 is partly open.
