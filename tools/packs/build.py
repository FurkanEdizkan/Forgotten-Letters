#!/usr/bin/env python3
"""Generate the local rules folders (format: app/src/lib/rules/pack.ts) from the group's own notes:
docs/packs/*.yaml (factions, armouries, Patrons, campaign tables), docs/reference/*.md (tables the packs lack) and
the PDFs (rule text pages, scenarios; see pages.py). Writes rules/core-1.0.2, rules/carcass-front-1.0 and, when
rules/_src/core-1.0.1.patch.yaml exists, rules/core-1.0.1. Both inputs and outputs are git-ignored.

    python3 tools/packs/build.py [--docs <docs dir>] [--out <rules dir>]
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fixes  # noqa: E402
import v101  # noqa: E402
from convert import Packs  # noqa: E402
from ids import slug  # noqa: E402
from tables import Tables  # noqa: E402

try:
    import pages as pdfpages  # noqa: E402
except ImportError:  # the PDF extractor is optional: without it, no pages or scenarios
    pdfpages = None

MAIN = Path('/mnt/Storage/All/Develop/Trench Crusade - Forgotten Letters')
FILES = ['keywords.json', 'items.json', 'armoury-lines.json', 'factions.json', 'variants.json', 'units.json',
         'upgrades.json', 'patrons.json', 'tables.json', 'scenarios.json', 'legal-lists.json']
MANIFESTS = {
    'core-1.0.2': {'id': 'core-1.0.2', 'name': 'Trench Crusade', 'kind': 'core', 'version': '1.0.2',
                   'released': '2026-02-11',
                   'notes': 'Rulebook and Warbands of Trench Crusade 1.0.2, with the Rules Commentaries 1.0.2.'},
    'carcass-front-1.0': {'id': 'carcass-front-1.0', 'name': 'Carcass Front', 'kind': 'expansion', 'version': '1.0',
                          'base': 'core-1.0.2', 'notes': 'The Carcass Front campaign book (map zones come in step 5).'},
    'core-1.0.1': {'id': 'core-1.0.1', 'name': 'Trench Crusade', 'kind': 'core', 'version': '1.0.1',
                   'notes': 'Rulebook and Warbands of Trench Crusade 1.0.1, with FAQ 1.'},
}


def exploration_lines(p):
    """Exploration-only kit: a line owned by the table whose row gives it."""
    for i in p.y['exploration']['armoury']:
        s = slug(i['name'])
        iid = p.item(i['name'], [], None)
        for where in ('core', 'cf'):
            tabs = [t for t in p.out[where]['tables.json'] if t['kind'] == 'exploration'
                    and any(iid in r.get('links', []) for r in t['rows'])]
            if not tabs:
                continue
            t = tabs[0]
            path = t['id'].split(':', 1)[1]
            el = {'id': f'line:{path}:{s}', 'owner': t['id'], 'item': iid, 'cost': i.get('cost', 0),
                  'currency': i.get('currency', 'ducats')}
            if i.get('limit') is not None:
                el['limit'] = i['limit']
            st = p.stipulations(i.get('stipulations') or {}, [], el['id'], [])
            if st:
                el['stipulations'] = st
            p.add(where, 'armoury-lines.json', el)
            break
        else:
            p.log['exploration item on no table row'].append(i['name'])


def linkify(body, terms):
    """Link the first plain mention of each keyword or item name as [[id|label]]."""
    for label, eid in terms:
        m = re.search(rf'(?<![\w\[|]){re.escape(label)}(?![\w\]|])', body)
        if m and '[[' not in body[max(0, m.start() - 60):m.start()].split(']]')[-1]:
            body = body[:m.start()] + f'[[{eid}|{label}]]' + body[m.end():]
    return body


def terms_of(files):
    t = [(re.sub(r'\s*(\(.*?\)|\[.*?\]|\+/-)\s*', ' ', k['name']).strip(), k['id']) for k in files['keywords.json']]
    t = [(n, i) for n, i in t if len(n) >= 4]
    t += [(it['name'], it['id']) for it in files['items.json'] if len(it['name']) >= 6]
    return sorted(set(t), key=lambda x: -len(x[0]))


def write(out, set_id, files, pages, base_terms=()):
    d = out / set_id
    if d.exists():
        shutil.rmtree(d)
    (d / 'pages').mkdir(parents=True)
    dump = lambda path, v: path.write_text(json.dumps(v, ensure_ascii=False, indent=1) + '\n')  # noqa: E731
    dump(d / 'manifest.json', MANIFESTS[set_id])
    for f in FILES:
        if files.get(f):
            dump(d / f, files[f])
    terms = terms_of(files) + list(base_terms)
    by = {}
    for pg in pages:
        pg['body'] = linkify(pg['body'], terms)
        by.setdefault(pg['section'], []).append(pg)
    for sec, lst in by.items():
        dump(d / 'pages' / f'{sec}.json', lst)
    print(f'{set_id}: ' + ', '.join(f'{f[:-5]} {len(files.get(f, []))}' for f in FILES) + f', pages {len(pages)}')


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--docs', type=Path, default=MAIN / 'docs')
    a.add_argument('--out', type=Path, default=MAIN / 'rules')
    args = a.parse_args()
    p = Packs(args.docs, (args.docs / 'reference' / '06b-exploration.md').read_text())
    p.register()
    p.build()
    pg = {}
    if pdfpages:
        for set_id, w in (('core-1.0.2', 'core'), ('carcass-front-1.0', 'cf')):
            for s in pdfpages.scenarios(set_id, args.docs):
                p.add(w, 'scenarios.json', s)
            pg[set_id] = pdfpages.pages(set_id, args.docs)
    else:
        p.log['no pages.py: pages and scenarios not generated'].append('-')
    merc = p.y['mercenaries'].get('rules', {}).get('text')
    if merc:  # the mercenaries' general rules have no element of their own
        pg.setdefault('core-1.0.2', []).append({'id': 'page:warbands/mercenaries', 'section': 'warbands',
                                                'title': 'Mercenaries', 'order': 900, 'body': merc.strip()})
    taken = {x['id'] for x in pg.get('core-1.0.2', [])}
    ren = {x['id']: x['id'].replace(f"page:{x['section']}/", f"page:{x['section']}/carcass-front-")
           for x in pg.get('carcass-front-1.0', []) if x['id'] in taken}
    for x in pg.get('carcass-front-1.0', []):  # an expansion page may not reuse a base page's id
        x['id'] = ren.get(x['id'], x['id'])
        if x.get('parent') in ren:
            x['parent'] = ren[x['parent']]
    Tables(p, args.docs).all()
    exploration_lines(p)
    fixes.apply(p)
    core, cf = p.out['core'], p.out['cf']
    write(args.out, 'core-1.0.2', core, pg.get('core-1.0.2', []))
    write(args.out, 'carcass-front-1.0', cf, pg.get('carcass-front-1.0', []), terms_of(core))
    patch = args.out / '_src' / 'core-1.0.1.patch.yaml'
    if patch.exists():
        files, man, failed, done, notrev = v101.apply(core, patch)
        MANIFESTS['core-1.0.1'].update({k: v for k, v in man.items() if k in ('released', 'notes', 'version')})
        if pdfpages:
            files['scenarios.json'] = pdfpages.scenarios('core-1.0.1', args.docs)
            p101 = pdfpages.pages('core-1.0.1', args.docs)
        else:
            p101 = []
        p101 += [x for x in pg.get('core-1.0.2', []) if x['id'] == 'page:warbands/mercenaries']
        write(args.out, 'core-1.0.1', files, p101)
        p.log['1.0.1 ops applied'].append(str(done))
        p.log['1.0.1 could not reverse (op failed)'] += failed
        p.log['1.0.1 not reversed (patch notes)'] += [f"{n.get('row')}: {n.get('reason')}" for n in notrev]
    else:
        p.log['no 1.0.1 patch: core-1.0.1 not generated'].append(str(patch))
    lines = []
    for k, v in sorted(p.log.items()):
        lines.append(f'## {k} ({len(v)})')
        lines += [f'  {x}' for x in v]
    (args.out / '_build-log.txt').write_text('\n'.join(lines) + '\n')
    for k, v in sorted(p.log.items()):
        print(f'{len(v):4}  {k}')
    print(f"full log: {args.out / '_build-log.txt'}")


if __name__ == '__main__':
    main()
