# Canopy: current approval-slice specification

**Created September 12, 2026; archival status September 26, 2026.**
Technical delivery is complete; artistic acceptance is pending. The full
original brief describes a larger future ambition than the authorized first
slice. Its proposed avatar style must not be promoted to an accepted decision.

## Problem statement

The procedural demo establishes product behavior and topology, but not the
finished art language. The owner needs a representative, editable, browser-tested
slice to judge that language before commissioning the rest of the settlement.
Its source, findings, and evidence must survive outside chat storage.

## Solution and user stories

1. As the owner, I can compare the first woodland slice in daylight, lantern
   night, character views, and motion before deciding on the art direction.
2. As a future artist, I can reopen modular source and rebuild/export it without
   another person's filesystem or intermediate development files.
3. As a future integrator, I can distinguish usable assets and measured facts
   from pending product work, proposed aesthetics, and navigation assumptions.

## Acceptance criteria

- [x] A gathering tree with shared seating, table, planters, and warm light;
  connected grove home with a physically furnished reading room and open doorway.
  Evidence: source collections and six environment render studies.
- [x] Original Pip and Sol, editable modular parts on compatible 16-bone rigs,
  approximately 1.66 m tall and 2.7 heads; Idle, in-place Walk, and Greeting.
  Evidence: character interface, posed contact sheet, true browser turnarounds,
  full-duration source/browser samples, independent per-character GLBs.
- [x] Separate ember reliquary, Sol's earned hearth deck with plot bridge,
  toggleable planting/journal enrichment, and Rue's warm rain postcard at the
  welcoming trailhead. No Rue avatar. Evidence: separate GLBs and source collections.
- [x] Seven attachment markers for future sites, without representing deferred
  destinations as completed settlement modules. Evidence: source marker and
  browser orientation checks against the study topology.
- [x] Two lighting scenes, six named exported cameras, a six-second source camera
  loop, and separate final phased day/night ambient videos.
  Evidence: exact-file audit, camera import samples, MP4 frame probes.
- [x] World-aligned meter units, portable constant-PBR materials, no required
  external textures/fonts/libraries, nine loadable GLBs, and environment plus
  contributions at or below 180,000 triangles with character costs separate.
  Evidence: exact-file audit and actual export/accessor measurements.
- [x] Final editable file, exports, original brief, compact visuals/motion,
  historical evidence, and working development source stored in the repository.
  Evidence: original SHA-256 checks and separate archival verification.
- [x] Default development commands allocate ignored fresh output and refuse
  clobbering; rebuild does not need omitted smoke/intermediate artifacts.
  Evidence: isolated complete rebuild, generated-export browser checks, and
  output-safety regression tests.
- [ ] **Pending human decision:** explicit art-direction approval of environment
  and avatar language. Technical checks and the archival request do not satisfy it.

## Accepted product semantics

Backlogged and invited avatars stay **outside** the settlement. Meeting the
player's chosen stamp grants exactly one permanent resident, even for a two-hour
stamp. Later merit enriches the same person's contribution, never duplicates the
resident or reduces the dignity of an early arrival.

Ending an unarrived invitation can leave a warm, non-decaying postcard. Re-inviting
retains it; arrival or explicit deletion removes it. The application owns proof,
persistence, lifecycle, and player-chosen compatible placement. Construction has
no costs or timers. Blender and the viewer only illustrate these states, and
ambient viewing awards no progress.

## Implementation and testing decisions

Keep editable source separate from batched export geometry. Use isolated Blender
processes, explicit disk inputs, disabled auto-execution, and fresh generated
outputs. Import the exports in a standalone loopback-only Three.js inspection
bench with its own locked dependencies, not in the Next.js application.

Test the saved artifacts and complete command interfaces: original hashes and
file coverage; source reopening; actual GLB primitives, units, markers, actions,
and materials; full-loop numeric samples; camera closure; real downward rays onto
upward bridge faces; synthetic browser controls/errors; and output/path safety.
The existing demo tests remain the authority for application lifecycle semantics.
No target-device performance claim follows from a polygon count or encoded fps.

## Out of scope / deferred

The remaining four residents (Wren, Nori, Io, Rue), neutral player configuration,
complete modular avatar catalog, additional actions, full settlement/lookout,
remaining contribution families, production LOD/instancing, and account/runtime
integration await separate approval. No new art, application replacement, public
asset upload, push, PR, merge, or release pipeline is authorized by this archive.

Physical interior navigation, whole-house obstacle replacement, and complete
furniture collision require deliberate later integration. This is not a
drop-in production asset replacement or a complete navigation mesh.
