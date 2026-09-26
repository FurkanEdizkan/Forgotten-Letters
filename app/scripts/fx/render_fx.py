"""Render the live map's effect sprites in Blender (lightning, hellfire, crow, smoke).

Runs headless and never touches an open Blender session:

    blender --background --factory-startup --python app/scripts/fx/render_fx.py -- <frames-dir>
    python3 app/scripts/fx/pack_fx.py <frames-dir> app/static/fx

Each effect renders a PNG sequence into <frames-dir>/<name>/. Light effects (lightning,
fire) render on black with bloom; crow and smoke render with a transparent background.
"""

import math
import os
import random
import sys

import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.abspath("fx-frames")


# ---------------------------------------------------------------- scene helpers

def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


def setup(name, w, h, frames, light, ortho_scale):
    s = bpy.context.scene
    s.render.engine = "BLENDER_EEVEE"
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.resolution_percentage = 100
    s.frame_start, s.frame_end = 1, frames
    s.render.fps = 24
    s.render.film_transparent = not light
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    s.render.filepath = f"{OUT}/{name}/"
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"

    world = s.world or bpy.data.worlds.new("World")
    s.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0, 0, 0, 1)
    bg.inputs["Strength"].default_value = 0.0

    cam_data = bpy.data.cameras.new("FXCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("FXCam", cam_data)
    s.collection.objects.link(cam)
    cam.location = (0, -10, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    s.camera = cam

    ng = bpy.data.node_groups.get("FX_Comp") or bpy.data.node_groups.new("FX_Comp", "CompositorNodeTree")
    for n in list(ng.nodes):
        ng.nodes.remove(n)
    if not ng.interface.items_tree:
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    out = ng.nodes.new("NodeGroupOutput")
    if light:
        g = ng.nodes.new("CompositorNodeGlare")
        g.inputs["Type"].default_value = "Bloom"
        g.inputs["Threshold"].default_value = 0.6
        g.inputs["Strength"].default_value = 1.0
        g.inputs["Size"].default_value = 0.6
        ng.links.new(rl.outputs["Image"], g.inputs["Image"])
        ng.links.new(g.outputs["Image"], out.inputs[0])
    else:
        ng.links.new(rl.outputs["Image"], out.inputs[0])
    s.compositing_node_group = ng
    s.render.use_compositing = True
    return s


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs["Surface"])
    return m, e


def heat(t):
    """0 = white-hot ... 1 = cooled: white -> yellow -> orange -> red."""
    stops = [(0, (1, 0.95, 0.8)), (0.25, (1, 0.75, 0.25)), (0.55, (1, 0.35, 0.05)), (1, (0.55, 0.05, 0.02))]
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if t <= b:
            k = (t - a) / (b - a)
            return tuple(ca[i] + (cb[i] - ca[i]) * k for i in range(3))
    return stops[-1][1]


def render():
    bpy.ops.render.render(animation=True)


# ---------------------------------------------------------------- lightning

def lightning():
    reset()
    s = setup("lightning", 256, 384, 12, light=True, ortho_scale=8.4)
    rng = random.Random(11)
    mat, em = emission("Bolt", (0.72, 0.84, 1.0), 12.0)

    def bolt(points, depth, name):
        cu = bpy.data.curves.new(name, "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = depth
        cu.bevel_resolution = 2
        sp = cu.splines.new("POLY")
        sp.points.add(len(points) - 1)
        for p, (x, z) in zip(sp.points, points):
            p.co = (x, 0, z, 1)
        ob = bpy.data.objects.new(name, cu)
        ob.data.materials.append(mat)
        s.collection.objects.link(ob)
        return ob

    # Jagged walk from the sky, pulled back to the centre so it strikes bottom-centre.
    pts, x, z = [], rng.uniform(-0.6, 0.6), 4.1
    while z > -3.8:
        pts.append((x, z))
        z -= rng.uniform(0.18, 0.4)
        x += rng.uniform(-0.4, 0.4) - x * 0.25
        x = max(-1.1, min(1.1, x))
    pts.append((0.0, -4.1))
    main = bolt(pts, 0.05, "BoltMain")

    branches = []
    for k in range(5):
        i = rng.randint(3, len(pts) - 7)
        bx, bz = pts[i]
        dirx = -1 if k % 2 else 1
        bp = [(bx, bz)]
        for _ in range(rng.randint(4, 7)):
            bz -= rng.uniform(0.15, 0.32)
            bx += dirx * rng.uniform(0.08, 0.3) + rng.uniform(-0.08, 0.08)
            bx = max(-2.5, min(2.5, bx))
            bp.append((bx, bz))
        branches.append((bolt(bp, 0.022, f"Branch{k}"), i / len(pts)))

    # The leader grows down over frames 1-3; branches appear as it passes them.
    for ob, start in [(main, 0.0)] + branches:
        cu = ob.data
        f0 = 1 + start * 2.5
        cu.bevel_factor_end = 0.0
        cu.keyframe_insert("bevel_factor_end", frame=f0)
        cu.bevel_factor_end = 1.0
        cu.keyframe_insert("bevel_factor_end", frame=f0 + 1.5)

    # Flash, flicker, fade.
    for f, v in {1: 6, 3: 14, 4: 30, 5: 20, 6: 8, 7: 22, 8: 12, 9: 6, 10: 3, 11: 1.2, 12: 0.0}.items():
        em.inputs["Strength"].default_value = v
        em.inputs["Strength"].keyframe_insert("default_value", frame=f)
    render()


# ---------------------------------------------------------------- hellfire burst

def fire():
    reset()
    frames = 16
    s = setup("fire", 256, 256, frames, light=True, ortho_scale=6.0)
    glare = s.compositing_node_group.nodes.get("Glare")
    glare.inputs["Size"].default_value = 0.45
    glare.inputs["Threshold"].default_value = 0.8
    rng = random.Random(5)

    # Embers: emission colour/brightness from each object's colour (RGB) and alpha.
    ember = bpy.data.materials.new("Ember")
    ember.use_nodes = True
    nt = ember.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    em = nt.nodes.new("ShaderNodeEmission")
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 14.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(oi.outputs["Color"], em.inputs["Color"])
    nt.links.new(oi.outputs["Alpha"], mul.inputs[0])
    nt.links.new(mul.outputs[0], em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])

    # Fireball: bright where it faces the camera, fading at the rim, broken up by animated noise.
    fb = bpy.data.materials.new("Fireball")
    fb.use_nodes = True
    nt = fb.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 2.2
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 6.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = 0.35
    ramp.inputs["From Max"].default_value = 0.7
    m1 = nt.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    m2 = nt.nodes.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    m3 = nt.nodes.new("ShaderNodeMath")
    m3.operation = "MULTIPLY"
    m3.inputs[1].default_value = 16.0
    em = nt.nodes.new("ShaderNodeEmission")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    add = nt.nodes.new("ShaderNodeAddShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links.new
    L(lw.outputs["Facing"], inv.inputs[1])
    L(inv.outputs[0], pw.inputs[0])
    L(tc.outputs["Object"], noise.inputs["Vector"])
    L(noise.outputs["Fac"], ramp.inputs["Value"])
    L(pw.outputs[0], m1.inputs[0])
    L(ramp.outputs[0], m1.inputs[1])
    L(m1.outputs[0], m2.inputs[0])
    L(oi.outputs["Alpha"], m2.inputs[1])
    L(m2.outputs[0], m3.inputs[0])
    L(oi.outputs["Color"], em.inputs["Color"])
    L(m3.outputs[0], em.inputs["Strength"])
    L(em.outputs[0], add.inputs[0])
    L(tr.outputs[0], add.inputs[1])
    L(add.outputs[0], out.inputs["Surface"])

    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1)
    tmp = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    sphere = tmp.data
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    tmp = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    ico = tmp.data
    bpy.data.objects.remove(tmp, do_unlink=True)

    origin_z = -1.4
    for n in range(3):
        me = sphere.copy()
        me.materials.append(fb)
        ob = bpy.data.objects.new(f"Core{n}", me)
        s.collection.objects.link(ob)
        off = (rng.uniform(-0.35, 0.35), 0.2 * n, rng.uniform(-0.1, 0.4))
        for f in range(1, frames + 1):
            k = (f - 1) / 10.0
            grow = math.sin(min(1.0, k * 1.8) * math.pi / 2)
            ob.location = (off[0] * grow, off[1], origin_z + off[2] * grow + 1.1 * k)
            ob.scale = ((0.35 + 1.15 * grow) * (1 - 0.2 * n),) * 3
            ob.rotation_euler = (0, 0.6 * k + n, 0)
            ob.color = (*heat(min(1.0, k * 1.1)), max(0.0, 1 - k) ** 1.6)
            for p in ("location", "scale", "rotation_euler", "color"):
                ob.keyframe_insert(p, frame=f)
    noise.inputs["W"].default_value = 0.0
    noise.inputs["W"].keyframe_insert("default_value", frame=1)
    noise.inputs["W"].default_value = 2.5
    noise.inputs["W"].keyframe_insert("default_value", frame=frames)

    for i in range(110):
        ob = bpy.data.objects.new(f"E{i}", ico)
        s.collection.objects.link(ob)
        ob.active_material = ember
        a = math.radians(rng.uniform(15, 165))
        v = rng.uniform(2.5, 8.0)
        vel = (math.cos(a) * v, math.sin(a) * v)
        radius, life, delay = rng.uniform(0.05, 0.13), rng.uniform(0.3, 0.6), rng.uniform(0, 3)
        for f in range(1, frames + 1):
            t = (f - 1 - delay) / 24.0
            if t < 0:
                ob.scale = (0.0001,) * 3
                ob.color = (0, 0, 0, 0)
            else:
                age = min(1.0, t / life)
                ob.location = (vel[0] * t, -1.5, origin_z + vel[1] * t - 3.5 * t * t)
                ob.scale = (radius * (1 - 0.75 * age),) * 3
                ob.color = (*heat(age * 0.9), max(0.0, 1 - age) ** 1.2)
            for p in ("location", "scale", "color"):
                ob.keyframe_insert(p, frame=f)
    render()


# ---------------------------------------------------------------- crow (top-down flap cycle)

def crow():
    reset()
    frames = 8
    s = setup("crow", 192, 192, frames, light=False, ortho_scale=2.9)
    cam = s.camera
    cam.location = (0, 0, 10)
    cam.rotation_euler = (0, 0, 0)
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs["Strength"].default_value = 0.25
    bg.inputs["Color"].default_value = (0.7, 0.72, 0.8, 1)
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 2.2
    sun = bpy.data.objects.new("Sun", sun_d)
    s.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(30), math.radians(-25), 0)

    mat = bpy.data.materials.new("Crow")
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.012, 0.012, 0.018, 1)
    b.inputs["Roughness"].default_value = 0.75
    b.inputs["Specular IOR Level"].default_value = 0.25

    def flat(name, outline, parent=None, thickness=0.018):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        face = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in outline])
        ext = bmesh.ops.extrude_face_region(bm, geom=[face])
        for v in [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]:
            v.co.z -= thickness
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        s.collection.objects.link(ob)
        if parent:
            ob.parent = parent
        return ob

    def sphere(name, loc, scale, r=1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=r, location=loc)
        ob = bpy.context.active_object
        ob.name = name
        ob.scale = scale
        bpy.ops.object.shade_smooth()
        ob.data.materials.append(mat)
        return ob

    # Flies toward +X.
    sphere("Body", (0, 0, 0), (0.4, 0.12, 0.1))
    sphere("Head", (0.4, 0, 0.02), (1, 0.9, 0.85), r=0.1)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.05, depth=0.18, location=(0.55, 0, 0.02),
                                    rotation=(0, math.radians(90), 0))
    bpy.context.active_object.data.materials.append(mat)
    flat("Tail", [(-0.3, 0.06), (-0.62, 0.15), (-0.7, 0.1), (-0.73, 0.03), (-0.73, -0.03), (-0.7, -0.1),
                  (-0.62, -0.15), (-0.3, -0.06)])

    inner_outline = [(0.14, 0.0), (0.2, 0.3), (0.16, 0.58), (-0.22, 0.58), (-0.24, 0.3), (-0.18, 0.0)]
    outer_outline = [(0.16, 0.0), (0.1, 0.3), (0.02, 0.5), (0.0, 0.66), (-0.04, 0.64), (-0.04, 0.52),
                     (-0.08, 0.63), (-0.12, 0.6), (-0.1, 0.48), (-0.15, 0.56), (-0.19, 0.52), (-0.16, 0.4),
                     (-0.21, 0.44), (-0.24, 0.38), (-0.22, 0.2), (-0.22, 0.0)]

    def wing(side):
        k = 1 if side == "R" else -1
        pts_i = [(x, k * y) for x, y in inner_outline]
        pts_o = [(x, k * y) for x, y in outer_outline]
        if k < 0:
            pts_i.reverse()
            pts_o.reverse()
        shoulder = bpy.data.objects.new(f"Shoulder{side}", None)
        s.collection.objects.link(shoulder)
        shoulder.location = (0.02, k * 0.08, 0)
        flat(f"Inner{side}", pts_i, parent=shoulder)
        wrist = bpy.data.objects.new(f"Wrist{side}", None)
        s.collection.objects.link(wrist)
        wrist.parent = shoulder
        wrist.location = (0, k * 0.56, 0)
        flat(f"Outer{side}", pts_o, parent=wrist)
        return shoulder, wrist, k

    wings = [wing("R"), wing("L")]
    for f in range(1, frames + 1):
        ph = (f - 1) / frames * 2 * math.pi
        a_sh = math.radians(40) * math.cos(ph)        # shoulder: up/down
        a_wr = math.radians(25) * math.cos(ph - 0.9)  # the hand lags, tips trail the stroke
        for shoulder, wrist, k in wings:
            shoulder.rotation_euler = (k * a_sh, 0, 0)
            wrist.rotation_euler = (k * a_wr, 0, 0)
            shoulder.keyframe_insert("rotation_euler", frame=f)
            wrist.keyframe_insert("rotation_euler", frame=f)
    render()


