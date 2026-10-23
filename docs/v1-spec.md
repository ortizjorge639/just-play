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

`v1-readiness.md` calls it "partly open". Nothing in the repo says what it is. The closest candidates, each one named in existing docs:

- **Anonymous sign-ins.** The readiness table says enforcement "is not written down yet." This is the only one already listed as a gate.
- **Merit tiers.** Defined in the rules, held back on purpose. See [settlement-art.md](settlement-art.md).
- **The settlement itself.** The 3D world residents live in. Same blocker.
- **Friend visits.** The world study says the world is private first, with optional visits. No design exists.
- **Account recovery.** Deferred by the owner.

I am not choosing for you. Pick one and I will write it up the way stories 3 to 6 were.

## Questions for the owner

1. Which of the five above is story 7, or is it something else?
2. For anonymous sign-ins: should an anonymous player be able to keep residents and a name card, and what happens to them if they never add an email?
3. Do you have the original v1-spec text, or the wording of stories 1 and 2?

## What is known to be out of v1

- Account recovery (deferred).
- Merit tiers and the 3D settlement (waiting on art approval).
- Licensed game characters, multiplayer, native screensaver packaging (excluded in the demo scope).
- Social sharing of residents or settlement state ([spec-stories-3-6.md](spec-stories-3-6.md), non-goals).

## Rules every story follows

- Server Actions for writes, with the three-client Supabase pattern.
- Plain, human copy. No unlock, streak, collect, countdown or profile-completion language.
- The game stays in the foreground. Nothing here earns progress by being watched, and nothing expires.
- Migrations are numbered, additive, and applied by the owner.
