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
    """Render the effect's frames. With FX_BLEND_DIR set, also save the scene there as <effect>.blend
    (FX_BLEND_ONLY=1 saves without rendering)."""
    blend_dir = os.environ.get("FX_BLEND_DIR")
    if blend_dir:
        os.makedirs(blend_dir, exist_ok=True)
        name = os.path.basename(bpy.context.scene.render.filepath.rstrip("/"))
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, f"{name}.blend"), copy=True, compress=True)
        if os.environ.get("FX_BLEND_ONLY"):
            return
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



# ---------------------------------------------------------------- aircraft (top-down, face +X)

def _top_down(name, w, h, frames, ortho_scale):
    s = setup(name, w, h, frames, light=False, ortho_scale=ortho_scale)
    # Spinning props turn 90-110 degrees per frame: motion blur would smear them away.
    s.render.use_motion_blur = False
    cam = s.camera
    cam.location = (0, 0, 20)
    cam.rotation_euler = (0, 0, 0)
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs["Strength"].default_value = 0.55
    bg.inputs["Color"].default_value = (0.8, 0.78, 0.72, 1)
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 3.2
    sun = bpy.data.objects.new("Sun", sun_d)
    s.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(35), math.radians(-30), math.radians(20))
    return s


def _fabric(name, colour, rib_scale=0.0, rib_dark=0.7, rough=0.8):
    """Doped-fabric look: base colour with darker rib bands along one axis."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    if rib_scale:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "X"
        wave.inputs["Scale"].default_value = rib_scale
        wave.inputs["Distortion"].default_value = 0.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = tuple(c * rib_dark for c in colour) + (1,)
        ramp.color_ramp.elements[1].color = (*colour, 1)
        nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*colour, 1)
    return m


def _box(name, size, loc, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    # Bake only the scale: keep the origin at `loc` so the part can be animated in place.
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    ob.data.materials.append(mat)
    return ob


def _disc(name, radius, loc, mat, depth=0.02):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def biplane():
    """WW1 biplane of Rudolf's Folly, seen from above, flying toward +X; 8-frame prop spin."""
    reset()
    frames = 8
    s = _top_down("biplane", 256, 256, frames, ortho_scale=3.8)
    wing = _fabric("Wing", (0.24, 0.24, 0.13), rib_scale=9.0, rib_dark=0.62)
    hull = _fabric("Hull", (0.2, 0.19, 0.11))
    metal = _fabric("Metal", (0.12, 0.11, 0.1), rough=0.4)
    red = _fabric("Red", (0.55, 0.06, 0.04))
    cream = _fabric("Cream", (0.85, 0.8, 0.66))
    blade = _fabric("Blade", (0.25, 0.15, 0.08), rough=0.5)

    # Fuselage tapering to the tail, round engine cowl at the nose.
    _box("Fuselage", (1.9, 0.36, 0.3), (-0.15, 0, 0), hull, bevel=0.1)
    _box("TailBoom", (0.6, 0.2, 0.18), (-1.3, 0, 0.02), hull, bevel=0.06)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.17, depth=0.22, location=(0.88, 0, 0),
                                        rotation=(0, math.radians(90), 0))
    cowl = bpy.context.active_object
    cowl.data.materials.append(metal)
    _box("Cockpit", (0.2, 0.18, 0.05), (0.05, 0, 0.14), metal, bevel=0.04)
    # Upper wing (full span, over the fuselage) and the lower wing peeking out behind it.
    _box("UpperWing", (0.42, 2.9, 0.035), (0.3, 0, 0.35), wing, bevel=0.02)
    _box("LowerWing", (0.38, 2.6, 0.03), (-0.02, 0, -0.18), wing, bevel=0.02)
    _box("Stabiliser", (0.34, 1.2, 0.025), (-1.52, 0, 0.05), wing, bevel=0.015)
    _box("Fin", (0.28, 0.03, 0.3), (-1.55, 0, 0.18), red, bevel=0.01)
    # Roundels on the upper wing tips: red over cream.
    for y in (-1.15, 1.15):
        _disc(f"RoundelOuter{y}", 0.17, (0.3, y, 0.375), cream)
        _disc(f"RoundelInner{y}", 0.1, (0.3, y, 0.39), red)

    # Two-blade propeller spinning about the nose axis. Each blade is keyframed directly
    # (orbiting the hub) rather than parented to a spinning empty, which rendered empty headless.
    hub = (1.04, 0.0, 0.0)
    blades = [(_box(f"Blade{k}", (0.05, 0.11, 0.5), hub, blade, bevel=0.015), k) for k in (1, -1)]
    for f in range(1, frames + 1):
        a = math.radians((f - 1) * (360 / frames) * 2.5)
        for b, k in blades:
            b.rotation_euler = (a, 0, 0)
            b.location = (hub[0], -math.sin(a) * 0.26 * k, math.cos(a) * 0.26 * k)
            b.keyframe_insert("rotation_euler", frame=f)
            b.keyframe_insert("location", frame=f)
    render()


