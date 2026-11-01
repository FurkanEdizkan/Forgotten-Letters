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
    revision2(p, log)


SINS = ['envy', 'gluttony', 'greed', 'lust', 'pride', 'sloth', 'wrath']
# Rulebook, Promotions and Experience: models that cannot be Promoted, and Limited Potential (at most 7 XP), by
# faction (names as printed; plurals match their singular entry).
NEVER = {'trench-pilgrims': ['Ecclesiastic Prisoner', 'Anchorite Shrine'],
         'heretic-legions': ['War Wolf Assault Beast', 'Wretched'],
         'black-grail': ['Grail Thrall', 'Fly Thrall', 'Hound of the Black Grail', 'Amalgam'],
         'seven-headed-serpent': ['Wretched', 'Yoke Fiend']}
LIMITED = {'trench-pilgrims': ['Communicant'],
           'iron-sultanate': ['Lions of Jabir', 'Brazen Bull', 'Takwin Homunculus', 'Homunculus'],
           'heretic-legions': ['Artillery Witch'],
           'seven-headed-serpent': ['Pit Locust', 'Desecrated Saint']}
# Trench Dog options (Rulebook Glory Items): Loyal Hound, and one Special Training by faction.
DOG_TRAINING = {'guard-dog': ('Guard Dog', ['new-antioch', 'trench-pilgrims', 'iron-sultanate', 'heretic-legions']),
                'hellhound': ('Hellhound', ['heretic-legions', 'black-grail', 'seven-headed-serpent']),
                'martyrdom-dog': ('Martyrdom Dog', ['trench-pilgrims']),
                'mercy-dog': ('Mercy Dog', ['new-antioch'])}


def _norm(s):
    s = re.sub(r'[^a-z0-9]', '', s.lower())
    for a, b in (('men$', 'man'), ('ies$', 'y'), ('(ch|sh|x|ss)es$', r'\1'), ('s$', '')):
        s = re.sub(a, b, s)
    return s


