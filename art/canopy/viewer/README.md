# Canopy local inspection bench

Standalone diagnostics, **not production integration or artistic approval**.
No lifecycle persistence, telemetry, CDN, remote assets, uploads, or approval
workflow. Only the proposed Pip and Sol are instantiated. Original September 12
source was adapted for repo portability on September 26; historical evidence
remains immutable in `../approval-v003/`.

## Install and serve

From this directory, with Node/npm installed:

```sh
npm ci --no-audit --no-fund
npm run serve
```

Open `http://127.0.0.1:4173/web/`. `PORT=0 npm run serve` chooses a free port.
Stop with Ctrl-C. The server binds **127.0.0.1 only**, rejects foreign Host headers,
and permits GET/HEAD only. It exposes exactly the inspection HTML/JS/CSS,
Three.js browser modules, the selected manifest, and nine named GLBs.
There is no directory listing or general repository/source/evidence serving;
hidden paths and symlinks outside each mount are refused.

The historical URL prefix `/canopy-v001/` is a virtual mount, **not a required
directory**. It maps to `../approval-v003/` by default. To inspect a rebuild:

```sh
CANOPY_ASSETS=../generated/my-rebuild npm run serve
```

`CANOPY_ASSETS` resolves from the working directory and must select
`approval-v003` or a nonsymlinked directory under `generated/`. This keeps the
server from exposing repository secrets even if launched from the repo root.
The viewer's pinned Three.js 0.180.0 is independent of the app's dependency.

## Automated checks

```sh
npm run browser:install
npm test
CANOPY_RUN=review-final npm run verify:all
CANOPY_ASSETS=../generated/my-rebuild CANOPY_RUN=review-rebuild npm run verify:all
```

Playwright 1.63.0 installs Chromium to ignored `.browsers/`; profiles and test
screenshots use `.runtime/`. To reuse an already installed compatible browser,
set `PLAYWRIGHT_BROWSERS_PATH` to its cache root. No personal path is required.

`npm test` exercises synthetic in-memory GLBs, missing assets on desktop/mobile,
controls, marker/animation validation, loopback restrictions, outside-mount
symlinks, and output safety. Synthetic fixtures are not evidence for the real art.

`verify:all` runs three independent real-file checks (also individually available
as `verify`, `verify:cameras`, and `verify:optional`). Each starts/stops its own
loopback server and Chromium, including failure cleanup:

| Check | Evidence / boundary |
| --- | --- |
| Core | Six files: environment, Pip, Sol, ember-small, hearth-deck, rain-postcard. Full buffer lengths and SHA-256, finite geometry/materials, bounds, +Y orientation, 11 semantic markers, six full-duration clips, closed ambient sweep. Captures day/night views, true orthographic turnarounds, clip extrema, and roof-hidden interior. |
| Cameras | Separately imports all six named source cameras. Uses current manifest byte length, not a fixed historical file size. Samples `Ambient loopAction` at 145 times, zero-to-six-second tracks, upright axes, specified positions/aims, nonzero motion, endpoint closure. |
| Optional | Separately imports 428-triangle enrichment and 726-triangle/94-object collision. Checks current hashes, bounds, materials, positive upward bridge normals, and 85 real downward bridge ray hits. **Not complete navigation certification.** |

Fresh output goes to `../generated/<CANOPY_RUN>/{core,cameras,optional}/`.
Without `CANOPY_RUN`, each command selects a new timestamped run. Existing
subdirectories are refused; choose a new run rather than overwrite old evidence.
The archived PNGs/JSON are never rewritten. Failed runs do not write a success
report. Historical reports do not establish success for changed code/assets.

The default environment/contribution budget is 180,000 triangles; the core
scene uses 150,594 because the 428-triangle enrichment is checked separately.
Pip/Sol add 13,628 triangles. The verifier inspects 342 character samples,
including endpoints, across all six clips. Three.js material primitives are
draw meshes, not the nine static GLB mesh definitions.

## Motion capture (optional)

