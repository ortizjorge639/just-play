import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

from paths import output_root, fresh_path, write_json

assert bpy.app.background, "Only run through source/run.py in isolated Blender."
OUT = output_root()
from characters import build_character

scene = bpy.context.scene
assert scene.name == "Canopy | Approval slice"
assert Path(bpy.data.filepath).resolve() == OUT / "environment-source.blend"
target = fresh_path(OUT / "canopy-approval-v003.blend")
for obj in bpy.data.collections["Collision"].objects:
    if obj.get("collision") == "walkable_bridge":
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.normal_update()
        for face in bm.faces:
            if face.normal.z < 0:
                face.normal_flip()
        bm.to_mesh(obj.data)
        bm.free()
cast = bpy.data.collections["Characters"]
pip = build_character("Pip", cast, location=(0, -3, 0))
sol = build_character("Sol", cast, location=(4, -2, 0), rotation=-.12)
for character in [pip, sol]:
    character["root"]["lifecycle_preview"] = "arrived"
    character["root"]["residency_is_permanent"] = True
overview = bpy.data.objects["Overview"]
overview.location = (58, -75, 48)
overview.rotation_euler = (Vector((12, -4, 1.5)) - overview.location).to_track_quat("-Z", "Y").to_euler()
overview.data.lens = 43
scene.camera = overview
scene.render.resolution_x = 1640
scene.render.resolution_y = 1080
scene.cycles.samples = 32
scene.frame_set(1)
for obj in bpy.data.collections["Lighting"].objects:
    if obj.type == "LIGHT" and obj.data.type == "POINT" and "day_energy" in obj:
        lantern_scale = obj["day_energy"] / 28
        obj.location.z -= .36 * lantern_scale
        obj["night_energy"] = 105 * lantern_scale

# Named presets retain independent light data while sharing editable geometry.
night = bpy.data.scenes.new("Canopy | Lantern night")
night.world = scene.world.copy()
background = night.world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (.055, .09, .16, 1)
background.inputs["Strength"].default_value = .25
for collection in scene.collection.children:
    if collection.name != "Lighting":
        night.collection.children.link(collection)
night_lights = bpy.data.collections.new("Lighting - Lantern night")
night.collection.children.link(night_lights)
for source in bpy.data.collections["Lighting"].objects:
    obj = source.copy()
    obj.data = source.data.copy()
    night_lights.objects.link(obj)
    if "night_energy" in source:
        obj.data.energy = source["night_energy"]
night.camera = overview
night.render.engine = "CYCLES"
night.cycles.device = "CPU"
night.cycles.samples = 32
night.cycles.use_denoising = True
night.render.resolution_x = 1640
night.render.resolution_y = 1080
night.render.resolution_percentage = 100
night.render.fps = 24
night.frame_start, night.frame_end = 1, 144
night.view_settings.view_transform = "AgX"
night.view_settings.exposure = .5
night.unit_settings.system = "METRIC"
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.shading.type = "MATERIAL"
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = None
scene.frame_set(1)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(target))

def portable(value):
    if isinstance(value, bpy.types.ID):
        return value.name
    if isinstance(value, dict):
        return {key: portable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [portable(item) for item in value]
    return value

write_json(OUT / "character-interface.json", portable({"Pip": pip, "Sol": sol}))
print("CANOPY_FINAL=" + json.dumps({"path": str(target), "scenes": [s.name for s in bpy.data.scenes]}))
