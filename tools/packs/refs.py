"""Name → id lookups and the selector, limit, price and stipulation conversions (LIMITS.md keys → pack.ts keys).
A context `ctx` is the list of scopes to search, nearest first: [variant path, faction id, 'mercenaries']."""
from ids import kw_slug, slug

ITEM_ALIASES = {'greatsword': 'great-sword-axe', 'great-sword': 'great-sword-axe',
                'mountaineers-kit': 'mountaineer-kit', 'dum-dum-ammunition': 'dum-dum-bullets'}
# Other printed names of the same item (30 §7, Q2), shown and searched beside the key name.
ITEM_ALIAS_NAMES = {'great-sword-axe': ['Greatsword', 'Great Sword', 'Great Axe'],
                    'great-hammer-maul': ['Great Hammer', 'Maul'], 'sword-axe': ['Sword', 'Axe'],
                    'mountaineer-kit': ["Mountaineer's Kit"], 'dum-dum-bullets': ['Dum Dum Bullets', 'Dum-Dum Ammunition']}


def lookup(table: dict, name: str, suffix=True):
    s = slug(name)
    for c in (s, s + 's', s[:-1] if s.endswith('s') else None, s + 'es'):
        if c and c in table:
            return table[c]
    if not suffix:
        return None
    ends = [v for k, v in table.items() if k.endswith('-' + s)]
    return ends[0] if len(ends) == 1 else None