```sh
CANOPY_RUN=my-capture npm run record
CANOPY_RUN=my-capture npm run record -- --night
CANOPY_RUN=my-capture npm run record:characters
```

Ambient output is always the final **phased** version; the old `--phased` flag
is accepted for compatibility but no longer changes filenames or timing.
The output subdirectories are `ambient-phased-frames`,
`ambient-night-phased-frames`, and `character-action-frames`.

Ambient capture writes 144 PNGs, 960x640, 24 fps, six seconds, without a duplicated
final frame. The viewer's sinusoidal overview camera sweep is closed; Idle clips
use an integer number of cycles and Sol has a 0.85-second phase offset.
**This is not the exported Blender camera.** Source-camera motion is verified
separately by `verify:cameras`.

Character capture writes 192 frames over eight seconds: exact exported 3s Idle,
2s Walk (two loops), 3s Greeting, without crossfades or retiming. Comparison
characters intentionally synchronize. Both recorders check strict browser/network
errors and write sequence metadata; raw frames remain ignored.

Encode, for example (optional FFmpeg, from this directory):

```sh
ffmpeg -hide_banner -loglevel error -n -framerate 24 \
  -i ../generated/my-capture/ambient-phased-frames/frame-%04d.png \
  -c:v libx264 -threads 2 -crf 20 -pix_fmt yuv420p -movflags +faststart \
  ../generated/my-capture/ambient-phased.mp4
```

Use the night or character frame directory similarly. `24 fps` specifies sampled
or encoded media, not measured real-time performance. Grayscale turnarounds
can be derived with FFmpeg's `format=gray` filter; the original is already archived.

## Import, lighting, and control contracts

World assets stay in glTF world coordinates; origin-space characters receive
viewer-only placements (Pip `[0,0,3]`, Sol `[4,0,2]`). No global rotation hides
orientation mistakes. The manifest supplies expected marker coordinates, character
heights/bones/clips, periods, SHA-256, and file lengths. Feet rest at zero and
character forward is +Z. Default heights are 1.660858 m and 1.668 m, tolerance
2 cm. Exactly named character clips are isolated on their owners.

The viewer consumes the original manifest's `coordinates`, `characters`, and
`files_sha256` fields. Optional `viewer` settings can override lights, cameras,
placements, animation aliases, markers, and deliberate limits, but do not silently
raise budgets. The source exporter uses `ACTIONS`,
`export_anim_single_armature=False`, and `export_anim_slide_to_zero=True`.
All clips start at zero; Idle/Greeting last 3s, Walk 1s, with closed endpoints.
Large adjacent sample deltas are reported for review, not hidden by interpolation.

GLBs load via native `Response.arrayBuffer()`, declared length and hash checks,
then `GLTFLoader.parseAsync()`. This fixed historical Chromium progress-stream
abort events without suppressing failures.

Constant metallic/roughness PBR stays intact; no procedural shader emulation or
external texture bake is needed. Explicit hemisphere, directional, and seven
warned fallback lantern points recreate approximate lighting, not Cycles/AgX.
Point lights sit below opaque paper fixtures; emission alone is visual-only.
Fallback values are tuned Three.js intensities, not a Blender energy conversion.
Point shadows are off, so there is no pixel-match or production-lighting claim.

Roof hiding recognizes `extras.configurable === "roof"`, `extras.roof`, or roof
node names. Cast turnarounds are level orthographic front/left/back/right at
0/90/180/270 degrees. Other views retain perspective. Playback starts paused;
`?capture=1` hides controls for exact-viewport capture.

For diagnostics, `window.canopyTest` exposes `ready`, `error`, `manifest`,
`warnings`, `stats()`, `setView()`, `setLighting()`, `playAction()`,
`setPlaying()`, `setTime()`, `renderOnce()`, `setRoof()`, `setCastAngle()`,
`setCastProjection()`, `sampleClip()`, and `snapshot()`. Wait for `ready === true`
and `error === null` before use. No control grants residency, merit, progress,
structure placement, or artistic approval.
