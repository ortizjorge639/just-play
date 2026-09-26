# September 26 archival verification

Fresh checks of the relocated tools and copied September 12 delivery.
**Not artistic approval, new art production, or application integration.**
The original evidence remains untouched in `../../approval-v003/`.

`portability.json` records versions, successful command families, source hashes,
original/rebuilt/re-exported asset hashes, coverage, and explicit exclusions.
The JSON below is copied from successful isolated runs. Absolute worktree paths
in fresh character reports are normalized to repository-relative paths;
the normalization and pre-normalization hashes are recorded in `portability.json`.
Ignored generated directories are provenance references, not required inputs.

| File | Observation |
| --- | --- |
| `archive-integrity.json` | 64 byte-identical preserved files (63 delivery + original 128-line brief), nine checked GLBs, source-file coverage |
| `blender-final.json` | Reopened exact archived blend: 4,865 objects, two scenes, seven actions, individual rig geometry, markers, units, no external dependencies |
| `blender-rebuild.json` | Independent environment + characters + finalization rebuild from source, no intermediate/smoke prerequisite |
| `export-rebuild.json` | Actual regenerated nine-file geometry/material/clip counts and 151,022-triangle environment budget |
| `browser-final.json`, `cameras-final.json`, `optional-final.json` | Relocated viewer imports original files; six clips/11 markers, six cameras/145 samples, 94 proxies/85 downward bridge ray hits |
| `browser-rebuild.json`, `cameras-rebuild.json`, `optional-rebuild.json` | Same consumer checks against new source rebuild |
| `character-source.json`, `character-isolation.json` | Numeric source/disk/GLB round-trip tests and exact per-character clip ownership, including the bad single-armature diagnostic |
| `media.json` | Final phased day/night 144-frame MP4s and 192-frame character MP4 decode to specified dimensions/durations |

## Commands exercised

From the repository root, with the installed Blender executable selected by
`BLENDER_BIN` (Blender 5.2.1 LTS in this run):

```sh
python3 art/canopy/source/verify_archive.py
python3 -m unittest discover -s art/canopy/source -p 'test_*.py'
python3 art/canopy/source/finalize_evidence.py
python3 art/canopy/source/run.py rebuild --name portability-rebuild
python3 art/canopy/source/run.py export --name portability-export
python3 art/canopy/source/run.py verify --name final-reopen
python3 art/canopy/source/run.py characters --name portability-characters
python3 art/canopy/source/verify_archive.py --assets art/canopy/generated/portability-rebuild
python3 art/canopy/source/package_canopy.py --name package-portability-check
python3 art/canopy/generated/package-portability-check/art/canopy/source/verify_archive.py
```

From `art/canopy/viewer/`:

```sh
npm ci --no-audit --no-fund
npm test
CANOPY_RUN=portability-final npm run verify:all
CANOPY_ASSETS=../generated/portability-rebuild CANOPY_RUN=portability-rebuilt-browser npm run verify:all
```

Four Python tests and four viewer tests passed. All Python scripts parsed and
all viewer JavaScript modules passed `node --check`. New doc links and scoped
app-tool exclusions were checked. `git diff --cached --check` covers the archive
addition as well as the existing-doc edits.

The installed matching Chromium was reused via `PLAYWRIGHT_BROWSERS_PATH`;
no browser binaries are committed. Node was 26.7.0, Python 3.14.7, Three.js
0.180.0, Playwright 1.63.0. The precise Chromium version is in the browser reports.

## Boundaries

Original media was decoded/probed, not re-rendered. Fresh representative viewer
screenshots were inspected but not duplicated into Git. Full Cycles rendering,
all 144/192-frame capture sequences, and target-device performance were not
rerun during archiving. Character source checks ran without their optional
render pass. The archived original render evidence remains available.

Eight rebuilt GLBs match original hashes. The rebuilt collider has identical
JSON, positions, and normals, but uses the alternate shared quad triangulation
indices, changing six bytes. All counts/bounds/raycast checks pass. A re-export
of the exact final saved blend matches **all nine** original hashes. New `.blend`
serialization is not claimed byte-deterministic.

No application runtime source was changed; only narrow TypeScript/ESLint
discovery exclusions keep the offline tools out of app checks. The production
Next.js build and unrelated legacy lint suite were not rerun for this archive.
The temporary offline package was verified and removed; the source archive and
useful ignored development runs were retained.
No push, PR, merge, upload, AXI run, live Blender modification, or user approval
was performed or inferred.
