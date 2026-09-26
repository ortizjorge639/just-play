import json
import math
import hashlib
from pathlib import Path

import bpy
from mathutils import Vector

from paths import output_root, write_json, display_path

assert bpy.app.background
OUT = output_root()
scene = bpy.context.scene
assert scene.name == "Canopy | Approval slice"
depsgraph = bpy.context.evaluated_depsgraph_get()
triangles = {}
for collection in scene.collection.children:
    count = 0
    if collection.name in {"Collision", "Lighting", "Cameras", "Markers"}:
        continue
    for obj in collection.objects:
        if obj.type not in {"MESH", "FONT", "CURVE"}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        data = evaluated.to_mesh()
        try:
            data.calc_loop_triangles()
            count += len(data.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    triangles[collection.name] = count
environment = sum(count for name, count in triangles.items() if name != "Characters")
assert environment <= 180000, {"environment": environment, "collections": triangles}

expected = {
    "LOCATION_Gathering": [0, 0, 0], "LOCATION_Grove": [20, 5, 3],
    "LOCATION_Trailhead": [-6, -22, -1], "ATTACH_plot": [37, -10, 4],
    "DOOR_Grove": [17, 3.1, 3], "ATTACH_brook": [30, 23, 4],
    "ATTACH_crown": [12, 40, 6], "ATTACH_fern": [-18, 29, 5],
    "ATTACH_dusk": [-39, 7, 3], "ATTACH_meadow": [-27, -17, 1],
    "ATTACH_sunrise": [12, -25, 0],
}
for name, coordinates in expected.items():
    assert (bpy.data.objects[name].location - Vector(coordinates)).length < 1e-5, name
assert bpy.data.objects["DOOR_Grove"]["clear_width"] >= 1.4
assert bpy.data.objects["DOOR_Grove"]["clear_height"] >= 2.2
assert len([o for o in scene.objects if o.name.startswith("ATTACH_")]) == 7
assert len([o for o in scene.objects if o.type == "ARMATURE"]) == 2
assert "Canopy | Lantern night" in bpy.data.scenes
assert len(bpy.data.scenes) == 2
assert len(scene.objects) == 4865
assert {a.name for a in bpy.data.actions} == {
    "Ambient loopAction", *[f"{name}_{clip}" for name in ("Pip", "Sol")
                           for clip in ("Idle", "Walk", "Greeting")]}
for obj in bpy.data.collections["Collision"].objects:
    if obj.get("collision") == "walkable_bridge":
        assert all(p.normal.z > .001 for p in obj.data.polygons), obj.name
assert scene.unit_settings.scale_length == 1
assert scene.render.fps == 24 and scene.frame_end == 144
assert len(bpy.data.libraries) == 0
missing = []
for image in bpy.data.images:
    if image.source == "FILE" and not image.packed_file and image.filepath:
        path = Path(bpy.path.abspath(image.filepath))
        if not path.is_file():
            missing.append(str(path))
for font in bpy.data.fonts:
    if font.filepath and font.filepath != "<builtin>" and not font.packed_file:
        path = Path(bpy.path.abspath(font.filepath))
        if not path.is_file():
            missing.append(str(path))
assert not missing, missing
assert not [image for image in bpy.data.images if image.source == "FILE"]
assert not [font for font in bpy.data.fonts if font.filepath not in {"", "<builtin>"}]
characters = {}
for name, mesh_count, triangle_count in [("Pip", 72, 7158), ("Sol", 70, 6470)]:
    root = bpy.data.objects[name + "_Root"]
    rig = bpy.data.objects[name + "_Rig"]
    parts = [obj for obj in root.children_recursive if obj.type == "MESH"]
    assert len(parts) == mesh_count and len(rig.data.bones) == 16
    measured_triangles = 0
    for obj in parts:
        evaluated = obj.evaluated_get(depsgraph)
        data = evaluated.to_mesh()
        try:
            data.calc_loop_triangles()
            measured_triangles += len(data.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    assert measured_triangles == triangle_count
    assert rig.animation_data.action.name == name + "_Idle"
    assert all(track.mute for track in rig.animation_data.nla_tracks)
    characters[name] = {
        "height_m": root["standing_height"], "bones": list(rig.data.bones.keys()),
        "meshes": len(parts), "triangles": measured_triangles,
        "clips": {clip: {"name": name + "_" + clip,
                         "period_seconds": bpy.data.actions[name + "_" + clip]["period_frames"] / 24}
                  for clip in ("Idle", "Walk", "Greeting")},
    }

camera = bpy.data.objects["Ambient loop"]
samples = []
for frame in range(1, 146):
    scene.frame_set(frame)
    assert all(math.isfinite(v) for row in camera.matrix_world for v in row)
    samples.append([float(v) for row in camera.matrix_world for v in row])
seam = max(abs(a - b) for a, b in zip(samples[0], samples[-1]))
assert seam < 1e-5, seam
scene.frame_set(1)
report = {
    "saved_path": display_path(bpy.data.filepath),
    "saved_sha256": hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
    "blender_version": bpy.app.version_string,
    "verified_in_blender": True,
    "source_scene_count": len(bpy.data.scenes),
    "source_objects": len(scene.objects),
    "source_actions": len(bpy.data.actions),
    "characters": characters,
    "triangles_by_collection": triangles,
    "environment_contribution_triangles": environment,
    "environment_budget": 180000,
    "source_topology_markers": expected,
    "missing_dependencies": missing,
    "external_texture_count": len([i for i in bpy.data.images if i.source == "FILE"]),
    "material_detail": "Authored geometry and portable constant PBR values; no procedural shader texture detail to bake.",
    "camera_loop_frames_inspected": len(samples),
    "camera_loop_matrix_seam_error": seam,
    "collision_objects": len(bpy.data.collections["Collision"].objects),
    "not_verified_here": ["production integration", "target-device frame rate"],
}
write_json(OUT / "blender-audit.json", report)
print("CANOPY_AUDIT=" + json.dumps(report))
