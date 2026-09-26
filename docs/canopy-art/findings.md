# Canopy: reloadable production findings

These facts apply to the **September 12 approval slice**, archived September 26.
Technical delivery is complete; visual approval is pending. See the
[evidence index](README.md) for primary artifacts and [commands](../../art/canopy/README.md)
for the portable adaptations.

## Shape, style, and measured costs

The proposed style is a warm handcrafted woodland diorama: composed foliage
clusters with visible negative space, supported timber decks, readable doors,
soft tool-cut edges, purposeful furnishings, and restrained irregularity.
Palette anchors include pine `#294F41`, moss `#647844`, timber `#A58360`,
cream `#DFD6B8`, clay `#C28C6D`, and amber paper `#FFD99B`. Surface identity
comes from authored geometry, color, roughness, and restrained emission, not
photorealistic noise or procedural texture detail requiring a hidden bake.

Pip's tousled hair, apron, and satchel contrast with Sol's swept silhouette, cape,
boots, and pendant. Parts remain editable and interchangeable in Blender.
Approximately 2.7-head proportions and their faces/costumes are proposed art,
not an accepted final character system.

| Measured scope | Triangles | Meshes / other counts |
| --- | ---: | --- |
| Environment + all contributions | 151,022 / 180,000 baseline | 9 static GLB meshes, **82 material primitives**, not 9 draw calls |
| Core viewer world, without optional enrichment | 150,594 | Six core files loaded including two characters |
| Pip | 7,158 | 72 meshes, 16 bones, 3 clips |
| Sol | 6,470 | 70 meshes, 16 bones, 3 clips |
| Optional hearth planting/journal | 428 | 1 GLB mesh split into 6 material draw meshes by Three.js |
| Collision proxies | 726 | 94 objects, 85 walkable bridge pieces |
| Source approval scene | All costs above measured separately | 4,865 objects; 2 lighting scenes; 7 actions total |

The slice already consumes **83.9%** of the initial full-world environment budget,
leaving 28,978 triangles. Expansion needs reduced repeated bevels, lower-detail
foliage, shared geometry/materials, batching, and eventually LOD/instancing;
do not silently raise the budget. Character modularity currently costs separate
draw meshes. Three.js splits material primitives; lights/render passes can add
work. Neither these counts nor 24-fps encoded video establish target-device fps.

## Coordinates and topology

Units are meters. Given application coordinates, Blender coordinates are
`(app.x, -app.z, app.y)`. The inverse is `(blender.x, blender.z, -blender.y)`.
Standard glTF Y-up export restores the application basis, with character forward
`-Y` in Blender becoming `+Z` in glTF. Do not add a global correction rotation.

| Marker / platform | Application / glTF position | Radius |
| --- | --- | --- |
| Gathering | `(0, 0, 0)` | 10 m |
| Grove | `(20, 3, -5)` | 8 m |
| Trailhead | `(-6, -1, 22)` | 6 m |
| Plot / hearth | `(37, 4, 10)` | 6 m |
| Brook | `(30, 4, -23)` | 5 m |
| Crown | `(12, 6, -40)` | 5 m |
| Fern | `(-18, 5, -29)` | 5 m |
| Dusk | `(-39, 3, -7)` | 5 m |
| Meadow | `(-27, 1, 17)` | 5 m |
| Sunrise | `(12, 0, 25)` | 5 m |
| `DOOR_Grove` | `(17, 3, -3.1)` | Door marker, not a platform |

The seven `ATTACH_*` sites retain the positions/parents in
[`world.ts`](../../lib/demo/world.ts); only the plot is occupied in this slice.
Bridge endpoints remain `radius - 1` from centers, with the existing 0.35 m
sinusoidal rise and 2 m traversable proxy width inside rails. The door has at
least 1.4 m clear width and 2.2 m height.

**Integration seam:** the demo teleports to `INTERIOR_CENTER = 190`, whereas
the art has a physical room at the home footprint. Either clone/reuse the
`Grove_Interior` mesh in the remote interior or explicitly change the doorway
transition. The existing whole-house obstacle is not a substitute for the
door-aware wall proxies. Tables, planters, benches, and furnishings still need
navigation treatment. Proxy import/raycast success is not navmesh certification.

## Animation and export lessons

