#!/usr/bin/env python3
"""Extract the live-map background from your copy of the Carcass Front book.

The map art belongs to the book and is not committed. This takes the map spread
from page 2 of `Carcass Front.pdf` and crops it to the framing the Player's Guide
design uses (1199x802), exported at 2x, so the Carcass Front zone preset
(src/lib/rules/zones.ts) lines up. Upload the result in Admin → Map.

Requires poppler-utils (pdfimages) and Pillow.

    python3 scripts/extract-map.py "../docs/Trench Crusade/Carcass Front/Carcass Front.pdf" carcass-map.webp
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

# Framing found by matching the design's map against the spread scaled to 1268 px wide.
SCALED_WIDTH, OFFSET_X, OFFSET_Y = 1268, 50, 13
DESIGN_W, DESIGN_H = 1199, 802


def main(pdf: str, out: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdfimages", "-f", "2", "-l", "2", "-png", pdf, f"{tmp}/sp"], check=True)
        src = Image.open(f"{tmp}/sp-000.png").convert("RGB")
    f = src.width / SCALED_WIDTH
    box = (OFFSET_X * f, OFFSET_Y * f, (OFFSET_X + DESIGN_W) * f, (OFFSET_Y + DESIGN_H) * f)
    crop = src.crop(tuple(round(v) for v in box)).resize((DESIGN_W * 2, DESIGN_H * 2), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out, quality=86)
    print(f"wrote {out} ({crop.width}x{crop.height}); upload it in Admin → Map")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], Path(sys.argv[2]))
