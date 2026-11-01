"""Convert the old Faction Studio packs (docs/packs/*.yaml, references by NAME) into rules-folder elements
(app/src/lib/rules/pack.ts, references by id). Two passes: `register` names every unit, upgrade, item and line;
`build` converts each pack, resolving names through those registries. Anything that does not resolve is logged
in `self.log` for the report, never dropped silently.
Reused from archive/carcass-front-v1: app/src/lib/faction-template.ts and app/src/lib/warband-rules.ts (variant
merge rules: caps and upgrades by name, named limits/prices replace, exclusions and free items add up).
"""
import collections
import re

import yaml

from ids import kw_slug, kw_use, slug
from refs import ITEM_ALIAS_NAMES
from refs import Refs
from elements import Elements
from overlays import Overlays

CF_FACTIONS = {'procession-of-the-sacred-affliction', 'heretic-naval-raiders'}
NOT_FACTIONS = {'glossary', 'campaign', 'exploration', 'glory-items', 'patrons', 'mercenaries'}
# Q91: the Carcass Front factions use their old parent faction's Glory Item table.
GLORY_PARENT = {'procession-of-the-sacred-affliction': 'trench-pilgrims', 'heretic-naval-raiders': 'heretic-legions'}


def camel(k: str) -> str:
    return re.sub(r'_([a-z])', lambda m: m[1].upper(), k)


def availability(a) -> dict:
    a = str(a).strip().lower()
    if a == 'any':
        return {'min': 0, 'max': None}
    lo, _, hi = a.partition('-')
    return {'min': int(lo), 'max': int(hi)} if hi else {'min': 0, 'max': int(lo)}


def norm_range(r):
    r = None if r is None else str(r).strip()
    return None if r in (None, '', '-', 'None') else r