| Verified issue | Working treatment and boundary |
| --- | --- |
| Selecting one rig still captured the other character's actions | Use `export_anim_single_armature=False`, `ACTIONS`, `export_merge_animation="NONE"`; select root plus recursive descendants. The retained integration test demonstrates the bad `True` case and exact three-clip ownership. |
| Frame-one exports began at 1/24 second | Set `export_anim_slide_to_zero=True`. Idle/Greeting are 3 s, Walk 1 s; source endpoints are frames 73/25. Playback excludes the duplicated endpoint. |
| Multi-rig action discovery | Character-specific action slots, fake users, and muted Walk/Greeting NLA stash tracks preserve clips; only Idle evaluates by default. Keep stash tracks muted. |
| Bridge proxies rejected rays from above | Final v003 flips downward bridge faces. Check **positive upward normals**, not `normal.y > .8` (valid inclines are shallower), plus actual Three.js downward ray hits. The final optional-import report supersedes v001 collision hashes. |
| Lantern paper self-occluded the point light | Move the companion source below the opaque lantern base. Emissive paper does not illuminate neighbors in standard Three.js. |
| Browser progress streams emitted `net::ERR_ABORTED` after HTTP 200 | Fetch full native `Response.arrayBuffer()`, validate declared length and SHA-256, then `GLTFLoader.parseAsync()`. Keep strict network/console failure checks; do not suppress the symptom. |

Both rigs use segmented/rigid skinning, not IK, facial controls, motion retargeting,
or world-space foot locking. Source bone matrices, selected evaluated vertices,
joint separation, loop repetition, and Blender round-trips were checked.
The browser sampled all six full clips at 24 Hz (342 samples including endpoints).
Numeric closure proves neither naturalistic foot contact nor artistic approval.

The source ambient camera has a six-second action, 145 numeric samples including
closure, and zero endpoint matrix delta. Its starting application position is
`(44, 26, 42.9)`, aimed at `(12, 2, 0)`. The final videos instead use the viewer's
closed overview sweep near `(58, 48, 75)`, aimed at `(12, 1.5, 4)`.
Sol is offset by 0.85 s in ambient mode, not in action comparisons.

## Appearance boundaries

Cycles area/world lighting, bounce light, AgX, and exposure do not automatically
port through glTF. The viewer uses explicit PBR hemisphere/directional/point
lights and its own tone mapping; point shadows are disabled. No bloom/fog or
pixel-equivalence claim is implied. Browser screenshots look less soft than Cycles.
The walking composition partly crops Sol at the right foreground, and distant
night faces are dark away from lantern pools. These were recorded limitations,
not reasons to silently redesign the art during archiving.

## Archival portability decisions

The original build script already contains the final visible environment;
`environment-source-v002.blend` was a checkpoint, not an irreplaceable dependency.
The portable runner regenerates that environment, adds characters and final
lighting/collision corrections, saves, reopens, and exports in isolated processes.
Cameras/collision export from fresh file loads so destructive static batching
cannot affect another export.

The old manifest depended on separate smoke output and a browser delivery report,
creating a circular bootstrap. The new manifest derives measured characters from
the exact-file audit and checks all nine exports, explicitly leaving new browser
verification unclaimed until run. The camera verifier reads the current manifest's
byte count instead of requiring 8,036 bytes for every future serialization.

Original delivery files retain exact bytes and hashes. Rebuilds are functionally
reproducible, not promised byte-identical `.blend` serializations. The September 26
rebuild produced eight byte-identical GLBs; collision JSON was identical and its
binary differed in six bytes, while geometry counts, bounds, upward normals, and
all 85 downward bridge rays still passed. Only the shared six-index quad
triangulation buffer differed (`0,3,2,0,2,1` versus `3,2,1,3,1,0`); positions and
normals were unchanged. Re-exporting the exact archived blend reproduced all
nine GLBs byte-for-byte. The immutable v003 remains authoritative.

Fresh checks use Blender 5.2.1 LTS, Three.js 0.180.0, Playwright 1.63.0, Node
26.7.0, and Python 3.14.7 on macOS. The Next.js demo uses a different Three.js
version; the viewer lockfile is intentionally independent. Development logs,
regenerated scenes, profiles, and captures remain ignored, not shipped as another
copy of the delivery. Historical paths in evidence are not executable defaults.
