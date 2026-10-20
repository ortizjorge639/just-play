# Spec Stories 3-6: Residents, Stamps, Name Card, Emotes

**Draft for owner review**

Reference: [Treehouse World Study](treehouse-world-study.md), [PRODUCT.md](../PRODUCT.md)

These four stories propose features for the Canopy settlement's personalization and interaction layer: game avatars that become residents, player-defined proof milestones for arrival, player identity in the settlement, and expressive interactions with residents. This document guides design and estimation for future implementation work.

---

## Story 3: Residents

**Scope:** Game avatars that become permanent inhabitants of the player's settlement after the player meets a chosen "stamp of proof" milestone.

### User journey

1. Player starts a game; the game's avatar appears as an **Invited** traveler, shown in the journal and on the map outside the settlement proper.
2. Player plays and meets the configured stamp (e.g., "2 hours played" or "reach Chapter 3").
3. Player self-confirms the milestone in the app (since telemetry is not yet verified).
4. The avatar becomes a permanent **Arrived** resident in the settlement. This status persists across:
   - Replays of the same game (replaying does not revoke residency)
   - Earned merit tier increases (later tiers enrich the same resident's contribution without duplicate avatars)
   - Stopping or abandoning the game later (stopping after arrival is a choice, not a failure)
5. In ambient view, residents are visible and interactive without earning gameplay progress or creating obligations.

### Scope inclusions

- **Resident state machine:** Backlogged (no invitation) → Invited (traveling, pre-arrival) → Arrived (permanent, earned contribution).
- **Arrival permanence:** Once a game's avatar arrives, it remains a resident. Subsequent play, stopping, replays, and tier changes do not remove the resident.
- **Remnants for dropped invitations:** If an invited game's invitation ends before arrival (player stops before reaching the stamp), a small keepsake (e.g., postcard) persists in the world and journal, manually deletable, and replaced by the full resident if re-invited and arrival is earned later.
- **Avatar identity:** Each game gets a unique avatar that represents that specific game. The avatar's visual presence, customization options, and role in the settlement are separate (Story 5 name card, Story 6 emotes).
- **Resident visibility:** Residents are displayed in:
  - The settlement's 3D world (Canopy nook)
  - The journal (Invited vs. Arrived sections)
  - The map (with location hints)
  - Historical records and stats

### Scope exclusions

- Avatar character design, animation, or asset sourcing (handled separately; current demo uses original R1 rig)
- Game-specific avatar customization or unlockable appearance variants
- Social sharing of residents or settlement state
- Persistent world integration with real accounts (deferred to future work)

### Acceptance criteria

- [ ] Database schema supports Invited and Arrived resident states, keyed by (user_id, game_id)
- [ ] Creating an invitation (starting a game) inserts an Invited resident record
- [ ] Confirming a stamp creates an Arrived resident record; retains all prior data
- [ ] Replaying an arrived game does not change its resident status or create duplicates
- [ ] Dropping an invitation before arrival creates a Remnant record; re-inviting replaces it with the resident upon stamp confirmation
- [ ] Residents are displayed in the journal, map, and settlement visualization
- [ ] Settlement layout accommodates 5+ residents without culling or degradation
- [ ] RLS policies ensure users can only see their own residents
- [ ] Abandoned games retain their residents (if already arrived) without special penalty or decay

### Open questions

1. **Avatar sourcing:** Will production use original designs, licensed game-specific assets, or a single canonical character (like the current demo R1)? Current plan: original designs, game-specific props are separate scope.
2. **Resident interaction:** Can players click/interact with residents in the world to view their game details? Or is the world view purely ambient?
3. **Proof records:** How will proof snapshots work when the stamp rules change? Should changing a rule require re-confirmation for already-arrived residents?
4. **Settlement capacity:** Is there a cap on residents (e.g., 50 max), or does the world expand infinitely?
5. **Removal:** Can players manually delete residents, or are they permanent once arrived?

---

## Story 4: Stamps (Proof Milestones)

**Scope:** Player-defined "done enough" milestones that determine when a game's avatar becomes a permanent resident. Each game can have its own stamp, or inherit from a default rule.

### User journey

1. Player opens settings to configure **stamp rules**: what counts as "proof" that they've meaningfully engaged with a game.
2. Player can define **default stamps** that apply globally (e.g., "2 hours of playtime") or set **per-game stamps** that override the default.
3. Player starts a game. The app displays:
   - The game's current stamp (either inherited default or per-game override)
   - Progress toward that stamp (e.g., "1.5 / 2 hours")
   - An option to self-confirm when reached (since telemetry is not yet verified)
4. Once the player self-confirms, the stamp is recorded, and the game's avatar becomes **Arrived** (Story 3).
5. If the game has multiple **merit tiers** (e.g., "Visitor" at 2 hours, "Resident" at 10 hours, "Elder" at 50 hours), the stamp system records progress toward each tier. Reaching later tiers enriches the resident's contribution without revoking earlier arrivals.
6. Stamps are mutable: if the player changes a rule, new invitations use the new stamp, but already-arrived residents are unaffected (unless explicitly re-confirmed).

### Scope inclusions

- **Stamp definition:** Configurable per-game or global. Examples: hours played, story milestone completed, percentage progress, main story finished.
- **Default stamp rule:** A catch-all that applies when no per-game override exists.
- **Merit tiers:** Up to 5 tiers per game, each with its own contribution level (e.g., figurine, room, garden). Later tiers enrich existing residents rather than create new ones.
- **Progress tracking:** Real-time display of game session time toward the current stamp.
- **Self-confirmation UI:** A clear button or prompt to confirm a milestone when the player believes they've reached it.
- **Proof immutability:** Once a stamp is confirmed, the proof record is final. Changing the stamp rule afterward requires re-confirmation.
- **Backlog games:** Backlogged games (not yet invited) have no stamp progress; inviting them initiates the stamp clock.

### Scope exclusions

- Automatic achievement or trophy detection (use self-confirmation instead)
- Telemetry verification or mod detection
- Cross-device stamp synchronization (accounts are not yet integrated)
- In-app progress milestones or achievement notifications
- Rewards or XP for reaching stamps (stamps are arrival eligibility only)

### Acceptance criteria

- [ ] Schema supports per-game and default stamp rules (target, unit, tier definitions)
- [ ] Stamp configuration UI allows defining 1–5 tiers with names and contribution levels
- [ ] Game session screen displays current stamp progress and remaining distance
- [ ] Self-confirm button is accessible and idempotent (confirming twice does not duplicate arrivals)
- [ ] Confirmed stamps are stored immutably in proof records (user_id, game_id, timestamp, stamp_rule_snapshot)
- [ ] Changing a stamp rule does not retroactively affect already-confirmed stamps
- [ ] Tier progress is tracked and available for future contribution enrichment
- [ ] Default stamp rule is applied to all new invitations unless overridden per-game
- [ ] RLS ensures users can only modify their own stamp rules and proof records

### Open questions

1. **Telemetry delay:** How long after a player reaches a stamp should they be able to self-confirm? Immediately, or after a short delay (e.g., next session)?
2. **Story milestone detection:** For story-based stamps, how will the app know the player reached Chapter 3? Manual self-confirmation only, or can this integrate with game APIs later?
3. **Tier richness:** Should later tiers be "bonus" contributions (same resident, fancier decoration) or separate major structural additions?
4. **Stamp history:** Should the player be able to view the exact timestamp they confirmed each stamp? Should they be able to change the recorded time?
5. **Retroactive rules:** If the owner changes a stamp rule from "10 hours" to "5 hours," should already-arrived residents with lower proof be re-confirmed, or remain grandfathered in?

---

## Story 5: Name Card

**Scope:** A player's personal identity card that appears alongside their residents, showing their name, basic profile info, and optionally their play philosophy or favorite games.

### User journey

1. Player completes their **name card**: username/display name, a short bio or tagline, optional avatar customization.
2. The name card appears in:
   - The settlement's welcome area or visible landmark (first thing visitors see)
   - Alongside the player's stats dashboard
   - In export/sharing contexts (when/if social features are added)
3. Residents can reference the player's name card: a visiting friend might say "Welcome to [Player]'s settlement" or a resident might remember "This is [Player]'s home."
4. The name card is mutable: the player can update their display name, bio, or preferences at any time without affecting resident state.

### Scope inclusions

- **Player identity:** Display name (required), optional bio/tagline (up to 200 characters), optional profile emoji or icon.
- **Play philosophy:** Optional field to describe the player's approach (e.g., "I love cozy games" or "Speedrunner").
- **Favorite games** (optional): A slot for 1–3 favorite games, displayed as small icons or names.
- **Settlement welcome:** The name card is displayed prominently in the settlement so visitors understand whose home they are exploring.
- **Persistence:** Name card data is account-backed and persists across sessions and devices (once accounts are integrated).

### Scope exclusions

- Avatar customization (residents have their own customization; the name card does not)
- Public profile URLs or social media links
- Achievements or leaderboard rankings on the name card
- Real-time visitor notifications or seen-by counts

### Acceptance criteria

- [ ] Database schema stores player display name, bio, favorite games array
- [ ] Name card UI is prominently displayed in the settlement or dashboard
- [ ] Player can edit their name card from settings without disrupting game state
- [ ] Name card changes are immediately visible in their own view and to future visitors
- [ ] Display name is non-empty and limited to 50 characters
- [ ] Bio is optional and limited to 200 characters
- [ ] Favorite games slot accepts up to 3 game IDs and renders their titles
- [ ] Name card is included in any future export or sharing context
- [ ] RLS ensures users can only edit their own name card

### Open questions

1. **Default display name:** What if the player never sets a name card? Use their email prefix, or require it before proceeding?
2. **Profile picture:** Should the name card include a profile photo upload, or just emoji/icons?
3. **Resident reactions:** Should residents in the world react to or mention the player's name card or tagline? (This touches Story 6 emotes and dialogue.)
4. **Visibility to visitors:** If a friend visits later, do they see the exact same name card, or a slightly different view (e.g., "Visiting [Player]'s Home")?

---

## Story 6: Emotes

**Scope:** Expressive interactions between the player and residents, allowing brief emotional exchanges without requiring dialogue, maintenance, or progress-farming.

### User journey

1. Player clicks on a resident in the settlement or during a session view.
2. A small **emote menu** appears with 3–5 expressive actions:
   - Wave (friendly greeting)
   - Celebrate (cheer/congratulate)
   - Rest (sit together quietly)
   - Share thought (player can leave a brief note the resident "acknowledges")
   - Check in (ask how the resident is doing, get a short flavor response)
3. Resident plays a brief animation or emote in response (head nod, jump, spin, etc.).
4. An optional **flavor line** might appear: a short, authored line that acknowledges the player's action without creating dialogue obligations or advancing a relationship meter.
5. Emote interactions **do not earn gameplay progress, XP, or rewards** (to prevent mechanical addiction).
6. A brief **interaction record** (optional) tracks the most recent emote per resident so players can remember they checked in.

### Scope inclusions

- **Emote set:** 3–5 player-initiated emotes (wave, celebrate, rest, share thought, check in) per resident.
- **Resident animations:** Each emote triggers a brief, looped resident animation or idle variation.
- **Flavor text:** Authored, short responses from residents that acknowledge the player's emote without creating dialogue burden.
- **Interaction cooldown:** Optional light cooldown to prevent spam (e.g., can wave at a resident every 10 minutes, but no hard limit).
- **Emote history:** Optional view showing the last time the player interacted with each resident.
- **Ambient presence:** Residents can be observed and interacted with during **ambient view** (world display without the game interface).

### Scope exclusions

- Full dialogue trees or branching storylines (that's narrative scope, not emotes)
- Emote unlocks or progression (all players have the same emotes)
- Emote rewards, streaks, or achievement tracking
- Resident moods or decay (residents do not become sad, lonely, or require maintenance)
- Sound effects or voice lines (authored flavor text only)
- Social features like emoting with friends (visit/guest scope)

### Acceptance criteria

- [ ] Click/touch interaction on a resident opens an emote menu
- [ ] Menu displays 3–5 distinct emote options with clear icons/labels
- [ ] Selecting an emote triggers a brief resident animation (0.5–2 seconds)
- [ ] Flavor text appears contextually (above the resident or in a message bubble) after emote plays
- [ ] Emote interactions do not award XP, progress, or achievements
- [ ] Emote history is stored and displayable (last interaction timestamp per resident per user)
- [ ] Cooldown (if implemented) prevents interaction spam without blocking all interaction
- [ ] Emotes are available during both game session view and ambient world view
- [ ] RLS ensures emote history is private to the user

### Open questions

1. **Flavor text authoring:** Who writes the emote responses? Will each resident have game-specific or generic flavor, or will it be randomized?
2. **Emote permanence:** Should the game record that the player waved at a specific resident, or is each emote ephemeral (not logged)?
3. **Cross-resident emotes:** Can the player emote at multiple residents at once, or only one at a time?
4. **Resident state:** Do residents "remember" recent interactions, or are they always in the same idle state regardless of the player's emote history?
5. **Accessibility:** Should emotes have text-only fallbacks or keyboard shortcuts for accessibility?
6. **Future dialogue:** If a caretaker/companion is added later (as speculated in PRODUCT.md), do they also respond to player emotes, or are resident emotes separate from companion interaction?

---

## Implementation dependencies

These four stories have a natural progression:

1. **Story 3 (Residents)** is the foundation. Residents must exist before they can be named, interacted with, or tied to proof milestones.
2. **Story 4 (Stamps)** governs when residents arrive. Stamp logic must be clear before residents appear in the settlement.
3. **Story 5 (Name Card)** provides player identity context. Residents need to know whose home they're in; this can be deferred if ambience is the only scope.
4. **Story 6 (Emotes)** adds interactivity. Once residents are in place and visible, players can interact with them.

Within a narrowed slice, consider the dependency order:

- **Minimum:** Stories 3 + 4 (residents with proof milestones, working silently)
- **Visible:** Stories 3 + 4 + 6 (residents with interaction, no names yet)
- **Full:** Stories 3 + 4 + 5 + 6 (complete personalization layer)

---

## Open decisions for the product owner

1. **Launch scope:** Which of these four stories are essential for the first Canopy release? (Residents and stamps alone? Or include emotes for interaction?)
2. **Proof verification:** Will proof remain self-confirmed indefinitely, or will future integrations (Steam API, game APIs) replace manual confirmation?
3. **Resident interaction:** Are residents always silent (ambient only), or do they eventually develop personality and dialogue? (This affects emote scope and companion planning.)
4. **Name card customization:** How deep should player customization go? Just name and bio, or full avatar design like the demo?
5. **Retroactivity:** If a player already has residents from the demo or early testing, how do we migrate them to the new (v1) schema and rules?

---

## Non-functional requirements

- **Performance:** Settlement rendering must support 50+ residents without frame drops (depends on 3D engine choice).
- **Storage:** Stamp rules, proof records, and emote history must fit within per-user quotas (proof records are immutable; emote history can be pruned after 1 year if needed).
- **Accessibility:** All emote menus and name card UI must pass WCAG AA contrast and keyboard navigation.
- **Internationalization:** Flavor text and emote labels must be translatable; character limits may vary by language.

---

## Validation success criteria

A successful implementation of these four stories means:

- [ ] Players can invite games, track progress toward proof milestones, and permanently arrive residents
- [ ] The settlement displays 5+ residents without performance degradation
- [ ] Players can interact with residents via emotes without earning gameplay rewards
- [ ] Each player sees their own name card in the settlement context
- [ ] No resident is deleted or loses status due to rule changes, rule edits, or time passage
- [ ] A visiting player (in the future) can understand whose home they're exploring and see the residents that belong there
- [ ] An abandoned game with an arrived resident is not visually penalized or marked as a failure

---

## Proposed first vertical slice: residents

This section proposes a thin, end-to-end slice of Story 3 (Residents) that can be implemented, tested, and shipped in isolation to validate the resident lifecycle and resident→session connection before building stamps (Story 4), name cards (Story 5), and emotes (Story 6).

### Slice scope

**What the slice delivers:**

- Database table to store resident state (Backlogged, Invited, Arrived)
- Server action to create an Invited resident when a player starts a game
- Server action to manually arrive a resident (admin/testing backdoor, since stamps are not yet implemented)
- Game session screen shows the current game's resident state (Invited, Arrived, or none)
- "Mark arrived" button appears on the session screen (for testing; production will use Story 4 stamps)
- Resident state persists across session resumption and app reload
- RLS policy prevents users from viewing other users' residents

**What is deliberately excluded:**

- Stamps (Story 4): No automatic arrival based on proof milestones. Manual confirmation only.
- Remnants: Dropped invitations do not create keepsakes yet. Ending an invited game simply cancels the invitation.
- Journal/map display: Residents exist in the database but are not rendered in the settlement world or journal yet (that is a separate 3D rendering effort).
- Name card (Story 5): No player identity display.
- Emotes (Story 6): No interaction layer.
- Resident deletion: No UI to manually delete residents or remnants.
- Merit tiers: Simple binary Invited/Arrived; no progress toward deeper tiers.

### Migration

The slice requires one new table. Owner applies this migration manually; it is not pre-applied.

```sql
-- Migration: 022_add_residents_table.sql
CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('backlogged', 'invited', 'arrived')),
  arrived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)
);

CREATE INDEX idx_residents_user_id ON residents(user_id);
CREATE INDEX idx_residents_game_id ON residents(game_id);

ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY residents_users_can_see_own ON residents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY residents_users_can_insert_own ON residents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY residents_users_can_update_own ON residents
  FOR UPDATE USING (auth.uid() = user_id);
```

### Server actions (new and modified)

**New action: `createInvitedResident(gameId)`**

When called from the session start flow (or from game search), this creates an Invited resident if one does not already exist.

```typescript
export async function createInvitedResident(gameId: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');
  
  const { error } = await supabase
    .from('residents')
    .upsert({
      user_id: user.id,
      game_id: gameId,
      status: 'invited',
      created_at: now(),
      updated_at: now(),
    }, { onConflict: 'user_id,game_id' });
  
  if (error) throw error;
  revalidatePath('/');
}
```

**New action: `arriveResident(gameId)` (testing/admin backdoor)**

Manual arrival endpoint for testing without stamps. Production should not expose this; stamps (Story 4) replace it.

```typescript
export async function arriveResident(gameId: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');
  
  const { error } = await supabase
    .from('residents')
    .update({
      status: 'arrived',
      arrived_at: now(),
      updated_at: now(),
    })
    .eq('user_id', user.id)
    .eq('game_id', gameId);
  
  if (error) throw error;
  revalidatePath('/');
}
```

**Modified action: Session creation**

Integrate `createInvitedResident()` into the existing session creation flow so starting a game automatically invites its resident.

### UI changes

**Game session screen additions:**

- Add a small resident status badge showing "Invited" or "Arrived" next to the game title.
- If Invited, show a "Mark as Arrived (test)" button that calls `arriveResident()`. Remove or hide this button once Story 4 is implemented.
- If Arrived, show a checkmark or "Resident arrived" label and optionally a date (e.g., "Arrived Oct 20, 2026").

### Acceptance checks

- [ ] New residents table exists and supports Invited/Arrived states
- [ ] Starting a game creates an Invited resident record
- [ ] Calling `arriveResident()` updates resident status and records `arrived_at` timestamp
- [ ] Session screen correctly displays resident state after creation and arrival
- [ ] Reloading the app preserves resident state (resident data loads from the database)
- [ ] RLS prevents users from seeing other users' residents
- [ ] Manual arrival via the test button works end-to-end without errors
- [ ] Arriving the same resident twice does not create duplicates or errors
- [ ] App does not break when starting a game whose resident data is not yet loaded

### Risks

1. **3D world integration unknown:** This slice stores resident state but does not integrate with the Canopy settlement renderer. Discovering that the renderer has breaking assumptions about resident structure could require schema rework.
2. **Stamp collision:** If Story 4 is implemented before this is shipped, developers may try to add stamp logic to this action, bloating the scope. Keep the slice minimal; story 4 is a separate task.
3. **Test data pollution:** The testing backdoor `arriveResident()` is exposed in production. Without access controls, testers could pollute the database. Recommend removing or gating it behind an owner toggle before shipping.
4. **Manual confirmation UX:** The "Mark as Arrived" test button is not user-friendly. If this slice ships to users (unlikely), they need a story about how to self-confirm milestones, which is Story 4.
5. **Data migration from demo:** If real accounts already have residents from the local demo, this table needs a one-time import strategy that is not included in this scope.

### Rough size estimate

**Effort breakdown:**

- Schema design and migration: 2–3 hours (agree on columns, indexes, RLS policies)
- Server actions (create invited, arrive, session integration): 3–4 hours
- Session screen UI updates (badge, test button): 2–3 hours
- Testing (manual, E2E if applicable): 2–3 hours
- Code review and fixes: 1–2 hours

**Total: 10–15 hours** for a single developer.

**Assumes:**
- Development environment is already set up (Supabase, Next.js, local auth)
- No new 3D integration required (residents are invisible in this slice)
- No UI kit components need to be created (badge and button use existing primitives)
- RLS policies follow the established pattern from other tables

**Blocking dependencies:**
- Must have write access to apply the migration (Supabase, or dev provides SQL)
- Existing session creation flow is stable and understood
- Game table and auth.users are available and stable

### Ship criteria

This slice is ready to merge when:

- [ ] All acceptance checks pass
- [ ] RLS policies are verified to prevent data leakage
- [ ] A developer can start a game, manually arrive it, and see the state persist across reload
- [ ] The testing backdoor (`arriveResident()`) is documented as temporary and removed before production release
- [ ] Code review is complete and no breaking changes are introduced to the session creation flow
