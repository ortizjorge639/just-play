# Canopy nook: visual-review layer

The nook is an **opt-in presentation of the existing active session**, not a
separate game or demo. Discover/select a real game, start playing, enter StandBy,
then choose **Canopy nook**. **Artwork view** returns to the existing lower-cost
presentation. The selection lasts only for that StandBy visit.

The fixed camera frames one furnished timber room: a sofa and throw, woven rug,
low table with tea and books, botanical print, small loft and ladder, balcony,
tree, and layered planting. These are original procedural Three.js geometry and
materials in `components/canopy/room.ts`. The recovered private mood reference is
not included, published, traced into a background, or loaded by the app.

The user's less-is-more direction governs the hierarchy: no decorative scene
labels, motivational subtitles or metadata pills. The room leads; real game,
optional elapsed time and session actions follow. Goal/notes and routine display
help are deliberately inspectable. Actual error, fullscreen and keep-awake
warnings remain visible when relevant, at readable size, not permanent tiny
corner essays.

## R1 provenance and material contract

- Original Just Play R1 source commit:
  `6a4370096092c9225578c3462a06d66b854ab133`.
- Exact original export:
  `art/canopy/robot-motion-v001/robot-motion.glb`, served here as
  `public/canopy/r1-4f33b632.glb`.
- SHA-256:
  `4f33b6329be78670cf53cdcba7b52ea6cb3c1425541ac8d1176b3826400a8234`.
- The unchanged source export manifest is retained at
  `art/canopy/robot-motion-v001/manifest.json`. Editable Blender source remains
  in the pinned commit at `art/canopy/robot-motion-v001/robot-motion.blend`;
  its hash is recorded in that manifest. No offline archive is served.
- The runtime checks the exact 2,223,624-byte export and hash before parsing.
  No older human characters, environment GLB, demo lifecycle, or local save store
  were imported.
- R1 retains its original five matte PBR materials, neutral ochre shell,
  25-bone skeleton, and original smooth-body/STEP-face Idle animation.
  Playback uses 1.25x authored Idle tempo, with no procedural bob or face
  replacement. The eight clips remain in the unchanged binary; only Idle is used.
- GLB units are meters, +Y up and +Z forward. This nook uses **1:1 export scale**
  (about 1.305 m tall), not the older world's 4/3 enlargement. Table, seat, and
  loft dimensions are authored relative to that height. R1 is a neutral starter,
  never presented as an earned resident or personification of the selected game.

New oak-grain texture, moss cloth, ceramic, paper and foliage materials are
authored in code, not claimed to match an older environment export. Warm
hemisphere/directional light, tone mapping and contact shadows intentionally
change the final appearance from an unlit material swatch. This is stylized
geometry, not the reference image's photoreal detail or approved final art.

## Existing session contract

Title, status, elapsed clock, recording preference, goal, and optional existing
notes come from the same `Session & { games: Game }` used by normal StandBy.
**Session details** reveals the goal/notes and starter explanation without
creating an experience or memory. Its keyboard-scrollable inspector occupies
the scene area instead of shrinking between controls; game/time/actions remain
outside it. Long context is checked for at least 100 px of usable text height
at 844x390 landscape and 320x568 portrait, including keyboard scrolling.
Pause/resume/finish still use the existing
authoritative actions and stale/offline guards. Recording and clock visibility
remain independent. The nook does not change optional reminder, fullscreen,
focus/Escape, wake-lock, or reconciliation ownership.

There are no new awards, invitations, milestones, arrivals, persistent world
state, preferences, schema changes, seed data, auth shortcuts, or public review
routes. Account-backed permanent contributions and optional memories are a
later layer, not part of this change.

## Loading, failure and rendering limits

The small React wrapper is memoized independently of timer/session updates.
Three.js, room geometry, and GLB loading start only when the nook is selected.
Leaving the nook or StandBy aborts pending loading and releases animation,
listeners, resize observation, skeleton/geometry/material/texture resources and
the WebGL context. Late parses are disposed rather than attached.

WebGL creation, asset/hash/parse, rendering and context-loss failures show an
explicit message over the existing game artwork with **Retry nook**. Normal
session controls remain available. Artwork view is always an explicit exit.
Failure is terminal for that initialization attempt: context loss during a
pending hash or parse rejects initialization, and a late completion cannot
overwrite the fallback with an empty "ready" view. StrictMode retry and exit
during parsing are covered with the real GLB/parser behind test-only barriers.

Ambient rendering is capped at 24 fps, DPR 1.5, approximately 1.7 million render
pixels, and one 1024-square shadow map. Static planks, furniture and foliage are
batched by material/shadow contract rather than drawn as hundreds of individual
pieces. A hidden document cancels the animation
frame loop. Reduced motion holds the authored pose and renders only on initial
load/resize or visibility changes. These are render-cost limits, **not measured
physical-phone battery, GPU, frame-rate, or thermal guarantees**. This remains
a browser surface, not native always-on display support.

## Reproduce isolated review

```powershell
npx --yes pnpm@10.34.5 run test:standby --workers 2
```

`tests/standby` renders the actual ActiveSession/StandBy/nook components with
representative A Short Hike session props and mocked server actions. Its HTTP
server exists only in the test process, not as a Next.js route or unauthenticated
production bypass. Esbuild emits separate lazy modules; the harness serves only
the one original runtime GLB. A successful harness render is not live Supabase
sign-in, cross-device persistence proof, or physical-device acceptance.

For screenshots, set `CANOPY_CAPTURE_DIR` to an existing local artifact directory.
The viewport tests capture 390x844 portrait, 844x390 landscape, 768x1024 tablet,
and 1440x1000 desktop. `CANOPY_RECORD=1` additionally records a short sanitized harness flow
with the existing Playwright video runner. It contains representative props,
not private account data, and should be labeled as an isolated review recording.

Visual checks should distinguish correct scene integration and measured layout
from the user's still-unproven personal artistic approval.

## Visual-layer checkpoint

On the original StandBy foundation `713ad29`, the final recorded run passed
**138 browser cases** (46 each in Chromium, WebKit and Firefox): the 84 existing
StandBy cases plus 54 nook/media cases. The latter include opt-in lazy loading,
one GLB load across timer/session updates, real session/goal/notes binding,
explicit failure/retry/context-loss fallback, remote finish, stale guards,
recording independence, measured viewport/pixel bounds, long content, and actual
WebGL draw-call counters remaining unchanged while reduced/hidden.
The less-is-more refinement additionally checks decorative-copy removal and
simultaneous relevant keep-awake/fullscreen warnings in a small landscape view.
Independent review's initialization-race and collapsed-details failures were
first reproduced against the refined source, then fixed with hash/parse,
StrictMode, retry/unmount and measured readable-height regressions. High-density
resize also verifies the actual render-pixel/DPR ceilings without reloading art.

Changed-file ESLint and the production build passed. Independent `tsc --noEmit`
reported only the ten known implicit-cookie-type errors in unchanged
`lib/supabase/server.ts` and `lib/supabase/proxy.ts`; the build intentionally
skips type validation per the existing project configuration. No claim of a
clean whole-repository typecheck is made.

Captures are actual headless browser renders of the production components in the
isolated harness, with representative props. No live personal account was
accessed. Device performance, live sign-in on the new preview hostname,
cross-device account behavior, and personal artistic approval remain unproven.
Any subsequent foundation correction needs its own synchronized rerun.
