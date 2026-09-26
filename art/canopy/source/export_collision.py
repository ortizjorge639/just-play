from pathlib import Path

import bpy

from paths import output_root, fresh_path

assert bpy.app.background
out = output_root()
target = fresh_path(out / "exports" / "collision-proxies.glb")
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.collections["Collision"].objects:
    if obj.get("collision") == "walkable_bridge":
        assert all(face.normal.z > .001 for face in obj.data.polygons)
    obj.hide_render = False
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(iter(bpy.data.collections["Collision"].objects))
status = bpy.ops.export_scene.gltf(
    filepath=str(target), export_format="GLB", use_selection=True, export_yup=True,
    export_extras=True, export_animations=False, export_apply=False,
)
assert status == {"FINISHED"}
print("COLLISION_EXPORT=" + str(target))
