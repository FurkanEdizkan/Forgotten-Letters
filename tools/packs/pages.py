"""Extract the compendium rule text and the scenarios from the rule book PDFs into `page` and `scenario` dicts
(the shapes in app/src/lib/rules/pack.ts). Text is the books' own words; only layout is cleaned (wrapped lines
joined, hyphenation undone, running heads, folios and side tabs dropped). Output goes only to the git-ignored
rules/ folder. Needs poppler's `pdftohtml` (same package as pdftotext): its XML gives the text in content-stream
order (the books' reading order, columns included) plus the font of every run, which finds the headings.

Usage: python3 pages.py --set core-1.0.2 --out rules/core-1.0.2 [--scenarios] [--docs <docs dir>]
"""

import argparse
import functools
import html
import json
import re
import subprocess
import sys
from pathlib import Path

DEFAULT = Path('/mnt/Storage/All/Develop/Trench Crusade - Forgotten Letters/docs')
SPLIT_AT = 15_000  # a chapter longer than this becomes a parent page with child pages
MAX_BODY = 20_000

# book id -> (pdf path under docs/, book page = pdf page - offset, side-tab strip width in pdftohtml px, figure fonts,
# {page: figure font sizes}, table cell x bounds). In the core books the FIGURE fonts only occur in placed page images
# (roster and profile examples) whose clipped text is hidden. The changelog is a Page | Location | Errata table.
FIGURE = 'GaramondPremrPro|Helvetica|Bringshoot'
WB_FIGURE = {13: {15, 31, 39}}  # font sizes used only by the example entry on WB p.13 (part of it hidden)
BOOKS = {
    'RB2': ('Trench Crusade/Base/v1.0.2/Trench-Crusade-Digital-Rulebook.pdf', 0, 200, FIGURE, {}, None),
    'WB2': ('Trench Crusade/Base/v1.0.2/Warbands-of-Trench-Crusade.pdf', 0, 200, FIGURE, WB_FIGURE, None),
    'CL2': ('Trench Crusade/Base/v1.0.2/Changelog-1.0.2.pdf', 0, 0, None, {}, (100, 225, {'Page Location', 'Errata'})),
    'RC2': ('Trench Crusade/Base/v1.0.2/Rules-Commentaries-1.0.2.pdf', 0, 0, None, {}, None),
    'RB1': ('Trench Crusade/Base/v1.0.1/Trench-Crusade-Digital-Rulebook.pdf', 0, 200, FIGURE, {}, None),
    'WB1': ('Trench Crusade/Base/v1.0.1/Warbands-of-Trench-Crusade.pdf', 0, 200, FIGURE, WB_FIGURE, None),
    'FAQ1': ('Trench Crusade/Base/v1.0.1/FAQ1-version-1.0.1.pdf', 0, 0, None, {}, None),
    'CF': ('Trench Crusade/Carcass Front/Carcass Front Book Single Page.pdf', 4, 0, None, {}, None),
}

