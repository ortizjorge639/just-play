# Offline Canopy art workspace

**Art approval is pending.** This is the technically complete September 12
representative slice, archived September 26, not production integration.
Start with the [archive/spec/evidence index](../../docs/canopy-art/README.md).

| Directory | Purpose |
| --- | --- |
| `approval-v003/` | Immutable editable final blend, nine GLBs, compact original evidence and reports |
| `source/` | Portable build/finalize/export/render/verify/package tools and character development tests |
| `viewer/` | Standalone Three.js 0.180.0 inspection bench with its own npm lockfile |
| `checks/2026-09-26/` | Fresh portability evidence, separate from historical evidence |
| `generated/` | Ignored new runs; never a substitute for the archived delivery |
| `provenance.json` | Original copied-file hashes and relative source lineage |

No assets are under `public/`, imported by Next.js, or fetched from a CDN.
App TypeScript and ESLint discovery exclude only this offline `art/canopy/`
tree; its source syntax, Python tests, and browser checks run independently.
No LFS/external asset storage is required. Do not overwrite the delivered files
to make a new experiment look like the September 12 result.

## Check or inspect without rebuilding

From the repository root (Python 3.10+):

```sh
python3 art/canopy/source/verify_archive.py
python3 -m unittest discover -s art/canopy/source -p 'test_*.py'
python3 art/canopy/source/finalize_evidence.py  # optional: requires ffprobe
```

Open `approval-v003/canopy-approval-v003.blend` in Blender to edit a **new saved
version**, or use the exact-file check below to leave the GUI untouched.
All required geometry/materials are embedded; no external textures/fonts/libraries
or procedural material bakes need restoration.

## Isolated Blender commands

Use Blender **5.2.1 LTS** for the recorded results. Put `blender` on PATH or set
`BLENDER_BIN` to your installed executable. For a standard macOS installation:

```sh
export BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"
python3 art/canopy/source/run.py verify
python3 art/canopy/source/run.py rebuild --name my-rebuild
python3 art/canopy/source/verify_archive.py --assets art/canopy/generated/my-rebuild
```

`verify` reopens the final copied blend using `--background --factory-startup
--disable-autoexec`, writes a new audit, and checks the immutable archive.
`rebuild` makes the environment from source, adds Pip/Sol and final corrections,
saves the final blend, reopens it for audit, exports all nine GLBs, then writes
measured export/manifest reports. It needs **no** old environment checkpoint,
smoke metadata, live MCP scene, or browser evidence.

Each command reserves a new child of `generated/`. Without `--name`, a fresh
timestamped name is used. Existing names, symlinked output roots, and writes
outside the owned run are refused; there is no force flag. Lower-level scripts
require the runner's owned output context. A failed run remains inspectable;
use a different name rather than overwriting it.

Additional bounded commands:

```sh
# Re-export the exact immutable source into a new output; never change its GLBs.
python3 art/canopy/source/run.py export --name export-study
# Use any explicit study blend as input; still writes only to generated/.
python3 art/canopy/source/run.py export --blend art/canopy/generated/my-rebuild/canopy-approval-v003.blend
# Six CPU Cycles studies; optional and relatively expensive.
python3 art/canopy/source/run.py render
# Numeric character development + disk/GLB round-trip + action isolation checks.
python3 art/canopy/source/run.py characters
# Also produce the original four poses and contact sheet.
python3 art/canopy/source/run.py characters --render-characters
```

Rebuilds preserve slice structure and contracts, not `.blend` byte determinism.
The exact archived file is verified by SHA-256. Fresh GLB manifests record their
own hashes. Source animation tests and browser loop sampling are complementary;
neither certifies realistic foot locking or production performance.

## Browser inspection

```sh
cd art/canopy/viewer
npm ci --no-audit --no-fund
npm run browser:install   # only needed for automated Chromium checks
npm test
npm run serve
```

Open the loopback URL printed by `serve` (default
`http://127.0.0.1:4173/web/`). Stop it with Ctrl-C. No browser automation dependency
is needed just to view it in your own browser. See the
[viewer guide](viewer/README.md) for exact mounts, controls, captures, and limits.

```sh
# Still from viewer/: verify all final GLBs, never overwrite historical evidence.
CANOPY_RUN=final-review npm run verify:all
# Inspect a source rebuild. Relative asset paths are relative to the working directory.
CANOPY_ASSETS=../generated/my-rebuild CANOPY_RUN=rebuilt-review npm run verify:all
```

An existing compatible Chromium installation can be selected with
`PLAYWRIGHT_BROWSERS_PATH`; the override is not hardcoded or required by the
archive. Otherwise `browser:install` places it in ignored `viewer/.browsers/`.

## Packaging and evidence

`python3 art/canopy/source/package_canopy.py --name portable-package` makes a
new ignored folder with the offline archive, docs, and source-context files.
It excludes generated runs, caches, dependencies, and browser binaries, and
does not create a duplicate ZIP or upload anything. It is an offline art package,
not a runnable copy of the whole Next.js application.

`finalize_evidence.py` now checks encoded final videos directly with `ffprobe`;
it does not require omitted PNG sequences or mutate historical reports.
New recordings can be encoded with the viewer guide's optional FFmpeg commands.

Original source hashes in `provenance.json` describe **pre-adaptation** source.
`verify_archive.py` enforces original bytes for the 63 delivery files and
128-line brief, checks source-file coverage, then validates all nine GLBs.
Fresh checks are intentionally separate and do not confer artistic approval.