class Packs(Refs, Elements, Overlays):
    def __init__(self, docs, rb_explore_text: str):
        self.docs = docs
        self.y = {}
        for p in sorted((docs / 'packs').glob('*.yaml')):
            if p.name != 'TEMPLATE.yaml' and not p.name.startswith('legal-lists'):
                self.y[p.stem] = yaml.safe_load(p.read_text())
        self.rb_explore = rb_explore_text.lower()
        self.out = {'core': collections.defaultdict(list), 'cf': collections.defaultdict(list)}
        self.where = {}  # id → 'core' | 'cf'
        self.log = collections.defaultdict(list)
        self.kw = set()
        self.units = collections.defaultdict(dict)  # scope → {slug: id}
        self.unit_kws = {}  # unit id → kw ids
        self.upgrades = collections.defaultdict(dict)
        self.groups = set()
        self.items = collections.defaultdict(list)  # slug → [(id, scope, profile)]
        self.item_el = {}
        self.lines = collections.defaultdict(dict)  # owner path → {slug: id}
        self.skills = {}  # slug → id
        self.patrons = {}
        self.fnames = {}  # name slug → faction / variant id
        self.prices = collections.defaultdict(list)  # owner path → price rules from units' kit.prices
        self.hire_cf = collections.defaultdict(list)  # CF faction → mercenary unit ids

    # ------------------------------------------------------------ bookkeeping
    def add(self, where, file, el):
        if file == 'legal-lists.json':
            self.out[where][file].append(el)
            return el
        if el['id'] in self.where:
            self.log['duplicate id'].append(el['id'])
            return el
        self.where[el['id']] = where
        self.out[where][file].append(el)
        return el

    def miss(self, kind, name, at):
        self.log[f'unresolved {kind}'].append(f'{name} ({at})')

    def bases(self):
        return [k for k, d in self.y.items() if 'parent' not in d['faction'] and k not in NOT_FACTIONS]

    def variants(self):
        return [k for k, d in self.y.items() if 'parent' in d['faction']]

    @staticmethod
    def side(fid):
        return 'cf' if fid in CF_FACTIONS else 'core'

    def vpath(self, key):
        d = self.y[key]['faction']
        return f"{d['parent']}/{slug(d['name'])}"

    # ------------------------------------------------------------ pass 1: names
    def register(self):
        for k in self.y['glossary']['keywords']:
            self.kw.add(kw_slug(k['name']))
        for key in self.bases():  # a faction's name wins over a variant of the same name
            f = self.y[key]['faction']
            self.fnames[slug(f['name'])] = f"faction:{f['id']}"
        for key in self.variants():
            self.fnames.setdefault(slug(self.y[key]['faction']['name']), f'variant:{self.vpath(key)}')
        packs = [(k, k, None) for k in self.bases()] + [(k, self.vpath(k), k.split('--')[0]) for k in self.variants()]
        packs.append(('mercenaries', 'mercenaries', None))
        for key, scope, _ in packs:
            d = self.y[key]
            for u in d.get('units') or []:
                uid = f"unit:{scope}/{slug(u['name'])}"
                self.units[scope][slug(u['name'])] = uid
                self.unit_kws[uid] = {f"kw:{kw_slug(x)}" for x in u.get('keywords') or []}
            for u in (d.get('rules') or {}).get('upgrades') or []:
                self.upgrades[scope][slug(u['name'])] = f"upgrade:{scope}/{slug(u['name'])}"
                if u.get('group'):
                    self.groups.add(u['group'])
        for p in self.y['patrons']['patrons']:
            pid = slug(p['name'])
            self.patrons[pid] = f'patron:{pid}'
            for s in p['skills']:
                self.skills.setdefault(slug(s['name']), f'skill:{pid}/{slug(s["name"])}')
        # Item profiles, deduplicated by name; precedence keeps core sources ahead of Carcass Front ones.
        core_b = [k for k in self.bases() if self.side(k) == 'core']
        cf_b = [k for k in self.bases() if self.side(k) == 'cf']
        core_v = [k for k in self.variants() if self.side(k.split('--')[0]) == 'core']
        cf_v = [k for k in self.variants() if k not in core_v]
        order = [(k, k, 'core') for k in core_b] + [('glory-items', None, 'core'), ('mercenaries', 'mercenaries', 'core')]
        order += [(k, self.vpath(k), 'core') for k in core_v] + [('exploration', None, 'core')]
        order += [(k, k, 'cf') for k in cf_b] + [(k, self.vpath(k), 'cf') for k in cf_v] + [('exploration', None, 'cf')]
        for key, scope, where in order:
            for i in self.y[key].get('armoury') or []:
                if key == 'exploration' and (where == 'core') != (i['name'].lower() in self.rb_explore):
                    continue
                self.register_item(i, scope, where, explored=key == 'exploration')

    def register_item(self, i, scope, where, explored):
        s = slug(i['name'])
        kws = sorted(i.get('keywords') or [])
        prof = (i['category'], i['type'], norm_range(i.get('range')), tuple(kws))
        for iid, _, p in self.items[s]:
            if p == prof or scope == 'mercenaries':  # a Mercenary's fixed kit is the shared item
                el = self.item_el[iid]
                if not el.get('text') and i.get('text') and not explored:
                    el['text'] = i['text'].strip()
                return
        iid = f'item:{s}' if not self.items[s] else f'item:{s}/{scope or where}'
        if self.items[s]:
            self.log['item profile differs, own id'].append(iid)
        self.items[s].append((iid, scope, prof))
        el = {'id': iid, 'name': i['name'], 'category': i['category'], 'type': i['type']}
        if prof[2]:
            el['range'] = prof[2]
        el['keywords'] = [self.kwu(x, iid) for x in kws]
        text = (i.get('text') or '').strip()
        if explored:  # the pack's first sentence says where it was found, not what it does
            text = re.sub(r'^[^\n]*?\((Favour|Relic|Supplies|Territories)[^)]*\)[^.\n]*\.\s*', '', text)
        if text:
            el['text'] = text
        if i.get('description'):
            el['lore'] = i['description'].strip()
        if i.get('unique'):
            el['unique'] = True
        if s in ITEM_ALIAS_NAMES:
            el['aliases'] = ITEM_ALIAS_NAMES[s]
        self.item_el[iid] = el
        self.add(where, 'items.json', el)

    def kwu(self, text, at):
        return kw_use(text, self.kw, lambda n: self.miss('keyword', n, at))
