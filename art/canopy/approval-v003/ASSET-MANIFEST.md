# Canopy - approval slice v001

Original art for Just Play. **This is the first art-direction gate, not the full
settlement or a production application replacement.**

## Included

The gathering tree and shared seating; a connected grove platform with a
physically furnished reading room; Pip and Sol; Sol's small ember reliquary;
an independently exported hearth deck, bridge, and enrichment overlay; a
welcoming trailhead with Rue's rainflower postcard, but no unarrived Rue avatar.
Seven authored attachment markers preserve future expansion.

`canopy-approval-v003.blend` contains independent golden-hour and lantern-night
scenes, editable source geometry, modular characters and rigs, source actions,
cameras, markers, and collision proxies. The six-second ambient camera cycle is
frames 1-144 at 24 fps; frame 145 is the repeated closure key, not an extra
playback frame.

The character proposal is compact original people, approximately 2.7 heads tall,
with simple readable faces and non-color silhouette differences. Pip's soft
gardener silhouette and apron contrast with Sol's swept hair, cape, and boots.
Materials use matte wood, cloth, paper, ceramic, and foliage values. Modeling and
restrained color variation provide detail, not photorealistic texture noise.

Pip uses 7,158 triangles and Sol 6,470, each approximately 1.66 m tall. Both
share 16 bone names with Idle (3 s), in-place Walk (1 s), and Greeting (3 s).
The source uses segmented armature skinning, not IK or a facial control rig.
World-space foot locking and motion retargeting are not claimed. Character
parts stay separate for configurability (72 Pip meshes, 70 Sol meshes), so a
production batching pass is still needed even though their triangle costs are
small. The six character clips have independent owners and zero-based glTF
timelines. Do not merge the two residents' action sets on export.
The browser's ambient presentation offsets Sol by 0.85 seconds to avoid
moving in unison. Cast/action comparison videos intentionally align the clips.

## Files and placement

| Export | Use |
| --- | --- |
| `exports/environment.glb` | Starter architecture, composed foliage, furnished interior, and semantic markers. Already in world coordinates. |
| `exports/pip.glb`, `exports/sol.glb` | Modular skinned characters at the origin, feet on the ground; named animation clips. |
| `exports/ember-small.glb` | Small arrival contribution, independently removable. World placement near gathering tree. |
| `exports/hearth-deck.glb` | Earned plot platform, supported shelter, hearth, and connecting grove bridge. Already at the plot site. |
| `exports/hearth-enrichment.glb` | Additional planting and a journal; enriches the same hearth without another resident. |
| `exports/rain-postcard.glb` | Warm, game-specific remnant. No weathering or decay variant. |
| `exports/collision-proxies.glb` | Separate simple walk surfaces and solid home walls; diagnostic geometry, never render as scenery. |
| `exports/cameras.glb` | Named overview, walking, home, interior, hearth, and ambient cameras, including the original looping camera action. |
| `blender-audit.json`, `export-report.json` | Exact saved-file and actual GLB geometry evidence. Character costs are separate. |
| `browser/` | Independent Three.js screenshots, animation inspection, and ambient preview evidence when generated. |

The manifest JSON and evidence reports are authoritative for measured counts
and files. Source geometry keeps separate editable objects. Static GLB geometry
is batched into a few meshes with material primitives; material primitives still
incur draw calls. This does not imply that thousands of source objects are
instanced efficiently in the browser.

## Coordinates and source fidelity

Source: Just Play's clean `ortizjorge639-treehouse-world-study` worktree at
`2cb9d46f77d519d7818d917d7762fcc3c6cb1196`. Read `PRODUCT.md`, the September 10
revision of `docs/treehouse-world-study.md`, `docs/demo.md`,
`lib/demo/world.ts`, and `lib/demo/state.ts`.

Units are meters. Blender `(x, y, z)` equals application `(x, -z, y)`.
The standard Blender glTF Y-up conversion restores application coordinates.
No additional scene rotation or scale should be applied in Three.js.

| Marker | Three.js position |
| --- | --- |
| `LOCATION_Gathering` | `(0, 0, 0)` |
| `LOCATION_Grove` | `(20, 3, -5)` |
| `LOCATION_Trailhead` | `(-6, -1, 22)` |
| `DOOR_Grove` | `(17, 3, -3.1)` |
| `ATTACH_plot` | `(37, 4, 10)` |
| `ATTACH_brook` | `(30, 4, -23)` |
| `ATTACH_crown` | `(12, 6, -40)` |
| `ATTACH_fern` | `(-18, 5, -29)` |
| `ATTACH_dusk` | `(-39, 3, -7)` |
| `ATTACH_meadow` | `(-27, 1, 17)` |
| `ATTACH_sunrise` | `(12, 0, 25)` |

