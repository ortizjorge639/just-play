import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

from paths import output_root, fresh_path

assert bpy.app.background, "Only run through source/run.py in isolated Blender."
OUT = output_root()
RNG = random.Random(129)
M = {}
C = {}
ICOS = {}


def material(name, hexcolor, roughness=0.8, emission=0):
    rgb = [int(hexcolor[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    rgb = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    M[name] = mat
    return mat


def relink(obj, name, collection, mat=None):
    obj.name = name
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    C[collection].objects.link(obj)
    if mat:
        obj.data.materials.append(M[mat])
    return obj


def box(name, loc, size, mat, collection="Environment", bevel=0.025, rot=0):
    w, d, h = [s / 2 for s in size]
    obj = mesh(name, [(-w, -d, -h), (w, -d, -h), (w, d, -h), (-w, d, -h),
                      (-w, -d, h), (w, -d, h), (w, d, h), (-w, d, h)],
               [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5),
                (2, 3, 7, 6), (3, 0, 4, 7)], mat, collection)
    obj.location = loc
    obj.rotation_euler.z = rot
    if bevel:
        mod = obj.modifiers.new("Soft tool-cut edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    return obj


def mesh(name, verts, faces, mat, collection="Environment"):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    C[collection].objects.link(obj)
    if mat:
        data.materials.append(M[mat])
    return obj


def beam(name, a, b, width, mat="Timber dark", collection="Environment", depth=None):
    a, b = Vector(a), Vector(b)
    obj = box(name, (a + b) / 2, (width, depth or width, (b - a).length),
              mat, collection, min(width * 0.13, 0.03))
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def tube(name, a, b, radius, mat="Timber dark", collection="Environment", r2=None, sides=10):
    a, b = Vector(a), Vector(b)
    height = (b - a).length / 2
    verts = [(math.cos(i * math.tau / sides) * r, math.sin(i * math.tau / sides) * r, z)
             for r, z in [(radius, -height), (radius if r2 is None else r2, height)]
             for i in range(sides)]
    faces = [tuple(reversed(range(sides))), tuple(range(sides, sides * 2))]
    faces.extend((i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides))
    obj = mesh(name, verts, faces, mat, collection)
    obj.location = (a + b) / 2
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def pebble(name, loc, scale, mat, collection="Foliage", subdiv=1):
    key = (subdiv, mat)
    if key not in ICOS:
        data = bpy.data.meshes.new("Shared sculptural foliage " + mat + str(subdiv))
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1)
        bm.to_mesh(data)
        bm.free()
        data.materials.append(M[mat])
        ICOS[key] = data
    obj = bpy.data.objects.new(name, ICOS[key])
    C[collection].objects.link(obj)
    obj.location = loc
    obj.scale = scale
    return obj


def marker(name, loc, kind, **extras):
    obj = bpy.data.objects.new(name, None)
    C["Markers"].objects.link(obj)
    obj.location = loc
    obj.empty_display_type = "ARROWS"
    obj.empty_display_size = 0.4
    obj["kind"] = kind
    for k, value in extras.items():
        obj[k] = value
    return obj


def text(name, body, loc, size=0.18, mat="Cream", collection="Environment"):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.size = size
    curve.align_x = "CENTER"
    curve.extrude = 0.001
    obj = bpy.data.objects.new(name, curve)
    C[collection].objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (math.pi / 2, 0, 0)
    curve.materials.append(M[mat])
    return obj


def lamp(name, loc, collection="Environment", size=1):
    x, y, z = loc
    tube(name + " roof", (x, y, z + .28 * size), (x, y, z + .45 * size),
         .23 * size, "Iron", collection, .1 * size, 6)
    box(name + " glowing paper", (x, y, z), (.26 * size, .26 * size, .45 * size),
        "Lantern paper", collection, .025 * size)
    for dx in [-.16, .16]:
        for dy in [-.16, .16]:
            beam(name + " frame", (x + dx * size, y + dy * size, z - .25 * size),
                 (x + dx * size, y + dy * size, z + .27 * size),
                 .035 * size, "Iron", collection)
    box(name + " base", (x, y, z - .27 * size), (.38 * size, .38 * size, .06 * size),
        "Iron", collection)
    light = bpy.data.lights.new(name + " light", "POINT")
    light.energy = 32 * size
    light.color = (1, .55, .23)
    light.shadow_soft_size = .35
    obj = bpy.data.objects.new(name + " light", light)
    C["Lighting"].objects.link(obj)
    obj.location = loc
    obj["night_energy"] = 55 * size
    obj["day_energy"] = 28 * size


def potted_plant(name, loc, scale=1, collection="Environment", flower=False):
    x, y, z = loc
    tube(name + " ceramic", (x, y, z + .05 * scale), (x, y, z + .42 * scale),
         .2 * scale, "Clay", collection, .29 * scale, 12)
    tube(name + " lip", (x, y, z + .36 * scale), (x, y, z + .43 * scale),
         .30 * scale, "Clay pale", collection, sides=12)
    tube(name + " soil", (x, y, z + .40 * scale), (x, y, z + .42 * scale),
         .25 * scale, "Earth", collection, sides=12)
    for k in range(7):
        angle = k * math.tau / 7
        a = (x, y, z + .4 * scale)
        b = (x + math.cos(angle) * .28 * scale, y + math.sin(angle) * .28 * scale,
             z + (.72 + .2 * (k % 2)) * scale)
        tube(name + " stem", a, b, .018 * scale, "Moss", collection, sides=5)
        leaf = pebble(name + " leaf", b, (.11 * scale, .24 * scale, .055 * scale),
                      "Leaf light" if k % 2 else "Leaf", collection)
        leaf.rotation_euler = (.25, .2, angle)
        if flower and k % 2 == 0:
            pebble(name + " flower", (b[0], b[1], b[2] + .08 * scale),
                   (.085 * scale,) * 3, "Butter", collection)


def fern(loc, scale=1, collection="Foliage"):
    x, y, z = loc
    for j in range(7):
        a = j * math.tau / 7
        length = scale * RNG.uniform(.5, 1)
        tip = Vector((x + math.cos(a) * length, y + math.sin(a) * length, z + .32 * scale))
        origin = Vector((x, y, z))
        for k in range(1, 6):
            t = k / 6
            center = origin.lerp(tip, t) + Vector((0, 0, math.sin(t * math.pi) * .22 * scale))
            width = .2 * scale * math.sin(t * math.pi)
            along = Vector((math.cos(a), math.sin(a), 0)) * .18 * scale
            side = Vector((-math.sin(a), math.cos(a), 0)) * width
            mesh("Fern leaflet", [center - along, center + side, center + along,
                                   center - side, center + Vector((0, 0, .04 * scale))],
                 [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], "Leaf", collection)


def branch(name, points, radii, collection="Foliage"):
    verts = []
    n = 11
    for k, ((x, y, z), radius) in enumerate(zip(points, radii)):
        for i in range(n):
            a = i * math.tau / n
            r = radius * (1 + .055 * math.sin(i * 2.6 + k))
            verts.append((x + math.cos(a) * r, y + math.sin(a) * r, z))
    faces = [tuple(reversed(range(n)))]
    for k in range(len(points) - 1):
        for i in range(n):
            faces.append((k * n + i, k * n + (i + 1) % n,
                          (k + 1) * n + (i + 1) % n, (k + 1) * n + i))
    faces.append(tuple(range((len(points) - 1) * n, len(points) * n)))
    obj = mesh(name, verts, faces, "Bark", collection)
    obj.data.materials.append(M["Bark light"])
    for face in obj.data.polygons:
        face.material_index = 1 if face.index % 11 in [3, 4] else 0
    return obj


def tree(name, loc, height, radius, crown=True):
    x, y, z = loc
    branch(name + " trunk", [(x, y, z - 5), (x - .15, y, z),
                            (x + .25, y, z + height * .45),
                            (x - .2, y + .3, z + height * .82)],
           [radius * 1.4, radius, radius * .68, radius * .29])
    for k in range(5):
        a = k * math.tau / 5 + .3
        end = (x + math.cos(a) * height * .38, y + math.sin(a) * height * .32,
               z + height * (.82 + .1 * (k % 2)))
        start = (x + .12, y, z + height * (.36 + .08 * (k % 3)))
        mid = (x + math.cos(a) * height * .22, y + math.sin(a) * height * .18, z + height * .64)
        branch(name + " bough", [start, mid, end], [radius * .56, radius * .3, .13])
        if crown:
            for j in range(5):
                b = a + j * 1.3
                center = (end[0] + math.cos(b) * 1.1, end[1] + math.sin(b) * 1.0,
                          end[2] + RNG.uniform(-.2, .8))
                leaf = pebble(name + " composed crown", center,
                              (RNG.uniform(1.5, 2.2), RNG.uniform(1.1, 1.8), RNG.uniform(.65, .95)),
                              ["Pine", "Leaf", "Leaf light"][j % 3], subdiv=2)
                leaf.rotation_euler.z = b
    for k in range(6):
        a = k * math.tau / 6
        branch(name + " root", [(x + math.cos(a) * radius * 1.8, y + math.sin(a) * radius * 1.8, z - .1),
                               (x + math.cos(a) * radius, y + math.sin(a) * radius, z + .35),
                               (x, y, z + 1.5)], [.11, .2, .26])


def deck(name, center, radius, collection="Environment", gates=()):
    x, y, z = center
    # The top surfaces retain the source location radius and exact floor height.
    step = .38
    for i in range(math.ceil(2 * radius / step)):
        dx = -radius + (i + .5) * step
        half = math.sqrt(max(0, radius * radius - dx * dx))
        if half < .15:
            continue
        sections = math.ceil(half * 2 / 2.8)
        for section in range(sections):
            length = half * 2 / sections
            yy = y - half + (section + .5) * length
            box(name + " plank", (x + dx, yy, z - .09), (step - .014, length - .013, .18),
                ["Timber", "Timber pale", "Timber honey"][(i + section) % 3], collection, .012)
    n = 48
    for i in range(n):
        a, b = i * math.tau / n, (i + 1) * math.tau / n
        beam(name + " fascia", (x + radius * math.cos(a), y + radius * math.sin(a), z - .22),
             (x + radius * math.cos(b), y + radius * math.sin(b), z - .22),
             .26, "Timber dark", collection, .3)
        mid = (a + b) / 2
        skip = any(abs(math.atan2(math.sin(mid - gate), math.cos(mid - gate))) < .19 for gate in gates)
        if i % 2 == 0 and not skip:
            px, py = x + (radius - .18) * math.cos(a), y + (radius - .18) * math.sin(a)
            beam(name + " rail post", (px, py, z), (px, py, z + .96), .11, collection=collection)
        if not skip:
            for h in [.42, .91]:
                beam(name + " rail", (x + (radius - .18) * math.cos(a), y + (radius - .18) * math.sin(a), z + h),
                     (x + (radius - .18) * math.cos(b), y + (radius - .18) * math.sin(b), z + h),
                     .055, "Timber dark", collection)
    for k in range(6):
        a = k * math.tau / 6
        beam(name + " under-deck joist",
             (x + radius * math.cos(a), y + radius * math.sin(a), z - .38),
             (x - radius * math.cos(a), y - radius * math.sin(a), z - .38),
             .28, collection=collection)
        beam(name + " knee brace", (x, y, z - 3),
             (x + radius * .82 * math.cos(a), y + radius * .82 * math.sin(a), z - .46),
             .3, collection=collection)
    branch(name + " supporting stem", [(x, y, z - 7), (x, y, z - 2.7), (x, y, z - .3)],
           [1.2, .85, .68], collection)
    collider = tube("COLLIDER_" + name, (x, y, z - .2), (x, y, z), radius, "Iron", "Collision", sides=32)
    collider.hide_render = True
    collider.display_type = "WIRE"
    collider["collision"] = "walkable_disc"
    collider["radius"] = radius - .55
    marker("LOCATION_" + name, center, "location", radius=radius)


def bridge(name, a, ar, b, br, collection="Environment"):
    a, b = Vector(a), Vector(b)
    direction = Vector((b.x - a.x, b.y - a.y, 0)).normalized()
    side = Vector((-direction.y, direction.x, 0))
    start, end = a + direction * (ar - 1), b - direction * (br - 1)
    steps = math.ceil((end - start).length / .3)
    previous = None
    for i in range(steps + 1):
        t = i / steps
        p = start.lerp(end, t)
        p.z += math.sin(math.pi * t) * .35
        obj = box(name + " tread", p - Vector((0, 0, .09)), (2.10, .285, .18),
                  "Timber honey" if i % 4 else "Timber pale", collection, .016)
        obj.rotation_euler.z = math.atan2(direction.y, direction.x) - math.pi / 2
        if i % 5 == 0 or i == steps:
            for sign in [-1, 1]:
                edge = p + side * 1.1 * sign
                beam(name + " upright", edge, edge + Vector((0, 0, 1.04)), .09, collection=collection)
        if previous is not None:
            for sign in [-1, 1]:
                for h in [.43, .97]:
                    beam(name + " rope", previous + side * 1.1 * sign + Vector((0, 0, h)),
                         p + side * 1.1 * sign + Vector((0, 0, h)), .035, "Rope", collection)
                beam(name + " stringer", previous + side * .84 * sign - Vector((0, 0, .23)),
                     p + side * .84 * sign - Vector((0, 0, .23)), .16, collection=collection)
            va = [previous - side, previous + side, p + side, p - side]
            col = mesh("COLLIDER_" + name, va, [(3, 2, 1, 0)], "Iron", "Collision")
            col.hide_render = True
            col.display_type = "WIRE"
            col["collision"] = "walkable_bridge"
        previous = p
    marker("BRIDGE_" + name + "_start", start, "bridge_endpoint")
    marker("BRIDGE_" + name + "_end", end, "bridge_endpoint")


def bench(name, loc, rotation=0, collection="Environment"):
    x, y, z = loc
    objs = []
    for yy in [-.15, .04, .23]:
        objs.append(box(name + " seat slat", (x, y + yy, z + .52), (1.8, .17, .1),
                        "Timber honey", collection))
    for xx in [-.68, .68]:
        objs.append(beam(name + " leg", (x + xx, y, z), (x + xx, y, z + .49),
                         .13, collection=collection))
        objs.append(beam(name + " back support", (x + xx, y + .24, z + .05),
                         (x + xx, y + .34, z + 1.07), .1, collection=collection))
    for zz in [.79, .99]:
        objs.append(box(name + " back slat", (x, y + .33, z + zz), (1.8, .07, .13),
                        "Timber", collection))
    if rotation:
        for obj in objs:
            offset = obj.location - Vector(loc)
            obj.location.x = x + math.cos(rotation) * offset.x - math.sin(rotation) * offset.y
            obj.location.y = y + math.sin(rotation) * offset.x + math.cos(rotation) * offset.y
            obj.rotation_euler.z += rotation
    marker("SEAT_" + name, (x, y, z + .56), "seat", facing=rotation)


def roof(name, x, y, z, width, depth, rise, collection="Environment", material_prefix="Roof"):
    slope = math.atan2(rise, width / 2)
    length = math.hypot(width / 2, rise)
    for sign in [-1, 1]:
        obj = box(name + " sheathing", (x + sign * width / 4, y, z + rise / 2),
                  (length, depth, .13), "Timber dark", collection)
        obj.rotation_euler.y = sign * slope
        cols = math.ceil(depth / .43)
        rows = math.ceil(length / .40)
        for row in range(rows):
            u = (row + .5) / rows
            for col in range(cols):
                yy = y - depth / 2 + (col + .5) * depth / cols
                zz = z + rise * (1 - u) + .09
                xx = x + sign * width / 2 * u
                tile = box(name + " shingle", (xx, yy, zz),
                           (length / rows + .055, depth / cols - .016, .06),
                           material_prefix + ["", " light", " dark"][(row + col * 2) % 3],
                           collection, .018)
                tile.rotation_euler.y = sign * slope
        for yy in [y - depth / 2, y + depth / 2]:
            beam(name + " rake", (x, yy, z + rise + .1),
                 (x + sign * width / 2, yy, z + .07), .12, "Timber dark", collection)
    beam(name + " ridge", (x, y - depth / 2 - .05, z + rise + .15),
         (x, y + depth / 2 + .05, z + rise + .15), .15, "Timber honey", collection)


def window_frame(name, center, width, height, orientation=0):
    x, y, z = center
    objs = []
    for xx in [-width / 2, width / 2]:
        objs.append(box(name + " jamb", (x + xx, y - .06, z), (.09, .13, height + .12), "Cream"))
    for zz in [-height / 2, height / 2]:
        objs.append(box(name + " sill", (x, y - .08, z + zz), (width + .23, .21, .1), "Cream"))
    objs.append(box(name + " mullion", (x, y - .045, z), (.045, .075, height), "Cream"))
    if orientation:
        for obj in objs:
            off = obj.location - Vector(center)
            obj.location = Vector(center) + Vector((math.cos(orientation) * off.x - math.sin(orientation) * off.y,
                                                     math.sin(orientation) * off.x + math.cos(orientation) * off.y, off.z))
            obj.rotation_euler.z = orientation


def house():
    x, y, z = 17, 6.5, 3
    for i in range(18):
        yy = y - 2.2 + (i + .5) * 4.4 / 18
        box("Home floorboard", (x, yy, z + .025), (4.8, .235, .05), "Timber pale", "Interior", .01)
    for xx in [-2.3, 2.3]:
        for yy in [-2.1, 2.1]:
            beam("Home structural post", (x + xx, y + yy, z), (x + xx, y + yy, z + 2.7), .16)
    front, back = y - 2.2, y + 2.2
    for i in range(13):
        zz = z + (i + .5) * .20
        for xx in [-1.55, 1.55]:
            box("Home front siding", (x + xx, front, zz), (1.5, .14, .19),
                "Cream" if i % 3 else "Cream shade")
        if zz > z + 2.2:
            box("Home door header siding", (x, front, zz), (1.65, .14, .19), "Cream")
        box("Home rear siding", (x, back, zz), (4.6, .14, .19), "Cream shade")
        for xx in [-2.35, 2.35]:
            if 1.05 < zz - z < 2.15:
                for yy in [-1.57, 1.57]:
                    box("Home side window pier", (x + xx, y + yy, zz), (.14, 1.25, .19), "Cream shade")
            else:
                box("Home side siding", (x + xx, y, zz), (.14, 4.4, .19), "Cream shade")
    for xx in [-.79, .79]:
        beam("Door jamb", (x + xx, front - .1, z), (x + xx, front - .1, z + 2.29), .12, "Timber dark")
    box("Door lintel", (x, front - .1, z + 2.29), (1.7, .18, .16), "Timber dark")
    # Open leaf sits beside the opening, not across the walkable threshold.
    door = box("Home open door", (x + .81, front + .74, z + 1.05), (.1, 1.45, 2.1),
               "Timber honey")
    door["configurable"] = "door_leaf"
    box("Door handle", (x + .73, front + 1.33, z + 1.07), (.06, .08, .12), "Iron")
    for sign in [-1, 1]:
        window_frame("Home side window", (x + sign * 2.35, y, z + 1.60), 1.9, 1.06, math.pi / 2)
    mesh("Home front gable", [(x - 2.35, front, z + 2.6), (x + 2.35, front, z + 2.6),
                               (x, front, z + 3.92)], [(0, 1, 2)], "Timber")
    mesh("Home rear gable", [(x + 2.35, back, z + 2.6), (x - 2.35, back, z + 2.6),
                              (x, back, z + 3.92)], [(0, 1, 2)], "Timber")
    for s in [-1, 1]:
        beam("Gable framing", (x, front - .09, z + 3.94),
             (x + s * 2.4, front - .09, z + 2.6), .13)
    roof("Home roof", x, y, z + 2.62, 5.45, 5.25, 1.52)
    for i in range(6):
        box("Porch board", (x, front - .18 - i * .25, z - .045), (5.25, .235, .12),
            "Timber honey")
    for xx in [-2.5, 2.5]:
        beam("Porch post", (x + xx, front - 1.45, z), (x + xx, front - 1.45, z + 2.32), .14)
        beam("Porch knee brace", (x + xx, front - 1.45, z + 1.75),
             (x + xx * .77, front - 1.45, z + 2.3), .11)
    roof("Porch hood", x, front - .7, z + 2.22, 5.55, 1.85, .46)
    lamp("Home welcome lantern", (x - 1.15, front - .34, z + 1.75), size=.8)
    box("Home nameboard", (x, front - 1.67, z + 2.26), (1.5, .075, .29), "Timber dark")
    text("Home lettering", "THE READING ROOM", (x, front - 1.72, z + 2.20), .12)
    potted_plant("Home porch fern", (x - 1.7, front - .75, z), .85)
    potted_plant("Home porch flowers", (x + 1.7, front - .7, z), .75, flower=True)
    # Furnished physical room; the demo's remote interior is not duplicated.
    box("Woven moss rug", (x - .15, y, z + .075), (2.45, 2.55, .035), "Fabric", "Interior", .025)
    for yy in [-1.05, -.8, .8, 1.05]:
        box("Rug woven border", (x - .15, y + yy, z + .097), (2.3, .035, .01),
            "Butter", "Interior", .003)
    for xx in [-1.85, -.65]:
        for yy in [1.25, 1.92]:
            beam("Reading chair leg", (x + xx, y + yy, z), (x + xx, y + yy, z + .47), .09,
                 collection="Interior")
    box("Reading chair cushion", (x - 1.25, y + 1.55, z + .52), (1.35, .9, .23),
        "Fabric", "Interior", .12)
    box("Reading chair back", (x - 1.25, y + 1.97, z + .93), (1.35, .22, .95),
        "Fabric", "Interior", .11)
    box("Reading pillow", (x - 1.38, y + 1.80, z + .91), (.62, .2, .54),
        "Butter", "Interior", .07)
    for xx in [-1.94, -.56]:
        box("Chair arm", (x + xx, y + 1.55, z + .76), (.16, 1.03, .13),
            "Timber honey", "Interior")
    marker("SEAT_Reading", (x - 1.25, y + 1.48, z + .68), "seat", facing=0)
    for xx in [.75, 2.05]:
        box("Bookshelf upright", (x + xx, y + 1.90, z + 1.05), (.12, .36, 2.1),
            "Timber dark", "Interior")
    for zz in [.13, .65, 1.17, 1.69, 2.16]:
        box("Bookshelf shelf", (x + 1.4, y + 1.90, z + zz), (1.46, .44, .1), "Timber", "Interior")
        if zz < 1.7:
            for i in range(7):
                height = RNG.uniform(.26, .4)
                book = box("Book original blank spine", (x + .85 + i * .17, y + 1.89, z + zz + .08 + height / 2),
                           (.11, .29, height), ["Clay", "Pine", "Butter", "Cream", "Sky"][i % 5],
                           "Interior", .008)
                book.rotation_euler.y = RNG.uniform(-.07, .07)
    tube("Reading side table", (x + .25, y + .95, z), (x + .25, y + .95, z + .69),
         .085, "Timber dark", "Interior")
    box("Reading table top", (x + .25, y + .95, z + .72), (.75, .72, .08), "Timber honey", "Interior")
    for dx, angle in [(-.12, -.12), (.12, .12)]:
        obj = box("Open book page", (x + .25 + dx, y + .90, z + .79),
                  (.25, .34, .022), "Paper", "Interior", .006)
        obj.rotation_euler.y = angle
    lamp("Reading lamp", (x + .26, y + 1.20, z + 1.16), "Interior", .65)
    tube("Reading lamp stem", (x + .26, y + 1.20, z + .78),
         (x + .26, y + 1.20, z + 1.0), .025, "Iron", "Interior", sides=8)
    tube("Reading lamp foot", (x + .26, y + 1.20, z + .775),
         (x + .26, y + 1.20, z + .805), .12, "Iron", "Interior", sides=12)
    for yy in [-1.7, 0, 1.7]:
        beam("Interior ceiling tie", (x - 2.3, y + yy, z + 2.51),
             (x + 2.3, y + yy, z + 2.51), .12, "Timber dark", "Interior")
    potted_plant("Interior windowsill plant", (x + 1.8, y - .4, z), .65, "Interior")
    box("Interior keepsake picture frame", (x - .3, back - .13, z + 1.7),
        (.62, .06, .72), "Timber honey", "Interior")
    box("Interior keepsake picture", (x - .3, back - .18, z + 1.7),
        (.5, .02, .60), "Sky", "Interior")
    pebble("Picture mountain motif", (x - .3, back - .2, z + 1.61), (.22, .025, .20),
           "Cream", "Interior")
    marker("DOOR_Grove", (17, 3.1, 3), "doorway", clear_width=1.46, clear_height=2.21,
           actual_threshold=[17, 4.3, 3], app_remote_interior_center=190)
    for loc, size in [((x - 2.35, y, z + 1.3), (.2, 4.4, 2.6)),
                      ((x + 2.35, y, z + 1.3), (.2, 4.4, 2.6)),
                      ((x, back, z + 1.3), (4.7, .2, 2.6)),
                      ((x - 1.55, front, z + 1.1), (1.5, .2, 2.2)),
                      ((x + 1.55, front, z + 1.1), (1.5, .2, 2.2))]:
        ob = box("COLLIDER_Home_wall", loc, size, "Iron", "Collision", 0)
        ob.hide_render = True
        ob.display_type = "WIRE"
        ob["collision"] = "solid"
    for obj in C["Environment"].objects:
        if "siding" in obj.name:
            obj.scale.z = .215 / .19


def small_ember():
    c = "Ember Small"
    x, y, z = 1.3, -.8, 0
    box("Ember exhibit pedestal", (x, y, z + .39), (.65, .65, .78), "Timber dark", c)
    box("Ember ceramic dish", (x, y, z + .83), (.61, .61, .11), "Clay", c, .045)
    for i in range(4):
        a = i * math.tau / 4
        beam("Reliquary ribs", (x + math.cos(a) * .20, y + math.sin(a) * .20, z + .88),
             (x + math.cos(a + .4) * .12, y + math.sin(a + .4) * .12, z + 1.23),
             .038, "Iron", c)
    pebble("The small ember", (x, y, z + 1.05), (.115, .1, .19), "Ember", c, 2)
    marker("CONTRIBUTION_ember_small", (x, y, z), "small_contribution", game_id="ember",
           replaces_remnant=True, resident_count=1)


def hearth():
    c = "Hearth Deck"
    x, y, z = 37, -10, 4
    deck("Hearth_plot", (x, y, z), 6, c, [math.atan2(15, -17)])
    bridge("Grove_to_plot", (20, 5, 3), 8, (x, y, z), 6, c)
    # All substantial furniture stays in the source contribution obstacle footprint.
    yy = y + 1.7
    box("Hearth stone base", (x, yy, z + .1), (3.15, 2.18, .2), "Stone", c, .07)
    for xx in [-1.4, 1.4]:
        beam("Hearth shelter post", (x + xx, yy + .78, z), (x + xx, yy + .78, z + 2.6),
             .15, collection=c)
        beam("Hearth shelter post", (x + xx, yy - .78, z), (x + xx, yy - .78, z + 2.6),
             .15, collection=c)
    roof("Hearth shelter", x, yy, z + 2.45, 3.25, 2.25, .56, c, "Clay roof")
    for side in [-1, 1]:
        box("Hearth masonry pier", (x + side * .57, yy + .35, z + .73),
            (.35, .59, 1.23), "Stone", c, .06)
        for h in [.35, .67, .99]:
            box("Hearth masonry joint", (x + side * .57, yy + .042, z + h),
                (.35, .01, .018), "Stone shade", c, 0)
    box("Hearth mantel", (x, yy + .35, z + 1.36), (1.64, .77, .18), "Stone shade", c)
    box("Hearth back", (x, yy + .63, z + .7), (.9, .18, 1.17), "Stone shade", c)
    for dx, dy in [(-.2, .0), (.2, .08), (0, -.14)]:
        tube("Hearth log", (x + dx - .28, yy + dy, z + .3), (x + dx + .28, yy + dy + .12, z + .3),
             .075, "Bark", c)
        pebble("Hearth ember flame", (x + dx, yy + dy, z + .49), (.10, .085, .22), "Ember", c, 2)
    box("Hearth built-in bench", (x - 1.04, yy - .18, z + .5), (.42, 1.15, .13),
        "Timber honey", c)
    box("Hearth built-in bench foot", (x - 1.04, yy - .18, z + .24), (.32, 1.0, .44),
        "Timber dark", c)
    marker("SEAT_Hearth", (x - 1.04, yy - .18, z + .6), "seat", facing=math.pi / 2)
    lamp("Hearth shelter lantern", (x + .98, yy - .73, z + 2.08), c, .75)
    marker("CONTRIBUTION_ember_structure", (x, y, z), "earned_structure", game_id="ember",
           site="plot", footprint_radius=6, starter=False)
    # Tier enrichment is independently removable and never adds another resident.
    potted_plant("Elder hearth planting", (x + 1.03, yy - .24, z + .22), .55, "Hearth Enrichment")
    box("Elder travel journal", (x + .45, yy + .30, z + 1.49), (.3, .23, .08),
        "Clay", "Hearth Enrichment")


def postcard():
    c = "Rain Postcard"
    x, y, z = -6, -22, -1
    # A single warm game-specific paper remnant; Rue is not in the settlement.
    box("Postcard paper", (x + 1.4, y + .3, z + 1.20), (.53, .034, .36), "Paper", c, .012)
    box("Postcard original rain illustration", (x + 1.4, y + .277, z + 1.22),
        (.44, .008, .25), "Sky", c, .002)
    for k in range(4):
        tube("Postcard rain stroke", (x + 1.22 + k * .11, y + .266, z + 1.29),
             (x + 1.24 + k * .11, y + .266, z + 1.25), .006, "Cream", c, sides=4)
    pebble("Postcard rainflower", (x + 1.5, y + .26, z + 1.16), (.075, .008, .054), "Butter", c, 1)
    box("Postcard peg", (x + 1.4, y + .246, z + 1.38), (.045, .05, .11), "Timber honey", c)
    marker("REMNANT_rain", (x + 1.4, y + .3, z + 1.2), "remnant", game_id="rain",
           decay=False, survives_reinvite=True, removed_on_arrival=True)


def gathering():
    tree("Gathering oak", (-3, 2, 0), 11.6, 1.25)
    # A wrap-around seating arc keeps the main walking lane open.
    for loc, angle in [((-5.8, 1.0, 0), -.8), ((-2.7, 5, 0), math.pi),
                       ((-5.0, -1.8, 0), -.4)]:
        bench("Gathering seat", loc, angle)
    for k in range(8):
        a = k * math.tau / 8
        x, y = -3 + math.cos(a) * 2.1, 2 + math.sin(a) * 2.1
        pebble("Root bed moss", (x, y, .025), (.52, .37, .12), "Moss", subdiv=2)
        fern((x, y, .09), .5)
    for x, y in [(-6.5, 4.8), (3.5, 6.7), (-6, -5.3), (6.5, -.2)]:
        beam("Plaza lantern standard", (x, y, 0), (x, y, 2.1), .11)
        beam("Plaza lantern hook", (x, y, 2.06), (x + .4, y, 2.15), .07)
        lamp("Gathering lantern", (x + .4, y, 1.77), size=.9)
    # Sagging string of lanterns through negative space below the foliage.
    last = None
    for i in range(19):
        t = i / 18
        pos = (-7 + 10 * t, 4.2 + 1.5 * t, 4.0 - .8 * math.sin(math.pi * t))
        if last:
            beam("Lantern garland cord", last, pos, .025, "Rope")
        if i % 3 == 0:
            lamp("Garland lantern", (pos[0], pos[1], pos[2] - .24), size=.48)
        last = pos
    box("Gathering tree identity plaque", (-2.8, .66, 1.55), (1.6, .08, .5), "Timber dark")
    text("Canopy plaque lettering", "C A N O P Y", (-2.8, .607, 1.50), .18)
    for a in [1.0, 1.35, 2.0, 2.4, 2.8, 3.35, 3.7, 5.7]:
        x, y = 8.15 * math.cos(a), 8.15 * math.sin(a)
        box("Plaza garden trough", (x, y, .22), (1.75, .62, .44), "Timber dark", rot=a + math.pi / 2)
        box("Plaza garden soil", (x, y, .45), (1.6, .49, .035), "Earth", rot=a + math.pi / 2)
        for d in [-.52, 0, .52]:
            xx, yy = x - math.sin(a) * d, y + math.cos(a) * d
            fern((xx, yy, .46), .65)
            if d == 0:
                potted_plant("Plaza garden blossom", (xx, yy, .4), .55, flower=True)
    for xx in [-4.0, -2.2]:
        for yy in [-5.8, -5]:
            beam("Gathering table trestle", (xx, yy, 0), (xx, yy, .83), .12)
    for yy in [-5.85, -5.55, -5.25, -4.95]:
        box("Gathering table top", (-3.1, yy, .87), (2.45, .28, .1), "Timber honey")
    bench("Table shared bench", (-3.1, -6.5, 0), math.pi)
    for xx, yy in [(-3.7, -5.7), (-2.7, -5.1)]:
        tube("Communal ceramic cup", (xx, yy, .94), (xx, yy, 1.1), .085, "Clay pale", sides=10)
    for i in range(3):
        card = box("Original story card", (-3.2 + i * .17, -5.4, .936), (.14, .22, .008),
                   ["Paper", "Butter", "Sky"][i], bevel=.003)
        card.rotation_euler.z = i * .12
    potted_plant("Shared table centerpiece", (-2.45, -5.5, .93), .4)


def trailhead():
    x, y, z = -6, -22, -1
    deck("Trailhead", (x, y, z), 6, gates=[math.atan2(22, 6)])
    bridge("Plaza_to_trailhead", (0, 0, 0), 10, (x, y, z), 6)
    for xx in [-1.45, 1.45]:
        beam("Trailhead welcome post", (x + xx, y + 2.6, z), (x + xx, y + 2.6, z + 2.8), .15)
    beam("Trailhead welcome lintel", (x - 1.7, y + 2.6, z + 2.8), (x + 1.7, y + 2.6, z + 2.8),
         .18, "Timber honey")
    box("Trailhead sign", (x, y + 2.6, z + 2.5), (2.55, .1, .34), "Timber dark")
    text("Trailhead lettering", "THE NEXT ADVENTURE", (x, y + 2.54, z + 2.45), .15)
    for xx in [1.0, 1.8]:
        beam("Postcard shelf leg", (x + xx, y + .36, z), (x + xx, y + .36, z + .98), .08)
    box("Postcard shelf", (x + 1.4, y + .38, z + .94), (1.25, .42, .1), "Timber")
    box("Postcard string support", (x + 1.4, y + .37, z + 1.43), (1.22, .08, .07), "Timber dark")
    potted_plant("Trailhead flower pot", (x + 2.15, y + .6, z), .75, flower=True)
    bench("Trailhead rest", (x - 2.1, y - .3, z), -.2)
    lamp("Trailhead lantern", (x - 1.45, y + 2.6, z + 2.1), size=.7)
    postcard()


def camera(name, loc, target, lens=45, ortho=None):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    C["Cameras"].objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    data.lens = lens
    data.clip_end = 300
    if ortho:
        data.type = "ORTHO"
        data.ortho_scale = ortho
    obj["camera_role"] = name
    return obj


def staging():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Canopy sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.42, .54, .46, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
    scene.world = world
    for name, loc, target, energy, size, color in [
        ("Sunlit window in sky", (-12, -19, 32), (9, 0, 2), 9500, 18, (1, .78, .52)),
        ("Soft sky fill", (27, 10, 28), (12, 0, 2), 6500, 24, (.59, .74, 1)),
    ]:
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.shape, light.size, light.color = energy, "DISK", size, color
        obj = bpy.data.objects.new(name, light)
        C["Lighting"].objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
        obj["day_energy"] = energy
        obj["night_energy"] = energy * .08
    light = bpy.data.lights.new("Golden hour sun", "SUN")
    light.energy, light.angle, light.color = 2.1, .16, (1, .83, .60)
    obj = bpy.data.objects.new("Golden hour sun", light)
    C["Lighting"].objects.link(obj)
    obj.rotation_euler = (.55, -.55, -.5)
    obj["day_energy"], obj["night_energy"] = 2.1, .12
    scene.camera = camera("Overview", (49, -58, 39), (12, -3, 1), 48)
    camera("Gathering walk", (7, -7, 2.3), (-3, 2, 2.5), 26)
    camera("Home threshold", (15.8, -.2, 5), (17, 6.8, 4.1), 32)
    camera("Interior", (17, 4.55, 4.55), (17, 7.6, 4.1), 21)
    camera("Hearth detail", (42, -17, 8.5), (37, -8.3, 5.1), 45)
    ambient = camera("Ambient loop", (44, -44, 26), (12, 0, 2), 46)
    for frame in range(1, 146, 6):
        t = (frame - 1) / 144 * math.tau
        ambient.location = (44 + 1.8 * math.sin(t), -44 + 1.1 * math.cos(t), 26 + .4 * math.sin(t))
        ambient.rotation_euler = (Vector((12, 0, 2)) - ambient.location).to_track_quat("-Z", "Y").to_euler()
        ambient.keyframe_insert("location", frame=frame)
        ambient.keyframe_insert("rotation_euler", frame=frame)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 6
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 144
    scene.view_settings.view_transform = "AgX"
    scene.render.film_transparent = False
    scene["coordinate_mapping"] = "Blender (x,y,z) = application (x,-z,y); glTF exporter restores application axes."
    scene["approval_scope"] = "Representative slice only. Full settlement and remaining avatars await art approval."
    scene["topology_source"] = "just-play 2cb9d46f77d519d7818d917d7762fcc3c6cb1196 lib/demo/world.ts"


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--proof", action="store_true")
    parser.add_argument("--output-name", default="environment-source.blend")
    options = parser.parse_args(args)
    target = fresh_path(OUT / ("environment-proof.blend" if options.proof else options.output_name))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    scene = bpy.context.scene
    scene.name = "Canopy | Approval slice"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    for name in ["Environment", "Foliage", "Interior", "Characters", "Ember Small", "Hearth Deck",
                 "Hearth Enrichment", "Rain Postcard", "Collision", "Markers", "Cameras", "Lighting"]:
        C[name] = bpy.data.collections.new(name)
        scene.collection.children.link(C[name])
    palette = {
        "Timber": "A58360", "Timber pale": "B39470", "Timber honey": "B18A60",
        "Timber dark": "5C4436", "Bark": "695044", "Bark light": "7D6050",
        "Cream": "DFD6B8", "Cream shade": "C7C6A8", "Paper": "F5E8CA",
        "Pine": "294F41", "Leaf": "52764D", "Leaf light": "809260", "Moss": "647844",
        "Roof": "566C52", "Roof light": "718063", "Roof dark": "3F584A",
        "Clay roof": "A96C55", "Clay roof light": "BD8661", "Clay roof dark": "865444",
        "Clay": "C28C6D", "Clay pale": "D5AC85", "Butter": "D6BB71",
        "Stone": "9D9B87", "Stone shade": "777C71", "Iron": "394540", "Rope": "B5A681",
        "Earth": "4C4836", "Fabric": "778577", "Sky": "98BDC1",
    }
    for name, color in palette.items():
        material(name, color, .88 if name in ["Bark", "Fabric", "Paper"] else .76)
    material("Lantern paper", "FFD99B", .65, 1.6)
    material("Ember", "FFB15E", .85, 2.8)
    deck("Gathering", (0, 0, 0), 10, gates=[math.atan2(5, 20), math.atan2(-22, -6)])
    gathering()
    staging()
    if not options.proof:
        deck("Grove", (20, 5, 3), 8,
             gates=[math.atan2(-5, -20), math.atan2(-15, 17), math.atan2(18, 10)])
        bridge("Plaza_to_grove", (0, 0, 0), 10, (20, 5, 3), 8)
        house()
        tree("Grove oak", (22, 10, 3), 9.6, .86)
        for loc in [(24, 8, 3), (23.5, 10, 3), (21, 10.7, 3), (15, 9, 3)]:
            fern(loc, .9)
            pebble("Grove moss bed", (loc[0], loc[1], loc[2] + .06), (.8, .7, .17), "Moss", subdiv=2)
        potted_plant("Grove edge garden", (24, 1.5, 3), 1.3, flower=True)
        bench("Grove outward seat", (23.5, 1, 3), .4)
        small_ember()
        hearth()
        trailhead()
        for name, loc, radius, parent in [
            ("plot", (37, -10, 4), 6, "grove"), ("brook", (30, 23, 4), 5, "grove"),
            ("crown", (12, 40, 6), 5, "lookout"), ("fern", (-18, 29, 5), 5, "lookout"),
            ("dusk", (-39, 7, 3), 5, "lodge"), ("meadow", (-27, -17, 1), 5, "lodge"),
            ("sunrise", (12, -25, 0), 5, "trailhead")]:
            marker("ATTACH_" + name, loc, "attachment", site=name, radius=radius,
                   parent_location=parent, occupied_preview=name == "plot")
        marker("LOCATION_Lookout_deferred", (0, 25, 5), "deferred_location", radius=6)
        marker("LOCATION_Lodge_deferred", (-21, 2, 2), "deferred_location", radius=7)
    else:
        scene.camera.location = (21, -28, 20)
        scene.camera.rotation_euler = (Vector((-1, 1, 3)) - scene.camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    print("CANOPY_BUILD=" + json.dumps({"path": str(target), "objects": len(scene.objects),
                                      "proof": options.proof}))


if __name__ == "__main__":
    main()
