"""
Pack the rendered seal passes (render_sigils.py) into two horizontal WebP strips per faction:
<faction>.webp (the neutral medallion) and <faction>-light.webp (the light mask as alpha).

  python3 app/scripts/fx/pack_sigils.py <frames-dir> app/src/lib/assets/sigils

The strips are derived from the faction logos, so they are gitignored like the map art;
each group renders them locally from its own copies. The app finds whatever strips exist
at build time and falls back to the warband's uploaded symbol for any faction without one.
"""
import os
import sys

from PIL import Image

FRAME = 160  # px per frame; must match SEAL_FRAME in src/lib/seals.ts

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


def strip(files, convert):
    im = Image.new('RGBA', (FRAME * len(files), FRAME), (0, 0, 0, 0))
    for i, f in enumerate(files):
        im.paste(convert(Image.open(f).resize((FRAME, FRAME), Image.LANCZOS)), (i * FRAME, 0))
    return im


def as_mask(im):
    """Light pass (grey on black) -> white with the brightness as alpha, ready to be filled with colour."""
    lum = im.convert('L')
    return Image.merge('RGBA', (Image.new('L', im.size, 255),) * 3 + (lum,))


for name in sorted(os.listdir(src)):
    d = os.path.join(src, name)
    if not os.path.isdir(os.path.join(d, 'base')):
        continue
    frames = lambda sub: sorted(os.path.join(d, sub, f) for f in os.listdir(os.path.join(d, sub)) if f[:-4].isdigit())
    for suffix, sub, conv in (('', 'base', lambda im: im.convert('RGBA')), ('-light', 'light', as_mask)):
        path = os.path.join(out, f'{name}{suffix}.webp')
        strip(frames(sub), conv).save(path, quality=86, method=6)
        print(f'{name}{suffix}: {os.path.getsize(path) // 1024} KB')
