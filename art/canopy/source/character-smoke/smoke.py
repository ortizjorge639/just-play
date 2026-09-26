"""Run only in this module's owned --factory-startup background process."""
import json
import math
from pathlib import Path
import sys
import os

import bpy
from mathutils import Vector
import numpy as np

from paths import output_root

HERE = output_root() / "character-smoke"
HERE.mkdir()
import characters

assert bpy.app.background
scene = bpy.data.scenes.new("Canopy_CharacterApproval")
bpy.context.window.scene = scene
for old_scene in list(bpy.data.scenes):
    if old_scene != scene:
        bpy.data.scenes.remove(old_scene)
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 20
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 6
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 144
scene.world = bpy.data.worlds.new("CharacterSmoke_World")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.34, .39, .34, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .65
scene.view_settings.view_transform = "AgX"
collection = bpy.data.collections.new("CharacterSmoke_Assets")
scene.collection.children.link(collection)
before = (scene.frame_start, scene.frame_end, scene.render.fps, scene.render.engine,
          scene.frame_current, scene.render.resolution_x, scene.render.resolution_y)
assets = [characters.build_character("Pip", collection, (-.52, 0, 0), -.06),
          characters.build_character("Sol", collection, (.52, 0, 0), .06)]
assert before == (scene.frame_start, scene.frame_end, scene.render.fps, scene.render.engine,
                  scene.frame_current, scene.render.resolution_x, scene.render.resolution_y)


def assign(asset, suffix):
    action = bpy.data.actions[next(n for n in asset["actions"] if n.endswith("_" + suffix))]
    asset["rig"].animation_data.action = action
    asset["rig"].animation_data.action_slot = action.slots[0]
    return action


def pose_matrices(rig):
    return np.array([list(row) for bone in rig.pose.bones for row in bone.matrix])


def evaluated_points(asset):
    graph = bpy.context.evaluated_depsgraph_get()
    parts = []
    for obj in asset["meshes"]:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        try:
            transform = asset["root"].matrix_world.inverted() @ evaluated.matrix_world
            parts.extend(tuple(transform @ v.co) for v in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    return np.array(parts)


report = {"blender": bpy.app.version_string, "target": "isolated factory startup",
          "scene_settings_preserved_by_module": True, "fps": 24, "parent_range": [1, 144],
          "forward": "-Y", "characters": {}, "renders": [], "warnings": [
              "Rigid segmented skinning; no IK or facial controls.",
              "In-place walk is a stylized cycle, not authored world-space foot locking.",
              "Blender glTF round-trip is a proxy; no external engine consumer tested."]}
for asset in assets:
    rig, meshes = asset["rig"], asset["meshes"]
    name = asset["root"]["canopy_character"]
    assert len(rig.pose.bones) == len(characters.BONE_SPEC)
    assert len(rig.animation_data.nla_tracks) == 2
    assert all(track.mute for track in rig.animation_data.nla_tracks)
    assert rig.animation_data.action.name == name + "_Idle"
    triangles = 0
    for obj in meshes:
        assert list(obj.users_collection) == [collection]
        assert all(len(v.groups) == 1 and abs(v.groups[0].weight - 1) < 1e-7
                   for v in obj.data.vertices)
        assert obj.modifiers[0].type == "ARMATURE" and obj.modifiers[0].object == rig
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    assert 1000 <= triangles <= 15000
    rest_min = min(v.co.z for obj in meshes for v in obj.data.vertices)
    assert abs(rest_min) < 1e-6
    assert 1.58 <= asset["height"] <= 1.72
    detail = {"meshes": len(meshes), "evaluated_triangles": triangles,
              "height_m": asset["height"], "rest_sole_z": rest_min,
              "bones": list(rig.pose.bones.keys()), "actions": {}, "extreme_pose_checks": {},
              "nla_stash_tracks": [{"name": t.name, "muted": t.mute} for t in rig.animation_data.nla_tracks]}
    for clip in ("Idle", "Walk", "Greeting"):
        action = assign(asset, clip)
        period = action["period_frames"]
        matrices, points = {}, {}
        minimum_z, max_joint_error = float("inf"), 0
        for frame in range(1, period + 2):
            scene.frame_set(frame)
            matrix = pose_matrices(rig)
            assert np.isfinite(matrix).all()
            matrices[frame] = matrix
            for side in ("L", "R"):
                for proximal, distal in (("upper_arm", "lower_arm"), ("lower_arm", "hand"),
                                         ("upper_leg", "lower_leg"), ("lower_leg", "foot")):
                    error = (rig.pose.bones[f"{proximal}.{side}"].tail -
                             rig.pose.bones[f"{distal}.{side}"].head).length
                    max_joint_error = max(max_joint_error, error)
            if frame in (1, period // 4 + 1, period // 2 + 1, period * 3 // 4 + 1, period + 1):
                points[frame] = evaluated_points(asset)
                assert np.isfinite(points[frame]).all()
                minimum_z = min(minimum_z, float(points[frame][:, 2].min()))
        endpoint_delta = float(np.max(np.abs(matrices[1] - matrices[period + 1])))
        assert endpoint_delta < 2e-6
        scene.frame_set(2 * period + 1)
        repeated_delta = float(np.max(np.abs(matrices[1] - pose_matrices(rig))))
        assert repeated_delta < 2e-6
        deformation = max(float(np.linalg.norm(p - points[1], axis=1).max()) for p in points.values())
        assert deformation > .003
        assert max_joint_error < 1e-6
        assert minimum_z >= -.005
        detail["actions"][clip] = {"name": action.name, "slot": action.slots[0].identifier,
                                   "period_frames": period, "key_range": list(action.frame_range),
                                   "endpoint_matrix_max_delta": endpoint_delta,
                                   "repeat_matrix_max_delta": repeated_delta,
                                   "max_vertex_travel_m": deformation, "fake_user": action.use_fake_user}
        detail["extreme_pose_checks"][clip] = {
            "all_frames_bone_matrices_finite": True, "samples_geometry_finite": sorted(points),
            "joint_separation_max_m": max_joint_error, "sampled_min_vertex_z_m": minimum_z}
    assign(asset, "Idle")
    report["characters"][name] = detail

stage = bpy.data.collections.new("CharacterSmoke_Stage")
scene.collection.children.link(stage)


def stage_mesh(name, vertices, faces, color):
    data = bpy.data.meshes.new(name + "_Mesh")
    data.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, data)
    stage.objects.link(obj)
    mat = bpy.data.materials.new(name + "_Mat")
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*color, 1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .9
    obj.data.materials.append(mat)
    return obj


stage_mesh("CharacterSmoke_Floor", [(-200, -200, -.008), (200, -200, -.008),
                                   (200, 200, -.008), (-200, 200, -.008)], [(0, 1, 2, 3)],
           (.38, .43, .33))
camera = bpy.data.objects.new("CharacterSmoke_Camera", bpy.data.cameras.new("CharacterSmoke_Camera"))
stage.objects.link(camera)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.5
scene.camera = camera


def aim_camera(location):
    camera.location = location
    camera.rotation_euler = (Vector((0, 0, .84)) - camera.location).to_track_quat("-Z", "Y").to_euler()


for name, location, energy, size, color in (
        ("Key", (-3, -4, 5), 500, 4, (1, .87, .70)),
        ("Fill", (3, -2, 3), 260, 3, (.78, .88, 1)),
        ("Rim", (1, 3, 4), 480, 3, (1, .92, .78))):
    data = bpy.data.lights.new("CharacterSmoke_" + name, "AREA")
    data.energy, data.shape, data.size, data.color = energy, "DISK", size, color
    obj = bpy.data.objects.new(data.name, data)
    stage.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, .8)) - obj.location).to_track_quat("-Z", "Y").to_euler()

