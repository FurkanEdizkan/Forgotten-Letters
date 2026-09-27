"""Pack the frames from render_fx.py into PixiJS spritesheets (WebP + JSON atlas).

    python3 app/scripts/fx/pack_fx.py <frames-dir> app/static/fx

Light effects (rendered on black) get their brightness as alpha, so the map draws them
with normal blending.
"""
import json, os, sys
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]

def light_to_alpha(im):
    """Turn light rendered on black into straight-alpha RGBA: alpha is the brightness and the
    colour is un-premultiplied, so it composites like additive light with normal blending
    (and avoids per-device additive-blend quirks)."""
    import numpy as np
    arr = np.asarray(im.convert('RGB')).astype(np.float32)
    alpha = arr.max(axis=2, keepdims=True)
    colour = np.where(alpha >= 6, arr * 255.0 / np.maximum(alpha, 1), 0)
    alpha = np.where(alpha >= 6, alpha, 0)
    out = np.concatenate([colour, alpha], axis=2).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def clean_additive(im, black=14, margin=(0.14, 0.14)):
    """Additive sprites must be pure black where empty: lift the black point to drop the
    bloom haze and fade the outer margin so no frame edge shows on the map."""
    from PIL import ImageChops, ImageDraw, ImageFilter
    rgb = im.convert('RGB').point(lambda v: 0 if v <= black else round((v - black) * 255 / (255 - black)))
    w, h = rgb.size
    mask = Image.new('L', (w, h), 0)
    mx, my = int(w * margin[0]), int(h * margin[1])
    ImageDraw.Draw(mask).rectangle([mx, my, w - mx, h - my], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(max(2, min(mx, my) * 0.8)))
    return ImageChops.multiply(rgb, Image.merge('RGB', (mask, mask, mask))).convert('RGBA')
SPECS = {
    # name: (target frame width, columns, blend hint)
    'lightning': (192, 6, 'add'),
    'fire': (192, 8, 'add'),
    'crow': (128, 8, 'normal'),
    'smoke': (192, 8, 'normal'),
    'biplane': (128, 8, 'normal'),
    'zeppelin': (384, 4, 'normal'),
    # One frame per faction, in render_fx.OUTPOST_FACTIONS order (last is neutral).
    'outposts': (128, 4, 'normal'),
}
# Aircraft also get a soft ground shadow (an extra frame, animation "shadow").
SHADOWS = {'biplane', 'zeppelin'}


def shadow_of(im):
    """A blurred dark silhouette to draw on the ground under a flying sprite."""
    from PIL import ImageFilter
    a = im.getchannel('A').filter(ImageFilter.GaussianBlur(max(2, im.width // 40)))
    a = a.point(lambda v: int(v * 0.55))
    return Image.merge('RGBA', (Image.new('L', im.size, 20), Image.new('L', im.size, 16), Image.new('L', im.size, 12), a))
os.makedirs(OUT, exist_ok=True)
for name, (fw, cols, blend) in SPECS.items():
    files = sorted(f for f in os.listdir(os.path.join(SRC, name)) if f.endswith('.png'))
    frames = [Image.open(os.path.join(SRC, name, f)).convert('RGBA') for f in files]
    w0, h0 = frames[0].size
    fh = round(h0 * fw / w0)
    frames = [im.resize((fw, fh), Image.LANCZOS) for im in frames]
    if blend == 'add':
        margin = (0.14, 0.03) if name == 'lightning' else (0.14, 0.14)
        frames = [clean_additive(im, margin=margin) for im in frames]
    anim_count = len(frames)
    if name in SHADOWS:
        frames = frames + [shadow_of(frames[0])]
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0 if blend == 'normal' else 255))
    atlas = {'frames': {}, 'animations': {name: []}, 'meta': {
        'image': f'{name}.webp', 'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height},
        'scale': '1', 'blend': 'normal', 'light': blend == 'add', 'app': 'blender-fx'}}
    for i, im in enumerate(frames):
        x, y = (i % cols) * fw, (i // cols) * fh
        sheet.paste(im, (x, y))
        key = f'{name}_{i:02d}'
        atlas['frames'][key] = {'frame': {'x': x, 'y': y, 'w': fw, 'h': fh}, 'rotated': False, 'trimmed': False,
                                'spriteSourceSize': {'x': 0, 'y': 0, 'w': fw, 'h': fh}, 'sourceSize': {'w': fw, 'h': fh}}
        if i < anim_count:
            atlas['animations'][name].append(key)
        else:
            atlas['animations']['shadow'] = [key]
    if blend == 'add':
        sheet = light_to_alpha(sheet)  # rendered on black -> real alpha, drawn with normal blending
    sheet.save(os.path.join(OUT, f'{name}.webp'), quality=88, method=6)
    json.dump(atlas, open(os.path.join(OUT, f'{name}.json'), 'w'), indent=1)
    print(f'{name}: {len(frames)} frames {fw}x{fh}, sheet {sheet.width}x{sheet.height}, '
          f'{os.path.getsize(os.path.join(OUT, name + ".webp")) // 1024} KB')