class Refs:
    def unit(self, name, ctx, at=''):
        for suffix in (False, True):  # an exact name in any scope beats a "Communicant" → "Lazarist Communicant" guess
            for sc in ctx:
                r = lookup(self.units.get(sc, {}), name, suffix)
                if r:
                    return r
        if at is not None:
            self.miss('unit', name, at)
        return None

    def upgrade(self, name, ctx):
        for sc in ctx:
            r = lookup(self.upgrades.get(sc, {}), name)
            if r:
                return r
        return None

    def item(self, name, ctx, at=''):
        s = ITEM_ALIASES.get(slug(name), slug(name))
        cands = self.items.get(s) or self.items.get(s.rstrip('s')) or []
        for sc in ctx:
            for iid, scope, _ in cands:
                if scope == sc:
                    return iid
        if cands:
            return cands[0][0]
        if at is not None:
            self.miss('item', name, at)
        return None

    def line(self, name, ctx):
        for sc in ctx:
            r = lookup(self.lines.get(sc, {}), name)
            if r:
                return r
        return None

    def is_kw(self, name):
        return name.upper() == name and kw_slug(name) in self.kw

    def kwid(self, name, at):
        if kw_slug(name) not in self.kw:
            self.miss('keyword', name, at)
        return f'kw:{kw_slug(name)}'

    def upgrade_ref(self, name, ctx, at):
        """An upgrade id, or an upgrade group / granted keyword (strings the contract allows here)."""
        r = self.upgrade(name, ctx)
        if r:
            return r
        if name not in self.groups and not self.is_kw(name):
            self.miss('upgrade', name, at)
        return name

    def skill(self, name, at):
        r = lookup(self.skills, name)
        for t in self.y['campaign']['tables'] if not r else []:  # a Skill Table row (only in effects)
            for row in t['rows']:
                if slug(row['name']) == slug(name):
                    return f"table:{t['id']}#{row['roll']}"
        if not r:
            self.miss('skill', name, at)
        return r or f'skill:unknown/{slug(name)}'

    # ------------------------------------------------------------ selectors
    def item_sel(self, y, ctx, at):
        o = {}
        if 'names' in y:
            o['items'] = [i for i in (self.item(n, ctx, at) for n in y['names']) if i]
        for k in ('categories', 'types', 'currency'):
            if k in y:
                o[k] = y[k]
        if 'keywords' in y:
            o['keywords'] = [self.kwid(k, at) for k in y['keywords']]
        if 'min_cost' in y:
            o['minCost'] = y['min_cost']
        if 'max_cost' in y:
            o['maxCost'] = y['max_cost']
        if 'not' in y:
            o['not'] = self.item_sel(y['not'], ctx, at)
        self.unknown(y, 'names categories types currency keywords min_cost max_cost not', at)
        return o

    def model_sel(self, y, ctx, at):
        o = {}
        if 'entries' in y:
            o['units'] = [u for u in (self.unit(n, ctx, at) for n in y['entries']) if u]
        if 'keywords' in y:
            o['keywords'] = [self.kwid(k, at) for k in y['keywords']]
        if 'upgrades' in y:
            o['upgrades'] = [self.upgrade_ref(n, ctx, at) for n in y['upgrades']]
        if 'skills' in y:
            o['skills'] = [self.skill(n, at) for n in y['skills']]
        if 'holding' in y:
            o['holding'] = self.item_sel(y['holding'], ctx, at)
        if 'category' in y:
            o['category'] = y['category']
        if 'value_under' in y:
            o['valueUnder'] = y['value_under']
        if 'base_over' in y:
            o['baseOver'] = y['base_over']
        if 'not' in y:
            o['not'] = self.model_sel(y['not'], ctx, at)
        self.unknown(y, 'entries keywords upgrades skills holding category value_under base_over not', at)
        return o

    def limit(self, y, ctx, at):
        o = {k: y[k] for k in ('name', 'min', 'max', 'count') if k in y}
        if 'text' in y:
            o['text'] = str(y['text'])[:300]
        if 'items' in y:
            o['items'] = self.item_sel(y['items'], ctx, at)
        if 'upgrades' in y:
            o['upgrades'] = [self.upgrade_ref(n, ctx, at) for n in y['upgrades']]
        if 'models' in y:
            o['models'] = self.model_sel(y['models'], ctx, at)
        if 'entries' in y:
            o['entries'] = [u for u in (self.unit(n, ctx, at) for n in y['entries']) if u]
        if 'warband_items' in y:
            o['warbandItems'] = self.item_sel(y['warband_items'], ctx, at)
        if 'who' in y:
            o['who'] = self.model_sel(y['who'], ctx, at)
        if 'per' in y:
            p = y['per']
            o['per'] = {k: p[k] for k in ('each', 'round', 'strict') if k in p}
            if 'models' in p:
                o['per']['models'] = self.model_sel(p['models'], ctx, at)
            if 'items' in p:
                o['per']['items'] = self.item_sel(p['items'], ctx, at)
        if 'when' in y:
            w = y['when']
            o['when'] = {}
            for a, b in (('rating_min', 'ratingMin'), ('rating_under', 'ratingUnder')):
                if a in w:
                    o['when'][b] = w[a]
            for k in ('present', 'absent'):
                if k in w:
                    o['when'][k] = self.model_sel(w[k], ctx, at)
            if 'option' in w:
                o['when']['option'] = w['option']
        self.unknown(y, 'name text min max count items upgrades models entries warband_items who per when', at)
        return o

    def limits(self, ys, ctx, at):
        return [self.limit(y, ctx, at) for y in ys or []]

    def price(self, y, ctx, at):
        o = {k: y[k] for k in ('first', 'copy', 'cost', 'currency', 'less', 'factor') if k in y}
        if 'items' in y:
            o['items'] = self.item_sel(y['items'], ctx, at)
        if 'entries' in y:
            o['entries'] = [u for u in (self.unit(n, ctx, at) for n in y['entries']) if u]
        for k in ('who', 'while'):
            if k in y:
                o[k] = self.model_sel(y[k], ctx, at)
        self.unknown(y, 'first copy cost currency less factor items entries who while', at)
        return o

    def only(self, names, ctx, at, scope_units):
        """`only: [ELITE, Mechanized Heavy Infantry]` (read as OR, Q36) → one ModelSel.
        A ModelSel ANDs its keys, so a mixed list is expanded to the unit ids that match (contract gap)."""
        units, kws, ups, items = [], [], [], []
        for n in names:
            n = str(n)
            if self.is_kw(n):
                kws.append(f'kw:{kw_slug(n)}')
            elif (u := self.unit(n, ctx, None)):
                units.append(u)
            elif (u := self.upgrade(n, ctx)):
                ups.append(u)
            elif (i := self.item(n, ctx, None)):
                items.append(i)
            elif (hits := sorted({v[0][0] for k, v in self.items.items() if slug(n) in k.split('-')})):
                self.log['only: name read as every item containing it'].append(f'{n} ({at})')
                items += hits
            else:
                self.miss('only name', n, at)
        sels = [x for x in ({'units': units} if units else None, {'keywords': kws} if kws else None,
                            {'upgrades': ups} if ups else None, {'holding': {'items': items}} if items else None) if x]
        if len(sels) > 1:  # "ELITE or Mechanized Heavy Infantry only" (Q36: or), in the printed order
            first = {n: i for i, n in enumerate(names)}
            order = lambda sel: min((first.get(n, 99) for n in names if self.sel_has(sel, n, ctx)), default=99)  # noqa: E731
            return {'any': sorted(sels, key=order)}
        if units:
            return {'units': units}
        if kws:
            return {'keywords': kws}
        if ups:
            return {'upgrades': ups}
        return {'holding': {'items': items}} if items else None

    def sel_has(self, sel, n, ctx):
        n = str(n)
        if 'keywords' in sel:
            return self.is_kw(n)
        if 'units' in sel:
            return self.unit(n, ctx, None) in sel['units']
        if 'upgrades' in sel:
            return self.upgrade(n, ctx) in sel['upgrades']
        return not self.is_kw(n)

    def stipulations(self, y, ctx, at, scope_units):
        o = {}
        for a, b in (('per_model', 'perModel'), ('shield_combo', 'shieldCombo'), ('bayonet_lug', 'bayonetLug'),
                     ('consumable', 'consumable'), ('headgear', 'headgear'), ('exploration_only', 'explorationOnly')):
            if a in y:
                o[b] = y[a]
        if y.get('only'):
            sel = self.only(y['only'], ctx, at, scope_units)
            if sel:
                o['only'] = sel
        if 'limits' in y:
            o['limits'] = self.limits(y['limits'], ctx, at)
        if 'limit_excludes' in y:
            o['limitExcludes'] = self.model_sel(y['limit_excludes'], ctx, at)
        if 'drop_keywords' in y:
            o['dropKeywords'] = [self.kwid(k, at) for k in y['drop_keywords']]
        # alignment / factions route Glory and exploration lines (handled by the caller)
        self.unknown(y, 'per_model shield_combo bayonet_lug consumable headgear exploration_only only limits '
                        'limit_excludes drop_keywords alignment factions', at)
        return o

    def unknown(self, y, known, at):
        for k in y:
            if k not in known.split():
                self.log['unmapped key'].append(f'{k} ({at})')
