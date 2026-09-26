import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

from paths import output_root, fresh_path

assert bpy.app.background, "Only run through source/run.py in isolated Blender."
OUT = output_root()
EXPORTS = OUT / "exports"
EXPORTS.mkdir(exist_ok=True)
scene = bpy.context.scene
assert scene.name == "Canopy | Approval slice"


def descendants(obj):
    return [obj] + [child for c in obj.children for child in descendants(c)]


def selected(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]


def glb(name, objects, animated=False):
    target = fresh_path(EXPORTS / (name + ".glb"))
    selected(objects)
    result = bpy.ops.export_scene.gltf(
        filepath=str(target), export_format="GLB", use_selection=True,
        export_yup=True, export_extras=True,
        export_cameras=any(obj.type == "CAMERA" for obj in objects), export_lights=False,
        export_animations=animated, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_range=False,
        export_apply=False, export_anim_single_armature=False,
        export_merge_animation="NONE", export_anim_slide_to_zero=True,
    )
    assert result == {"FINISHED"} and target.is_file(), result
    print("EXPORTED=" + str(target), flush=True)


def batch(collections, name, keep_roof=False):
    objects = [obj for c in collections for obj in bpy.data.collections[c].objects
               if obj.type in {"MESH", "CURVE", "FONT"}]
    groups = {"main": [], "roof": []} if keep_roof else {"main": []}
    for obj in objects:
        is_roof = any(word in obj.name.lower() for word in ["roof", "gable", "porch hood"])
        groups["roof" if keep_roof and is_roof else "main"].append(obj)
    merged = []
    for key, objs in groups.items():
        if not objs:
            continue
        selected(objs)
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        ob = bpy.context.object
        ob.name = name + ("_Roof" if key == "roof" else "")
        ob["asset_batch"] = name
        if key == "roof":
            ob["configurable"] = "roof"
        merged.append(ob)
    return merged


for label in ["Pip", "Sol"]:
    root = bpy.data.objects[label + "_Root"]
    objects = descendants(root)
    old_location, old_rotation = root.location.copy(), root.rotation_euler.copy()
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    glb(label.lower(), objects, animated=True)
    root.location, root.rotation_euler = old_location, old_rotation

scene.frame_set(1)
environment = batch(["Environment"], "Starter_Architecture", keep_roof=True)
environment += batch(["Foliage"], "Foliage")
environment += batch(["Interior"], "Grove_Interior")
markers = list(bpy.data.collections["Markers"].objects)
glb("environment", environment + markers)
glb("ember-small", batch(["Ember Small"], "Ember_Small"))
glb("hearth-deck", batch(["Hearth Deck"], "Ember_Hearth_Deck", keep_roof=True))
glb("hearth-enrichment", batch(["Hearth Enrichment"], "Ember_Hearth_Enrichment"))
glb("rain-postcard", batch(["Rain Postcard"], "Rain_Postcard"))
# Cameras and collision export in separate exact-file processes; make_manifest
# measures all nine outputs only after both have completed.
