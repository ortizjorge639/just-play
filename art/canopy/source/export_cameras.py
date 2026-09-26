import json
import struct
from pathlib import Path

import bpy

from paths import output_root, fresh_path

assert bpy.app.background
out = output_root()
target = fresh_path(out / "exports" / "cameras.glb")
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.collections["Cameras"].objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects["Ambient loop"]
status = bpy.ops.export_scene.gltf(
    filepath=str(target), export_format="GLB", use_selection=True, export_yup=True,
    export_extras=True, export_cameras=True, export_lights=False,
    export_animations=True, export_animation_mode="ACTIONS", export_anim_single_armature=False,
    export_merge_animation="NONE", export_anim_slide_to_zero=True, export_frame_range=False,
)
assert status == {"FINISHED"}
raw = target.read_bytes()
size = struct.unpack_from("<I", raw, 12)[0]
data = json.loads(raw[20:20 + size])
assert len(data["cameras"]) == 6
assert len(data["animations"]) == 1
print("CAMERA_EXPORT=" + json.dumps({"bytes": len(raw), "cameras": len(data["cameras"]),
                                   "animations": [a["name"] for a in data["animations"]]}))