Starter disc radii are 10 m, 8 m, and 6 m respectively; the plot radius is 6 m.
Bridges use the existing endpoint rule (`radius - 1`) and the existing
0.35 m sinusoidal rise. Their traversable proxy width is 2 m, within the rails.
The hearth furniture stays in the source contribution obstacle footprint.

**Interior integration is not drop-in navigation:** the source app teleports
through `DOOR` to an interior around `INTERIOR_CENTER = 190`. This art models a
physical room in the original home footprint with an open leaf and a clear
threshold. The application must either reuse/clone that interior at its remote
interior location or explicitly revise its doorway transition. The app's
existing whole-house obstacle must not be mistaken for these doorway-aware wall
proxies. Starter planters, tables, and seating also need the application's
navigation treatment; the viewer does not claim complete pedestrian collision.

The GLB `Grove_Interior` mesh can be extracted for that integration. Its source
collection remains editable. Doorway, seating, attachment, and location empties
carry semantic extras. Collision proxies are a starting kit, not a certified
navigation mesh. No application files were modified.

## Lifecycle contract

Blender and the viewer illustrate assets only. They do not award or verify
proof, alter local saves, place structures in production, or implement lifecycle
persistence.

- **Backlogged / invited:** do not instantiate that resident in the settlement.
  Invitations remain on the application's outside-world journal/map.
- **Arrived:** instantiate exactly one permanent resident and the small
  contribution, including when the chosen stamp is a short milestone.
- **Deeper merit:** enable the earned structure and its enrichment in place.
  Never duplicate or replace the resident with a more worthy-looking person.
- **Dropped invitation:** optionally instantiate the postcard. Retain it across
  re-invites; remove it on arrival or explicit user deletion. There is no decay.
- **Earned construction:** place platform, connection, collision, and map entry
  together at a compatible site. No costs or timers.

Pip and Sol are both illustrated as already arrived. Rue is represented only
by the postcard. Tier-enrichment objects are separate from the starter world.

## Browser look and limits

Materials are portable glTF metallic/roughness materials with color, roughness,
and limited emission. No image textures, procedural shader detail, downloaded
assets, external fonts, or external Blender libraries are required, so there is
no procedural texture detail to bake and no hidden texture dependency to pack.

Blender area lights, world illumination, AgX rendering, and Cycles bounce light
do not carry over automatically. The standalone viewer recreates a hemisphere
fill, directional key, warm point lanterns, night background, and its own tone
mapping. Emissive surfaces do not illuminate other objects in standard Three.js:
keep the companion point lights. No bloom, fog, or performance equivalence is
implied by a Blender render.

The initial 180,000-triangle environment/contribution baseline is enforced
against actual exports; character and proxy triangles are reported separately.
This slice is not a promise that the future complete world fits unchanged.
Before expanding, budget the remaining locations and reduce repeated bevels,
introduce lower-detail foliage, and retain shared geometry/materials rather than
silently increasing the baseline. No target-device frame rate is claimed.
The measured approval slice uses **151,022 environment/contribution triangles**
and 726 collision-proxy triangles. Its static exports have nine meshes and 82
material primitives, not nine draw calls. Lighting and repeated character
materials can add work beyond these static counts.

**Browser evidence:** the core six-asset scene, all six character clips, eleven
orientation markers, and the separately imported source-camera animation passed
Three.js/Chromium checks. Optional enrichment and the 94 collision-proxy objects
also passed independent GLTFLoader, material, bounds, and hash checks. The
enrichment is intentionally not loaded by the default viewer, so that viewer
reports 150,594 environment triangles; the additional 428 triangles remain
separately available. Proxy importability does not certify navigation behavior.

Use `browser/ambient-phased.mp4` and `browser/ambient-night-phased.mp4` for the
final six-second staggered-resident studies; `browser/character-actions.mp4`
shows the exact exported Idle, Walk, and Greeting clips over eight seconds.
Ambient videos use the viewer's own closed camera sweep. The distinct exported
Blender camera loop was independently sampled in Three.js at 145 times, with
matching endpoint matrices. Video frame rate describes the encoded media, not
measured real-time performance.

## Deliberately awaiting approval

The remaining four residents, neutral player configuration, complete modular
avatar catalog, the remaining locations and themed contributions, wider action
library, production LOD/instancing strategy, and production integration are
deferred. This first slice establishes their proposed visual language without
presenting unapproved expansion as completed work.
