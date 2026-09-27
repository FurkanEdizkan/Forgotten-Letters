#!/usr/bin/env python3
"""
Read the rules this campaign uses from your own copies of the Trench Crusade books into a JSON
file the app imports (Admin → Rules). The books are copyrighted, so neither they nor the output
are committed; every group runs this against its own PDFs.

  python3 app/scripts/import-rules.py "docs/Trench Crusade/Base/v1.0.2/Warbands-of-Trench-Crusade.pdf" \
      [--carcass "docs/Trench Crusade/Carcass Front/Carcass Front.pdf"] -o data/rules.json

What it reads (by the books' layout, via `pdftotext -bbox-layout` word positions):
  - faction and variant chapters, from the contents pages;
  - unit entries: "<availability> <Name> - Cost: <n> <ducats|glory>", the profile row
    (Movement / Ranged / Melee / Armour / Base), Battlekit, "* Ability: text" blocks, Keywords;
  - armoury tables: item, restrictions and limit, cost, grouped by category;
  - the keywords glossary: "NAME (Tag|Effect): text".
It is a best effort: the Campaign Master checks and corrects entries in the app, and entries they
mark verified are kept when a new import is loaded.
"""
import argparse
import html
import json
import re
import subprocess
import sys
import unicodedata

NAV_X = 140          # the chapter tabs down the left edge
FOOTER_Y = 735       # page number and running footer
DUCAT = '\U0001F451'  # the book's crown symbol
GLORY = '☼'


def letters(s):
    s = unicodedata.normalize('NFKD', s)
    return re.sub(r'[^a-z]', '', s.lower())


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


# ---------------------------------------------------------------- page text