scene.frame_set(1)
aim_camera((2.6, -7, 3.1))
blend_path = HERE / "canopy-characters.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
report["blend"] = str(blend_path)
report["status"] = "geometry_and_animation_passed"
(HERE / "smoke-report.json").write_text(json.dumps(report, indent=2))

for clip, frame, filename, camera_location in ([
        ("Idle", 1, "01-idle.png", (1.7, -7, 2.9)),
        ("Walk", 7, "02-walk.png", (1.7, -7, 2.9)),
        ("Greeting", 37, "03-greeting.png", (1.7, -7, 2.9)),
        ("Idle", 1, "04-back.png", (-2.8, 7, 2.8))] if os.environ.get("CANOPY_RENDER_CHARACTERS") == "1" else []):
    for asset in assets:
        assign(asset, clip)
    scene.frame_set(frame)
    aim_camera(camera_location)
    scene.render.filepath = str(HERE / filename)
    bpy.ops.render.render(write_still=True)
    report["renders"].append({"clip": clip, "frame": frame, "path": str(HERE / filename)})

tiles = []
for entry in report["renders"]:
    image = bpy.data.images.load(entry["path"], check_existing=False)
    buffer = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(buffer)
    tiles.append(buffer.reshape(image.size[1], image.size[0], 4))
    bpy.data.images.remove(image)
if tiles:
    montage = np.concatenate((np.concatenate(tiles[2:], axis=1),
                              np.concatenate(tiles[:2], axis=1)), axis=0)
    image = bpy.data.images.new("CharacterSmoke_ContactSheet", width=1440, height=1440)
    image.pixels.foreach_set(montage.ravel())
    image.filepath_raw = str(HERE / "contact-sheet.png")
    image.file_format = "PNG"
    image.save()
    report["contact_sheet"] = image.filepath_raw
for asset in assets:
    assign(asset, "Idle")
scene.frame_set(1)
aim_camera((1.7, -7, 2.9))
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for asset in assets:
    for obj in [asset["root"], asset["rig"]] + asset["meshes"]:
        obj.select_set(True)
props = bpy.ops.export_scene.gltf.get_rna_type().properties
assert "ACTIONS" in [item.identifier for item in props["export_animation_mode"].enum_items]
gltf_path = HERE / "canopy-characters.glb"
export_result = bpy.ops.export_scene.gltf(
    filepath=str(gltf_path), export_format="GLB", use_selection=True,
    use_active_scene=True,
    export_animations=True, export_animation_mode="ACTIONS", export_frame_range=False,
    export_anim_slide_to_zero=True,
    export_anim_single_armature=False, export_merge_animation="NONE",
    export_skins=True, export_materials="EXPORT")
assert export_result == {"FINISHED"}
report["glb"] = str(gltf_path)
report["status"] = "passed_pending_disk_roundtrip"
(HERE / "smoke-report.json").write_text(json.dumps(report, indent=2))
# Preserve the actual usable approval scene, not the export selection or posed previews.
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for default_scene in list(bpy.data.scenes):
    if default_scene != scene:
        bpy.data.scenes.remove(default_scene)
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
print("CHARACTER_SMOKE=" + json.dumps(report))
