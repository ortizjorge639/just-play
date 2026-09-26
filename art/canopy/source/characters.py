"""Original Canopy approval characters; no scene, render, or file side effects.

Usage in Blender 5.2:
    import characters
    pip = characters.build_character("Pip", collection, (-1, 0, 0))
    sol = characters.build_character("Sol", collection, (1, 0, 0), rotation=0.2)

Local forward is -Y, up is Z; rotation is radians around Z. All geometry is
armature-deformed and all objects belong exclusively to the supplied collection.
The rest pose has soles at Z=0. Idle alone is active, with cyclic F-curves, so it
repeats over a parent's 1..144 timeline without changing that timeline or FPS.
Use 24 FPS. Loops have duplicate endpoint keys: Idle/Greeting 1..73 (72-frame
period), Walk 1..25 (24-frame period). Export through Blender glTF ACTIONS mode,
export_frame_range=False, export_anim_slide_to_zero=True,
export_anim_single_armature=False, with the desired
character selected. Keep export_anim_single_armature=False even when exporting
one selected character: True broadcasts every armature action in bpy.data.actions
onto that rig, including another character's clips. Export root plus all recursive
descendants; temporarily zero root.location/rotation for an origin-space asset.
Every action has a character-specific slot and fake user.
Walk/Greeting are additionally referenced by MUTED single-strip NLA stash tracks
so Blender 5.2 ACTIONS export discovers them with multiple armatures. Only Idle
evaluates; do not unmute the stash tracks. For an individual clip assign rig.animation_data.action
to bpy.data.actions[name], assign its slots[0] to animation_data.action_slot,
and export in ACTIVE_ACTIONS mode. Restore the Idle action afterwards.

Parts such as Hair_*, Apron_*, Cape_*, and Satchel_* can be hidden or replaced.
Shared bone names are in BONE_SPEC. Segmented joints use rigid skinning, not IK;
this is an original stylized approval kit, not a production facial rig.
"""

import math

import bpy
from mathutils import Euler, Matrix, Vector


BONE_SPEC = {
    "pelvis": ((0, 0, .58), (0, 0, .72), None),
    "spine": ((0, 0, .72), (0, 0, 1.015), "pelvis"),
    "neck": ((0, 0, 1.015), (0, 0, 1.10), "spine"),
    "head": ((0, 0, 1.10), (0, 0, 1.49), "neck"),
}
for _side, _sign in (("L", 1), ("R", -1)):
    BONE_SPEC.update({
        f"upper_arm.{_side}": ((_sign * .225, 0, .955),
                              (_sign * .315, 0, .745), "spine"),
        f"lower_arm.{_side}": ((_sign * .315, 0, .745),
                              (_sign * .34, -.015, .585), f"upper_arm.{_side}"),
        f"hand.{_side}": ((_sign * .34, -.015, .585),
                         (_sign * .35, -.02, .52), f"lower_arm.{_side}"),
        f"upper_leg.{_side}": ((_sign * .115, 0, .605),
                              (_sign * .12, 0, .345), "pelvis"),
        f"lower_leg.{_side}": ((_sign * .12, 0, .345),
                              (_sign * .12, 0, .105), f"upper_leg.{_side}"),
        f"foot.{_side}": ((_sign * .12, 0, .105),
                         (_sign * .12, -.14, .055), f"lower_leg.{_side}"),
    })


def _linear_hex(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
                 for c in rgb) + (1,)


