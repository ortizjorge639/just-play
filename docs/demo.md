# Presenting the Canopy demo

The public demo is at **`/demo`**. It is a fictional, local-first demonstration,
not a view of someone's real Just Play account. No Supabase configuration or
sign-in is required for this route.

**September 10 revision:** the demo implements
[stamps of proof, outside-the-world invitations, remnants, tiered contributions,
and earned placement](treehouse-world-study.md#september-10-revision-stamps-remnants-and-earned-contributions).
The walkthrough below describes the revised local-first model. All milestone
proofs are explicit self-confirmations of fictional sample games; there is no
external playtime or achievement verification.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/demo`. The existing account-backed application at
`/` still requires its usual environment configuration.

For a presentation, use the optimized build rather than the development server:

```bash
pnpm build
pnpm start
```

The project pins pnpm 10.34.5. Use that version rather than allowing a tooling
wrapper to bootstrap an unrelated package-manager version.

## The story to present

Begin with the whole scene. This is a home made from adventures, not a game
library with a 3D background.

1. Show **Backlogged**: fictional possibilities outside the settlement, not
   unattended NPCs.
2. Invite **The Last Ember**. Sol is **Invited**, traveling beyond the settlement
   in the journal and map. The lodge remains scenery, not active-game housing.
3. Choose a stamp in the journal's expandable rules editor, or use the default
   **Play for 2 hours**. Click **Self-confirm arrival stamp**. The same Sol becomes
   **Arrived**, a permanent neighbor with an ember reliquary at the gathering tree.
4. Self-confirm the **Resident** tier's **Reach the credits** milestone. Sol earns
   an open-air hearth deck. In **Build**, select a compatible branch and explicitly
   place it. Platform, bridge, map entry, collision and navigation activate together.
   The **Elder** tier enriches that same addition, not a duplicate avatar.
5. Invite **After the Rain**, then **End invitation · keep a postcard**. Rue's
   postcard remains at the trailhead and in the journal through re-invites. The
   journal can delete it; earning arrival replaces it with Rue's contribution.
6. Find residents and contributions through the map directory. Enter the
   furnished grove home. Other buildings and earned pavilions are open-air or
   exterior scenery, not additional enterable interiors.
7. Capture a photograph, then switch to ambient viewing. Let the camera and
   characters tell the rest of the story without a dashboard.

The games, character identities, and starter memories are explicitly
illustrative. Player-written notes are separate from that sample content.
Moving through the world or leaving it running never awards gameplay progress.

## Controls

Walk with WASD or the arrow keys; hold Shift to move faster. Drag the scene to
turn the camera and scroll to zoom. Touchscreens have hold-to-walk arrows.
The map also supports direct travel, so a presentation does not depend on
precise steering.

Use **J** for the journal, **M** for the map, **E** beside a place or door,
and **H** for ambient view. **Escape** closes a panel or leaves ambient view.
The grove's context button enters its furnished home; other buildings are
exteriors in this demo.

**Take a tour** has eight real-state steps: invitation, rule selection, arrival,
deeper proof, player-chosen placement, another invitation, postcard, and ambient
view. It honors existing arrivals, rules, active games, and placements. If another
game is active, handle it in the journal or skip; the tour never replaces it.
After a world-view step, use **Tour** to continue. Back, Skip, End tour, and closing
the panel cancel pending post-save navigation. An authorized save may still finish
after a held browser lock releases, but it cannot reopen or advance a departed tour.

The journal's **Default stamp & merit tiers** applies to games without an override.
Each game's **Choose this game's stamp & tiers** can override that rule or restore
inheritance. Configure one to five named tiers, custom textual milestones, and
which tiers earn a structure. No tier name itself confers permanence. Rule edits
do not revoke arrivals, reduce earned depth, delete placed additions, or rewrite
the original self-confirmed proof history. A changed rule needs a new confirmation.
The demo retains up to 200 distinct proof snapshots per game and reports the limit
without discarding history.

Ambient controls disappear after a few seconds of inactivity. Move the pointer,
tap, or use the keyboard to bring them back. **Hold this view** fixes the camera
while neighbors continue their routines. Reduced-motion preferences prevent
automatic camera movement. Settings also provide night lighting and lower detail.

## Persistence and recovery

Progress is saved only in this browser under the stable key
`just-play-canopy-demo-v1`, now with a strictly validated **version 2** payload.
Version-one notes, dates, residents, active replay/invitation, revisions, home
assignments, and construction are migrated without silently resetting the world.
Existing residents remain permanently arrived without inventing historical proofs.
An already-built **Fern House** remains on its original branch as a legacy build,
with its bridge and resident assignments. Its assignments can still be edited.
It does not require newly earned proof; new free Fern House construction is removed.
The journal explains this mapping. The upgraded payload is persisted on the next
successful mutation; merely loading a version-one save does not overwrite it.
Opening the same URL on another device does not transfer the world. Reset
affects only the demo's own save and requires confirmation.

If browser storage is unavailable or a save cannot be read, the interface
explains the problem rather than silently replacing saved progress. A
session-only demonstration is still possible. Unsupported versions are blocked,
not reset. Browsers without Web Locks run session-only because cross-tab writes
cannot be safely coordinated. Save/reset operations compare the exact observed
serialized save under a Web Lock, including same-revision replacements. Conflicts
offer **Load newer saved world** or **Keep this world session-only**; recovery
choices are disabled while a mutation is pending. Reset removes only this demo key,
including when the current world is session-only and Web Locks are available,
and never erases a newer cross-tab save without an explicit recovery choice.
Without Web Locks, reset affects only the in-memory visit so the protected
stored world may return after a reload.
Recovery controls appear inside any open panel, so the dialog's focus boundary
never leaves them inaccessible behind it.

Photos are downloaded locally;
they are not uploaded or added to an online album.

## Technical boundaries

`app/demo` is a public route. Its dynamically loaded renderer lives in
`components/demo`; persistent, validated domain state lives in `lib/demo`.
The account-backed app, production game records, and Supabase schema remain
separate. The public demo does not load the account application's analytics
script, so presenting locally does not require Vercel's analytics endpoint.

The world definition is shared by geometry, walkability, resident navigation,
and the map. Characters use local pathfinding and modest activity routines,
not AI chat or an always-running server simulation. Original procedural
scenery is batched by material rather than rendered as thousands of separate
objects.

Core safeguards can be exercised with:

```bash
pnpm test
pnpm typecheck:demo
pnpm exec eslint app/demo components/demo components/site-analytics.tsx app/layout.tsx lib/demo middleware.ts --max-warnings 0
pnpm build
```

The dedicated type-check covers demo code independently because the inherited
Next.js configuration ignores TypeScript errors during a production build.
The public-route regression runs in the test command rather than the scoped
type-check, which would otherwise pull in existing Supabase proxy typing errors.
Repository-wide lint also currently reports unrelated legacy issues in
`active-session.tsx`, `booster-pack.tsx`, `card-deck.tsx`, and `progress.tsx`.
The focused demo lint command above does not disable or alter those rules.
The original static-scenery budget remains at most 40 meshes and 150,000 triangles.
The fully expanded world (legacy home plus all six themed contributions) has a
combined static-and-contribution budget of 80 meshes and 180,000 triangles, tested
with the maximum configured depth. Geometry remains material-batched; proofs and
notes do not mount additional DOM labels. This is a geometry budget, not a promise
of a particular frame rate on every device.

Seven finite compatible branch sites fit all six contributions and a preserved
legacy home. An earned addition is placed once; later tiers enrich it in place.
The six original themes are Pip's lantern garden, Sol's hearth deck, Wren's
letter-writing loft, Nori's tide garden, Io's stargazing deck, and Rue's rain patio.

The demo does not include real account integration, multiplayer, licensed game
characters, unrestricted building, an economy, or a native OS screensaver.
Sharing its URL shares the sample experience, not a visitor's private local
save.
