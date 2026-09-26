"""Check the parent's placement, descendant-selection, and per-file export contract."""
import json
from pathlib import Path
import struct
import sys

import bpy

from paths import output_root

HERE = output_root() / "character-smoke"
from characters import build_character

assert bpy.app.background
scene = bpy.data.scenes.new("CharacterIntegrationCheck")
bpy.context.window.scene = scene
for old in list(bpy.data.scenes):
    if old != scene:
        bpy.data.scenes.remove(old)
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 144
collection = bpy.data.collections.new("Characters")
scene.collection.children.link(collection)
assets = [build_character("Pip", collection, location=(0, -3, 0)),
          build_character("Sol", collection, location=(4, -2, 0), rotation=-.12)]
scene.frame_set(1)
results = {}


def inspect_glb(path):
    data = path.read_bytes()
    length = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + length])
    binary = data[28 + length:]
    timings = {}
    for action in gltf.get("animations", []):
        ranges = []
        for sampler in action["samplers"]:
            accessor = gltf["accessors"][sampler["input"]]
            view = gltf["bufferViews"][accessor["bufferView"]]
            offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            values = struct.unpack_from("<" + str(accessor["count"]) + "f", binary, offset)
            assert abs(min(values)) < 1e-6
            ranges.append((min(values), max(values)))
        start, end = min(v[0] for v in ranges), max(v[1] for v in ranges)
        assert abs(end - (1 if action["name"].endswith("Walk") else 3)) < 1e-6
        timings[action["name"]] = {"first_key_seconds": start, "duration_seconds": end}
    return {"animations": [a["name"] for a in gltf.get("animations", [])],
            "timings": timings,
            "skins": len(gltf["skins"]), "meshes": len(gltf["meshes"]),
            "joints": len(gltf["skins"][0]["joints"])}


for asset in assets:
    root, rig = asset["root"], asset["rig"]
    name = root["canopy_character"]
    descendants = set(root.children_recursive)
    assert descendants == set(asset["meshes"]) | {rig}
    original_location = root.location.copy()
    original_rotation = root.rotation_euler.copy()
    try:
        root.location = (0, 0, 0)
        root.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        for obj in bpy.context.selected_objects:
            obj.select_set(False)
        for obj in [root] + list(descendants):
            obj.select_set(True)
        path = HERE / (name.lower() + "-origin.glb")
        bpy.ops.export_scene.gltf(
            filepath=str(path), export_format="GLB", use_selection=True, use_active_scene=True,
            export_animations=True, export_animation_mode="ACTIONS",
            export_anim_single_armature=False, export_frame_range=False,
            export_anim_slide_to_zero=True,
            export_merge_animation="NONE", export_skins=True)
        info = inspect_glb(path)
        assert set(info["animations"]) == set(asset["actions"])
        assert info["skins"] == 1 and info["joints"] == 16
        assert info["meshes"] == len(asset["meshes"])
        info["path"] = str(path)
        info["requested_scene_location"] = list(original_location)
        info["requested_scene_rotation_z"] = original_rotation.z
        info["selected_recursive_descendants"] = len(descendants)
        info["active_action_after_export"] = rig.animation_data.action.name
        assert info["active_action_after_export"] == name + "_Idle"
        assert all(t.mute for t in rig.animation_data.nla_tracks)
        results[name] = info
        if name == "Pip":
            path = HERE / "single-armature-true-diagnostic.glb"
            bpy.ops.export_scene.gltf(
                filepath=str(path), export_format="GLB", use_selection=True, use_active_scene=True,
                export_animations=True, export_animation_mode="ACTIONS",
                export_anim_single_armature=True, export_frame_range=False,
                export_anim_slide_to_zero=True,
                export_merge_animation="NONE", export_skins=True)
            diagnostic = inspect_glb(path)
            assert len(diagnostic["animations"]) == 6
            results["single_armature_true_diagnostic"] = diagnostic
    finally:
        root.location = original_location
        root.rotation_euler = original_rotation
        bpy.context.view_layer.update()
results["status"] = "passed_with_export_anim_single_armature_false"
(HERE / "integration-report.json").write_text(json.dumps(results, indent=2))
print("INTEGRATION_CHECK=" + json.dumps(results))
