"""Exact-disk checks, or isolated glTF round-trip with -- gltf."""
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import numpy as np

from paths import output_root

assert bpy.app.background
HERE = output_root() / "character-smoke"
report_path = HERE / "smoke-report.json"
report = json.loads(report_path.read_text())
expected = {f"{name}_{clip}" for name in ("Pip", "Sol") for clip in ("Idle", "Walk", "Greeting")}


def point_bounds(objects):
    points = []
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        try:
            points.extend(tuple(evaluated.matrix_world @ v.co) for v in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    points = np.array(points)
    assert np.isfinite(points).all()
    return np.array([points.min(axis=0), points.max(axis=0)])


if sys.argv[-1] != "gltf":
    assert Path(bpy.data.filepath) == HERE / "canopy-characters.blend"
    assert len(bpy.data.scenes) == 1
    scene = bpy.context.scene
    assert scene.name == "Canopy_CharacterApproval"
    assert (scene.frame_start, scene.frame_end, scene.render.fps) == (1, 144, 24)
    assert {a.name for a in bpy.data.actions} == expected
    detail = {"scene": scene.name, "characters": {}, "passed": True}
    for name in ("Pip", "Sol"):
        rig = bpy.data.objects[name + "_Rig"]
        assert rig.animation_data.action.name == name + "_Idle"
        assert all(t.mute for t in rig.animation_data.nla_tracks)
        assert all(a.use_fake_user for a in bpy.data.actions)
        assert len(rig.pose.bones) == 16
        meshes = [o for o in scene.objects if o.type == "MESH" and o.name.startswith(name + "_")]
        for obj in meshes:
            assert obj.modifiers[0].object == rig
            for mat in obj.data.materials:
                nodes = mat.node_tree.nodes
                assert all(n.bl_idname in ("ShaderNodeBsdfPrincipled", "ShaderNodeOutputMaterial")
                           for n in nodes)
        action = rig.animation_data.action
        rig.data.pose_position = "REST"
        scene.frame_set(1)
        bounds = point_bounds(meshes).tolist()
        rig.data.pose_position = "POSE"
        matrices = []
        for frame in (1, 73, 145):
            scene.frame_set(frame)
            values = np.array([list(row) for bone in rig.pose.bones for row in bone.matrix])
            assert np.isfinite(values).all()
            matrices.append(values)
        assert np.max(np.abs(matrices[0] - matrices[2])) < 2e-6
        detail["characters"][name] = {"rest_bounds": bounds, "meshes": len(meshes),
                                      "idle_repeats_through_parent_range": True}
    report["disk_verification"] = detail
    report_path.write_text(json.dumps(report, indent=2))
    print("DISK_VERIFIED=" + json.dumps(detail))
else:
    data = (HERE / "canopy-characters.glb").read_bytes()
    magic, version, size, json_length, chunk_type = struct.unpack("<5I", data[:20])
    assert magic == 0x46546C67 and version == 2 and size == len(data)
    assert chunk_type == 0x4E4F534A
    gltf = json.loads(data[20:20 + json_length])
    bin_length, bin_type = struct.unpack("<2I", data[20 + json_length:28 + json_length])
    binary = data[28 + json_length:28 + json_length + bin_length]
    assert {a["name"] for a in gltf["animations"]} == expected
    assert len(gltf["skins"]) == 2
    assert all(len(skin["joints"]) == 16 for skin in gltf["skins"])
    assert len(gltf["scenes"]) == 1
    assert len(gltf["meshes"]) == 142
    assert all("JOINTS_0" in p["attributes"] and "WEIGHTS_0" in p["attributes"]
               for mesh in gltf["meshes"] for p in mesh["primitives"])
    assert all(node.get("name", "").startswith(("Pip", "Sol")) or "mesh" not in node
               for node in gltf["nodes"])

    def accessor(index):
        value = gltf["accessors"][index]
        view = gltf["bufferViews"][value["bufferView"]]
        count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[value["type"]]
        assert value["componentType"] == 5126
        offset = view.get("byteOffset", 0) + value.get("byteOffset", 0)
        array = np.ndarray((value["count"], count), dtype="<f4", buffer=binary, offset=offset,
                           strides=(view.get("byteStride", count * 4), 4))
        assert np.isfinite(array).all()
        return array

    clip_report = {}
    for action in gltf["animations"]:
        durations, endpoint_deltas = [], []
        for sampler in action["samplers"]:
            times, values = accessor(sampler["input"]), accessor(sampler["output"])
            assert abs(float(times[0, 0])) < 1e-6
            durations.append(float(times[-1, 0] - times[0, 0]))
            endpoint_deltas.append(float(np.max(np.abs(values[-1] - values[0]))))
        expected_duration = 1 if action["name"].endswith("Walk") else 3
        assert abs(max(durations) - expected_duration) < 1e-6
        assert max(endpoint_deltas) < 1e-6
        clip_report[action["name"]] = {"duration_seconds": max(durations),
                                       "first_key_seconds": 0,
                                       "channels": len(action["channels"]),
                                       "endpoint_accessor_max_delta": max(endpoint_deltas)}
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.scene.render.fps = 24
    bpy.ops.import_scene.gltf(filepath=str(HERE / "canopy-characters.glb"))
    rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"
              and any(m.type == "ARMATURE" for m in o.modifiers)]
    helper_meshes = [o.name for o in bpy.context.scene.objects
                     if o.type == "MESH" and o not in meshes]
    assert len(rigs) == 2 and len(meshes) == 142, {
        "rigs": [o.name for o in rigs], "meshes": len(meshes),
        "objects": [(o.name, o.type) for o in bpy.context.scene.objects if o.type != "MESH"]}
    imported = {}
    for rig in rigs:
        name = "Pip" if "Pip" in rig.name else "Sol"
        assert len(rig.pose.bones) == 16
        rig.data.pose_position = "REST"
        bpy.context.view_layer.update()
        owned_meshes = [o for o in meshes if o.name.startswith(name + "_")]
        assert all(any(m.type == "ARMATURE" and m.object == rig for m in o.modifiers)
                   for o in owned_meshes)
        bounds = point_bounds(owned_meshes)
        original = np.array(report["disk_verification"]["characters"][name]["rest_bounds"])
        error = float(np.max(np.abs(original - bounds)))
        assert error < 2e-5
        rig.data.pose_position = "POSE"
        tracks = rig.animation_data.nla_tracks
        assert len(tracks) == 3
        for track in tracks:
            track.mute = True
        motions = {}
        for track in tracks:
            action = track.strips[0].action
            rig.animation_data.action = action
            rig.animation_data.action_slot = track.strips[0].action_slot
            samples = []
            for frame in (1, 7, 19, 25, 37, 73):
                bpy.context.scene.frame_set(frame)
                matrices = np.array([list(row) for b in rig.pose.bones for row in b.matrix])
                assert np.isfinite(matrices).all()
                samples.append(matrices)
            change = float(max(np.max(np.abs(m - samples[0])) for m in samples[1:]))
            assert change > .001
            motions[action.name] = change
        imported[name] = {"rest_bounds_max_delta_m": error, "meshes": len(owned_meshes),
                          "imported_action_matrix_changes": motions}
    report["gltf_verification"] = {"animations": clip_report, "skins": 2, "meshes": 142,
                                    "importer_helper_meshes": helper_meshes,
                                    "roundtrip": imported, "passed": True}
    report["status"] = "passed"
    report_path.write_text(json.dumps(report, indent=2))
    print("GLTF_VERIFIED=" + json.dumps(report["gltf_verification"]))