# Chapters: (section, title, book, first page, last page), book pages of 1.0.2 for the core sets. A chapter starts at
# its heading on its first page (or the top of that page) and ends where the next chapter starts.
CORE = [
    ('core-rules', 'Core Rules', 'RB', 14, 14), ('core-rules', 'The Initiative Phase', 'RB', 14, 14),
    ('core-rules', 'The Activation Phase', 'RB', 14, 20), ('core-rules', 'The Morale Phase', 'RB', 21, 21),
    ('comprehensive-rules', 'What You Need To Play', 'RB', 22, 23),
    ('comprehensive-rules', 'Core Concepts', 'RB', 23, 29),
    ('comprehensive-rules', 'Other Rules Principles', 'RB', 30, 31),
    ('comprehensive-rules', 'Game Turns', 'RB', 32, 32), ('comprehensive-rules', '1. Initiative Phase', 'RB', 32, 32),
    ('comprehensive-rules', '2. Activation Phase', 'RB', 33, 34), ('comprehensive-rules', 'Movement', 'RB', 35, 41),
    ('comprehensive-rules', 'Combat', 'RB', 42, 49), ('comprehensive-rules', '3. Morale Phase', 'RB', 50, 50),
    ('comprehensive-rules', 'Winning the Game', 'RB', 51, 51),
    ('comprehensive-rules', 'Keywords Glossary', 'RB', 52, 57),
    ('comprehensive-rules', 'Trench Crusade Terrain', 'RB', 58, 67), ('warbands', 'Introduction', 'WB', 7, 8),
    ('warbands', 'Starting a Warband', 'WB', 9, 9), ('warbands', 'Choose a Faction', 'WB', 9, 9),
    ('warbands', 'Recruit Your Warband', 'WB', 9, 10), ('warbands', 'Battlekit', 'WB', 11, 12),
    ('warbands', 'Warband Entries', 'WB', 13, 13), ('warbands', 'Warband Roster Sheet', 'WB', 14, 14),
    ('warbands', 'Ready for Battle', 'WB', 14, 14), ('battlekit', 'Battlekit', 'RB', 68, 69),
    ('battlekit', 'Ranged Weapons', 'RB', 70, 74), ('battlekit', 'Melee Weapons', 'RB', 75, 77),
    ('battlekit', 'Grenades', 'RB', 78, 79), ('battlekit', 'Shields', 'RB', 80, 80),
    ('battlekit', 'Equipment', 'RB', 81, 86), ('campaigns', 'Campaign Rules', 'RB', 87, 87),
    ('campaigns', 'Patrons', 'RB', 87, 94), ('campaigns', 'Campaign Games', 'RB', 95, 99),
    ('campaigns', 'Campaign Phase', 'RB', 100, 100), ('campaigns', 'Trauma Step', 'RB', 101, 103),
    ('campaigns', 'Promotions & Experience Step', 'RB', 104, 111),
    ('campaigns', 'Reinforcements Step', 'RB', 112, 112), ('campaigns', 'Exploration Step', 'RB', 113, 122),
    ('campaigns', 'Quartermaster Step', 'RB', 123, 124), ('campaigns', 'Glory Items', 'RB', 125, 127),
    ('campaigns', 'Glory Item Cartulary', 'RB', 128, 143), ('scenarios', 'Scenarios', 'RB', 144, 144),
    ('scenarios', 'Scenario Format', 'RB', 145, 150),
]
ERRATA = {
    'core-1.0.2': [('errata', 'Trench Crusade 1.0.2 Changelog', 'CL2', 2, 2),
                   ('errata', 'Digital Rulebook Updates 1.0.2', 'CL2', 2, 9),
                   ('errata', 'Warbands of Trench Crusade Updates 1.0.2', 'CL2', 10, 15),
                   ('errata', 'Rules Commentaries Version 1.0.2', 'RC2', 2, 8)],
    'core-1.0.1': [('errata', 'FAQ1 - Version 1.0.1', 'FAQ1', 2, 5)],
}
CF_PAGES = [  # book pages; the New Patrons (pp.78-79) are data, the map zones come in step 5
    ('scenarios', 'Scenarios & Terrain', 'CF', 60, 60),
    ('scenarios', 'Carcass Front Terrain Piece Rules', 'CF', 61, 61),
    ('scenarios', 'Random Scenario Generator', 'CF', 74, 77),
    ('campaigns', 'The Carcass Front Campaign', 'CF', 80, 82), ('campaigns', 'Campaign Phase', 'CF', 83, 85),
    ("campaigns", "Rudolf's Folly", 'CF', 86, 86), ('campaigns', 'Outposts Step', 'CF', 87, 87),
    ('campaigns', 'Winning the Campaign', 'CF', 87, 87),
    ('campaigns', 'The Path to Leviathan Campaign', 'CF', 88, 90),
    ('campaigns', 'Carcass Front Exploration Tables', 'CF', 91, 95),
]
SCENARIOS_CORE = [
    ('Claim No Man’s Land', 151, 153), ('Hunt for Heroes', 154, 157), ('Relic Hunt', 158, 160),
    ('Trench Warfare', 161, 163), ('Armoured Train', 164, 167), ('Dragon Hunt', 168, 174),
    ('Supply Raid', 175, 177), ('From Below', 178, 184), ('Fields of Glory', 185, 186),
    ('Don’t Breathe', 187, 191), ('The High Ground', 192, 194), ('Great War', 195, 197),
]
SCENARIOS_CF = [
    ('The Ruins of Nineveh Novus', 62, 64), ('Domus Demetrius', 65, 67), ('The Steel Necropolis', 68, 69),
    ('The Sword of God', 70, 71), ('The Altar of Leviathan', 72, 73),
]
SETS = {
    'core-1.0.2': ({'RB': 'RB2', 'WB': 'WB2'}, CORE + ERRATA['core-1.0.2'], SCENARIOS_CORE),
    'core-1.0.1': ({'RB': 'RB1', 'WB': 'WB1'}, CORE + ERRATA['core-1.0.1'], SCENARIOS_CORE),
    'carcass-front-1.0': ({}, CF_PAGES, SCENARIOS_CF),
}
ARTISTS = {'GD', 'AD', 'MF', 'MG', 'MK', 'VM', 'MM', 'VP', 'PW'}


