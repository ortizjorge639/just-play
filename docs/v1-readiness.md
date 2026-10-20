# v1 readiness

Status after two independent audit rounds (separate model, read-only).
Auditor confidence, not a test count: **full spec 35%, narrowed release 70%**.
Narrowed release = session tracker plus neutral StandBy/Canopy preview, no residents.
Target was 95%. It is not reached.

## Done on this branch

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
| Next.js | Server Actions denial-of-service advisory (GHSA-p3m5-59mp-jv5r). Upgrade to 16.4.1 or later. It was not on the reachable registry; do not ship a canary. |
| Environments | Owner-confirmed separate preview and production databases. |
| Test account | Retire the old test user and any old deployment that still has the login. |
| Anonymous sign-ins | Decide the policy, then enforce it in Supabase and the app. |
| Catalog insert policy | Migration 013 still lets any signed-in user insert games directly. Replace it with a server-only insert. Owner applies. |
| Account recovery (C) | Run it on the approved origin, or record the precise blocker. |

## Done since the last audit (not yet re-audited)

- Active-session totals are derived from finished session rows, not the stored counters. The stored counters and migration 020 are unchanged.
- Failed reads of the current game, history and stats raise an error, and `app/error.tsx` shows a retry screen instead of an empty app.
- Recommendation cards take keyboard input: Enter or Up to play, Down to skip, I for details.

## Still blocking (code)

1. The Game screen still reads the stored progress counters, which stay wrong until migration 020 is corrected.
2. Quick filter save failures are not handled.
3. First run is a slideshow, and discovery returns up to 10 games with repeat packs. The spec wants an action-based start and 1-3 picks.

## Not in the narrowed release

Residents, stamps, name card, emotes and home view (spec stories 3-6). Spec story 7 is partly open.
