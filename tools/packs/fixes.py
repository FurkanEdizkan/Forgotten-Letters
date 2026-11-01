"""Data fixes from docs/reference/40-data-model.md §13 and the approved defaults of 41-open-questions.md, applied
to the converted elements by id. Each fix logs what it touched, so the report can list it."""
import re

from convert import CF_FACTIONS, GLORY_PARENT


def els(p, file):
    return [e for w in ('core', 'cf') for e in p.out[w][file]]


def apply(p):
    log = p.log['fix applied']
    units = els(p, 'units.json')
    # Q43: the Papal States Lieutenant keeps LEADER (Lector also gives it to the Trench Cleric).
    for u in units:
        if u['id'] == 'unit:new-antioch/papal-states-intervention-force/lieutenant' and \
                not any(k['kw'] == 'kw:leader' for k in u['keywords']):
            u['keywords'].append({'kw': 'kw:leader'})
            log.append(f"Q43 LEADER kept: {u['id']}")
    # Papal States: its Lector rule makes the Trench Cleric the leader, and warband exports (Trench Companion) call
    # that model "Lector"; the alias lets an import find it.
    for u in units:
        if u['id'] in ('unit:new-antioch/trench-cleric',
                       'unit:new-antioch/papal-states-intervention-force/trench-cleric'):
            u.setdefault('aliases', [])
            if 'Lector' not in u['aliases']:
                u['aliases'].append('Lector')
                log.append(f"Lector alias: {u['id']}")
    # Q65: the Hell Knight's Infernal Iron Armour is part of its cost.
    for u in units:
        if u['name'].startswith('Hell Knight') and u['kit'].get('fixed'):
            u['kit']['includedInCost'] = True
            log.append(f"Q65 includedInCost: {u['id']}")
    for up in els(p, 'upgrades.json'):
        # Unseen Advance: "models without ELITE", by keyword (non-ELITE Mercenaries count, ELITE Anointed do not).
        if up['name'] == 'Unseen Advance':
            up.pop('for', None)
            up['limits'] = [l for l in up.get('limits', []) if l.get('upgrades') != [up['id']]] + [
                {'text': 'Unseen Advance is only for models without ELITE', 'upgrades': [up['id']], 'max': 0,
                 'who': {'keywords': ['kw:elite']}}]
            log.append(f"Unseen Advance by keyword: {up['id']}")
        # Wrath of God: no Ranged Weapons or Armour; a Leper-Knight can never take it.
        if up['name'] == 'Wrath of God':
            before = up.get('for', [])
            up['for'] = [u for u in before if not u.endswith('/leper-knight')]
            if not any(l.get('items', {}).get('categories') == ['ranged', 'armour'] for l in up.get('limits', [])):
                up.setdefault('limits', []).append({'text': 'Wrath of God: no Ranged Weapons or Armour',
                                                    'items': {'categories': ['ranged', 'armour']}, 'max': 0})
            if before != up['for']:
                log.append(f"Wrath of God without Leper-Knight: {up['id']}")
    # Q91: Glory Item tables; the Carcass Front factions use their parent faction's (default reading a).
    tables = {t['id'] for t in p.out['core']['tables.json']}
    for f in els(p, 'factions.json'):
        fid = f['id'].split(':', 1)[1]
        t = f'table:glory-items/{GLORY_PARENT.get(fid, fid)}'
        if t in tables:
            f['gloryTable'] = t
            if fid in CF_FACTIONS:
                log.append(f"Q91 gloryTable {t}: {f['id']}")
        if fid in CF_FACTIONS:  # who it may hire: the expansion's own list (core cannot name it)
            hires = sorted({u for v, us in p.hire_cf.items() if v == f['id'] for u in us})
            if hires:
                f['mercenaries'] = hires
    # Trench Ghosts cannot take the Heretic Legions Trench Dog Glory Item (06c §8).
    for v in els(p, 'variants.json'):
        if v['id'] == 'variant:heretic-legions/trench-ghosts':
            line = 'line:glory-items/heretic-legions:trench-dog'
            if line in p.where and line not in v.get('excludes', []):
                v.setdefault('excludes', []).append(line)
                log.append(f'Trench Dog Glory line excluded: {v["id"]}')
    # 20 §24: the Apocrypha award Campaign Victory Points (the book's medal), not Glory.
    for it in p.out['cf']['items.json']:
        if it['name'].endswith('Apocrypha') and re.search(r'Gain \d+ glory', it.get('text', '')):
            it['text'] = re.sub(r'Gain (\d+) glory', r'Gain \1 Campaign Victory Points', it['text'])
            log.append(f"Apocrypha CVP, not Glory: {it['id']}")
    # An illegal list must break only the rule it tests: the Knights' Procurement list lacked its must-include
    # Stigmatic Nun and the Leper-Knight's required armour.
    for ll in p.out['cf']['legal-lists.json']:
        if ll['target'] == 'variant:procession-of-the-sacred-affliction/the-knights-of-saint-lazarus' and \
                'Procurement' in ll['name'] and not ll['legal']:
            units = [m['unit'] for m in ll['models']]
            nun = 'unit:procession-of-the-sacred-affliction/stigmatic-nuns'
            if nun not in units and nun in p.where:
                ll['models'].append({'unit': nun})
            for m in ll['models']:
                if m['unit'].endswith('/leper-knight') and not m.get('kit'):
                    m['kit'] = ['item:standard-armour']
            log.append(f"Knights Procurement list completed: {ll['name']}")