def zeppelin():
    """War zeppelin seen from above, flying toward +X; 4-frame engine-prop cycle."""
    reset()
    frames = 4
    s = _top_down("zeppelin", 512, 192, frames, ortho_scale=9.4)
    hull_m = _fabric("Envelope", (0.55, 0.53, 0.47), rib_scale=14.0, rib_dark=0.8, rough=0.6)
    dark = _fabric("Dark", (0.16, 0.15, 0.13))
    red = _fabric("Red", (0.5, 0.06, 0.05))
    blade = _fabric("Blade", (0.2, 0.12, 0.07), rough=0.5)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1)
    hull = bpy.context.active_object
    hull.name = "Hull"
    bpy.ops.object.shade_smooth()
    hull.scale = (3.8, 0.85, 0.85)
    hull.location.x = 0.35
    hull.data.materials.append(hull_m)
    # Cruciform tail fins and a painted band near the nose.
    _box("FinTop", (0.9, 0.04, 0.9), (-2.85, 0, 0.75), hull_m, bevel=0.03)
    _box("FinSideL", (0.9, 0.75, 0.04), (-2.85, 0.75, 0), hull_m, bevel=0.03)
    _box("FinSideR", (0.9, 0.75, 0.04), (-2.85, -0.75, 0), hull_m, bevel=0.03)
    _box("Rudder", (0.3, 0.06, 0.8), (-3.27, 0, 0.72), red, bevel=0.02)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.86, minor_radius=0.04, location=(2.95, 0, 0),
                                     rotation=(0, math.radians(90), 0))
    band = bpy.context.active_object
    band.scale = (1, 1, 1)
    band.data.materials.append(red)
    # Engine pods on outriggers with spinning props.
    pivots = []
    for side in (-1, 1):
        _box(f"Strut{side}", (0.12, 0.7, 0.05), (-0.6, side * 1.05, -0.2), dark)
        _box(f"Pod{side}", (0.55, 0.22, 0.22), (-0.6, side * 1.35, -0.2), dark, bevel=0.06)
        pv = bpy.data.objects.new(f"Prop{side}", None)
        s.collection.objects.link(pv)
        pv.location = (-0.92, side * 1.35, -0.2)
        for k in (1, -1):
            b = _box(f"ZBlade{side}{k}", (0.05, 0.1, 0.38), (0, 0, 0), blade)
            b.parent = pv
            b.location = (0, 0, 0.19 * k)
        pivots.append(pv)
    for f in range(1, frames + 1):
        for pv in pivots:
            pv.rotation_euler = (math.radians((f - 1) * 45), 0, 0)
            pv.keyframe_insert("rotation_euler", frame=f)
    render()


# ---------------------------------------------------------------- outpost tokens (3/4 view, one frame per faction)

# Pennant colours per faction (same order as OUTPOST_ORDER in the app); the last is neutral.
OUTPOST_FACTIONS = [
    ("new-antioch", (0.12, 0.22, 0.55), (0.9, 0.85, 0.7)),
    ("trench-pilgrims", (0.85, 0.8, 0.66), (0.55, 0.05, 0.04)),
    ("iron-sultanate", (0.1, 0.35, 0.2), (0.85, 0.65, 0.2)),
    ("heretic-legions", (0.08, 0.06, 0.06), (0.6, 0.05, 0.04)),
    ("black-grail", (0.3, 0.38, 0.1), (0.3, 0.08, 0.3)),
    ("seven-headed-serpent", (0.5, 0.03, 0.06), (0.85, 0.65, 0.2)),
    ("neutral", (0.45, 0.42, 0.36), (0.25, 0.23, 0.2)),
]