# ---------------------------------------------------------------- smoke puff

def smoke():
    reset()
    frames = 16
    s = setup("smoke", 256, 256, frames, light=False, ortho_scale=4.0)
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs["Strength"].default_value = 0.8
    bg.inputs["Color"].default_value = (0.75, 0.72, 0.68, 1)
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 3.0
    sun = bpy.data.objects.new("Sun", sun_d)
    s.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(30), 0)
    if hasattr(s.eevee, "volumetric_tile_size"):
        s.eevee.volumetric_tile_size = "2"
    if hasattr(s.eevee, "volumetric_samples"):
        s.eevee.volumetric_samples = 96
    if hasattr(s.eevee, "volumetric_shadow_samples"):
        s.eevee.volumetric_shadow_samples = 32
    if hasattr(s.eevee, "volumetric_end"):
        s.eevee.volumetric_end = 30

    bpy.ops.mesh.primitive_cube_add(size=2)
    dom = bpy.context.active_object
    dom.name = "SmokeDomain"
    dom.scale = (1.9, 1.9, 1.9)

    m = bpy.data.materials.new("Smoke")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 2.6
    noise.inputs["Detail"].default_value = 8.0
    noise.inputs["Roughness"].default_value = 0.6
    # Domain warp: a second noise displaces the sphere so its outline billows.
    warp = nt.nodes.new("ShaderNodeTexNoise")
    warp.noise_dimensions = "4D"
    warp.inputs["Scale"].default_value = 1.1
    warp.inputs["Detail"].default_value = 3.0
    sub = nt.nodes.new("ShaderNodeVectorMath")
    sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = (0.5, 0.5, 0.5)
    scl = nt.nodes.new("ShaderNodeVectorMath")
    scl.operation = "SCALE"
    scl.inputs["Scale"].default_value = 0.9
    addv = nt.nodes.new("ShaderNodeVectorMath")
    addv.operation = "ADD"
    length = nt.nodes.new("ShaderNodeVectorMath")
    length.operation = "LENGTH"
    radius = nt.nodes.new("ShaderNodeValue")
    div = nt.nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    fall = nt.nodes.new("ShaderNodeMapRange")
    fall.inputs["From Min"].default_value = 1.0
    fall.inputs["From Max"].default_value = 0.2
    shape = nt.nodes.new("ShaderNodeMapRange")
    shape.inputs["From Min"].default_value = 0.46
    shape.inputs["From Max"].default_value = 0.62
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    dens = nt.nodes.new("ShaderNodeMath")
    dens.operation = "MULTIPLY"
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.42, 0.38, 0.33, 1)
    vol.inputs["Anisotropy"].default_value = 0.2
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links.new
    L(tc.outputs["Object"], warp.inputs["Vector"])
    L(warp.outputs["Color"], sub.inputs[0])
    L(sub.outputs[0], scl.inputs[0])
    L(tc.outputs["Object"], addv.inputs[0])
    L(scl.outputs[0], addv.inputs[1])
    L(addv.outputs[0], length.inputs[0])
    L(tc.outputs["Object"], noise.inputs["Vector"])
    L(length.outputs["Value"], div.inputs[0])
    L(radius.outputs[0], div.inputs[1])
    L(div.outputs[0], fall.inputs["Value"])
    L(noise.outputs["Fac"], shape.inputs["Value"])
    L(fall.outputs[0], mul.inputs[0])
    L(shape.outputs[0], mul.inputs[1])
    L(mul.outputs[0], dens.inputs[0])
    L(dens.outputs[0], vol.inputs["Density"])
    L(vol.outputs[0], out.inputs["Volume"])
    dom.data.materials.append(m)

    # Billow: radius grows, noise drifts and evolves, density thins out.
    for f in range(1, frames + 1):
        k = (f - 1) / (frames - 1)
        radius.outputs[0].default_value = 0.35 + 0.6 * math.sin(k * math.pi / 2)
        radius.outputs[0].keyframe_insert("default_value", frame=f)
        dens.inputs[1].default_value = 16.0 * (1 - k) ** 1.5 + 0.0001
        dens.inputs[1].keyframe_insert("default_value", frame=f)
        noise.inputs["W"].default_value = 1.2 * k
        noise.inputs["W"].keyframe_insert("default_value", frame=f)
    for f, w in ((1, 0.0), (frames, 0.9)):
        warp.inputs["W"].default_value = w
        warp.inputs["W"].keyframe_insert("default_value", frame=f)
    for f in (1, frames):
        dom.location.z = -0.2 + 0.5 * (f - 1) / (frames - 1)
        dom.keyframe_insert("location", frame=f)
    render()


if __name__ == "__main__":
    for effect in (lightning, fire, crow, smoke):
        effect()
    print(f"rendered effect frames into {OUT}")