class _Character:
    def __init__(self, name, collection):
        self.name, self.collection = name, collection
        self.meshes = []
        self.root = bpy.data.objects.new(name + "_Root", None)
        self.root.empty_display_type = "PLAIN_AXES"
        self.root.empty_display_size = .2
        collection.objects.link(self.root)
        self.root["canopy_character"] = name
        self.root["forward_axis"] = "-Y"
        self.root["rest_sole_z"] = 0.0
        self.materials = {}
        colors = {
            "skin": "DBA07A" if name == "Pip" else "86513E",
            "cheek": "CD816D" if name == "Pip" else "965A46",
            "hair": "584033" if name == "Pip" else "292D2C",
            "hair_light": "725440" if name == "Pip" else "424844",
            "brow": "4D392D" if name == "Pip" else "242927",
            "eye_white": "F3E8D7",
            "iris": "466F53" if name == "Pip" else "C39152",
            "pupil": "252B29",
            "mouth": "804F41" if name == "Pip" else "492F2B",
            "shirt": "64794B" if name == "Pip" else "B95F43",
            "shirt_light": "8C9C65" if name == "Pip" else "D1855C",
            "cloth": "DDD0A6" if name == "Pip" else "823F37",
            "cloth_edge": "AEAD7F" if name == "Pip" else "E2AB74",
            "pants": "465744" if name == "Pip" else "3E4847",
            "leather": "997044" if name == "Pip" else "514136",
            "sole": "5A543D" if name == "Pip" else "352F2B",
            "seed": "E5BC63",
            "ember": "E3A35A",
        }
        for role, color in colors.items():
            mat = bpy.data.materials.new(f"{name}_Mat_{role}")
            mat.diffuse_color = _linear_hex(color)
            mat.use_nodes = True
            shader = mat.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Base Color"].default_value = mat.diffuse_color
            shader.inputs["Roughness"].default_value = .84
            shader.inputs["Metallic"].default_value = 0
            shader.inputs["Transmission Weight"].default_value = 0
            self.materials[role] = mat
        self.rig = self._rig()

    def _rig(self):
        arm = bpy.data.armatures.new(self.name + "_Skeleton")
        rig = bpy.data.objects.new(self.name + "_Rig", arm)
        self.collection.objects.link(rig)
        rig.parent = self.root
        rig.show_in_front = True
        rig["rig_contract"] = "Canopy_v1_shared_16_bones"
        for obj in bpy.context.selected_objects:
            obj.select_set(False)
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        try:
            for name, (head, tail, parent) in BONE_SPEC.items():
                bone = arm.edit_bones.new(name)
                bone.head, bone.tail = head, tail
                bone.align_roll(Vector((0, -1, 0)))
                if parent:
                    bone.parent = arm.edit_bones[parent]
        finally:
            bpy.ops.object.mode_set(mode="OBJECT")
        for bone in rig.pose.bones:
            bone.rotation_mode = "QUATERNION"
        return rig

    def mesh(self, name, vertices, faces, material, bone="head", smooth=True):
        data = bpy.data.meshes.new(f"{self.name}_{name}_Mesh")
        data.from_pydata(vertices, [], faces)
        data.update()
        obj = bpy.data.objects.new(f"{self.name}_{name}", data)
        self.collection.objects.link(obj)
        obj.parent = self.root
        obj.data.materials.append(self.materials[material])
        for face in data.polygons:
            face.use_smooth = smooth
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(vertices))), 1.0, "REPLACE")
        mod = obj.modifiers.new("Canopy_Skin", "ARMATURE")
        mod.object = self.rig
        obj["kit_part"] = name
        obj["deform_bone"] = bone
        self.meshes.append(obj)
        return obj

    def ellipsoid(self, name, center, radii, material, bone="head",
                  segments=12, rings=7, rotation=None):
        vertices = [(0, 0, -1)]
        for j in range(1, rings):
            latitude = -math.pi / 2 + math.pi * j / rings
            for i in range(segments):
                a = 2 * math.pi * i / segments
                vertices.append((math.cos(latitude) * math.cos(a),
                                 math.cos(latitude) * math.sin(a),
                                 math.sin(latitude)))
        vertices.append((0, 0, 1))
        faces = []
        for i in range(segments):
            faces.append((0, 1 + (i + 1) % segments, 1 + i))
        for j in range(rings - 2):
            a, b = 1 + j * segments, 1 + (j + 1) * segments
            for i in range(segments):
                n = (i + 1) % segments
                faces.append((a + i, a + n, b + n, b + i))
        top = len(vertices) - 1
        base = 1 + (rings - 2) * segments
        for i in range(segments):
            faces.append((base + i, base + (i + 1) % segments, top))
        transform = Euler(rotation).to_matrix() if rotation else Matrix.Identity(3)
        vertices = [Vector(center) + transform @ Vector(
            (v[0] * radii[0], v[1] * radii[1], v[2] * radii[2])) for v in vertices]
        return self.mesh(name, vertices, faces, material, bone)

    def profile(self, name, levels, material, bone="spine", segments=16):
        """Closed oval rings: each level is z, halfwidth, halfdepth, y-offset."""
        vertices = []
        for z, width, depth, offset in levels:
            for i in range(segments):
                a = 2 * math.pi * i / segments
                vertices.append((width * math.cos(a), offset + depth * math.sin(a), z))
        faces = [tuple(reversed(range(segments)))]
        for j in range(len(levels) - 1):
            for i in range(segments):
                k, n = j * segments + i, j * segments + (i + 1) % segments
                faces.append((k, n, n + segments, k + segments))
        faces.append(tuple((len(levels) - 1) * segments + i for i in range(segments)))
        return self.mesh(name, vertices, faces, material, bone)

    def stroke(self, name, points, radius, material, bone="head", sides=6):
        vertices = []
        for i, point in enumerate(points):
            tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(
                points[max(0, i - 1)])
            tangent.normalize()
            reference = Vector((0, -1, 0))
            if abs(tangent.dot(reference)) > .95:
                reference = Vector((1, 0, 0))
            a = tangent.cross(reference).normalized()
            b = tangent.cross(a).normalized()
            for j in range(sides):
                theta = j * math.tau / sides
                vertices.append(Vector(point) + radius * (a * math.cos(theta) + b * math.sin(theta)))
        faces = [tuple(reversed(range(sides)))]
        for i in range(len(points) - 1):
            for j in range(sides):
                k, n = i * sides + j, i * sides + (j + 1) % sides
                faces.append((k, n, n + sides, k + sides))
        faces.append(tuple((len(points) - 1) * sides + j for j in range(sides)))
        return self.mesh(name, vertices, faces, material, bone)

    def panel(self, name, points, thickness, material, bone="spine", smooth=False):
        n = len(points)
        vertices = points + [(x, y + thickness, z) for x, y, z in points]
        faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
        faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
        return self.mesh(name, vertices, faces, material, bone, smooth)

    def body(self):
        pip = self.name == "Pip"
        self.profile("Tunic", [(.56, .185, .13, .015), (.64, .21, .15, 0),
                              (.80, .20, .14, 0), (.94, .24, .115, 0),
                              (1.005, .135, .085, 0)], "shirt")
        self.ellipsoid("Hips", (0, 0, .59), (.19, .13, .135), "pants", "pelvis")
        self.ellipsoid("Neck", (0, 0, 1.052), (.077, .072, .095), "skin", "neck")
        self.profile("Collar", [(.984, .116, .082, 0), (1.017, .101, .078, 0)],
                     "shirt_light")
        for side, sign in (("L", 1), ("R", -1)):
            arm, lower, hand = f"upper_arm.{side}", f"lower_arm.{side}", f"hand.{side}"
            thigh, shin, foot = f"upper_leg.{side}", f"lower_leg.{side}", f"foot.{side}"
            self.ellipsoid(f"Sleeve_{side}", (sign * .272, 0, .858), (.087, .095, .146),
                           "shirt", arm, rotation=(0, sign * -.38, 0))
            self.ellipsoid(f"Cuff_{side}", (sign * .312, 0, .752), (.081, .09, .048),
                           "shirt_light", arm, rings=5)
            self.ellipsoid(f"Forearm_{side}", (sign * .328, -.007, .676), (.058, .064, .111),
                           "skin", lower)
            self.ellipsoid(f"Hand_{side}", (sign * .346, -.019, .551), (.067, .058, .079),
                           "skin", hand)
            self.ellipsoid(f"Thumb_{side}", (sign * .295, -.047, .56), (.025, .033, .044),
                           "skin", hand, segments=8, rings=5)
            self.ellipsoid(f"Trouser_{side}", (sign * .117, 0, .483), (.092, .104, .177),
                           "pants", thigh)
            self.ellipsoid(f"Knee_{side}", (sign * .12, 0, .343), (.077, .083, .075),
                           "pants", shin)
            self.ellipsoid(f"LowerTrouser_{side}", (sign * .12, 0, .252), (.075, .078, .123),
                           "pants", shin)
            if not pip:
                self.ellipsoid(f"BootShaft_{side}", (sign * .12, .005, .183),
                               (.089, .096, .124), "leather", shin)
                self.ellipsoid(f"BootCuff_{side}", (sign * .12, .001, .273),
                               (.096, .102, .032), "cloth_edge", shin, rings=5)
            self.ellipsoid(f"Shoe_{side}" if pip else f"BootToe_{side}",
                           (sign * .12, -.054, .091), (.106, .162, .083),
                           "leather", foot)
            self.ellipsoid(f"Sole_{side}", (sign * .12, -.054, .031),
                           (.107, .163, .031), "sole", foot, rings=6)
            self.stroke(f"ShoeSeam_{side}", [(sign * .12 - .07, -.145, .125),
                        (sign * .12, -.161, .144), (sign * .12 + .07, -.145, .125)],
                        .006, "cloth_edge", foot)

    def face(self):
        pip = self.name == "Pip"
        levels = ([(1.052, .092, .10, -.005), (1.085, .14, .143, -.008),
                   (1.17, .202, .18, -.01), (1.285, .235, .208, -.007),
                   (1.40, .227, .198, .005), (1.51, .199, .17, .02),
                   (1.58, .113, .10, .023), (1.602, .025, .026, .023)] if pip else
                  [(1.057, .083, .086, -.005), (1.091, .143, .133, -.012),
                   (1.18, .203, .174, -.006), (1.295, .218, .19, 0),
                   (1.42, .207, .182, .008), (1.525, .18, .15, .02),
                   (1.575, .10, .086, .02), (1.594, .025, .025, .02)])
        self.head_levels = levels
        self.profile("Face_SculptedHead", levels, "skin", "head", 20)
        for side, s in (("L", 1), ("R", -1)):
            self.ellipsoid(f"Face_Ear_{side}", (s * .224, -.004, 1.294),
                           (.052, .038, .08), "skin", segments=10, rings=6)
            self.ellipsoid(f"Face_EarInset_{side}", (s * .242, -.033, 1.295),
                           (.022, .012, .043), "cheek", segments=8, rings=5)
            self.ellipsoid(f"Face_Cheek_{side}", (s * .142, -.171, 1.264),
                           (.066, .028, .048), "skin", segments=10, rings=6)
            self.ellipsoid(f"Face_Blush_{side}", (s * .154, -.19, 1.261),
                           (.034, .008, .019), "cheek", segments=10, rings=5)
            eye_y = -.196 if pip else -.183
            self.ellipsoid(f"Face_EyeWhite_{side}", (s * .093, eye_y, 1.366),
                           (.046, .018, .057 if pip else .043), "eye_white", segments=12, rings=6)
            self.ellipsoid(f"Face_Iris_{side}", (s * .089, eye_y - .016, 1.363),
                           (.024, .009, .033 if pip else .028), "iris", segments=10, rings=6)
            self.ellipsoid(f"Face_Pupil_{side}", (s * .089, eye_y - .024, 1.364),
                           (.012, .005, .023), "pupil", segments=8, rings=5)
            self.ellipsoid(f"Face_EyeGlint_{side}", (s * .089 - .006, eye_y - .029, 1.377),
                           (.0065, .0025, .008), "eye_white", segments=6, rings=4)
            eyebrow_z = 1.435 + (.012 if pip and s == 1 else 0)
            self.stroke(f"Face_Brow_{side}",
                        [(s * .055, eye_y + .008, eyebrow_z),
                         (s * .089, eye_y - .002, eyebrow_z + .008),
                         (s * .134, eye_y + .02, eyebrow_z - .004)],
                        .011 if pip else .014, "brow")
        if pip:
            self.ellipsoid("Face_NoseBridge", (0, -.206, 1.323), (.033, .029, .057), "skin")
            self.ellipsoid("Face_NoseTip", (0, -.239, 1.297), (.043, .046, .034), "skin",
                           segments=10, rings=6)
        else:
            self.mesh("Face_NoseSculpt", [(-.025, -.172, 1.367), (.025, -.172, 1.367),
                      (-.033, -.208, 1.276), (.033, -.208, 1.276), (0, -.273, 1.295),
                      (0, -.199, 1.262)],
                      [(0, 1, 4), (1, 3, 4), (3, 5, 4), (5, 2, 4), (2, 0, 4),
                       (0, 2, 5, 3, 1)], "skin")
        self.stroke("Face_Smile", [(-.064, -.185, 1.225), (-.035, -.197, 1.214),
                    (0, -.202, 1.21), (.035, -.197, 1.214), (.064, -.185, 1.23 if pip else 1.222)],
                    .0065, "mouth")
        self.ellipsoid("Face_LowerLip", (0, -.183, 1.193), (.033, .007, .008),
                       "cheek", segments=10, rings=4)

    def hair(self):
        pip = self.name == "Pip"
        # The cap's lower hairline rises over the forehead and dips behind ears.
        n, ring_count = 20, 12
        vertices = []
        for ring in range(ring_count):
            t = ring / ring_count
            for i in range(n):
                a = i * math.tau / n
                front = max(0, -math.sin(a))
                bottom = 1.255 + .225 * front
                z = bottom + (1.627 - bottom) * math.sin(t * math.pi / 2)
                levels = self.head_levels + [(1.627, .004, .004, .023)]
                lower, upper = next((lo, hi) for lo, hi in zip(levels, levels[1:])
                                    if lo[0] <= z <= hi[0])
                blend = (z - lower[0]) / (upper[0] - lower[0])
                width, depth, offset = [lower[k] * (1 - blend) + upper[k] * blend
                                       for k in (1, 2, 3)]
                vertices.append(((width + .016) * math.cos(a),
                                 offset + (depth + .018) * math.sin(a), z))
        vertices.append((0, .023, 1.627))
        faces = []
        for ring in range(ring_count - 1):
            for i in range(n):
                k, nxt = ring * n + i, ring * n + (i + 1) % n
                faces.append((k, nxt, nxt + n, k + n))
        faces.extend(((ring_count - 1) * n + i, (ring_count - 1) * n + (i + 1) % n,
                      ring_count * n) for i in range(n))
        faces.append(tuple(reversed(range(n))))
        self.mesh("Hair_Cap", vertices, faces, "hair")
        if pip:
            for i, (x, y, z, rx, rz, tilt) in enumerate([
                    (-.143, -.122, 1.517, .086, .107, -.45),
                    (-.054, -.158, 1.528, .092, .108, -.4),
                    (.064, -.151, 1.546, .105, .101, .6),
                    (.153, -.079, 1.501, .073, .114, .42),
                    (-.063, .029, 1.579, .118, .077, -.32)]):
                self.ellipsoid(f"Hair_TousledLock_{i:02}", (x, y, z), (rx, .086, rz),
                               "hair_light" if i in (1, 4) else "hair",
                               rotation=(0, tilt, .10), segments=12, rings=6)
            self.stroke("Hair_ForelockRidge", [(-.112, -.211, 1.539),
                        (-.059, -.231, 1.533), (-.018, -.221, 1.496)],
                        .007, "hair_light")
        else:
            self.mesh("Hair_SweptCrest", [(-.213, -.065, 1.499), (-.15, -.199, 1.481),
                      (.146, -.209, 1.46), (.202, -.131, 1.504), (.086, -.099, 1.668),
                      (-.066, -.063, 1.63), (-.104, .107, 1.591), (.13, .082, 1.584)],
                      [(0, 1, 5), (1, 2, 4, 5), (2, 3, 4), (0, 5, 6), (5, 4, 7, 6),
                       (3, 7, 4), (0, 6, 7, 3, 2, 1)], "hair", smooth=False)
            self.panel("Hair_SweptHighlight", [(-.126, -.203, 1.5), (-.086, -.19, 1.552),
                       (.078, -.111, 1.648), (.028, -.159, 1.569)], .003, "hair_light", "head")
            for side, sign in (("L", 1), ("R", -1)):
                self.panel(f"Hair_Temple_{side}", [(sign * .204, -.083, 1.483),
                           (sign * .219, -.026, 1.466), (sign * .214, -.041, 1.302),
                           (sign * .194, -.087, 1.355)], .018, "hair", "head")

    def wardrobe(self):
        if self.name == "Pip":
            self.panel("Apron_Bib", [(-.117, -.121, .963), (.117, -.121, .963),
                       (.13, -.166, .776), (-.13, -.166, .776)], .022, "cloth", smooth=True)
            self.panel("Apron_Skirt", [(-.145, -.169, .79), (.145, -.169, .79),
                       (.191, -.159, .543), (.153, -.174, .502), (-.153, -.174, .502),
                       (-.191, -.159, .543)], .025, "cloth", smooth=True)
            self.panel("Apron_Pocket", [(-.078, -.195, .704), (.078, -.195, .704),
                       (.073, -.204, .606), (.056, -.209, .589), (-.057, -.209, .589),
                       (-.074, -.204, .606)], .015, "shirt_light", smooth=True)
            self.stroke("Apron_PocketStitch", [(-.065, -.216, .69), (-.063, -.22, .609),
                        (-.047, -.223, .6), (.047, -.223, .6), (.063, -.22, .609),
                        (.065, -.216, .69)], .0035, "cloth")
            self.stroke("Apron_Hem", [(-.174, -.177, .545), (-.146, -.192, .52),
                        (.146, -.192, .52), (.174, -.177, .545)], .005, "cloth_edge")
            for s, side in ((1, "L"), (-1, "R")):
                self.stroke(f"Apron_Strap_{side}", [(s * .095, -.135, .915),
                            (s * .109, -.119, .974), (s * .116, -.061, 1.008),
                            (s * .117, .067, 1.001), (s * .098, .122, .918)],
                            .019, "cloth_edge", "spine", 6)
                self.ellipsoid(f"Apron_Button_{side}", (s * .096, -.146, .929),
                               (.013, .006, .014), "leather", "spine", segments=8, rings=4)
            self.stroke("Satchel_CrossbodyStrap", [(-.145, -.096, .979), (-.064, -.165, .892),
                        (.055, -.173, .795), (.175, -.144, .714), (.214, -.097, .663)],
                        .016, "leather", "spine")
            self.ellipsoid("Satchel_SeedBag", (.234, -.03, .633), (.09, .088, .119),
                           "leather", "pelvis")
            self.ellipsoid("Satchel_Flap", (.241, -.111, .677), (.083, .019, .063),
                           "cloth_edge", "pelvis", rings=6)
            self.ellipsoid("Satchel_Clasp", (.242, -.132, .65), (.014, .008, .02),
                           "seed", "pelvis", segments=8, rings=4)
            self.panel("Apron_SeedPacket", [(-.031, -.203, .718), (.018, -.203, .735),
                       (.035, -.203, .689), (-.014, -.203, .674)], .009, "seed")
            self.stroke("Apron_SprigStem", [(.036, -.219, .72), (.043, -.225, .778)],
                        .003, "shirt")
            self.ellipsoid("Apron_SprigLeaf", (.058, -.227, .758), (.021, .005, .012),
                           "shirt", "spine", segments=8, rings=5, rotation=(0, -.5, 0))
        else:
            self.panel("Cape_AsymmetricBack", [(-.183, .074, 1.003), (.183, .074, 1.003),
                       (.264, .17, .929), (.3, .229, .639), (.141, .254, .57),
                       (-.186, .225, .685), (-.25, .149, .865)], .025, "cloth")
            self.panel("Cape_ShoulderDrape", [(-.121, -.085, 1.016), (.124, -.085, 1.016),
                       (.285, -.07, .918), (.224, -.15, .847), (.04, -.153, .91),
                       (-.153, -.116, .964)], .034, "cloth", smooth=True)
            self.stroke("Cape_EmbroideredEdge", [(-.168, .211, .702), (.141, .244, .59),
                        (.28, .218, .654), (.25, .16, .89)], .008, "cloth_edge", "spine")
            self.stroke("Cape_FrontTrim", [(-.153, -.131, .965), (.04, -.174, .925),
                        (.225, -.169, .865), (.278, -.093, .921)],
                        .007, "cloth_edge", "spine")
            self.stroke("Pendant_Cord", [(-.07, -.101, 1.014), (-.046, -.157, .922),
                        (0, -.171, .861), (.045, -.155, .924), (.069, -.102, 1.014)],
                        .007, "sole", "spine")
            self.panel("Pendant_Ember", [(0, -.19, .89), (.026, -.19, .857),
                       (0, -.194, .823), (-.026, -.19, .857)], .016, "ember")
            self.panel("Pendant_Inset", [(0, -.199, .879), (.013, -.199, .857),
                       (0, -.201, .839), (-.009, -.199, .857)], .002, "cloth_edge")
            self.profile("Belt", [(.64, .213, .154, 0), (.678, .211, .154, 0)], "leather")
            self.panel("Belt_Buckle", [(-.021, -.168, .68), (.025, -.168, .68),
                       (.025, -.17, .642), (-.021, -.17, .642)], .007, "cloth_edge")
            self.ellipsoid("Belt_Pouch", (-.213, .028, .671), (.058, .083, .077),
                           "leather", "pelvis")
            for i in range(3):
                self.stroke(f"Tunic_Seam_{i}", [(-.15 + i * .012, -.117, .749),
                            (-.146 + i * .011, -.111, .783)], .004, "shirt_light", "spine")

    def _rotate(self, name, x=0, y=0, z=0):
        bone = self.rig.pose.bones[name]
        rest = bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion = rest.inverted() @ Euler((x, y, z)).to_quaternion() @ rest

    def animate(self):
        rig = self.rig
        rig.animation_data_create()
        actions = {}
        for clip, period in (("Idle", 72), ("Walk", 24), ("Greeting", 72)):
            action = bpy.data.actions.new(f"{self.name}_{clip}")
            action.use_fake_user = True
            action.use_frame_range = True
            action.frame_start, action.frame_end = 1, period + 1
            action.use_cyclic = True
            action["period_frames"] = period
            action["fps"] = 24
            action["owner_character"] = self.name
            slot = action.slots.new(id_type="OBJECT", name=rig.name)
            rig.animation_data.action = action
            rig.animation_data.action_slot = slot
            for f in range(1, period + 2):
                phase = (f - 1) / period * math.tau
                for bone in rig.pose.bones:
                    bone.location = (0, 0, 0)
                    bone.scale = (1, 1, 1)
                    bone.rotation_quaternion = (1, 0, 0, 0)
                if clip == "Idle":
                    breath = math.sin(phase)
                    rig.pose.bones["spine"].scale.y = 1 + .009 * breath
                    self._rotate("head", x=.025 * breath, y=.027 * math.sin(phase),
                                 z=.033 * math.sin(phase))
                    for side, sign in (("L", 1), ("R", -1)):
                        self._rotate(f"upper_arm.{side}", x=.025 * breath, y=sign * .02 * breath)
                        self._rotate(f"lower_arm.{side}", x=-.035 - .016 * breath)
                elif clip == "Walk":
                    self._rotate("spine", z=.035 * math.sin(phase))
                    self._rotate("head", x=.022 * math.cos(2 * phase), z=-.025 * math.sin(phase))
                    ankle_lifts = []
                    for side, offset in (("L", 0), ("R", math.pi)):
                        wave = math.sin(phase + offset)
                        hip, knee = .40 * wave, .56 * max(0, wave)
                        ankle_lifts.append(.5 - .26 * math.cos(hip) - .24 * math.cos(hip + knee))
                        self._rotate(f"upper_leg.{side}", x=hip)
                        self._rotate(f"lower_leg.{side}", x=knee)
                        self._rotate(f"foot.{side}", x=-hip - knee)
                        self._rotate(f"upper_arm.{side}", x=-.30 * wave)
                        self._rotate(f"lower_arm.{side}", x=-.12 - .10 * max(0, wave))
                    rig.pose.bones["pelvis"].location.y = -min(ankle_lifts)
                else:
                    # Cosine envelope gives a calm raise, two wrist waves, and return.
                    envelope = (1 - math.cos(phase)) / 2
                    self._rotate("upper_arm.L", x=-.18 * envelope, y=-1.83 * envelope)
                    self._rotate("lower_arm.L", x=-.12 * envelope, y=-.30 * envelope)
                    self._rotate("hand.L", z=.30 * math.sin(3 * phase) * envelope)
                    self._rotate("head", x=.035 * envelope, y=-.07 * envelope, z=.10 * envelope)
                    self._rotate("spine", y=-.035 * envelope)
                    self._rotate("lower_arm.R", x=-.035 * envelope)
                for bone in rig.pose.bones:
                    for channel in ("location", "rotation_quaternion", "scale"):
                        bone.keyframe_insert(data_path=channel, frame=f, group=bone.name)
            for layer in action.layers:
                for strip in layer.strips:
                    bag = strip.channelbag(slot)
                    if bag:
                        for curve in bag.fcurves:
                            for key in curve.keyframe_points:
                                key.interpolation = "LINEAR"
                            curve.modifiers.new("CYCLES")
            actions[clip] = action
        rig.animation_data.action = actions["Idle"]
        rig.animation_data.action_slot = actions["Idle"].slots[0]
        for clip in ("Walk", "Greeting"):
            track = rig.animation_data.nla_tracks.new()
            track.name = self.name + "_Stash_" + clip
            track.mute = True
            strip = track.strips.new(actions[clip].name, 1, actions[clip])
            strip.action_slot = actions[clip].slots[0]
            strip.extrapolation = "NOTHING"
        rig["clip_names"] = ",".join(action.name for action in actions.values())
        return actions


