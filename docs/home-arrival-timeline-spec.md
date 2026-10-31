# Home arrival timeline spec

**Status:** User-approved implementation verified locally; the database
privacy/read-only criterion remains unverified.

**Production scope update:** Settlement/world entry points are withdrawn from
Home and StandBy. The gallery, Arrivals, and resident data remain unchanged.
The experimental implementation is preserved on the pushed
`ortizjorge639-review-latest-pr` branch at `defda32`. Settlement modules and
database records are retained but no longer wired into the production UI.
StandBy defaults to Artwork; Canopy is unchanged pending a separate UX review.
The optional-world criteria below describe the original approved slice, not
the current production scope.

## Problem Statement

Home should feel like a quiet personal gallery of the games that have found a
place in the player's life. The current view leads with the world and hides
residents and keepsakes in a collapsed section, making it harder to see the
games and their history at a glance.

## Solution

Use the approved Home prototype's element placement as the visual direction,
keeping the resident gallery as the primary content and the world as a quiet,
optional presence. Add an arrival timeline as a secondary section so players
can revisit when games found a home. The timeline includes all arrivals,
including residents whose games were later set aside. Keep the introduction
focused on the games: omit redundant owner labels, explanatory subcopy, and
resident counts.

## User Stories

1. As a player, I want Home to foreground my resident games, so that it feels
   like a personal gallery rather than another activity I need to manage.
2. As a player, I want to see when each game arrived, even if I later set it
   aside, so that my gaming history remains meaningful.
3. As a player, I want Home to focus on my games without redundant labels, so
   that the page feels personal without unnecessary meta information.

### Acceptance Criteria

- [x] Home keeps the approved gallery-first element hierarchy, with the
  optional world available without displacing the gallery. Verify against the
  user-approved Home prototype at a narrow and a wide viewport.
- [x] The arrival timeline includes every resident, regardless of the game's
  current progress status, including a resident whose game is later set aside.
  Verify with resident fixtures, including one later set aside.
- [x] Each timeline entry shows the game's title and its original `arrived_at`
  date, ordered newest arrival first. Replays or later progress changes do not
  change the original arrival date. Verify rendered ordering and entry content
  with deterministic resident fixtures; the existing resident persistence test
  covers original arrival retention after replay and setting aside.
- [x] A postcard for a game that has not arrived is not shown as an arrival.
  Verify with a fixture containing a postcard without a resident.
- [x] An account with no residents has a calm, complete empty state and no
  fabricated timeline entries. Verify with an empty Home fixture.
- [x] Home omits the redundant owner label, explanatory subcopy, and resident
  count. Verify the rendered output with a named-player fixture.
- [ ] The timeline is read-only and private to the signed-in player; opening
  Home does not create, remove, or alter arrivals, postcards, sessions, or
  progress. Verify through the existing resident RLS/migration tests and a
  read-only interaction check.

## Implementation Decisions

- Use the existing resident record as the source of truth for an arrival:
  `arrived_at` is persisted, and residents remain after a game is replayed or
  set aside.
- Reuse the resident data already loaded for Home. The existing server read
  returns residents newest-first with game metadata; no new arrival table,
  migration, or Server Action is required for this slice.
- Keep postcards distinct from arrivals. A postcard records a game set aside
  before becoming a resident; it is not an arrival timeline event.
- Preserve the approved gallery placement and add the timeline as supporting
  history, rather than making the world or timeline replace the gallery.
- Use the game's current title with the resident's original arrival date. Do
  not infer arrivals from session history or game-progress timestamps.

## Testing Decisions

- Test observable Home output at the Home rendering seam with deterministic
  resident and postcard props: gallery hierarchy, date/title, newest-first
  ordering, inclusion after setting aside, exclusion of postcard-only games,
  omitted redundant copy, and empty state. These checks are implemented in the
  focused Home rendering test.
- Retain the database behavior test that verifies an arrived resident and its
  original arrival timestamp persist after replay or setting aside. Prior art:
  the existing residents migration test.
- Run the repository's `pnpm lint` and `pnpm exec tsc --noEmit` for the
  component/type changes. Run the existing residents migration test using the
  command documented at its top; it requires the PGlite package listed there.
- Review the prototype-derived composition in the browser at narrow and wide
  widths. Sample dates and artwork in the prototype are illustrative, not
  production data.

## Out of Scope

- Changing arrival eligibility, stamp rules, resident permanence, postcards,
  or game-progress semantics.
- Adding a new database table, migration, analytics, streaks, or reward for
  viewing the timeline.
- Redesigning Progress, settings, the Deck, Now Playing, or authentication.
- Building a 3D settlement, social sharing, or a new resident interaction.

## Further Notes

- The user chose a quiet personal gallery, approved the prototype's element
  placement as close to their vision, and specifically welcomed the arrival
  timeline as an unexpected addition.
- Timeline scope was confirmed: include all arrivals, including games later
  set aside; do not limit it to current residents by progress status.
- The authenticated application could not be visually inspected locally
  because the required Supabase environment variables were unavailable during
  the earlier audit; a local component preview is used for visual checks.
- Related domain context: [product principles](../PRODUCT.md) and the earlier
  [Home view proposal](home-view-proposal.md).