def pages(pdf, first=None, last=None, nav_x=NAV_X, full=False):
    """Yield (page number, [(y, x, text)], footer) with the tab column and footer split off.
    Two-page spreads (wider than tall) are split into their left and right pages.
    With `full`, lines are (y, x, text, height) and the page width comes last."""
    args = ['pdftotext', '-bbox-layout']
    if first:
        args += ['-f', str(first)]
    if last:
        args += ['-l', str(last)]
    out = subprocess.run(args + [pdf, '-'], capture_output=True, check=True).stdout.decode('utf-8', 'replace')
    found = re.findall(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', out, re.S)
    for n, (w, h, page) in enumerate(found, start=first or 1):
        w, h = float(w), float(h)
        halves = [(0.0, w)] if w <= h else [(0.0, w / 2), (w / 2, w)]
        for i, (left, right) in enumerate(halves):
            lines, footer = [], []
            for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', page, re.S):
                x, y = float(m.group(1)), float(m.group(2))
                if not (left <= x < right):
                    continue
                x -= left
                text = html.unescape(' '.join(re.findall(r'>([^<]*)</word>', m.group(5)))).strip()
                if not text:
                    continue
                if y > h - (h - FOOTER_Y if w <= h else 45):
                    footer.append(text)
                elif x >= nav_x:
                    lines.append((y, x, text, float(m.group(4)) - y) if full else (y, x, text))
            lines.sort()
            name = n if len(halves) == 1 else f'{n}{"ab"[i]}'
            yield (name, lines, ' '.join(footer), right - left) if full else (name, lines, ' '.join(footer))


def clean(t):
    """Carcass Front marks bullets with a control character and separates labels with tabs."""
    t = re.sub(r'\s+', ' ', t.replace('\x07', '* ').replace('\t', ' ')).strip()
    # Drop capitals set apart from their word: "E * nforced", "* W * hip" → "* Enforced", "* Whip".
    t = re.sub(r'^(?:\*\s*)?([A-Z])\s*\*\s+([a-z])', r'* \1\2', t)
    return t


def rows(lines, tol=4):
    """Group lines into rows by y; each row is a list of (x, text) left to right.
    A drop capital printed apart ("L" + "* oudspeakers") is put back into its word."""
    out = []
    for y, x, t in lines:
        if out and abs(out[-1][0] - y) <= tol:
            out[-1][1].append((x, t))
        else:
            out.append([y, [(x, t)]])
    result = []
    for y, cells in out:
        cells = [(x, clean(t)) for x, t in cells if clean(t)]
        caps = [c for c in cells if re.fullmatch(r'[A-Z]', c[1])]
        for cap in caps:
            host = next((c for c in cells if c is not cap and re.match(r'^\*\s+[a-z]', c[1])), None)
            if host:
                cells[cells.index(host)] = (host[0], re.sub(r'^\*\s+', '* ' + cap[1], host[1]))
                cells.remove(cap)
        result.append((y, sorted(cells)))
    return result


# ---------------------------------------------------------------- contents → chapters

def contents(pdf, toc_pages):
    """Ordered (title, page) pairs from the contents pages (two columns, some numbers on the next line)."""
    entries = []
    for n, lines, _ in pages(pdf, toc_pages[0], toc_pages[-1], nav_x=0):
        # Contents use the whole page width, tabs included.
        pending = None
        for _, cells in rows(lines):
            for x, t in cells:
                m = re.match(r'^(.*?)[\s\t]*(\d{1,3})$', t)
                if m and m.group(1).strip():
                    entries.append((m.group(1).strip(), int(m.group(2))))
                    pending = None
                elif m and pending:
                    entries.append((pending, int(m.group(2))))
                    pending = None
                elif not m:
                    pending = t.strip()
    return entries


FACTION_IDS = {
    'principalityofnewantioch': 'new-antioch',
    'trenchpilgrims': 'trench-pilgrims',
    'ironsultanate': 'iron-sultanate',
    'hereticlegions': 'heretic-legions',
    'cultoftheblackgrail': 'black-grail',
    'courtofthesevenheadedserpent': 'seven-headed-serpent',
    'mercenaries': 'mercenaries',
    'processionofthesacredaffliction': 'procession-of-the-sacred-affliction',
    'hereticnavalraiders': 'heretic-naval-raiders',
}


def faction_for(title):
    t = letters(title)
    for k, v in FACTION_IDS.items():
        if t == k or t == 'the' + k:
            return v
    return None


# Variants per faction, as in the Warbands book (and app/src/lib/rules/factions.ts).
VARIANTS = {
    'new-antioch': ['Papal States Intervention Force', 'Éire Rangers', 'Kingdom of Alba Assault Detachment',
                    'Stosstruppen of the Free State of Prussia', 'Expeditionary Forces of Abyssinia'],
    'trench-pilgrims': ['Procession of the Sacred Affliction', 'War Pilgrimage of Saint Methodius', 'Cavalcade of the Tenth Plague'],
    'iron-sultanate': ["Fida'i of Alamut – The Cabal of Assassins", 'The House of Wisdom', 'Defenders of the Iron Wall'],
    'heretic-legions': ['Trench Ghosts', 'Knights of Avarice', 'Naval Raiding Party'],
    'black-grail': ['Dirge of the Great Hegemon'],
    'seven-headed-serpent': ['Wrath', 'Envy', 'Lust', 'Pride', 'Sloth', 'Gluttony', 'Greed'],
}


def variant_named(title):
    t = letters(title)
    t = re.sub(r'warbands?$', '', t)  # "Wrath Warbands"
    for f, vs in VARIANTS.items():
        for v in vs:
            lv = letters(v)
            if t == lv or (len(t) > 8 and (lv.startswith(t) or t.startswith(lv))):
                return f, v
    return None


def chapters(toc):
    """Variant start pages from the contents: (page, faction, variant)."""
    starts = []
    for title, page in toc:
        fv = variant_named(title)
        # The Court's sins are lists of Goetic powers inside its chapter, not separate unit lists.
        if fv and fv[0] != 'seven-headed-serpent':
            starts.append((page, fv[0], fv[1]))
    starts.sort(key=lambda s: s[0])
    return starts


FOOTERS = {
    'newantioch': 'new-antioch', 'trenchpilgrims': 'trench-pilgrims', 'ironsultanate': 'iron-sultanate',
    'hereticlegions': 'heretic-legions', 'blackgrail': 'black-grail', 'thecourt': 'seven-headed-serpent',
    'mercenaries': 'mercenaries', 'mercenary': 'mercenaries',
    # Carcass Front promotes two variants to factions of their own.
    'theprocessionofthesacredaffliction': 'procession-of-the-sacred-affliction',
    'hereticnavalraiders': 'heretic-naval-raiders',
}


def faction_from_footer(footer):
    """Warbands book: "Iron Sultanate-Trench Crusade". Carcass Front: "Heretic Naval Raiders 47"."""
    m = re.search(r'([A-Za-z ]+?)\s*-\s*Trench Crusade', footer)
    if m:
        return FOOTERS.get(letters(m.group(1)))
    for name in re.split(r'\s*\d+\s*', footer):
        f = FOOTERS.get(letters(name))
        if f:
            return f
    return None


def chapter_at(starts, page, faction):
    """The variant a page belongs to: the latest variant of this faction starting at or before it."""
    cur = None
    for p, f, v in starts:
        if p <= page and f == faction:
            cur = v
        elif p <= page and f != faction:
            pass
    return cur


CATEGORIES = {
    'rangedweapons': 'ranged', 'meleeweapons': 'melee', 'grenades': 'grenade', 'shields': 'shield', 'shield': 'shield',
    'armour': 'armour', 'equipment': 'equipment', 'specialequipment': 'special',
}

# ---------------------------------------------------------------- entries

# Troops you may take any number of have no leading availability: "Heretic Troopers - Cost: 30".
ENTRY = re.compile(r'^(?:(?P<avail>\d+(?:\s*[-–]\s*\d+)?)\s+)?(?P<name>[A-Z][^:]{1,60}?)\s*[-–]\s*Cost:?\s*(?P<cost>\d+)\s*(?P<cur>\S)?')
PROFILE = ['movement', 'ranged', 'melee', 'armour', 'base']


def currency(sym):
    return 'glory' if sym and (GLORY in sym or 'glory' in sym.lower()) else 'ducats'


def availability(s):
    if not s:
        return {'min': 0, 'max': None}
    s = s.replace('–', '-').replace(' ', '')
    lo, _, hi = s.partition('-')
    return {'min': int(lo) if hi else 0, 'max': int(hi or lo)}


def parse_book(pdf, toc_pages, nav_x=NAV_X):
    toc = contents(pdf, toc_pages) if toc_pages else []
    starts = chapters(toc)
    units, items, keywords = [], [], []
    unit = None
    faction = None
    section = None            # current unit sub-block: battlekit / abilities / keywords / lore
    category = 'troop'
    item_cat = None
    in_glossary = False
    table_x = 0
    details = {}   # item rules blocks: name → {type, range, keywords, text}
    detail = None
    detail_head = None
    for n, lines, footer in pages(pdf, nav_x=nav_x):
        # The running footer ("Iron Sultanate-Trench Crusade") names the chapter; the contents give the variant.
        faction = faction_from_footer(footer) or faction
        variant = chapter_at(starts, n, faction) if faction else None
        profile_head = None
        for y, cells in rows(lines):
            text = ' '.join(t for _, t in cells)
            low = letters(text)
            margin = cells[0][0] < nav_x + 60  # headings start at the page margin, not inside a unit's columns
            # Headings that change what follows.
            if low.startswith('elitewarbandentries') or low.startswith('elitewarbandentry'):  # centred title
                category, unit, item_cat, detail = 'elite', None, None, None
                continue
            if low.startswith('troopswarbandentries') or low.startswith('troopwarbandentries'):
                category, unit, item_cat, detail = 'troop', None, None, None
                continue
            if margin and low == 'armourytables':
                item_cat, unit, detail = None, None, None
                continue
            if 'keywordglossary' in low or low == 'keywordsglossary':
                in_glossary = True
                continue
            is_profile = sum(letters(t) in PROFILE for _, t in cells) >= 3
            cat_cell = next((c for c in cells if letters(c[1]) in CATEGORIES), None)
            # A category heading stands alone in its column (Carcass Front sets rules text beside it).
            if cat_cell and not is_profile and not any(x > cat_cell[0] for x, _ in cells):
                item_cat = CATEGORIES[letters(cat_cell[1])]
                table_x = cat_cell[0]
                unit = None
                continue

            m = ENTRY.match(text)
            if m and faction:
                unit = {
                    'faction': faction, 'variant': variant, 'page': n,
                    'name': m.group('name').strip(), 'category': 'mercenary' if faction == 'mercenaries' else category,
                    'availability': availability(m.group('avail')), 'cost': int(m.group('cost')),
                    'currency': currency(m.group('cur') or text),
                    'text': [], 'battlekit': [], 'abilities': [], 'keywords': [], 'stats': {},
                }
                units.append(unit)
                section, item_cat, in_glossary = 'text', None, False
                detail, detail_head = None, None
                continue

            hd = re.match(r'^(.+?)\s*\|\s*(\d+)\s*[' + DUCAT + GLORY + r']', cells[0][1])
            if hd and len(cells) == 1:
                detail = {'faction': faction, 'name': hd.group(1).strip(), 'description': [], 'type': None, 'range': None, 'keywords': [], 'rules': []}
                details.setdefault((faction, letters(detail['name'])), detail)
                unit, item_cat, detail_head = None, None, None
                continue
            if detail and not unit:
                heads = [letters(t) for _, t in cells]
                if heads[:3] == ['type', 'range', 'keywords']:
                    detail_head = [x for x, _ in cells]
                    continue
                if detail_head and not text.startswith('*'):
                    if table_row(detail, detail_head, cells):
                        continue
                    detail_head = None
                if text.startswith('*'):
                    detail_head = None
                    detail['rules'].append(text.lstrip('* ').strip())
                    continue
                if detail['rules'] and cells[0][0] > (detail_head[0] if detail_head else 0):
                    detail['rules'][-1] += ' ' + text
                    continue
                if not detail['type']:
                    detail['description'].append(text)
                    continue


            if unit:
                heads = [letters(t) for _, t in cells]
                if sum(h in PROFILE for h in heads) >= 3:
                    profile_head = [(x, h) for (x, _), h in zip(cells, heads)]
                    continue
                if not unit['stats'] and not profile_head and re.match(r'^\d+\s*[”"]\s*/', cells[0][1]):
                    # A profile row without its header row: Movement, Ranged, Melee, Armour, Base in order.
                    vals = [t for _, t in cells]
                    if len(vals) == 1:
                        vals = re.findall(r'\d+[”"]/\w+|[+-]?\d+\s*DICE|\d+mm|[+-]?\d+|See below|-', vals[0])
                    unit['stats'] = dict(zip(PROFILE, vals))
                    continue
                if profile_head:
                    for x, t in cells:
                        key = min(profile_head, key=lambda p: abs(p[0] - x))[1]
                        if key in PROFILE:
                            unit['stats'][key] = t
                    profile_head = None
                    continue
                lab = re.match(r'^(Battlekit|Abilities|Keywords|Powers)\b\s*\*?\s*(.*)$', cells[0][1])
                if lab:
                    cells = ([(cells[0][0], lab.group(2))] if lab.group(2) else []) + cells[1:]
                    text = ' '.join(t for _, t in cells)
                first = lab.group(1).lower() if lab else letters(cells[0][1])
                if first == 'battlekit':
                    section = 'battlekit'
                    if cells:
                        unit['battlekit'].append(' '.join(t for _, t in cells))
                    continue
                if first == 'powers':
                    section = 'powers'
                    unit['powers'] = ' '.join(t for _, t in cells)
                    continue
                if section == 'powers' and not lab:
                    unit['powers'] += ' ' + text
                    continue
                if first == 'abilities':
                    section = 'abilities'
                    if not cells or letters(cells[0][1]) == 'none':
                        continue
                if first == 'keywords':
                    section = 'keywords'
                    unit['keywords'] += [k.strip() for k in (cells[0][1] if cells else '').split(',') if k.strip()]
                    continue
                if section == 'keywords':
                    first_cell = cells[0][1]
                    if first_cell.isupper() and len(first_cell) > 2:
                        unit['keywords'] += [k.strip() for k in first_cell.split(',') if k.strip()]
                        continue
                    section = None
                if section == 'abilities':
                    a = re.match(r'^\*\s*([^:]{2,80}):\s*(.*)$', text)
                    if a:
                        name = re.sub(r'^\*\s*', '', a.group(1)).strip()
                        name = re.sub(r'^([A-Z])\s*\*\s*([a-z])', r'\1\2', name)  # a drop capital set apart
                        unit['abilities'].append({'name': name, 'text': a.group(2).strip()})
                    elif unit['abilities']:
                        unit['abilities'][-1]['text'] += ' ' + text
                    continue
                if section == 'battlekit':
                    unit['battlekit'].append(text)
                    continue
                if section == 'text':
                    unit['text'].append(text)
                    continue

            if item_cat and faction and len(cells) >= 2:
                cost = re.match(r'^(\d+)\s*([' + DUCAT + GLORY + '])', cells[-1][1])
                name_cell = next((c for c in cells if abs(c[0] - table_x) < 12), None)
                if cost and name_cell and name_cell is not cells[-1]:
                    name = name_cell[1]
                    cells = cells[cells.index(name_cell):]
                    unique = name.startswith('•')
                    notes = ' '.join(t for _, t in cells[1:-1])
                    limit = re.search(r'Limit:\s*(\d+)', notes)
                    items.append({
                        'faction': faction, 'variant': variant, 'page': n, 'category': item_cat,
                        'name': name.lstrip('• ').strip(), 'unique': unique,
                        'cost': int(cost.group(1)), 'currency': currency(cost.group(2) or ''),
                        'limit': int(limit.group(1)) if limit else None,
                        'restrictions': re.sub(r',?\s*Limit:\s*\d+', '', notes).strip(' ,') or None,
                    })
                    continue

            if in_glossary:
                k = re.match(r'^([A-Z][A-Z0-9 /+\-()’\']{1,60}?)\s*\((Tag|Effect|Tag, Effect)\):\s*(.*)$', text)
                if k:
                    keywords.append({'name': k.group(1).strip(), 'kind': k.group(2), 'text': k.group(3).strip()})
                elif keywords and cells[0][0] > nav_x + 18:
                    keywords[-1]['text'] += ' ' + text
    for i in items:
        d = details.get((i['faction'], letters(i['name'])))
        if d:
            i['type'], i['range'] = d['type'], d['range']
            i['keywords'] = [k.upper() for k in d['keywords'] if k != '-']
            i['text'] = ' '.join(d['rules']).strip() or None
            i['description'] = ' '.join(d['description']).strip() or None
    return toc, starts, units, items, keywords


def table_row(cur, head, cells):
    """One row of an item's Type / Range / Keywords table. Keywords wrap onto rows above and below
    the Type row, so rows holding only keywords are taken too. False once the table has ended."""
    cols = [min(range(3), key=lambda i: abs(head[i] - x)) for x, _ in cells]
    if all(c == 2 for c in cols) and abs(cells[0][0] - head[2]) < 30:
        for _, t in cells:
            cur['keywords'] += [k.strip() for k in t.split(',') if k.strip()]
        return True
    if cur['type']:
        return False
    for (x, t), col in zip(cells, cols):
        if col == 0:
            cur['type'] = t
        elif col == 1:
            cur['range'] = t
        else:
            cur['keywords'] += [k.strip() for k in t.split(',') if k.strip()]
    return True


def parse_battlekit(pdf, nav_x=NAV_X):
    """Common battlekit from the rulebook: a title line, a description, the Type/Range/Keywords
    table and "* rule" paragraphs. Returns name → {type, range, keywords, text, description}."""
    found = {}
    title, cur, head = None, None, None
    for _, lines, _ in pages(pdf, nav_x=nav_x):
        for _, cells in rows(lines):
            text = ' '.join(t for _, t in cells)
            heads = [letters(t) for _, t in cells]
            if heads[:3] == ['type', 'range', 'keywords']:
                if title and (not cur or cur['name'] != title):
                    cur = {'name': title, 'description': desc, 'type': None, 'range': None, 'keywords': [], 'rules': []}
                    found[letters(title)] = cur
                head = [x for x, _ in cells]
                continue
            if head and cur:
                if not text.startswith('*') and table_row(cur, head, cells):
                    continue
                head = None
            if cur and text.startswith('*'):
                cur['rules'].append(text.lstrip('* ').strip())
                continue
            if cur and cur['rules'] and cells[0][0] > head_x(cur):
                cur['rules'][-1] += ' ' + text
                continue
            # A title: one short line in Title Case, not a sentence.
            if len(cells) == 1 and len(text) <= 40 and not text.endswith('.') and text[:1].isupper() and letters(text) not in CATEGORIES:
                title, desc, cur = text, [], None
                continue
            if title and not cur:
                desc.append(text)
    return {k: v for k, v in found.items() if v['type']}


ALIAS_USES = re.compile(r'The ([A-Z][^.:*]{1,40}?) uses the ([A-Z][^.:*]{1,40}?) Warband Entry(?:,)?\s*([^*]*)')
ALIAS_CALLED = re.compile(r'The ([A-Z][^.:*]{1,40}?) or ([A-Z][^.:*]{1,40}?) in an? [^.*]*? are called the ([A-Z][\w’\' ]{1,30}?)\.\s*([^*]*)')


def aliased(base, name, faction, variant, rule, page):
    """A variant model that uses another entry, with the changes its rule spells out."""
    u = json.loads(json.dumps(base))
    u.update(name=name, faction=faction, variant=variant, page=page)
    u['abilities'] = [{'name': name, 'text': rule.strip()}] + u['abilities']
    for stat in ('Ranged', 'Melee'):
        m = re.search(stat + r' Characteristic of ([+-]?\d+ DICE)', rule)
        if m:
            u['stats'][stat.lower()] = m.group(1)
    m = re.search(r'a cost of (\d+)', rule)
    if m:
        u['cost'] = int(m.group(1))
    for m in re.finditer(r'the ((?:[A-Z]{2,}[ ,]*(?:and )?)+)Keywords?', rule):
        u['keywords'] += [k for k in re.split(r',\s*|\s+and\s+', m.group(1).strip()) if k and k not in u['keywords']]
    return u


def variant_aliases(pdf, starts, units, nav_x=NAV_X):
    """Variants rename or re-use entries in their special rules ("The Executor uses the Plague Knight
    Warband Entry", "The Grail Thralls ... are called the Bereaved"): add those as units of the variant."""
    out = []
    faction = None
    find = lambda f, name: next((u for u in units if u['faction'] == f and not u['variant'] and letters(name) in letters(u['name'])), None)
    for n, lines, footer in pages(pdf, nav_x=nav_x):
        faction = faction_from_footer(footer) or faction
        variant = chapter_at(starts, n, faction) if faction else None
        if not variant:
            continue
        text = ' '.join(clean(t) for _, _, t in lines)
        for m in ALIAS_USES.finditer(text):
            base = find(faction, m.group(2))
            if base:
                u = aliased(base, m.group(1), faction, variant, m.group(0), n)
                if re.search(r'must include 1 ' + re.escape(m.group(1)), text):
                    u['availability'] = {'min': 1, 'max': 1}
                out.append(u)
        for m in ALIAS_CALLED.finditer(text):
            base = find(faction, m.group(1)) or find(faction, m.group(2))
            if base:
                out.append(aliased(base, m.group(3), faction, variant, m.group(0), n))
    return out


# ---------------------------------------------------------------- rules text (core, campaign, scenarios)

# Chapters by running footer, and which part of the compendium they belong to.
RULEBOOK_CHAPTERS = {'Core Rules': 'core', 'Comprehensive Rules': 'core', 'Terrain': 'core',
                     'Campaign Rules': 'campaign', 'Scenarios': 'scenario'}
CARCASS_CHAPTERS = {'Scenarios & Terrain': 'scenario', 'Campaigns on the Carcass Front': 'campaign',
                    'The Carcass Front Campaign': 'campaign', 'The Path to Leviathan Campaign': 'campaign',
                    'Carcass Front Exploration Tables': 'campaign'}


def page_chapter(footer, chapters):
    for name in sorted(chapters, key=len, reverse=True):
        if re.search(re.escape(name) + r'\s*(?:-\s*Trench Crusade|\d|$|\s)', footer):
            return name
    return None


def parse_pages(pdf, chapters, nav_x=NAV_X, columns=1, source=''):
    """Rules text as pages: a new page at each large heading, "### " for sub-headings, "| a | b"
    for table rows and "* " for bullets, paragraphs separated by blank lines."""
    out, cur, chapter = [], None, None
    for n, lines, footer, width in pages(pdf, nav_x=nav_x, full=True):
        found = page_chapter(footer, chapters)
        chapter = found if found else (chapter if re.sub(r'[\sMFG\d]', '', footer) == '' or len(footer) > 60 else None)
        if not chapter:
            cur = None
            continue
        # Reading order: down the left column, then the right.
        mid = width / 2 if columns == 2 else width
        lines = [l for l in lines if l[3] < 40]
        body_h = sorted(l[3] for l in lines)[len(lines) // 2] if lines else 12
        col_of = lambda l: 0 if l[1] < mid - 10 else 1
        prev_y = None
        for col in range(2 if columns == 2 else 1):
            for y, cells in rows([l[:3] for l in lines if col_of(l) == col]):
                here = [l for l in lines if col_of(l) == col and abs(l[0] - y) <= 4]
                h = max(l[3] for l in here)
                big = clean(' '.join(l[2] for l in here if l[3] >= body_h * 1.6))
                if big:
                    title = re.sub(r'^(?:[IVX]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)\s*º\s*', '', big).strip()
                    title = title.title() if title.isupper() else title
                    # Diagram labels ("Zone Zone", "X"), unit entries and stray fragments are not headings.
                    if (len(letters(title)) >= 5 and title[:1].isupper() and not ENTRY.match(title)
                            and not re.search(r'\b(\w+(?: \w+)?) \1\b', title) and sum(len(w) == 1 for w in title.split()) < 2):
                        cur = {'book': chapters[chapter], 'chapter': chapter, 'title': title, 'page': str(n), 'source': source, 'body': []}
                        out.append(cur)
                        prev_y = y
                    cells = [c for c in cells if c[1] not in big]
                    if not cells:
                        continue
                    h = body_h
                text = ' '.join(t for _, t in cells)
                if cur is None:
                    cur = {'book': chapters[chapter], 'chapter': chapter, 'title': chapter, 'page': str(n), 'source': source, 'body': []}
                    out.append(cur)
                b = cur['body']
                gap = prev_y is not None and y - prev_y > body_h * 1.5
                prev_y = y
                if len(cells) > 1 and not text.startswith('*'):
                    b.append('| ' + ' | '.join(t for _, t in cells))
                elif (text.isupper() and len(text.split()) <= 6 and len(text) > 3) or (h > body_h * 1.1 and len(text) < 60 and not text.endswith('.')):
                    b.append('### ' + (text.title() if text.isupper() else text))
                elif b and b[-1].startswith('| ') and not gap and not text.startswith('*'):
                    b[-1] += ' ' + text  # a table cell running onto the next line
                elif text.startswith('*') or gap or not b or b[-1].startswith('### '):
                    b.append(text)
                else:
                    b[-1] += ' ' + text
    for p in out:
        p['body'] = '\n\n'.join(p['body']).strip()
    out = [p for p in out if len(p['body']) > 40]
    seen = {}
    for i, p in enumerate(out):
        base = slug(f"{p['chapter']}-{p['title']}")
        seen[base] = seen.get(base, 0) + 1
        p['slug'] = base if seen[base] == 1 else f'{base}-{seen[base]}'
        p['order'] = i
    return out


def head_x(cur):
    return 160


def join_keywords(kws):
    """Put back keywords split across lines: "CUMBER-" + "SOME", "FLYING (FLY THRALLS" + "ONLY)"."""
    out = []
    for k in kws:
        if out and out[-1].endswith('-'):
            out[-1] = out[-1][:-1] + k
        elif out and out[-1].count('(') > out[-1].count(')'):
            out[-1] += ', ' + k
        else:
            out.append(k)
    return [k.upper() for k in out]


def tidy(units):
    for u in units:
        u['description'] = ' '.join(u.pop('text')).strip()
        u['battlekitNote'] = ' '.join(u.pop('battlekit')).strip()
        u['keywords'] = join_keywords(u['keywords'])
        for a in u['abilities']:
            a['text'] = re.sub(r'\s+', ' ', a['text']).strip()
        u['id'] = slug(f"{u['faction']}-{u['variant'] or ''}-{u['name']}")
    return units


BROKEN = re.compile(r'(\w+)- (\w+)')


def dehyphen(data):
    """Line-end hyphens survive as "Counter- Charge" or "mass- produced". Join a split word when the
    book prints the whole word elsewhere ("AC- TIONS" → "ACTIONS"); else keep it a compound ("Counter-Charge")."""
    vocab = set()

    def walk(v, fn):
        if isinstance(v, str):
            return fn(v)
        if isinstance(v, list):
            return [walk(x, fn) for x in v]
        if isinstance(v, dict):
            return {k: walk(x, fn) for k, x in v.items()}
        return v

    walk(data, lambda t: vocab.update(w.lower() for w in re.findall(r'\w+', BROKEN.sub(' ', t))))
    fix = lambda t: BROKEN.sub(lambda m: m[1] + m[2] if (m[1] + m[2]).lower() in vocab else f'{m[1]}-{m[2]}', t)
    return walk(data, fix)


def self_test():
    """Checks on made-up lines in the books' shapes (no book text lives in the repository)."""
    m = ENTRY.match('0-2 Grave Warden - Cost: 45 ' + DUCAT)
    assert m and m.group('name') == 'Grave Warden' and m.group('cost') == '45' and availability(m.group('avail')) == {'min': 0, 'max': 2}
    m = ENTRY.match('Ash Walkers – Cost: 20 ' + DUCAT)
    assert m and m.group('name') == 'Ash Walkers' and availability(m.group('avail')) == {'min': 0, 'max': None}
    m = ENTRY.match('1 Hired Blade - Cost: 3 ' + GLORY)
    assert currency(m.group('cur')) == 'glory'
    assert faction_from_footer('83 Iron Sultanate-Trench Crusade') == 'iron-sultanate'
    assert faction_from_footer('Heretic Naval Raiders 47') == 'heretic-naval-raiders'
    assert clean('\x07 Grim Resolve: text') == '* Grim Resolve: text'
    assert clean('E\x07 nduring') == '* Enduring'
    assert variant_named('Wrath Warbands') == ('seven-headed-serpent', 'Wrath')
    r = rows([(10, 150, 'G'), (11, 150, '\x07 rim Resolve: text')])
    assert r[0][1] == [(150, '* Grim Resolve: text')], r
    d = dehyphen({'a': ['The ACTIONS list.', 'Take AC- TIONS and a Counter- Charge.']})
    assert d['a'][1] == 'Take ACTIONS and a Counter-Charge.', d
    assert join_keywords(['CUMBER-', 'SOME', 'FLYING (FLY', 'ONLY)', 'fire']) == ['CUMBERSOME', 'FLYING (FLY, ONLY)', 'FIRE']
    assert page_chapter('14 Core Rules -Trench Crusade', RULEBOOK_CHAPTERS) == 'Core Rules'
    assert page_chapter('Scenarios & Terrain 62', CARCASS_CHAPTERS) == 'Scenarios & Terrain'
    print('self-test ok')


def main():
    if '--self-test' in sys.argv:
        return self_test()
    ap = argparse.ArgumentParser()
    ap.add_argument('warbands', help='Warbands of Trench Crusade PDF')
    ap.add_argument('--toc', default='4-6', help='contents pages of the Warbands book, e.g. 4-6')
    ap.add_argument('--carcass', help='Carcass Front book PDF (its two faction lists and mercenary)')
    ap.add_argument('--rulebook', help='Trench Crusade Digital Rulebook PDF (common battlekit rules)')
    ap.add_argument('--no-pages', action='store_true', help='skip the core, campaign and scenario text')
    ap.add_argument('-o', '--out', default='rules.json')
    a = ap.parse_args()
    lo, hi = (int(x) for x in a.toc.split('-'))
    toc, starts, units, items, keywords = parse_book(a.warbands, list(range(lo, hi + 1)))
    aliases = variant_aliases(a.warbands, starts, units)
    units += aliases
    print(f'{len(aliases)} variant units: ' + ', '.join(f"{u['name']} ({u['variant']})" for u in aliases), file=sys.stderr)
    if a.carcass:
        _, _, cu, ci, ck = parse_book(a.carcass, [], nav_x=0)
        units += cu
        items += ci
        keywords += [k for k in ck if k['name'] not in {x['name'] for x in keywords}]
    if a.rulebook:
        common = parse_battlekit(a.rulebook)
        for i in items:
            d = common.get(letters(i['name']))
            if d and not i.get('type'):
                i['type'], i['range'] = d['type'], d['range']
                i['keywords'] = [k.upper() for k in d['keywords'] if k != '-']
                i['text'] = ' '.join(d['rules']).strip() or None
                i['description'] = ' '.join(d['description']).strip() or None
        print(f'{len(common)} common battlekit entries from the rulebook', file=sys.stderr)
    units = tidy(units)
    # Keep one entry per faction, variant and name: the most complete one.
    best = {}
    for u in units:
        u['keywords'] = [k for k in u['keywords'] if len(k) < 30]
        k = (u['faction'], u['variant'], letters(u['name']))
        score = len(u['stats']) + len(u['keywords']) + len(u['abilities'])
        if k not in best or score > best[k][0]:
            best[k] = (score, u)
    units = [u for _, u in best.values()]
    seen_items = {}
    for i in items:
        seen_items.setdefault((i['faction'], i['variant'], letters(i['name'])), i)
    items = list(seen_items.values())
    for i in items:
        i['keywords'] = join_keywords(i.get('keywords') or [])
    missing = [f"{i['name']} ({i['faction']})" for i in items if not i.get('type')]
    if missing:
        print(f'{len(missing)} armoury items without rules: ' + ', '.join(missing), file=sys.stderr)
    seen = sorted({u['faction'] for u in units} | {i['faction'] for i in items})
    factions = {f: sorted({u['variant'] for u in units if u['faction'] == f and u['variant']} | set(VARIANTS.get(f, []))) for f in seen}
    data = {
        'source': 'Warbands of Trench Crusade' + (' + Carcass Front' if a.carcass else ''),
        'factions': [{'id': f, 'variants': sorted(v)} for f, v in factions.items()],
        'units': units,
        'items': items,
        'keywords': keywords,
        'pages': [],
    }
    if not a.no_pages:
        if a.rulebook:
            data['pages'] += parse_pages(a.rulebook, RULEBOOK_CHAPTERS, source='Trench Crusade Rulebook')
        if a.carcass:
            data['pages'] += parse_pages(a.carcass, CARCASS_CHAPTERS, nav_x=0, columns=2, source='Carcass Front')
        for i, p in enumerate(data['pages']):
            p['order'] = i
        print(f"{len(data['pages'])} rules pages: " + ', '.join(f"{b} {sum(p['book'] == b for p in data['pages'])}" for b in ('core', 'campaign', 'scenario')), file=sys.stderr)
    data = dehyphen(data)
    with open(a.out, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f"{len(units)} units, {len(items)} armoury items, {len(keywords)} keywords, "
          f"{len(factions)} factions → {a.out}", file=sys.stderr)


if __name__ == '__main__':
    main()