def outposts():
    """A sandbagged redoubt with a dugout, wire stakes and a faction pennant; frame n = faction n."""
    reset()
    frames = len(OUTPOST_FACTIONS)
    s = setup("outposts", 256, 256, frames, light=False, ortho_scale=3.5)
    s.render.use_motion_blur = False
    cam = s.camera
    tilt = math.radians(46)
    lift = 0.3  # nudge the frame up so the pennant fits
    cam.location = (0, -6.5 + lift * math.cos(tilt), 6.2 + lift * math.sin(tilt))
    cam.rotation_euler = (tilt, 0, 0)
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs["Strength"].default_value = 0.5
    bg.inputs["Color"].default_value = (0.8, 0.76, 0.68, 1)
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 3.4
    sun_d.angle = math.radians(8)
    sun = bpy.data.objects.new("Sun", sun_d)
    s.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(40), math.radians(-25), math.radians(35))

    sand = _fabric("Sandbag", (0.46, 0.38, 0.25), rough=0.95)
    earth = _fabric("Earth", (0.2, 0.16, 0.11), rough=1.0)
    wood = _fabric("Timber", (0.22, 0.14, 0.08), rough=0.85)
    iron = _fabric("Iron", (0.12, 0.12, 0.12), rough=0.5)
    flag_a = _fabric("FlagField", (1, 1, 1), rough=0.7)
    flag_b = _fabric("FlagStripe", (1, 1, 1), rough=0.7)

    # Earthen mound
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=16, radius=1)
    mound = bpy.context.active_object
    mound.name = "Mound"
    mound.scale = (1.35, 1.35, 0.28)
    mound.location = (0, 0, -0.12)
    bpy.ops.object.shade_smooth()
    mound.data.materials.append(earth)

    # Ring of sandbags in two courses, with a gap for the entrance at the front.
    for course, (radius, z) in enumerate(((1.05, 0.14), (1.0, 0.3))):
        n = 20
        for i in range(n):
            a = i / n * math.tau + (course * math.pi / n)
            if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < 0.35:
                continue  # entrance faces the camera
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1,
                                                 location=(math.cos(a) * radius, math.sin(a) * radius, z))
            bag = bpy.context.active_object
            bag.scale = (0.2, 0.12, 0.09)
            bag.rotation_euler = (0, 0, a + math.pi / 2)
            bpy.ops.object.shade_smooth()
            bag.data.materials.append(sand)

    # Timber-roofed dugout at the back, sunk into the mound.
    _box("Dugout", (0.9, 0.55, 0.32), (0, 0.35, 0.22), wood, bevel=0.03)
    _box("Roof", (1.05, 0.7, 0.07), (0, 0.35, 0.42), wood, bevel=0.02)
    _box("Door", (0.26, 0.04, 0.22), (0, 0.06, 0.2), iron)

    # Wire stakes outside the ring
    for i in range(7):
        a = i / 7 * math.tau + 0.3
        _box(f"Stake{i}", (0.04, 0.04, 0.32), (math.cos(a) * 1.3, math.sin(a) * 1.3, 0.1), wood)

    # Pennant: pole plus a two-colour swallowtail flag (colours keyed per frame).
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.03, depth=1.5, location=(0.55, 0.45, 0.9))
    bpy.context.active_object.data.materials.append(wood)
    field = flat_flag("FlagFieldMesh", [(0, 0), (0.62, 0.02), (0.5, -0.17), (0.62, -0.36), (0, -0.34)], flag_a)
    stripe = flat_flag("FlagStripeMesh", [(0, -0.12), (0.56, -0.13), (0.56, -0.21), (0, -0.22)], flag_b)
    for ob in (field, stripe):
        ob.location = (0.58, 0.45, 1.62)
        ob.rotation_euler = (math.radians(90), 0, math.radians(-12))
    stripe.location.y -= 0.005

    for f, (_, a, b) in enumerate(OUTPOST_FACTIONS, start=1):
        for mat, col in ((flag_a, a), (flag_b, b)):
            inp = mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"]
            inp.default_value = (*col, 1)
            inp.keyframe_insert("default_value", frame=f)
    for mat in (flag_a, flag_b):
        for fc in getattr(mat.node_tree.animation_data.action, "fcurves", []):
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT"
    render()


def flat_flag(name, outline, mat, thickness=0.01):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((x, 0, y)) for x, y in outline])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]:
        v.co.y += thickness
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob

# ---------------------------------------------------------------- battlefield: monuments, trophy, corpses

