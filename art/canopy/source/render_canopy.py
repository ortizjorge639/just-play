import argparse
import json
import sys
from pathlib import Path

import bpy
from paths import fresh_path

assert bpy.app.background

args = sys.argv[sys.argv.index("--") + 1:]
parser = argparse.ArgumentParser()
parser.add_argument("--camera", default="Overview")
parser.add_argument("--output", required=True)
parser.add_argument("--night", action="store_true")
parser.add_argument("--width", type=int, default=1440)
parser.add_argument("--height", type=int, default=1000)
parser.add_argument("--samples", type=int, default=32)
options = parser.parse_args(args)
scene = bpy.context.scene
target = fresh_path(options.output)
scene.camera = bpy.data.objects[options.camera]
scene.render.resolution_x = options.width
scene.render.resolution_y = options.height
scene.render.resolution_percentage = 100
scene.cycles.samples = options.samples
scene.render.filepath = str(target)
scene.frame_set(1)
for ob in scene.objects:
    if ob.type == "LIGHT" and "day_energy" in ob:
        ob.data.energy = ob["night_energy" if options.night else "day_energy"]
if options.night:
    bg = scene.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (.055, .09, .16, 1)
    bg.inputs["Strength"].default_value = .25
    scene.view_settings.exposure = .5
bpy.ops.render.render(write_still=True)
assert target.is_file()
print("CANOPY_RENDER=" + json.dumps({"path": str(target), "camera": scene.camera.name,
                                    "night": options.night}))
