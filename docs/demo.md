# Presenting the Canopy demo

The public demo is at **`/demo`**. It is a fictional, local-first demonstration,
not a view of someone's real Just Play account. No Supabase configuration or
sign-in is required for this route.

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

1. Show the backlog: fictional adventures waiting to begin.
2. Start **The Last Ember**. Sol arrives as a visiting character at the lodge.
3. Meet the visitor, then mark the sample game complete. The same character
   becomes a permanent neighbor; starting a replay does not revoke that home.
4. Build **Fern House** on its authored plot. The platform and bridge become
   available together, and a permanent resident can move there.
5. Use the map and resident journal to find a character and their game memory.
   Enter the furnished house in the resident grove.
6. Capture a photograph, then switch to ambient viewing. Let the camera and
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

**Take a tour** walks through real saved state changes. After each action,
look around and use the **Tour** button to continue. Building Fern House and
moving Sol in are separate actions within the fourth step.

Ambient controls disappear after a few seconds of inactivity. Move the pointer,
tap, or use the keyboard to bring them back. **Hold this view** fixes the camera
while neighbors continue their routines. Reduced-motion preferences prevent
automatic camera movement. Settings also provide night lighting and lower detail.

## Persistence and recovery

Progress is saved only in this browser under `just-play-canopy-demo-v1`.
Opening the same URL on another device does not transfer the world. Reset
affects only the demo's own save and requires confirmation.

If browser storage is unavailable or a save cannot be read, the interface
explains the problem rather than silently replacing saved progress. A
session-only demonstration is still possible. Photos are downloaded locally;
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
The static-scenery budget is at most 40 meshes and 150,000 triangles; this is
a geometry budget, not a promise of a particular frame rate on every device.

The demo does not include real account integration, multiplayer, licensed game
characters, unrestricted building, an economy, or a native OS screensaver.
Sharing its URL shares the sample experience, not a visitor's private local
save.
