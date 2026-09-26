# Just Play: the cozy treehouse prototype

**Open `index.html` directly, or preview at http://127.0.0.1:4175.**
The generated HTML is the deliverable: CSS, JavaScript, React, Framer Motion,
Three.js, procedural graphics, and redistribution notices are embedded. It does
not fetch fonts, textures, models, CDN scripts, or game metadata.

This is an original toy-diorama interpretation of the approved cozy direction,
not a reproduction of Animal Crossing assets or characters.

## Scope and branch

Based on `v2` at `949d0d6`, on `ortizjorge639-treehouse-redesign`.
`feature/treehouse` was already included in `v2`. `main` contains the reverted
v2 rollout and is not the baseline for this prototype.

Production routes, auth, Supabase, IGDB, root dependencies, and root configuration
are unchanged. The separate `fix/treehouse-empty-state` commit (`9f6ef9c`) remains
an integration follow-up, not silently cherry-picked into this prototype.
Jorge approved committing and pushing this prototype feature branch on
2026-09-26. That approval does not include production integration, deployment,
or merging into `main` or `v2`.

## Run or rebuild

```sh
cd prototypes/treehouse
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm serve
```

Only **building** needs downloaded dependencies. The resulting HTML works
without them. Browsers may restrict local storage for `file://`; localhost is
the most reliable preview and gives the file a stable storage origin.

The renderer is `WebGPURenderer`, with its WebGL2 fallback when WebGPU isn't
available. Settings report the active backend. `/?webgl` explicitly exercises
the fallback; complete renderer failure leaves library controls usable.
System fonts are used, so typography can vary slightly between devices.

## Pass-by-pass diff and walkthrough

| Pass | Source | How to verify |
| --- | --- | --- |
| LOOK | `src/style.css`, `src/scene.ts`, `src/app.tsx` | Open Treehouse, Backlog, and In progress at desktop and phone sizes. Inspect the original six animal silhouettes, wooden clubhouse, paper note, and shared controls. Select residents in the roster or the scene. Switch afternoon/evening and rotate/reset/zoom the diorama. |
| FEEL | `src/app.tsx`, `src/scene.ts` | Start TUNIC from Backlog: its artwork shares into In progress. Start and pause a session or log 25 minutes. Finish the game: Fern grows into the treehouse with a short settling motion and mote burst. Reload: the completed state remains. Enable reduced motion or pause ambient motion; core actions still work without the choreography. |
| PERFORM | `src/scene.ts`, `build.mjs`, `profile.mjs` | Generate the reference artifact and run the profiler below. Inspect real backend, draw calls, frame cadence, and CPU submission samples. Leave Treehouse for another state: the optimized canvas stops drawing. |

`src/data.ts` contains a versioned, validated local save and explicitly synthetic
sample library. `DESIGN.md` records the implemented visual vocabulary.
`index.html` is generated; edit source, then rebuild rather than editing its bundle.
Compare the change set against `origin/v2`, not `main`, to exclude the old rollout
and its reverts.

## Performance evidence

The comparison is **the same new prototype with optimizations disabled**, not
the old production application. `baseline.html` is unminified, uses individual
static meshes, redraws static shadows every frame, has a DPR ceiling of 2, and
does not suspend inactive scenes. The final version instances static geometry,
retains static shadows, caps DPR at 1.5, and renders ambient motion at roughly
30 fps rather than 60 fps. Direct camera controls remain interactive.

Measured on this Mac in full Chromium 153 headless, WebGPU, 1440x1000 CSS pixels,
device scale 2, after a five-second warm sample:

| Measurement | Reference | Optimized |
| --- | ---: | ---: |
| Draw calls / rendered frame | 1,053 | 138 |
| Static mesh batches | 484 | 53 |
| Triangles including shadow work / frame | 302,827 | 167,571 |
| CPU render-submission median | 3.3 ms | 2.7 ms |
| CPU render-submission p95 | 3.9 ms | 3.9 ms |
| Ambient frame interval | 16.7 ms | 33.3 ms |
| Canvas DPR ceiling | 2 | 1.5 |

That is **87% fewer draw calls**. Submission timings are CPU timings around
`renderer.render`, not GPU execution time or whole-app INP. The final p95 sample
did not improve. Shader initialization varied with caching (the final run was
148 ms reference / 270 ms optimized), so no startup improvement is claimed.

Minification reduced the artifact, including embedded dependency license notices,
from about 3,437 KiB to 1,309 KiB raw, and 622 KiB to 362 KiB gzip.
Build output reports the exact current sizes. Gzip is a transfer
comparison; the tiny local preview server intentionally serves the raw HTML.

```sh
corepack pnpm build --baseline
corepack pnpm run profile
# Repeat timings without replacing screenshots:
corepack pnpm run profile --metrics-only
```

This writes `artifacts/profile.json` and desktop/mobile screenshots. Full
Chromium (`channel: "chromium"`) is intentional: this machine's headless-shell
WebGPU device was lost, while full Chromium rendered correctly.
`window.treehouseMetrics` exposes bounded diagnostic samples in browser DevTools.

## Automated checks

```sh
corepack pnpm typecheck
corepack pnpm exec playwright install chromium
corepack pnpm test
```

The local checks cover rendering, offline operation, the game lifecycle, sessions,
search, local-save persistence and recovery, dialogs, and responsive/reduced-motion
behavior. There was no pre-existing browser-test runner for this standalone
artifact; its tooling is isolated from the Next.js package.

## Prototype boundaries

- Data is local to this file's/browser origin, not an account or cloud backup.
  Switching between `file://` and localhost uses different storage.
- A maximum of 100 local games is supported. The diorama displays 12 visitors at
  once; the complete roster remains available, and selecting any resident brings
  them into view. This is explicit in the interface for larger collections.
- Time goals are gentle 25-minute defaults. Pausing saves elapsed time; starting
  another game's session first saves the old session. There is no punitive streak,
  XP economy, sound playback, or background audio.
- Reset requires an explicit checkbox and affects only this prototype's save key.
- The design detector's three inset-shadow warnings were reviewed as intentional
  toy thickness on the logo, primary button, and goal fill, not accent sidebars.
  A real width-transition issue was changed to a transform-based progress fill.
- The screenshot review found no remaining material visual defects. That does not
  establish complete assistive-technology or cross-browser conformance.

**Next gate: approval of the prototype before production integration.**
Tailwind v4/shadcn component integration, React Server Component boundaries,
authenticated lifecycle wiring, Supabase query plans, IGDB token/metadata
caching, production bundles, and production before/after timings belong to that
separately approved phase. No production performance improvement is claimed here.
