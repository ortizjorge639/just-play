# Canopy art archive

**Technical approval slice: complete. Visual/art-direction approval: pending.
Full settlement and production integration: deferred, not authorized.**

Created September 12, 2026; archived September 26, 2026. The owner's subsequent
"i see" and request to store the work are not art approval. This archive does
not change `/demo`, the account-backed app, or the accepted product rules.

## Start here

| Need | Repo-contained source |
| --- | --- |
| Exact original brief | [128-line source brief](source-brief.txt), preserved byte-for-byte |
| Current scope and acceptance criteria | [Slice specification](spec.md) |
| Technical findings and integration limits | [Findings](findings.md) |
| Reopen, rebuild, export, validate | [Art workspace commands](../../art/canopy/README.md) |
| Inspect interactively | [Standalone viewer](../../art/canopy/viewer/README.md), separate from Next.js |
| Editable final project | [canopy-approval-v003.blend](../../art/canopy/approval-v003/canopy-approval-v003.blend) |
| All nine GLBs | [Exports](../../art/canopy/approval-v003/exports/) |
| Historical delivery contract | [Asset manifest](../../art/canopy/approval-v003/ASSET-MANIFEST.md) and [machine manifest](../../art/canopy/approval-v003/manifest.json) |
| Import lineage and original hashes | [Provenance](../../art/canopy/provenance.json) |
| Fresh archival checks | [September 26 evidence](../../art/canopy/checks/2026-09-26/) |

## Representative evidence

The images and videos below are the original September 12 evidence, not new
art production. All six Cycles studies, four character smoke poses plus contact
sheet, true front/left/back/right browser turnarounds, grayscale front, clip
extremes, representative day/night views, and machine reports are retained.

| Subject | Evidence |
| --- | --- |
| Gathering tree, home, trailhead, earned hearth | [Golden hour](../../art/canopy/approval-v003/renders-v002/golden-hour.png), [lantern night](../../art/canopy/approval-v003/renders-v002/lantern-night.png) |
| Furnished physical interior | [Cycles interior](../../art/canopy/approval-v003/renders-v002/furnished-interior.png), [browser interior](../../art/canopy/approval-v003/browser/interior-night.png) |
| Proposed original people | [Contact sheet](../../art/canopy/approval-v003/character-evidence/contact-sheet.png), [front](../../art/canopy/approval-v003/browser/cast-turnaround-front.png), [grayscale](../../art/canopy/approval-v003/browser/cast-turnaround-front-grayscale.png) |
| Final staggered ambient previews | [Day MP4](../../art/canopy/approval-v003/browser/ambient-phased.mp4), [night MP4](../../art/canopy/approval-v003/browser/ambient-night-phased.mp4): each 144 frames, 960x640, 24 fps, 6 seconds |
| Exact character actions | [Character MP4](../../art/canopy/approval-v003/browser/character-actions.mp4): 192 frames, 8 seconds; 3s Idle + 2s Walk + 3s Greeting |
| Full clip and orientation checks | [Browser verification](../../art/canopy/approval-v003/browser/verification.json): 342 character samples, 11 markers |
| Separate source camera verification | [Camera report](../../art/canopy/approval-v003/browser/camera-import-verification.json): six cameras, 145 samples, zero endpoint matrix delta |
| Final collision and optional enrichment | [Authoritative v003 optional report](../../art/canopy/approval-v003/browser/optional-import-verification.json) |
| Exact source reopening / geometry | [Blender audit](../../art/canopy/approval-v003/blender-audit.json), [export report](../../art/canopy/approval-v003/export-report.json) |

The ambient MP4s use a **viewer-authored** closed camera sweep and a 0.85-second
Sol phase offset. They do not show the exported Blender camera. The character
comparison is intentionally synchronized and uses no fancy blends.

## Lineage and evidence integrity

The source topology and product mapping are from study commit
`2cb9d46f77d519d7818d917d7762fcc3c6cb1196`, on
`ortizjorge639-treehouse-world-study`. Baseline `main` at `b0ecead` did not
contain this demo/study. The archive preserves the inherited study work;
it is not a claim that those features were in baseline main.

The [September 10 revision](../treehouse-world-study.md#september-10-revision-stamps-remnants-and-earned-contributions)
supersedes the earlier lodge-visitor model. The art brief's avatar anatomy,
costumes, and 2.5-3-head aesthetic are **proposals**, not accepted product rules.
All included art is original. Yukagecho was studied for atmosphere and spatial
lessons; no Nintendo or Yukagecho artwork, models, or implementation were imported.

`approval-v003/` and the original brief are immutable copies. Historical reports
retain their original timestamps, hashes, local paths, and older names (including
"v001", "six approved GLBs", and superseded unphased video references). Here
"approved GLBs" was a technical allowlist, not the owner's art-direction approval.
Those paths are provenance, not dependencies. Use this index and current commands
rather than executing old commands embedded in historical reports.

The old unphased ambient MP4s and motion sheet, intermediate blends/backups,
failed captures, full PNG sequences, giant logs, caches, browser binaries,
`node_modules`, and duplicate ZIP are intentionally omitted. The final phased
MP4s supersede those videos. Recorded JSON may refer to an omitted sequence;
its closure/encoding facts are preserved, not silently re-dated or rewritten.

`source/` and `viewer/` are explicitly **portable adaptations** of the development
scripts; original file hashes are recorded in provenance. Newly run evidence is
separate in `checks/2026-09-26/`. Everything needed to review, reopen, rebuild,
and export this slice is here apart from installed Blender, Python, Node/npm,
viewer packages/browser, and optional FFmpeg. Assets stay outside `public/`;
ordinary Git is used because this repository has no LFS requirement.
