"""
Render each faction's seal as a struck medallion, in two passes the app composites live:

  base  — the medallion in neutral silver (the app tints it with the warband's metal colour);
  light — the rising band of light alone, as a grey mask (the app fills it with the warband's
          two light colours, foot to crest).

So a player can recolour their seal without re-rendering anything.

The seals are the group's own copies of the faction logos, kept outside git (docs/Factions/).
Each becomes: raised metal relief (displaced from the logo's line art) over a dark enamel
field, a metal rim, a glint light circling the relief, and a band of the faction's light
that climbs the line art bottom to top over a 32-frame loop.

Run inside Blender (headless, or through the Blender MCP bridge):
  blender --background --factory-startup --python app/scripts/fx/render_sigils.py -- <logo-dir> <out-dir> [faction ...]
Each faction's scene is also saved as <out-dir>/<faction>.blend for hand-tuning.
Then pack: python3 app/scripts/fx/pack_sigils.py <out-dir> app/static/sigils
"""
import math
import os
import sys

import bpy

FRAMES = 32
SIZE = 256

# Linear-light colours. metal: raised relief; low/high: the rising light, foot to crest; rim: the ring.
FACTIONS = {
    'new-antioch': dict(logo='New Antioch/New_Antioch_Logo.webp',
                        metal=(0.62, 0.45, 0.15), low=(1.0, 0.55, 0.08), high=(1.0, 0.93, 0.78), rim=(0.62, 0.45, 0.15)),
    'trench-pilgrims': dict(logo='Trench Pilgrims/Trench_Pilgrims_Logo.webp',
                            metal=(0.5, 0.36, 0.2), low=(1.0, 0.42, 0.05), high=(0.8, 0.03, 0.02), rim=(0.38, 0.2, 0.1)),
    'iron-sultanate': dict(logo='Iron Sultanate/Iron_Sultante_Logo.webp',
                           metal=(0.62, 0.42, 0.13), low=(0.42, 0.05, 1.0), high=(0.05, 1.0, 0.3), rim=(0.83, 0.62, 0.22)),
    'heretic-legions': dict(logo='Heretic Legions/Heretic_Legion_Logo.webp',
                            metal=(0.34, 0.32, 0.31), low=(0.95, 0.03, 0.01), high=(1.0, 0.42, 0.04), rim=(0.2, 0.17, 0.16)),
    'black-grail': dict(logo='Black Grail/Black_Grail_Logo.webp',
                        metal=(0.34, 0.35, 0.18), low=(0.12, 0.2, 0.01), high=(0.78, 0.9, 0.08), rim=(0.22, 0.24, 0.1)),
    'seven-headed-serpent': dict(logo='Courth of Seven Headed Serpent/Court_Logo.webp',
                                 metal=(0.72, 0.4, 0.28), low=(0.75, 0.01, 0.08), high=(1.0, 0.6, 0.4), rim=(0.72, 0.4, 0.28)),
}


def height_map(logo, path):
    """The logo's line art, softened, as a relief height map (alpha-cut to the seal)."""
    src = bpy.data.images.load(logo)
    w, h = src.size
    px = list(src.pixels)
    out = bpy.data.images.new('height', w, h, alpha=False)
    vals = [0.0] * (w * h * 4)
    for i in range(w * h):
        v = px[i * 4] * px[i * 4 + 3]
        vals[i * 4:i * 4 + 4] = (v, v, v, 1.0)
    out.pixels = vals
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    return src, out