sys.path.insert(0, str(Path(__file__).resolve().parent))
from ids import slug  # noqa: E402 (one slug rule for every id)


def key(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', slug(s))


def same(heading: str, title: str) -> bool:
    """A heading names the title, maybe after a scenario's roman numeral."""
    h, t = key(heading), key(title)
    return h.endswith(t) and re.fullmatch(r'([ivx]+o)?', h[:len(h) - len(t)]) is not None  # 'IV º Name'


def map_101(book: str, p: int) -> int:
    """1.0.2 book page -> 1.0.1 page: the 1.0.2 keyword glossaries grew by one page (RB pp.52-57, WB pp.15-20)."""
    first, last = (52, 57) if book.startswith('RB') else (15, 20)
    return p if p < first else min(p, last - 1) if p <= last else p - 1


# ------------------------------------------------------------------ pdftohtml XML -> lines


@functools.lru_cache(maxsize=None)
def _doc(pdf: Path):
    """All pages of a PDF as {page: (height, [element])}, an element being (top, left, width, height, font, bold,
    text); plus the fonts {id: (size, family, color)} and the body text size."""
    xml = subprocess.run(['pdftohtml', '-xml', '-i', '-stdout', str(pdf)], capture_output=True, text=True,
                         check=True).stdout
    fonts = {m[0]: (int(m[1]), m[2], m[3]) for m in re.findall(
        r'<fontspec id="(\d+)" size="(-?\d+)" family="([^"]*)" color="([^"]*)"/>', xml)}
    pages, chars = {}, {}
    for pm in re.finditer(r'<page number="(\d+)"[^>]* height="(\d+)"[^>]*>(.*?)</page>', xml, re.S):
        els = []
        for t in re.finditer(r'<text top="(-?\d+)" left="(-?\d+)" width="(\d+)" height="(\d+)" font="(\d+)">(.*?)</text>',
                             pm[3], re.S):
            text = html.unescape(re.sub(r'<[^>]+>', '', t[6]))
            els.append((int(t[1]), int(t[2]), int(t[3]), int(t[4]), t[5], '<b>' in t[6], text))
            chars[fonts[t[5]][0]] = chars.get(fonts[t[5]][0], 0) + len(text.strip())
        pages[int(pm[1])] = (int(pm[2]), els)
    return pages, fonts, max(chars, key=chars.get)


def _lines(pdf: Path, page: int, cfg):
    """The page's visual lines in reading order, as dicts with text, position, size and flags."""
    strip, figure, fig_sizes, cols = cfg
    sizes = fig_sizes.get(page, ())
    pages, fonts, body = _doc(pdf)
    height, els = pages[page]
    # white text is a map label, unless the page is dark (most of its text is white)
    white = sum(len(e[6]) for e in els if fonts[e[4]][2].lower() == '#ffffff') > sum(len(e[6]) for e in els) / 2
    lines = []
    for top, left, width, h, font, bold, text in els:
        size, family, color = fonts[font]
        if (not width or (color.lower() == '#ffffff' and not white) or top > 0.935 * height or left + width < strip
                or (text.strip() in ARTISTS and size < body) or top + h < 0.03 * height
                or (figure and re.search(figure, family)) or size in sizes):
            continue
        if 'TCHeadline' in family:
            text = text.upper()  # an all-caps display face whose text layer is lower case
        cur = lines[-1] if lines else None
        col = sum(left >= c for c in cols[:2]) if cols else 0  # table cells never share a line
        if cur and abs(top - cur['top']) <= 5 and left >= cur['right'] - 6 and col == cur['col']:
            gap = left - cur['right']
            sep = ' | ' if gap > 1.2 * size and text.strip() else ' ' if gap > 2 and not (
                cur['raw'].endswith(' ') or text.startswith(' ')) else ''
            cur['raw'] += sep + text
            cur['right'] = left + width
        else:
            cur = {'top': top, 'left': left, 'right': left + width, 'h': h, 'raw': text, 'page': page, 'col': col,
                   'size': 0, 'allbold': True, 'font': None}
            lines.append(cur)
        if text.strip():
            cur['size'] = max(cur['size'], size)
            if not cur['font']:  # the first run: a bold one is a run-in label
                cur['font'], cur['label'] = (size, family, color), bold and 'Semibold' not in family
            cur['allbold'] &= ((bold and 'Semibold' not in family) or size >= 1.4 * body) and 'Calligraphy' not in family
    out = []
    for ln in lines:
        text = re.sub(r'\s+', ' ', ln['raw'].replace('\xad', '')).strip()
        if not text or (ln['size'] < body and not re.search(r'\w', text)) or re.fullmatch(r'[A-Z]{2}( [A-Z]{2})*', text):
            continue  # empty, a stray symbol from a figure, or a map label such as a zone code
        ln['text'] = text
        ln['bullet'] = ln['raw'][:1].isspace()
        big = ln['size'] >= 1.4 * body
        # small headings are bold body-size lines; a bold line ending in a full stop is a label, not a heading
        ln['heading'] = (ln['allbold'] and not ln['bullet'] and len(text) <= 90 and not text[:1].islower()
                         and ' | ' not in text and re.search(r'[^\W\d_]{3}', text)
                         and (big or (ln['size'] >= body and not text.endswith('.'))))
        out.append(ln)
    for a, b in zip(out, out[1:]):  # a bold line wrapping into a bold label ending in a full stop is part of it
        if (a['heading'] and not b['heading'] and b['allbold'] and b['font'] == a['font']
                and 0 < b['top'] - a['top'] <= 1.6 * a['h']):
            a['heading'] = False
    if cols:
        out = _table(out, cols)
    for ln in out:  # the right edge of the column the line sits in: a line that reaches it was wrapped
        ln['colright'] = max(o['right'] for o in out if abs(o['left'] - ln['left']) < 60)
    return out, body


def _join(a: str, b: str) -> str:
    """Join a wrapped line to the text before it. A word broken at a line end loses its hyphen (ceiling: a compound
    that happens to break at its own hyphen before a lower-case word loses it too); before a capital it stays."""
    if re.search(r'[^\W\d_]-$', a):
        return a[:-1] + b if b[:1].islower() else a + b
    return f'{a} {b}'


def _table(lines, cols):
    """A three-column table page (the changelog), top to bottom. A row starts where its location cell starts (after a
    gap, or level with a page number; a page number can also sit centred in its row); the row's page and location
    cells go in front of its first errata line as `page | location | text`."""
    cells = []
    for ln in sorted(lines, key=lambda ln: ln['top']):
        m = ln['col'] == 0 and re.fullmatch(r'(\d+(?:\s*[&,-]\s*\d+)*\s*[&,]?)\s*(.*)', ln['text'])
        if ln['text'] in cols[2]:
            continue
        split = ln['col'] == 1 and ln['right'] > cols[1] + 20 and re.search(r'(\S)\s{2,}(?=\S)', ln['raw'].strip())
        if m:  # a page number, maybe with the start of the location in the same text run
            cells.append({**ln, 'text': m[1], 'col': 'page'})
            if m[2]:
                cells.append({**ln, 'text': m[2], 'col': 1})
        elif split:  # a location and its errata in one text run
            raw = ln['raw'].strip()
            cells += [{**ln, 'text': raw[:split.end(1)]}, {**ln, 'text': raw[split.end():].strip(), 'col': 2}]
        else:
            cells.append(ln)
    nums = [c['top'] for c in cells if c['col'] == 'page']
    starts, prev = [], None
    for c in cells:
        if c['col'] == 1:
            if prev is None or c['top'] - prev['top'] > 1.3 * prev['h'] or any(abs(c['top'] - t) <= 3 for t in nums):
                starts.append(c['top'] - 4)
            prev = c
    starts = sorted(starts + [t - 4 for t in nums if not any(abs(t - 4 - s) < 30 for s in starts)]) + [1e9]
    out, done = [], set()
    for c in cells:
        if c['col'] in ('page', 1):
            continue
        band = next((k for k in range(len(starts) - 1) if starts[k] <= c['top'] < starts[k + 1]), None)
        if c['col'] == 2 and band is not None and band not in done:
            done.add(band)
            row = [o for o in cells if o['col'] in ('page', 1) and starts[band] <= o['top'] < starts[band + 1]]
            num = ' '.join(o['text'] for o in row if o['col'] == 'page')
            where = functools.reduce(_join, [o['text'] for o in row if o['col'] == 1] or [''])
            c = {**c, 'text': f'{num} | {where} | {c["text"]}', 'lead': True, 'heading': False}
        out.append(c)
    return out


def _blocks(pdf: Path, pages: range, cfg):
    """Lines -> blocks [kind, text, size, page], kind being 'h' (heading), 'li' (bullet), 'ol' (numbered item), 'row'
    (table row) or 'p'."""
    blocks, prev, parts, row_left = [], None, {}, 0
    for page in pages:
        lines, body = _lines(pdf, page, cfg)
        for ln in lines:
            t = ln['text']
            row = ' | ' in t and not ln.get('lead')
            item = re.match(r'(\d+|[a-z])\.\s', t)
            if prev is not None:
                dy = ln['top'] - prev['top'] if ln['page'] == prev['page'] else -1
                short = prev['right'] < prev['colright'] - 0.12 * (prev['colright'] - prev['left'])
                ends = re.search(r'[.!?:;”"]$', prev['text'])
                if ln['heading'] and prev['heading'] and 0 <= dy <= 1.6 * prev['h'] and ln['font'] == prev['font']:
                    blocks[-1][1] += ' ' + t
                    parts.setdefault(len(blocks) - 1, [blocks[-1][1][:-len(t) - 1]]).append(t)
                    if len(blocks[-1][1]) > 90:
                        blocks[-1][0] = 'p'  # a bold paragraph, not a heading
                    prev = ln
                    continue
                if (blocks[-1][0] == 'row' and not (row or ln['heading'] or ln['bullet']) and -prev['h'] <= dy <= 1.6 * prev['h']
                        and ln['left'] > row_left + 15):  # a wrapped table cell
                    blocks[-1][1] = blocks[-1][1] + ' | ' + t if ln['left'] > prev['right'] else _join(blocks[-1][1], t)
                    prev = ln
                    continue
                joined = not (ln['heading'] or prev['heading'] or ln['bullet'] or item or row or ln.get('lead')
                              or blocks[-1][0] == 'row'
                              or dy > 1.25 * prev['h'] or ((dy < 0 or short or ln.get('label')) and ends))
                if joined:
                    blocks[-1][1] = _join(blocks[-1][1], t)
                    prev = ln
                    continue
            kind = 'h' if ln['heading'] else 'li' if ln['bullet'] else 'ol' if item else 'row' if row else 'p'
            blocks.append([kind, t, ln['size'], ln['page']])
            prev, row_left = ln, ln['left']
    # three or more short bold lines in a row are a list (a column of names), not one wrapped heading
    for i in sorted(parts, reverse=True):
        if blocks[i][0] == 'h' and len(parts[i]) > 2:
            blocks[i:i + 1] = [['row', t, blocks[i][2], blocks[i][3]] for t in parts[i]]
    return blocks


def _markdown(blocks, title: str) -> str:
    """Blocks -> markdown. Headings rank by size, then capitals over mixed case; ## for the top rank used at least
    twice and anything above it, ### below. A leading copy of the title and a heading repeated as a running head are dropped."""
    last = None
    if blocks and blocks[0][0] == 'h' and same(blocks[0][1], title):
        last, blocks = blocks[0][1], blocks[1:]
    kept = []
    for b in blocks:
        if b[0] == 'h':
            if b[1] == last:
                continue
            last = b[1]
        kept.append(b)
    blocks = kept
    rank = [(b[2], b[1].isupper()) for b in blocks if b[0] == 'h']
    top = max((r for r in rank if rank.count(r) > 1), default=max(rank, default=None))
    parts = []
    for kind, text, size, _ in blocks:
        if kind == 'h':
            parts.append(('## ' if (size, text.isupper()) >= top else '### ') + text)
        elif kind == 'li':
            parts.append('- ' + text)
        else:
            parts.append(text)
    out = ''
    for i, (part, b) in enumerate(zip(parts, blocks)):
        glue = '\n' if i and {b[0], blocks[i - 1][0]} <= {'li', 'ol'} or b[0] == blocks[i - 1][0] == 'row' else '\n\n'
        out += (glue if i else '') + part
    return out.strip()


# ------------------------------------------------------------------ chapters -> pages


def _chapters(set_id: str, entries, docs: Path):
    """[(entry, blocks)] for each chapter entry: its blocks from its heading to the next chapter's heading."""
    books = SETS[set_id][0]
    out = []
    by_book = {}
    for e in entries:
        by_book.setdefault(books.get(e[2], e[2]), []).append(e)
    for book, es in by_book.items():
        path, offset, *cfg = BOOKS[book]
        conv = (lambda p: map_101(book, p)) if book in ('RB1', 'WB1') else (lambda p: p)
        lo, hi = conv(min(e[3] for e in es)), conv(max(e[4] for e in es))
        blocks = _blocks(docs / path, range(lo + offset, hi + offset + 1), cfg)
        starts = []
        for e in es:
            first = conv(e[3]) + offset
            after = starts[-1] if starts else 0
            hit = next((i for i, b in enumerate(blocks) if i >= after and b[0] == 'h' and first - 1 <= b[3] <= first + 1
                        and same(b[1], e[1])), None)
            if hit is None:
                hit = next((i for i, b in enumerate(blocks) if i >= after and b[3] >= first), len(blocks))
                print(f'  {set_id}: no heading for {e[1]!r} near p.{first}, using the page top', file=sys.stderr)
            starts.append(hit)
            if hit < len(blocks) and abs(blocks[hit][3] - first) > (book in ('RB1', 'WB1')):
                print(f'  {set_id}: {e[1]!r} starts on pdf p.{blocks[hit][3]}, not p.{first}', file=sys.stderr)
        for n, e in enumerate(es):
            # a chapter runs on to the next one's heading when that starts on or right after its last page
            last = conv(e[4]) + offset
            end = next((i for i, b in enumerate(blocks) if b[3] > last), len(blocks))
            if n + 1 < len(es) and es[n + 1][3] <= e[4] + 1 and starts[n + 1] > starts[n]:
                end = starts[n + 1]
            out.append((e, blocks[starts[n]:end]))
    return out


def _split(md: str, limit: int = SPLIT_AT, sep: str = '\n\n'):
    """Cut markdown into pieces of at most `limit` chars at paragraph breaks, or at line breaks inside a long list."""
    pieces, cur = [], ''
    for para in md.split(sep):
        if len(para) > limit:
            if sep == '\n':
                raise ValueError(f'a line of {len(para)} chars does not fit a page')
            pieces += ([cur] if cur else []) + _split(para, limit, '\n')
            cur = ''
        elif cur and len(cur) + len(para) + len(sep) > limit:
            pieces.append(cur)
            cur = para
        else:
            cur = f'{cur}{sep}{para}' if cur else para
    return pieces + [cur] if cur else pieces


def pages(set_id: str, docs: Path = DEFAULT) -> list[dict]:
    """`page` dicts for a rules set, in reading order; long chapters become a parent page plus child pages."""
    out, ids, order = [], set(), {}

    def add(section, title, body, parent=None):
        pid = base = f'page:{section}/{slug(title)}'
        n = 2
        while pid in ids:
            pid, n = f'{base}-{n}', n + 1
        ids.add(pid)
        order[section] = order.get(section, 0) + 1
        out.append({'id': pid, 'section': section, 'title': title[:120], 'order': order[section],
                    **({'parent': parent} if parent else {}), 'body': body})
        return pid

    for (section, title, *_), blocks in _chapters(set_id, SETS[set_id][1], docs):
        md = _markdown(blocks, title)
        if len(md) <= SPLIT_AT:
            add(section, title, md)
            continue
        head, *subs = re.split(r'\n(?=## )', '\n' + md)
        head = head.strip()
        if head.startswith('## '):
            head, subs = '', [head] + subs
        first, *rest = _split(head) or ['']
        parent = add(section, title, first)
        subs = [f'## {title} ({n})\n{piece}' for n, piece in enumerate(rest, 2)] + subs
        for sub in subs:
            name, _, body = sub.strip()[3:].partition('\n')
            for i, piece in enumerate(_split(body.strip()) or ['']):
                add(section, name.strip() if i == 0 else f'{name.strip()} ({i + 1})', piece, parent)
    return out


def _subsection(md: str, name: str):
    """The body under the heading `name`, up to the next heading of the same or a higher level."""
    m = re.search(rf'^(#+) {name}\b.*?$', md, re.M | re.I)
    if not m:
        return None
    end = re.search(rf'^#{{1,{len(m[1])}}} ', md[m.end():], re.M)
    return md[m.end():m.end() + end.start() if end else None].strip()


def scenarios(set_id: str, docs: Path = DEFAULT) -> list[dict]:
    """`scenario` dicts: the whole scenario as `text`, its Deployment and Victory Conditions also on their own."""
    books, _, table = SETS[set_id]
    book = books.get('RB', 'CF')
    entries = [('scenarios', name, 'RB' if books else 'CF', a, b) for name, a, b in table]
    out = []
    for (_, name, *_), blocks in _chapters(set_id, entries, docs):
        text = _markdown(blocks, name)
        if len(text) > MAX_BODY:
            raise ValueError(f'{set_id} ({book}): scenario {name} is {len(text)} chars')
        s = {'id': f'scenario:{slug(name)}', 'name': name, 'text': text}
        for field, head in (('deployment', 'Deployment'), ('victory', 'Victory Conditions')):
            part = _subsection(text, head)
            if part:
                s[field] = part
        out.append(s)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--set', required=True, choices=SETS)
    ap.add_argument('--out', required=True, type=Path)
    ap.add_argument('--docs', type=Path, default=DEFAULT)
    ap.add_argument('--scenarios', action='store_true')
    a = ap.parse_args()
    (a.out / 'pages').mkdir(parents=True, exist_ok=True)
    by_section = {}
    for p in pages(a.set, a.docs):
        by_section.setdefault(p['section'], []).append(p)
    for section, ps in by_section.items():
        (a.out / 'pages' / f'{section}.json').write_text(json.dumps(ps, ensure_ascii=False, indent=1), 'utf-8')
        print(f'{section}: {len(ps)} pages, {sum(len(p["body"]) for p in ps)} chars')
    if a.scenarios:
        sc = scenarios(a.set, a.docs)
        (a.out / 'scenarios.json').write_text(json.dumps(sc, ensure_ascii=False, indent=1), 'utf-8')
        print(f'scenarios: {len(sc)}')


if __name__ == '__main__':
    main()
