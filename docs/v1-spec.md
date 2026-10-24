# v1 spec: what is on record

The original `docs/v1-spec.md` was never committed to main, and I could not find it in any branch or in history. This file rebuilds what can be backed by the repo. It does not invent the parts that were never written down. Where something is inferred, it says so.

Sources: [PRODUCT.md](../PRODUCT.md), [spec-stories-3-6.md](spec-stories-3-6.md), [v1-readiness.md](v1-readiness.md), [standby-canopy-handoff.md](standby-canopy-handoff.md).

## Stories

| # | Story | Status | Where it lives |
| --- | --- | --- | --- |
| 1 | Choose a game without scrolling: recommendations by mood, energy and time, in a swipe deck | Inferred from PRODUCT.md and the app. Shipped. No written story. | `components/card-deck.tsx`, `app/actions.ts` |
| 2 | Stay with the game: lock in, play, pause, finish, with a session history and a quiet StandBy view | Inferred from PRODUCT.md and the handoff plan. Shipped. No written story. | session state machine, [canopy-nook.md](canopy-nook.md) |
| 3 | Residents: each game becomes one permanent resident | Shipped | [residents-proposal.md](residents-proposal.md), migration 023 |
| 4 | Stamps: the player sets what counts as done enough | Shipped (hours and milestone stamps) | [stamps-proposal.md](stamps-proposal.md), migration 024 |
| 5 | Name card: a name, a line, a style, up to three favourite games | Shipped | [name-card-proposal.md](name-card-proposal.md), migrations 025, 026 |
| 6 | Emotes: say hi to a resident, four options, last one kept | Shipped | [emotes-proposal.md](emotes-proposal.md), migration 027 |
| 7 | Not defined anywhere in the repo | Open | See below |

If the original wording of stories 1 and 2 exists outside the repo, send it and I will replace the inferred rows.

## Story 7

The settlement. Owner decision: the Blender slice is approved, and the design must plan for many more residents and homes over time. Spec and master plan: [spec-story-7-settlement.md](spec-story-7-settlement.md). Anonymous sign-ins, merit tiers, friend visits and account recovery stay separate items.

## Questions for the owner

1. Answered. An anonymous player gets the whole experience: residents, name card, stamps, emotes and the settlement. Nothing is gated behind an email. Their data lives with that anonymous account, so it is lost if they clear the browser or sign out without adding an email. The app should say that plainly where someone can add one, without nagging. Linking an email later belongs with account recovery, which stays deferred.
2. Do you have the original v1-spec text, or the wording of stories 1 and 2?

## What is known to be out of v1

- Account recovery (deferred).
- Merit tiers (slice 5 of the settlement plan, not scoped yet).
- Licensed game characters, multiplayer, native screensaver packaging (excluded in the demo scope).
- Social sharing of residents or settlement state ([spec-stories-3-6.md](spec-stories-3-6.md), non-goals).

## Rules every story follows

- Server Actions for writes, with the three-client Supabase pattern.
- Plain, human copy. No unlock, streak, collect, countdown or profile-completion language.
- The game stays in the foreground. Nothing here earns progress by being watched, and nothing expires.
- Migrations are numbered, additive, and applied by the owner.