def build(logo, f, tmpdir):
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    s = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    s.render.resolution_x = s.render.resolution_y = SIZE
    s.render.film_transparent = True
    s.view_settings.view_transform = 'Standard'
    s.frame_start, s.frame_end = 1, FRAMES
    world = bpy.data.worlds.new('W')
    s.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.02, 0.02, 0.02, 1)
    bg.inputs['Strength'].default_value = 0.08

    img, height = height_map(logo, os.path.join(tmpdir, 'height.png'))
    aspect = img.size[1] / img.size[0]

    # Relief: a subdivided plane displaced by the (blurred) line art.
    bpy.ops.mesh.primitive_plane_add(size=2)
    face = bpy.context.active_object
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.subdivide(number_cuts=180)
    bpy.ops.object.mode_set(mode='OBJECT')
    face.scale.y = aspect
    bpy.ops.object.transform_apply(scale=True)
    tex = bpy.data.textures.new('Height', 'IMAGE')
    tex.image = height
    tex.extension = 'CLIP'
    disp = face.modifiers.new('Relief', 'DISPLACE')
    disp.texture = tex
    disp.texture_coords = 'UV'
    disp.strength = 0.03
    disp.mid_level = 0
    # Smoothing the displaced surface softens the hard ink edges into a struck relief.
    soft = face.modifiers.new('Smooth', 'SMOOTH')
    soft.factor = 0.8
    soft.iterations = 4
    bpy.ops.object.shade_smooth()

    m = bpy.data.materials.new('Seal')
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    N.clear()

    def node(t, **kw):
        n = N.new(t)
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    def op(o, a, b=None, v=None):
        n = node('ShaderNodeMath', operation=o)
        L.new(a, n.inputs[0])
        if b is not None:
            L.new(b, n.inputs[1])
        if v is not None:
            n.inputs[1].default_value = v
        return n.outputs[0]

    def remap(value, a, b, c, d):
        n = node('ShaderNodeMapRange')
        n.inputs[1].default_value, n.inputs[2].default_value = a, b
        n.inputs[3].default_value, n.inputs[4].default_value = c, d
        L.new(value, n.inputs[0])
        return n.outputs[0]

    out = node('ShaderNodeOutputMaterial')
    out.name = 'Output'
    bsdf = node('ShaderNodeBsdfPrincipled')
    tx = node('ShaderNodeTexImage', image=img, extension='CLIP')
    sep = node('ShaderNodeSeparateColor')
    L.new(tx.outputs['Color'], sep.inputs['Color'])
    ink = sep.outputs['Red']  # 1 on the line art, 0 on the field
    base = node('ShaderNodeMix', data_type='RGBA')
    base.inputs[6].default_value = (0.012, 0.01, 0.016, 1)
    base.inputs[7].default_value = (0.8, 0.8, 0.8, 1)  # neutral silver; the app tints it
    L.new(ink, base.inputs[0])
    L.new(base.outputs[2], bsdf.inputs['Base Color'])
    L.new(ink, bsdf.inputs['Metallic'])
    L.new(remap(ink, 0, 1, 0.85, 0.26), bsdf.inputs['Roughness'])

    # The rising band: its centre climbs from below the seal to above it over the loop.
    tc = node('ShaderNodeTexCoord')
    xyz = node('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['UV'], xyz.inputs[0])
    band = node('ShaderNodeValue')
    y = xyz.outputs['Y']
    near = remap(op('ABSOLUTE', op('SUBTRACT', y, band.outputs[0])), 0, 0.2, 0.8, 0)
    foot = remap(y, 0, 0.5, 0.5, 0)
    strength = op('MULTIPLY', op('MULTIPLY', op('ADD', near, foot), ink), v=2.6)
    ramp = node('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.15
    ramp.color_ramp.elements[0].color = (*f['low'], 1)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (*f['high'], 1)
    L.new(y, ramp.inputs['Fac'])
    L.new(ramp.outputs['Color'], bsdf.inputs['Emission Color'])
    # Base pass: no light. The light pass swaps in an emission-only shader (see render()).
    bsdf.inputs['Emission Strength'].default_value = 0.0
    lightpass = node('ShaderNodeEmission')
    lightpass.name = 'LightPass'
    lightpass.inputs['Color'].default_value = (1, 1, 1, 1)
    # The mask peaks near 1 so it keeps its gradient instead of clipping to white.
    L.new(op('MULTIPLY', op('MULTIPLY', op('ADD', near, foot), ink), v=0.75), lightpass.inputs['Strength'])
    mix = node('ShaderNodeMixShader')
    clear = node('ShaderNodeBsdfTransparent')
    L.new(tx.outputs['Alpha'], mix.inputs[0])
    L.new(clear.outputs[0], mix.inputs[1])
    L.new(bsdf.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    face.data.materials.append(m)
    bv = band.outputs[0]
    bv.default_value = -0.3
    bv.keyframe_insert('default_value', frame=1)
    bv.default_value = 1.3
    bv.keyframe_insert('default_value', frame=FRAMES + 1)
    action = m.node_tree.animation_data.action
    for fc in getattr(action, 'fcurves', []):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

    # Metal rim.
    bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.04, major_segments=128,
                                     minor_segments=16, location=(0, 0, 0.01))
    rim = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    rm = bpy.data.materials.new('Rim')
    rm.use_nodes = True
    rb = rm.node_tree.nodes['Principled BSDF']
    rb.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    rb.inputs['Metallic'].default_value = 1
    rb.inputs['Roughness'].default_value = 0.22
    rim.data.materials.append(rm)

    # Straight-on camera; a glint light circling once per loop.
    cd = bpy.data.cameras.new('Cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = 2.14
    cam = bpy.data.objects.new('Cam', cd)
    s.collection.objects.link(cam)
    cam.location = (0, 0, 5)
    s.camera = cam
    kd = bpy.data.lights.new('Key', 'AREA')
    kd.energy = 120
    kd.size = 1.0
    key = bpy.data.objects.new('Key', kd)
    s.collection.objects.link(key)
    track = key.constraints.new('TRACK_TO')
    track.target = face
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'
    for fr in range(1, FRAMES + 2):
        a = (fr - 1) / FRAMES * math.tau + 2.2
        key.location = (math.cos(a) * 2.4, math.sin(a) * 2.4, 1.4)
        key.keyframe_insert('location', frame=fr)
    fd = bpy.data.lights.new('Fill', 'SUN')
    fd.energy = 1.5
    fill = bpy.data.objects.new('Fill', fd)
    s.collection.objects.link(fill)
    fill.rotation_euler = (math.radians(20), math.radians(-15), 0)

    # A soft bloom so the light reads at badge size.
    if hasattr(s, 'compositing_node_group'):
        ng = bpy.data.node_groups.new('Bloom', 'CompositorNodeTree')
        s.compositing_node_group = ng
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = ng.nodes.new('CompositorNodeRLayers')
        go = ng.nodes.new('NodeGroupOutput')
        gl = ng.nodes.new('CompositorNodeGlare')
        for name, val in (('Type', 'Fog Glow'), ('Quality', 'High'), ('Threshold', 1.2), ('Strength', 0.6)):
            try:
                gl.inputs[name].default_value = val
            except Exception:
                pass
        ng.links.new(rl.outputs['Image'], gl.inputs[0])
        ng.links.new(gl.outputs[0], go.inputs[0])
    return s


def set_pass(s, light):
    """Base pass: the lit medallion, no emission. Light pass: emission only, as a grey mask on black."""
    m = bpy.data.materials['Seal']
    N, L = m.node_tree.nodes, m.node_tree.links
    mix = next(n for n in N if n.bl_idname == 'ShaderNodeMixShader')
    src = N['LightPass'] if light else next(n for n in N if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    L.new(src.outputs[0], mix.inputs[2])
    for ob in s.objects:
        if ob.type == 'LIGHT':
            ob.hide_render = light
        if ob.name.startswith('Torus'):
            ob.hide_render = light
    s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0 if light else 0.08
    s.render.film_transparent = not light


def render(logo_dir, out_dir, names):
    for name in names:
        f = FACTIONS[name]
        logo = os.path.join(logo_dir, f['logo'])
        if not os.path.exists(logo):
            print(f'skip {name}: no logo at {logo}')
            continue
        frames = os.path.join(out_dir, name)
        os.makedirs(os.path.join(frames, 'base'), exist_ok=True)
        os.makedirs(os.path.join(frames, 'light'), exist_ok=True)
        s = build(logo, f, frames)
        set_pass(s, False)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, f'{name}.blend'), compress=True)
        for light in (False, True):
            set_pass(s, light)
            for fr in range(1, FRAMES + 1):
                s.frame_set(fr)
                s.render.filepath = os.path.join(frames, 'light' if light else 'base', f'{fr:04d}.png')
                bpy.ops.render.render(write_still=True)
        print(f'{name}: {FRAMES} frames x 2 passes')


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(argv) >= 2:
        render(argv[0], argv[1], argv[2:] or list(FACTIONS))