def _cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=16, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def _ball(name, r, loc, mat, scale=(1, 1, 1), segs=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(6, segs // 2), radius=r, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    return ob


def _ring(name, r, thick, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=thick, major_segments=16, minor_segments=6, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def _glow(name, colour, strength=6):
    return emission(name, colour, strength)[0]


def _map_camera(name, w, h, frames, ortho_scale, lift=0.0):
    """The outposts' camera and light, so battlefield sprites sit on the painted map the same way."""
    s = setup(name, w, h, frames, light=False, ortho_scale=ortho_scale)
    s.render.use_motion_blur = False
    cam = s.camera
    tilt = math.radians(46)
    cam.location = (0, -6.5 + lift * math.cos(tilt), 6.2 + lift * math.sin(tilt))
    cam.rotation_euler = (tilt, 0, 0)
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs["Strength"].default_value = 0.5
    bg.inputs["Color"].default_value = (0.8, 0.76, 0.68, 1)
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 3.4
    sun_d.angle = math.radians(8)
    sun = bpy.data.objects.new("Sun", sun_d)
    s.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(40), math.radians(-25), math.radians(35))
    return s


def _one_per_frame(groups):
    """Show group n only on frame n+1 (hide_render keyed with constant interpolation)."""
    for i, obs in enumerate(groups):
        for f in range(1, len(groups) + 1):
            for ob in obs:
                ob.hide_render = (f != i + 1)
                ob.keyframe_insert("hide_render", frame=f)
    for ob in bpy.data.objects:
        ad = ob.animation_data
        if ad and ad.action:
            for fc in getattr(ad.action, "fcurves", []):
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT"


# The factions that raise a monument when they win, in sheet order (the last frame is a draw's cairn).
MONUMENT_FACTIONS = ["new-antioch", "trench-pilgrims", "iron-sultanate", "heretic-legions", "black-grail",
                     "seven-headed-serpent", "procession-of-the-sacred-affliction", "heretic-naval-raiders"]


def monuments():
    """A victory monument per faction (frame n = MONUMENT_FACTIONS[n]) plus a draw's cairn, each on a
    scorched mound. They are stills: the map raises them out of the ground itself."""
    reset()
    s = _map_camera("monuments", 256, 320, len(MONUMENT_FACTIONS) + 1, ortho_scale=3.5, lift=1.0)
    stone = _fabric("Stone", (0.27, 0.25, 0.22), rough=0.95)
    dark_stone = _fabric("DarkStone", (0.16, 0.15, 0.14), rough=0.9)
    earth = _fabric("Scorched", (0.07, 0.055, 0.045), rough=1.0)
    iron = _fabric("Iron", (0.1, 0.1, 0.11), rough=0.45)
    rust = _fabric("Rust", (0.3, 0.13, 0.06), rough=0.8)
    wood = _fabric("Timber", (0.22, 0.14, 0.08), rough=0.85)
    brass = _fabric("Brass", (0.75, 0.55, 0.2), rough=0.3)
    gold = _fabric("Gold", (0.85, 0.65, 0.2), rough=0.25)
    bone = _fabric("Bone", (0.8, 0.75, 0.62), rough=0.7)
    blood = _fabric("Blood", (0.35, 0.02, 0.02), rough=0.6)
    antioch = _fabric("AntiochBlue", (0.12, 0.2, 0.5), rough=0.8)
    cream = _fabric("Cream", (0.85, 0.8, 0.66), rough=0.8)
    grail = _fabric("GrailRot", (0.3, 0.33, 0.12), rough=0.6)
    serpent = _fabric("SerpentRed", (0.45, 0.03, 0.05), rough=0.4)
    sail = _fabric("BlackSail", (0.07, 0.07, 0.08), rough=0.9)
    candle = _glow("Candle", (1.0, 0.7, 0.3), 12)
    green = _glow("Alchemy", (0.3, 1.0, 0.45), 8)
    purple = _glow("Aether", (0.6, 0.25, 1.0), 6)
    ember = _glow("Ember", (1.0, 0.25, 0.05), 5)

    def mound():
        m = _ball("Mound", 1, (0, 0, -0.12), earth, scale=(0.95, 0.8, 0.22), segs=32)
        rnd = random.Random(1)
        rocks = [_ball(f"Rubble{i}", 0.06 + rnd.random() * 0.07,
                       (math.cos(a) * rnd.uniform(0.6, 0.85), math.sin(a) * rnd.uniform(0.5, 0.7), 0.03), dark_stone,
                       scale=(1.4, 1, 0.6), segs=8)
                 for i, a in enumerate(rnd.uniform(0, math.tau) for _ in range(9))]
        return [m, *rocks]

    def plinth():
        return [_box("PlinthLow", (0.9, 0.9, 0.18), (0, 0, 0.09), stone, bevel=0.02),
                _box("PlinthHigh", (0.62, 0.62, 0.2), (0, 0, 0.28), stone, bevel=0.02)]

    groups = []

    # New Antioch: an iron cross with a torn Antiochian banner.
    g = mound() + plinth()
    g += [_box("CrossPost", (0.12, 0.12, 2.1), (0, 0, 1.43), iron, bevel=0.01),
          _box("CrossArm", (1.0, 0.12, 0.12), (0, 0, 1.95), iron, bevel=0.01)]
    ban = flat_flag("AntiochBanner", [(-0.4, 0), (0.4, 0), (0.4, -0.7), (0.2, -0.55), (0.05, -0.82), (-0.15, -0.6), (-0.4, -0.75)], antioch)
    ban.location = (0, -0.08, 1.88)
    stripe = flat_flag("AntiochStripe", [(-0.06, 0), (0.06, 0), (0.06, -0.6), (-0.06, -0.62)], cream)
    stripe.location = (0, -0.1, 1.88)
    g += [ban, stripe]
    groups.append(g)

    # Trench Pilgrims: a gabled reliquary on a pole, ringed with candles.
    g = mound() + plinth()
    g += [_cyl("RelPole", 0.06, 1.3, (0, 0, 1.03), wood),
          _box("Reliquary", (0.55, 0.4, 0.42), (0, 0, 1.88), gold, bevel=0.02),
          _cyl("RelRoof", 0.42, 0.35, (0, 0, 2.26), gold, rot=(0, 0, math.radians(45)), verts=4, r2=0.0),
          _box("RelWindow", (0.2, 0.02, 0.22), (0, -0.21, 1.88), candle),
          _box("RelCrossV", (0.04, 0.04, 0.3), (0, 0, 2.55), gold),
          _box("RelCrossH", (0.18, 0.04, 0.04), (0, 0, 2.6), gold)]
    for i in range(7):
        a = i / 7 * math.tau + 0.25
        p = (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.45)
        g += [_cyl(f"Candle{i}", 0.035, 0.16, p, cream), _ball(f"Flame{i}", 0.035, (p[0], p[1], p[2] + 0.12), candle, scale=(1, 1, 1.8), segs=8)]
    groups.append(g)

    # Iron Sultanate: a brass obelisk crowned by an alchemical orb.
    g = mound() + plinth()
    g += [_cyl("Obelisk", 0.36, 2.0, (0, 0, 1.38), brass, rot=(0, 0, math.radians(45)), verts=4, r2=0.16),
          _ball("Orb", 0.2, (0, 0, 2.6), green),
          _ring("OrbRing", 0.34, 0.025, (0, 0, 2.6), purple, rot=(math.radians(70), 0, math.radians(20))),
          _ring("OrbRing2", 0.3, 0.02, (0, 0, 2.6), gold, rot=(math.radians(-60), math.radians(30), 0))]
    groups.append(g)

    # Heretic Legions: an inverted cross hung with chains, a skull at its foot.
    g = mound() + plinth()
    g += [_box("InvPost", (0.13, 0.13, 2.3), (0, 0, 1.53), wood, bevel=0.01),
          _box("InvArm", (0.95, 0.13, 0.13), (0, 0, 1.0), wood, bevel=0.01),
          _ball("Skull", 0.16, (0.22, -0.3, 0.45), bone, scale=(1, 1.1, 0.9)),
          _box("BloodRag", (0.3, 0.02, 0.5), (-0.3, -0.08, 0.72), blood)]
    for side in (-1, 1):
        for k in range(5):
            g.append(_ring(f"Chain{side}{k}", 0.05, 0.014, (side * 0.4, -0.09, 0.9 - k * 0.09), iron,
                           rot=(0, math.radians(90 * (k % 2)), 0)))
    groups.append(g)

    # Cult of the Black Grail: a rotten pillar crowned by the grail, flies swarming.
    g = mound() + plinth()
    g += [_cyl("GrailPillar", 0.26, 1.6, (0, 0, 1.18), dark_stone, verts=10, r2=0.2),
          _cyl("GrailStem", 0.05, 0.3, (0, 0, 2.13), grail),
          _cyl("GrailCup", 0.12, 0.32, (0, 0, 2.43), grail, r2=0.3),
          _cyl("GrailBrew", 0.27, 0.02, (0, 0, 2.58), green)]
    rnd = random.Random(7)
    for i in range(40):
        a, r, z = rnd.random() * math.tau, 0.3 + rnd.random() * 0.7, 1.6 + rnd.random() * 1.4
        g.append(_ball(f"Fly{i}", 0.025, (math.cos(a) * r, math.sin(a) * r, z), iron, segs=6))
    groups.append(g)

    # Court of the Seven-Headed Serpent: a pillar a serpent coils up, seven heads fanned at its top.
    g = mound() + plinth()
    g.append(_cyl("SerpPillar", 0.2, 1.8, (0, 0, 1.28), dark_stone, verts=12))
    for i in range(28):
        t = i / 27
        a = t * math.tau * 2.2
        g.append(_ball(f"Coil{i}", 0.1 - t * 0.02, (math.cos(a) * 0.26, math.sin(a) * 0.26, 0.45 + t * 1.75), serpent, segs=10))
    for h in range(7):
        a = math.radians(-75 + h * 25)
        for k in range(4):
            r = 0.1 + k * 0.12
            g.append(_ball(f"Neck{h}{k}", 0.07 - k * 0.006, (math.sin(a) * r, -math.cos(a) * r * 0.3, 2.25 + k * 0.1 + (0.12 if k == 3 else 0)), serpent, segs=8))
        g.append(_ball(f"Eye{h}", 0.02, (math.sin(a) * 0.46, -math.cos(a) * 0.14 - 0.05, 2.62), gold, segs=6))
    groups.append(g)

    # Procession of the Sacred Affliction: a gibbet hung with a cage and bells.
    g = mound() + plinth()
    g += [_box("GibPost", (0.14, 0.14, 2.3), (-0.35, 0, 1.53), wood, bevel=0.01),
          _box("GibArm", (0.95, 0.12, 0.12), (0.05, 0, 2.6), wood, bevel=0.01),
          _box("GibBrace", (0.5, 0.08, 0.08), (-0.15, 0, 2.38), wood),
          _cyl("GibRope", 0.012, 0.35, (0.4, 0, 2.38), wood)]
    g[-2].rotation_euler = (0, math.radians(45), 0)
    for k in range(8):
        a = k / 8 * math.tau
        g.append(_cyl(f"CageBar{k}", 0.012, 0.6, (0.4 + math.cos(a) * 0.17, math.sin(a) * 0.17, 1.9), rust, verts=6))
    g += [_cyl("CageTop", 0.2, 0.04, (0.4, 0, 2.2), rust), _cyl("CageBottom", 0.2, 0.04, (0.4, 0, 1.6), rust),
          _ball("CageBones", 0.1, (0.4, 0, 1.7), bone)]
    for k, x in enumerate((-0.05, 0.15)):
        g.append(_cyl(f"Bell{k}", 0.08, 0.14, (x, 0, 2.43), brass, r2=0.03))
    groups.append(g)

    # Heretic Naval Raiders: an anchor driven into the mud before a broken mast with a black sail.
    g = mound()
    g += [_cyl("Mast", 0.07, 2.2, (0.35, 0.3, 1.0), wood, rot=(math.radians(-8), math.radians(10), 0)),
          _box("Yard", (0.9, 0.06, 0.06), (0.42, 0.28, 1.85), wood)]
    sailm = flat_flag("Sail", [(-0.4, 0), (0.45, 0), (0.35, -0.55), (0.1, -0.4), (-0.05, -0.75), (-0.35, -0.5)], sail)
    sailm.location = (0.42, 0.25, 1.82)
    g.append(sailm)
    g += [_cyl("Shank", 0.07, 1.5, (-0.25, -0.1, 0.8), iron, rot=(0, math.radians(-12), 0)),
          _box("Stock", (0.7, 0.08, 0.08), (-0.4, -0.1, 1.5), iron),
          _ring("AnchorRing", 0.1, 0.025, (-0.42, -0.1, 1.66), iron, rot=(math.radians(90), 0, 0))]
    arms = _ring("Arms", 0.42, 0.06, (-0.18, -0.1, 0.25), iron, rot=(math.radians(90), 0, math.radians(-12)))
    g.append(arms)
    g += [_ball("Figurehead", 0.22, (0.55, -0.35, 0.35), wood, scale=(0.9, 0.8, 1.2)), _box("Weed", (0.1, 0.02, 0.4), (-0.15, -0.2, 0.9), grail)]
    groups.append(g)

    # A draw: a cairn of stones with a helmet on a stake.
    g = mound()
    rnd = random.Random(3)
    for i in range(22):
        layer = i // 8
        a = rnd.random() * math.tau
        r = (0.55 - layer * 0.18) * rnd.random()
        g.append(_ball(f"Cairn{i}", 0.2 - layer * 0.03, (math.cos(a) * r, math.sin(a) * r, 0.12 + layer * 0.22), stone, scale=(1.2, 1, 0.8), segs=8))
    g += [_box("Stake", (0.05, 0.05, 1.2), (0.05, 0, 1.0), wood), _ball("Helmet", 0.18, (0.05, 0, 1.62), rust, scale=(1, 1, 0.55)),
          _ball("Embers", 0.08, (-0.25, -0.35, 0.2), ember)]
    groups.append(g)

    _one_per_frame(groups)
    render()


def trophy():
    """The loser's broken standard, hung on the winner's monument. Frame 1: the snapped pole and crossbar;
    frame 2: the torn cloth alone, white so the map can dye it the loser's colours."""
    reset()
    s = _map_camera("trophy", 160, 200, 2, ortho_scale=2.2, lift=0.5)
    wood = _fabric("Timber", (0.22, 0.14, 0.08), rough=0.85)
    iron = _fabric("Iron", (0.12, 0.12, 0.12), rough=0.5)
    cloth = _fabric("Cloth", (0.92, 0.9, 0.86), rough=0.85)
    pole = [_cyl("Pole", 0.035, 1.4, (0, 0, 0.7), wood, rot=(0, math.radians(14), 0)),
            _box("Bar", (0.8, 0.05, 0.05), (0.14, 0, 1.28), wood),
            _cyl("Finial", 0.06, 0.16, (0.18, 0, 1.46), iron, r2=0.0)]
    flag = flat_flag("Standard", [(-0.38, 0), (0.38, 0), (0.36, -0.5), (0.2, -0.38), (0.12, -0.68), (-0.05, -0.45),
                                  (-0.22, -0.72), (-0.38, -0.46)], cloth)
    flag.location = (0.14, -0.06, 1.25)
    _one_per_frame([pole, [flag]])
    render()


def corpses():
    """Six fallen soldiers seen from the map's angle, in drab grey-khaki so the map can tint them."""
    reset()
    s = _map_camera("corpses", 160, 128, 6, ortho_scale=1.5, lift=0.0)
    cloth = _fabric("Uniform", (0.36, 0.34, 0.28), rough=0.95)
    coat = _fabric("Greatcoat", (0.26, 0.25, 0.22), rough=0.95)
    skin = _fabric("Skin", (0.5, 0.42, 0.36), rough=0.8)
    iron = _fabric("Helmet", (0.2, 0.2, 0.19), rough=0.5)
    blood = _fabric("Blood", (0.3, 0.02, 0.02), rough=0.4)
    wood = _fabric("Stock", (0.22, 0.14, 0.08), rough=0.85)
    rnd = random.Random(11)
    groups = []
    for v in range(6):
        g = []
        yaw = rnd.uniform(-1.2, 1.2)
        c, sn = math.cos(yaw), math.sin(yaw)
        at = lambda x, y, z: (x * c - y * sn, x * sn + y * c, z)
        body = coat if v % 2 else cloth
        torso = _ball(f"Torso{v}", 0.2, at(0, 0, 0.08), body, scale=(1.5, 0.9, 0.45))
        torso.rotation_euler = (0, 0, yaw)
        g.append(torso)
        g.append(_ball(f"Head{v}", 0.08, at(0.4, 0.02, 0.07), skin))
        if v != 3:  # one lost his helmet
            g.append(_ball(f"Helm{v}", 0.1, at(0.43 + (0.18 if v == 4 else 0), 0.04 + (0.1 if v == 4 else 0), 0.1), iron, scale=(1, 1, 0.5)))
        for k, (dx, dy, ang) in enumerate(((0.18, 0.2, 0.9 + v * 0.2), (0.15, -0.2, -0.6 - v * 0.15), (-0.35, 0.09, 0.2 * v), (-0.35, -0.1, -0.3))):
            limb = _cyl(f"Limb{v}{k}", 0.045, 0.34, at(dx, dy, 0.05), body if k > 1 else coat, rot=(0, math.radians(90), yaw + ang), verts=8)
            g.append(limb)
        g.append(_ball(f"Pool{v}", 0.18, at(0.1, 0.05 * v, -0.02), blood, scale=(1.3 + v * 0.1, 1, 0.05)))
        if v in (0, 2, 5):
            g.append(_box(f"Rifle{v}", (0.7, 0.03, 0.03), at(0.05, -0.3, 0.03), wood))
        groups.append(g)
    _one_per_frame(groups)
    render()


def flash():
    """A muzzle flash: four frames of a star of fire that flares and dies."""
    reset()
    s = setup("flash", 128, 128, 4, light=True, ortho_scale=1.2)
    mat, em = emission("Flash", (1, 0.8, 0.45), 14)
    parts = [_ball("Core", 0.12, (0, 0, 0), mat)]
    for i in range(5):
        a = i / 5 * math.tau
        spike = _cyl(f"Spike{i}", 0.05, 0.45, (math.cos(a) * 0.2, 0, math.sin(a) * 0.2), mat, rot=(0, -a + math.pi / 2, 0), verts=6, r2=0.0)
        parts.append(spike)
    for f, (sc, st) in enumerate(((0.6, 18), (1.0, 14), (0.75, 7), (0.4, 3)), start=1):
        for p in parts:
            p.scale = (sc, sc, sc)
            p.keyframe_insert("scale", frame=f)
        em.inputs["Strength"].default_value = st
        em.inputs["Strength"].keyframe_insert("default_value", frame=f)
    render()


def _dust_mat(name, colour):
    """Soft dust: a principled surface whose alpha the effect keys frame by frame."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    try:
        m.surface_render_method = "BLENDED"
    except AttributeError:
        m.blend_method = "BLEND"
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = 1.0
    return m, b.inputs["Alpha"]


def _clod_mesh(name, r, rnd):
    """A lumpy clod of earth: an icosphere with its vertices pushed about."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r)
    ob = bpy.context.active_object
    ob.name = name
    for v in ob.data.vertices:
        v.co *= 0.7 + rnd.random() * 0.6
    return ob


def blast():
    """An artillery shell landing in the mud, seen from the map's angle: a plume of earth clods flung up on ballistic arcs that fall back, and the scorched crater left behind. The dust and
    smoke are the map's own smoke sheet, layered over this. Transparent ground, so it sits on the painted map."""
    reset()
    frames = 18
    s = _map_camera("blast", 256, 288, frames, ortho_scale=4.2, lift=1.2)
    rnd = random.Random(21)
    fps = 18.0
    g = 9.0

    earth = _fabric("Clod", (0.16, 0.12, 0.08), rough=1.0)
    wet = _fabric("WetClod", (0.09, 0.07, 0.05), rough=0.8)
    scorch_m, scorch_a = _dust_mat("Scorch", (0.05, 0.04, 0.03))
    crater = _ball("Crater", 1, (0, 0, 0.01), scorch_m, scale=(0.75, 0.62, 0.02), segs=24)

    # The flash itself is drawn by the map (additive light); this sheet is the earth and the crater.
    # The plume: clods thrown up and out, a tight column of fast ones in the middle.
    clods = []
    for i in range(110):
        up = rnd.uniform(4.0, 7.5) if i < 40 else rnd.uniform(2.0, 4.5)
        spread = rnd.uniform(0.1, 0.5) if i < 40 else rnd.uniform(0.8, 2.2)
        a = rnd.uniform(0, math.tau)
        ob = _clod_mesh(f"Clod{i}", rnd.uniform(0.06, 0.16), rnd)
        ob.data.materials.append(wet if i % 3 == 0 else earth)
        clods.append((ob, (math.cos(a) * spread, math.sin(a) * spread * 0.8, up), rnd.uniform(0, 1.5)))

    for f in range(1, frames + 1):
        t = (f - 1) / fps
        k = (f - 1) / (frames - 1)
        # Clods on their arcs, settling where they land
        for ob, (vx, vy, vz), spin in clods:
            z = vz * t - 0.5 * g * t * t
            landed = z < 0 and t > vz / g
            tt = (2 * vz / g) if landed else t
            ob.location = (vx * tt, vy * tt, max(0.02, 0.15 + (0 if landed else z)))
            ob.rotation_euler = (spin * t * 8, spin * t * 5, 0)
            ob.keyframe_insert("location", frame=f)
            ob.keyframe_insert("rotation_euler", frame=f)
        scorch_a.default_value = min(0.9, t * 6)
        scorch_a.keyframe_insert("default_value", frame=f)
    render()


def spurt():
    """A round striking the dirt: a kick of grit and a small dust puff that hangs and thins."""
    reset()
    frames = 8
    s = _map_camera("spurt", 96, 96, frames, ortho_scale=1.2, lift=0.3)
    rnd = random.Random(4)
    earth = _fabric("Grit", (0.2, 0.15, 0.1), rough=1.0)
    grit = []
    for i in range(10):
        ob = _clod_mesh(f"Grit{i}", rnd.uniform(0.015, 0.035), rnd)
        ob.data.materials.append(earth)
        a = rnd.uniform(0, math.tau)
        grit.append((ob, (math.cos(a) * rnd.uniform(0.1, 0.4), math.sin(a) * 0.2, rnd.uniform(1.2, 2.4))))
    m, alpha = _dust_mat("Kick", (0.4, 0.33, 0.25))
    puff = _ball("Kick", 0.12, (0, 0, 0.08), m, segs=14)
    for f in range(1, frames + 1):
        t = (f - 1) / 18.0
        for ob, (vx, vy, vz) in grit:
            ob.location = (vx * t, vy * t, max(0.01, vz * t - 4.5 * t * t))
            ob.keyframe_insert("location", frame=f)
        sc = 0.4 + t * 5
        puff.scale = (sc, sc, sc * 1.2)
        puff.location = (0, 0, 0.08 + t * 0.5)
        alpha.default_value = 0.8 * max(0, 1 - t * 2.1)
        puff.keyframe_insert("scale", frame=f)
        puff.keyframe_insert("location", frame=f)
        alpha.keyframe_insert("default_value", frame=f)
    render()


EFFECTS = {f.__name__: f for f in (lightning, fire, crow, smoke, biplane, zeppelin, outposts,
                                   monuments, trophy, corpses, flash, blast, spurt)}

if __name__ == "__main__":
    # Optional names after the output dir render only those effects.
    args = sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else []
    for name in args or EFFECTS:
        EFFECTS[name]()
    print(f"rendered effect frames into {OUT}")
