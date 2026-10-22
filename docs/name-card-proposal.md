# Name card: proposal and task plan

**Status:** proposal only. Nothing here is built, and nothing proceeds until the
owner answers the decisions below. It follows
[residents-proposal.md](residents-proposal.md) (shipped) and
[stamps-proposal.md](stamps-proposal.md) (proposed), and narrows Story 5 in
[spec-stories-3-6.md](spec-stories-3-6.md), which stays as history. The home is
private-first with optional friend visits ([PRODUCT.md](../PRODUCT.md)), so this
slice is about how the player sees their own card, not about visitors.

## The idea in one paragraph

The home should say whose it is. A name card is a small, quiet, player-written
card: a name, an optional line about how you play, and up to three games you
love. It sits at the top of your Progress tab, where today the app only says
"{name} 👋". It is yours to edit any time, it never touches residents or
history, and nothing about it is public.

## What the code already gives us

| Fact | Where | Consequence |
| --- | --- | --- |
| `users.display_name` exists and is shown in Settings and Progress | `lib/types.ts`, `components/settings.tsx`, `components/progress.tsx` | The name is not new. The card builds on it and does not create a second name. |
| Nothing lets the player edit the name | sign-up sets it once; no edit UI | Editing the name is the first real feature here. |
| Fallback is the email prefix, or "Player" for anonymous users | `app/auth/actions.ts`, `components/settings.tsx` | Never require a name. Keep the fallback. |
| `users` UPDATE policy is `auth.uid() = id` with no column limit | `scripts/002_rls_policies.sql`, `006` | A client can already write any column of its own row directly. New fields must not rely on that. See the open check below. |
| `Game` rows are readable by authenticated users | RLS | Favorites can be validated against real games. |

## Design

### Where data lives

The name stays in `users.display_name`, the single source of truth the app
already reads. Everything new goes in one small table:

`name_cards(user_id PK, tagline, play_style, favorite_game_ids text[], updated_at)`

- `tagline`: optional, 0 to 200 characters (the spec's bio).
- `play_style`: optional, 0 to 80 characters ("I love cozy games"). Kept
  separate from the tagline so the card can lay them out differently.
- `favorite_game_ids`: 0 to 3 distinct ids, each an existing `games.id`.
- One row per user, created on first save. No row means an empty card.
- RLS on, SELECT own row only, **no client write policy**, cascade on user
  delete.

### One checked write path

`save_name_card(p_display_name, p_tagline, p_play_style, p_favorite_game_ids)`,
SECURITY DEFINER, `search_path` pinned, EXECUTE only for `authenticated`:

1. Require `auth.uid()`.
2. Trim every text field. Reject a name that is empty after trimming or over 50
   characters, a tagline over 200, a play style over 80.
3. Reject more than 3 favorites, duplicates, or ids that are not in `games`.
4. Update `users.display_name` and upsert the card in one transaction.
5. Return the saved card.

It writes only the card fields and the name. It cannot touch XP, counters,
sessions, residents or stamps, and nothing else calls it.

### What the player sees

1. **Progress tab header:** the card replaces the "{name} 👋" line. Name large,
   tagline under it, play style as a small line, favorites as up to three small
   cover thumbnails with titles. An empty card shows only the name and a quiet
   "Edit card" link, never a prompt to fill things in.
2. **Edit card:** a plain form reached from that link and from Settings. Four
   fields, a live character count, and Save. Favorites are picked from the
   player's own library, searchable, with a remove control on each chosen game.
3. **Failure:** a save that fails keeps what the player typed and says so in
   one plain line, for example "Couldn't save your card. Try again." Same
   pattern as quick filters.
4. **Residents:** unchanged. Residents do not read the card in this slice.

### Copy rules

Same as the other slices: plain and short. No "complete your profile", no
progress meter for the card, no streak or ranking language, no nudging. An
empty card is a complete card.

## Rules the tests must hold

1. A valid save stores the name and card; a second save overwrites, never
   duplicates.
2. Name is trimmed, non-empty and at most 50 characters; tagline at most 200;
   play style at most 80. Boundary lengths accepted, one over rejected.
3. At most 3 favorites, no duplicates, every id must exist in `games`.
4. A user cannot read or write another user's card, and cannot write
   `name_cards` directly.
5. A failed validation changes nothing, including the name.
6. Saving the card adds no XP, changes no counters, and leaves residents,
   postcards and sessions untouched.
7. An account with no card row renders the empty state, not an error.
8. Applying the migration twice changes nothing.

## Open check before building

The `users` UPDATE policy being column-wide is an existing condition, not part
of this slice. Before N1 I will read what migrations 018 to 023 did to
protected columns (for example XP and counters) and list any direct-write gap
for the owner. Name card work will not widen it, and I will not change it
without agreement.

## Decisions for the owner

| # | Decision | My default |
| --- | --- | --- |
| 1 | Is the name card private to the player for now, with no visitor view? | Yes. Visitors do not exist yet, and the product is private-first. |
| 2 | Keep `display_name` as the one name, editable here, and never require it? | Yes. Fall back to the email prefix or "Player". |
| 3 | Skip the profile emoji and photo in this slice? | Yes. Uploads need storage and moderation. Emoji validation is fiddly. Both can follow. |
| 4 | Favorites picked only from the player's own library? | Yes. Keeps the list honest and the picker small. |
| 5 | A separate `play_style` line from the tagline? | Yes, short. The spec treats them as distinct. |
| 6 | Should residents ever mention the player's name? | Later, with emotes (Story 6). Not in this slice. |

## Task plan

One PR per task. Arrows are real dependencies only.

| ID | Task | Needs | Done means |
| --- | --- | --- | --- |
| N0 | Owner answers the decisions above | none | Defaults agreed or changed |
| N1 | Migration 024 or 025 (next free number): `name_cards`, `save_name_card`, RLS, plus PGlite tests for rules 1 to 8 using the real SQL file and real roles | N0 | Tests pass. **Owner applies it.** |
| N2 | `getNameCard()` and `saveNameCard()` actions, types, plain-voice errors | N1 applied | A failed save shows a visible message and keeps input |
| N3 | Card in the Progress header, with the empty state | N2 | Renders with and without a card |
| N4 | Edit form and favorites picker, reachable from Progress and Settings | N2 | Saves, validates, survives reload |
| N5 | Playwright coverage, keyboard and contrast pass, copy review | N3, N4 | Lint `--max-warnings 0`, `tsc` and the standby suite pass |
| N6 | Update `v1-readiness.md` and the spec | N5 | Docs match what shipped |

N3 and N4 can run in parallel once N2 lands. If stamps ship first the number
shifts, and I will use the next free one.

## Safe rollout

Preview and production share one Supabase project, so the migration is a live
change. It is additive and idempotent, and nothing reads the new table until N2
ships. Order: merge N1 and the owner applies it, then the app PRs. No Vercel or
Supabase settings change. Existing accounts look the same until they edit their
card.

## Not in this slice

Visitor view, public profile URLs, sharing or export, profile photo or emoji,
avatar customization, achievements or rankings on the card, residents reacting
to the card, emotes, home view, and account recovery.