def revision2(p, log):
    """Step 4 revision 2 (the Trench Companion cross-reference, 1 Nov 2026)."""
    units = els(p, 'units.json')
    variants = els(p, 'variants.json')
    factions = els(p, 'factions.json')
    lines = p.out['core']['armoury-lines.json']
    by_id = {v['id']: v for v in variants}
    # Knights of Avarice cannot take the Tormentor Chain Glory Item.
    v = by_id.get('variant:heretic-legions/knights-of-avarice')
    chain = 'line:glory-items/heretic-legions:tormentor-chain'
    if v and chain in p.where and chain not in v.get('excludes', []):
        v.setdefault('excludes', []).append(chain)
        log.append(f'Tormentor Chain excluded: {v["id"]}')
    # The Sipahi has FIRETEAM from being paired in a fireteam, not as a printed keyword.
    for u in units:
        if u['id'].endswith('/sipahi-automaton-cavalry'):
            before = len(u['keywords'])
            u['keywords'] = [k for k in u['keywords'] if k['kw'] != 'kw:fireteam']
            if len(u['keywords']) != before:
                log.append(f'FIRETEAM keyword dropped: {u["id"]}')
    # Keywords every model of a variant has (mercenaries left out by the engine).
    grants = {'variant:heretic-legions/trench-ghosts': [{'kw': 'kw:fear'}, {'kw': 'kw:negate', 'value': 'DIFFICULT TERRAIN'},
                                                        {'kw': 'kw:negate', 'value': 'GAS'}],
              'variant:new-antioch/kingdom-of-alba-assault-detachment': [{'kw': 'kw:ignore', 'value': 'DEFENDED OBSTACLE'}]}
    for vid, kws in grants.items():
        if vid in by_id:
            by_id[vid].setdefault('rules', {})['grant'] = kws
            log.append(f'rules.grant: {vid}')
    # Papal States: Threshold 200 lower.
    v = by_id.get('variant:new-antioch/papal-states-intervention-force')
    if v:
        v.setdefault('rules', {})['thresholdModifier'] = -200
        log.append(f'thresholdModifier -200: {v["id"]}')
    # The Court's Sins are a dedication (chosen on the warband) that lays the Sin's overlay over the faction.
    for f in factions:
        if f['id'] == 'faction:seven-headed-serpent':
            f['dedications'] = [{'key': s, 'name': s.title(), 'variant': f'variant:seven-headed-serpent/{s}'}
                                for s in SINS if f'variant:seven-headed-serpent/{s}' in by_id]
            f.pop('requiresVariant', None)
            log.append(f'Sins as dedications: {f["id"]}')
    for w in ('core', 'cf'):
        for ll in p.out[w]['legal-lists.json']:
            t = ll['target']
            if t.startswith('variant:seven-headed-serpent/'):
                ll['target'] = 'faction:seven-headed-serpent'
                ll['dedication'] = t.rsplit('/', 1)[1]
            elif t == 'faction:seven-headed-serpent' and 'variants' in ll.get('expect', ''):
                ll['expect'] = 'must choose one of'
    # Promotion: who can never be Promoted, who has Limited Potential.
    for u in units:
        fid = u['id'].split(':', 1)[1].split('/', 1)[0]
        n = _norm(u['name'])
        for key, names in (('never', NEVER), ('limited', LIMITED)):
            if any(_norm(x) == n for x in names.get(fid, [])):
                u['promotion'] = key
                log.append(f'promotion {key}: {u["id"]}')
    # Trench Dog options as Glory lines that need a Trench Dog on the same model.
    dog = 'item:trench-dog'
    trainings = [f'item:trench-dog-{k}' for k in DOG_TRAINING]
    needs_dog = lambda item: {'text': 'Needs a Trench Dog on the same model', 'items': {'items': [item]}, 'max': 0,
                              'who': {'not': {'holding': {'items': [dog]}}}}
    new_items = [{'id': 'item:loyal-hound', 'name': 'Loyal Hound', 'category': 'special', 'type': 'Special',
                  'keywords': [{'kw': 'kw:fireteam'}],
                  'text': 'Trench Dog option: the model and its Trench Dog have the FIRETEAM Keyword.'}]
    new_items += [{'id': f'item:trench-dog-{k}', 'name': f'Trench Dog: {name}', 'category': 'special', 'type': 'Special',
                   'keywords': [], 'text': 'Trench Dog Special Training (Rulebook Glory Items).'}
                  for k, (name, _) in DOG_TRAINING.items()]
    for it in new_items:
        if it['id'] not in p.where:
            p.add('core', 'items.json', it)
    tables = {t['id']: t for t in p.out['core']['tables.json']}
    for fid in ['new-antioch', 'trench-pilgrims', 'iron-sultanate', 'heretic-legions', 'black-grail', 'seven-headed-serpent']:
        owner = f'table:glory-items/{fid}'
        if f'line:glory-items/{fid}:trench-dog' not in p.where:
            continue
        add = [('loyal-hound', 'item:loyal-hound', [needs_dog('item:loyal-hound')])]
        add += [(f'trench-dog-{k}', f'item:trench-dog-{k}',
                 [needs_dog(f'item:trench-dog-{k}'),
                  {'text': 'One Special Training per Trench Dog', 'items': {'items': trainings}, 'max': 1}])
                for k, (_, fs) in DOG_TRAINING.items() if fid in fs]
        for slug, item, limits in add:
            lid = f'line:glory-items/{fid}:{slug}'
            if lid in p.where:
                continue
            p.add('core', 'armoury-lines.json', {'id': lid, 'owner': owner, 'item': item, 'cost': 1, 'currency': 'glory',
                                                 'stipulations': {'perModel': 1, 'limits': limits}})
            if owner in tables:
                tables[owner]['rows'].append({'roll': '-', 'name': next(i['name'] for i in new_items if i['id'] == item),
                                              'links': [item]})
            v = by_id.get('variant:heretic-legions/trench-ghosts')
            if fid == 'heretic-legions' and v:
                v.setdefault('excludes', []).append(lid)
        log.append(f'Trench Dog options: {owner}')
