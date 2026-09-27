#!/usr/bin/env python3
"""Extract Special Zone lore from your copy of the Carcass Front book into a JSON file.

The book's lore belongs to its publisher and is not committed. This reads your PDF and
writes { "zone-id": "lore text", ... } for the admin Lore page's "Import lore" button.
Paragraph breaks are guessed from the PDF layout; tidy the text up in the editor.

Requires poppler-utils (pdftotext).

    python3 scripts/import-lore.py "../docs/Trench Crusade/Carcass Front/Carcass Front Book Single Page.pdf" lore.json
"""
import json
import re
import subprocess
import sys

# Section heading in the book -> zone ids it describes.
SECTIONS = {
    'Domus Demetrius': ['domus-demetrius'],
    'The Altar of Leviathan': ['altar-of-leviathan'],
    'The Steel Necropolis': ['steel-necropolis'],
    'The Ruins of Nineveh Novus': ['ruins-of-nineveh-novus'],
    'The Sword of God': ['sword-of-god'],
    'The Pillar of Jonah': ['pillar-of-jonah'],
    'Baghras Fortress': ['baghras-fortress'],
    'The House of Pillars': ['house-of-pillars'],
    'Kurd Dagh & the Pilgrims of Stone': ['kurd-dagh', 'pilgrimage-of-stone'],
    'The Vivarium': ['vivarium'],
}
FOOTERS = {'The Carcass Front', 'Carcass Front'}


def page_text(pdf: str, page: int) -> str:
    return subprocess.run(['pdftotext', '-f', str(page), '-l', str(page), pdf, '-'],
                          capture_output=True, text=True, check=True).stdout


def page_count(pdf: str) -> int:
    info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True, check=True).stdout
    return int(re.search(r'^Pages:\s+(\d+)', info, re.M).group(1))


def to_paragraphs(lines: list[str]) -> str:
    """Re-flow PDF lines: a short line ending a sentence closes a paragraph."""
    paras, current = [], []
    for raw in lines:
        line = raw.replace('\f', '').strip()
        if not line or line in FOOTERS or re.fullmatch(r'\d{1,3}', line):
            continue
        if current and current[-1].endswith('-') and not current[-1].endswith(' -'):
            current[-1] = current[-1][:-1] + line  # re-join hyphenated words
        else:
            current.append(line)
        if len(line) < 55 and re.search(r'[.!?”"]$', line):
            paras.append(' '.join(current))
            current = []
    if current:
        paras.append(' '.join(current))
    return '\n\n'.join(p for p in paras if len(p) > 3)


def main(pdf: str, out: str) -> None:
    starts = {}
    for page in range(1, min(page_count(pdf), 60) + 1):
        first = next((l.strip() for l in page_text(pdf, page).splitlines() if l.strip()), '')
        if first in SECTIONS and first not in starts:
            starts[first] = page
    ordered = sorted(starts.items(), key=lambda kv: kv[1])
    lore = {}
    for i, (heading, start) in enumerate(ordered):
        end = ordered[i + 1][1] - 1 if i + 1 < len(ordered) else start + 2
        lines = []
        for page in range(start, min(end, start + 2) + 1):
            lines += page_text(pdf, page).splitlines()
        lines = lines[1:] if lines and lines[0].strip() == heading else lines
        text = to_paragraphs(lines)
        for zone in SECTIONS[heading]:
            lore[zone] = text
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(lore, f, ensure_ascii=False, indent=1)
    missing = sorted(set(SECTIONS) - set(starts))
    print(f'wrote lore for {len(lore)} zones to {out}' + (f'; not found: {", ".join(missing)}' if missing else ''))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
