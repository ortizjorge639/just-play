from pathlib import Path

import bpy

from paths import output_root, fresh_path

assert bpy.app.background
OUT = output_root() / "renders"
OUT.mkdir(exist_ok=True)
day = bpy.data.scenes["Canopy | Approval slice"]
night = bpy.data.scenes["Canopy | Lantern night"]
studies = [
    (day, "Overview", "golden-hour.png", 1640, 1080, 32, 0),
    (night, "Overview", "lantern-night.png", 1640, 1080, 40, .5),
    (day, "Gathering walk", "walking-scale.png", 1440, 960, 32, .1),
    (day, "Interior", "furnished-interior.png", 1200, 900, 40, .65),
    (day, "Home threshold", "grove-home.png", 1200, 1000, 32, .1),
    (night, "Hearth detail", "hearth-night.png", 1200, 900, 40, .6),
]
for scene, camera, filename, width, height, samples, exposure in studies:
    path = fresh_path(OUT / filename)
    bpy.context.window.scene = scene
    scene.camera = bpy.data.objects[camera]
    scene.frame_set(1)
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 6
    scene.view_settings.exposure = exposure
    scene.render.filepath = str(path)
    for light in scene.objects:
        if light.type == "LIGHT" and "day_energy" in light:
            light.data.energy = light["night_energy" if scene == night else "day_energy"]
    bpy.ops.render.render(write_still=True)
    print("STUDY_DONE=" + str(path), flush=True)
