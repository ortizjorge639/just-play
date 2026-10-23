# v1 readiness

Status after two independent audit rounds (separate model, read-only).
Auditor confidence, not a test count: **full spec 35%, narrowed release 70%**.
Narrowed release = session tracker plus neutral StandBy/Canopy preview. Residents, Home and stamps are separate slices, not part of the audited release.
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

## Residents (shipped, owner applied 023)

Design: [residents-proposal.md](residents-proposal.md). The old first slice in `spec-stories-3-6.md` is superseded.

- Migration 023 adds `residents` and `postcards`, written only by database triggers. Applied.
- The keyboard and accessibility pass on the residents surfaces is done.

## Home (shipped)

Design: [home-view-proposal.md](home-view-proposal.md). A Home tab shows who lives here, the game on the way (the current game, until it has a resident) and keepsakes. Residents and keepsakes moved out of Progress. No migration.

## Stamps (shipped)

Design: [stamps-proposal.md](stamps-proposal.md).

- Migration 024 adds `stamp_rules`, `stamp_proofs`, `confirm_stamp` and `set_stamp_rule`. **The owner must apply it** (`scripts/024_stamps.sql`). It is additive and safe to re-run. The UI needs it live.
- Settings sets the default rule; the game screen sets a rule for one game and shows "Let it move in" once the rule is met. The player always confirms.
- Not yet checked against the live tables. After applying 024, set a rule on production and confirm it saves.
- Still open: a contrast pass on the new controls, and merit tiers (waiting on the settlement art).

## Name card (shipped)

- Migration 025 (applied) adds `name_cards` and `save_name_card`. The card sits in the Progress header and is edited from Progress or Settings ([name-card-proposal.md](name-card-proposal.md)).
- Migration 026 (applied) stops a direct `display_name` write from the client. Migration 028 (applied, smoke tested: XP still moves) locks `total_xp` and `level` the same way, keyed on the transaction flag the standby functions already set. No function rework was needed. See `docs/xp-lock-proposal.md`.
- Still open: a contrast pass on the card and form.

## Emotes (shipped)

- Migration 027 (applied) adds `resident_emotes` and `record_emote`. Each resident on Home has a "Say hi" menu with four emotes; only the last one is kept ([emotes-proposal.md](emotes-proposal.md)).
- The four lines per emote live in `lib/emotes.ts` and were approved by the owner.
- Still open: a contrast pass on the menu.

## Settlement (logic built, first view shipped)

- `lib/settlement/` holds a kit of parts picked from game genres, an append-only layout (six residents per deck), and the shape a view accepts. No migration. Design: [settlement-logic-proposal.md](settlement-logic-proposal.md).
- Home has a List / Settlement toggle. Settlement draws the approved Blender deck once per layout deck, with the approved ember and tinted stand-ins for parts without art. If WebGL or the art fails, a 2D deck map shows instead. Read-only, no migration. Plan: [settlement-slice-2-plan.md](settlement-slice-2-plan.md) (option A).
- The view pans (drag or arrow keys) and zooms (scroll, pinch, plus and minus, 0 resets). Each child deck is turned so its bridge meets the deck it hangs from, with planks across the gap.
- Part picks are frozen: a part has an `availableFrom` date and is only offered to residents who arrived after it, so growing the catalogue never changes an existing home. Only append parts, with a later date.
- Not yet: tapping a home, more parts, merit tiers, player placement.
- Nothing in the app calls it yet. A read-only decks summary on Home and a 3D view are both separate, unstarted items.
- Anything that imports residents must not backdate `arrived_at`, or it would move existing homes.

## Still to build

Nothing from stories 3-6. Merit tiers wait on the settlement art ([what that means](settlement-art.md)).

## Not in the narrowed release

Story 7 is undefined. [v1-spec.md](v1-spec.md) rebuilds what the repo supports, lists the candidates, and has the questions for the owner.
