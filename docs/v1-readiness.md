# v1 readiness

Status after two independent audit rounds (separate model, read-only).
Auditor confidence, not a test count: **full spec 35%, narrowed release 70%**.
Narrowed release = session tracker plus neutral StandBy/Canopy preview. Residents are a separate first slice, not part of the audited release.
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

## Code blockers: closed

1. Game screen counters: migration 022 corrects the stored `game_progress` counters (applied by the owner).
2. Quick filter save failures now show plain-voice feedback.
3. First run is action-based, and the old slideshow route is gone.

## Residents (first slice, in review)

Design: [residents-proposal.md](residents-proposal.md). The old first slice in `spec-stories-3-6.md` is superseded.

- Migration 023 adds `residents` and `postcards`, written only by database triggers. **The owner must apply it** (`scripts/023_residents_and_postcards.sql`). It is additive and safe to re-run.
- The app treats missing tables as empty lists, so code can ship before the migration, but residents only appear once it is applied.
- Still to do after the slice: a keyboard and contrast pass on the new surfaces, then stamps, name card and emotes.

## Not in the narrowed release

Residents, stamps, name card, emotes and home view (spec stories 3-6). Spec story 7 is partly open.