def build_character(name, collection, location=(0, 0, 0), rotation=0):
    """Build Pip or Sol in collection and return root, rig, meshes, actions, height.

    Requires a linked, visible collection in the current view layer and Object
    mode. Refuses a repeated name instead of creating ambiguous .001 assets.
    Does not set scene FPS, frames, camera, renderer, world, or save any files.
    The caller owns those settings. Selection/active object are restored.
    """
    if name not in ("Pip", "Sol"):
        raise ValueError("Only original approval characters 'Pip' and 'Sol' are available")
    if bpy.context.mode != "OBJECT":
        raise RuntimeError("build_character requires Object mode")
    if not isinstance(collection, bpy.types.Collection):
        raise TypeError("collection must be a bpy.types.Collection")
    if any(obj.name.startswith(name + "_") for obj in bpy.data.objects):
        raise ValueError(f"Character prefix {name!r} is already in use")
    if any(action.name.startswith(name + "_") for action in bpy.data.actions):
        raise ValueError(f"Character action prefix {name!r} is already in use")
    if len(location) != 3 or not all(math.isfinite(float(v)) for v in location):
        raise ValueError("location must contain three finite numbers")
    if not math.isfinite(rotation):
        raise ValueError("rotation must be finite radians")
    selected = list(bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    try:
        builder = _Character(name, collection)
        builder.body()
        builder.face()
        builder.hair()
        builder.wardrobe()
        actions = builder.animate()
        builder.root.location = location
        builder.root.rotation_euler.z = rotation
        height = max(v.co.z for obj in builder.meshes for v in obj.data.vertices)
        builder.root["standing_height"] = height
        builder.root["head_to_body_ratio"] = 2.7
        bpy.context.view_layer.update()
        return {"root": builder.root, "rig": builder.rig, "meshes": builder.meshes,
                "actions": [action.name for action in actions.values()], "height": height}
    finally:
        for obj in bpy.context.selected_objects:
            obj.select_set(False)
        for obj in selected:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = active
