"""Variants (overlays on a faction), mercenaries, Glory Item tables, Patrons and the legal/illegal example lists."""
import copy

import yaml

from elements import by_name
from ids import slug


class Overlays:
    def variant(self, key):
        d = self.y[key]
        fid, vp = d['faction']['parent'], self.vpath(key)
        vid, where = f'variant:{vp}', self.side(fid)
        ctx, r = [vp, fid, 'mercenaries'], d.get('rules') or {}
        base = next(f for f in self.out[where]['factions.json'] if f['id'] == f'faction:{fid}')
        replaces, adds = [], []

        def overlay(new_id, base_id):
            (replaces.append({'from': base_id, 'to': new_id}) if base_id else adds.append(new_id))

        # Upgrades first: a copy identical to the faction's stays the faction's (the Sins repeat the shared powers),
        # and every later reference to it must use the faction's id.
        ups = r.get('upgrades') or []
        for u in ups:
            bid = self.upgrades[fid].get(slug(u['name']))
            if bid and self.same_upgrade(self.upgrade_el(u, vp, vid, ctx), bid, where, vp, fid):
                self.upgrades[vp][slug(u['name'])] = bid
        for u in ups:
            bid = self.upgrades[fid].get(slug(u['name']))
            if self.upgrades[vp][slug(u['name'])] != bid:
                el = self.add(where, 'upgrades.json', self.upgrade_el(u, vp, vid, ctx))
                overlay(el['id'], bid)
        for u in d.get('units') or []:
            el = self.add(where, 'units.json', self.unit_el(u, vp, vid, ctx, where))
            overlay(el['id'], self.units[fid].get(slug(u['name'])))
        su = self.scope_units(ctx)
        for i in d.get('armoury') or []:
            el = self.add(where, 'armoury-lines.json', self.line_el(i, vp, vid, ctx, su))
            overlay(el['id'], self.lines[fid].get(slug(i['name'])))
        excludes = self.excluded(r.get('excluded'), ctx, vid, fid)
        rules = self.rules_common(r, ctx, vid, vp)
        # Merge like the old engine, then write the merged list (a variant's list key replaces the faction's).
        if 'caps' in rules:
            rules['caps'] = [{'unit': c['unit'], 'max': c['max']}
                             for c in by_name([dict(c, name=c['unit']) for c in base.get('caps', [])],
                                              [dict(c, name=c['unit']) for c in rules['caps']])]
        if 'limits' in rules:
            rules['limits'] = by_name(base.get('limits', []), rules['limits'])
        own_prices = rules.get('prices', []) + self.prices.get(vp, [])
        if own_prices:
            rules['prices'] = by_name(base.get('prices', []), own_prices)
        if 'freeItems' in rules:
            rules['freeItems'] = list(dict.fromkeys(base.get('freeItems', []) + rules['freeItems']))
        drop = {self.unit(n, ctx, vid) for n in r.get('optional') or []} | set(excludes)
        if r.get('must_include') or r.get('optional'):
            src = r if r.get('must_include') else (self.y[fid].get('rules') or {})
            rules['mustInclude'] = self.must(src, ctx if r.get('must_include') else [fid], vid, drop)
        if replaces:  # merged faction rules must name the variant's own copies
            import json
            froms = [f'"{r_["from"]}"' for r_ in replaces]
            for k in ('limits', 'prices', 'caps'):
                if k not in rules and base.get(k) and any(f in json.dumps(base[k]) for f in froms):
                    rules[k] = copy.deepcopy(base[k])
            txt = json.dumps(rules)
            for r_ in replaces:
                txt = txt.replace(f'"{r_["from"]}"', f'"{r_["to"]}"')
            rules = json.loads(txt)
        el = {'id': vid, 'faction': f'faction:{fid}', 'name': d['faction']['name']}
        if replaces:
            el['replaces'] = replaces
        if adds:
            el['adds'] = adds
        if excludes:
            el['excludes'] = excludes
        if rules:
            el['rules'] = rules
        if r.get('text'):
            el['text'] = r['text'].strip()
        if d['faction'].get('description'):
            el['lore'] = d['faction']['description'].strip()
        self.unknown(r, 'start_ducats start_glory excluded must_include leader optional caps free_items fireteams '
                        'upgrades limits prices patron text', vid)
        self.add(where, 'variants.json', el)

    def same_upgrade(self, el, bid, where, vp, fid):
        import json
        b = next((x for x in self.out[where]['upgrades.json'] if x['id'] == bid), None)
        norm = lambda x: json.dumps({k: v for k, v in x.items() if k not in ('id', 'owner')}, sort_keys=True)  # noqa: E731
        return b is not None and norm(b) == norm(el).replace(f'{vp}/', f'{fid}/')

    # ------------------------------------------------------------ mercenaries
    def mercenaries(self):
        d, ctx = self.y['mercenaries'], ['mercenaries']
        for u in d.get('units') or []:
            u = copy.deepcopy(u)
            fireteam = 'FIRETEAM' in (u.get('keywords') or []) and slug(u['name']) == 'mamluk-faris'
            if fireteam:  # 40 §13: the Mamluk's FIRETEAM is a choice on recruitment (Sworn Brethren)
                u['keywords'].remove('FIRETEAM')
            el = self.add('core', 'units.json', self.unit_el(u, 'mercenaries', 'faction:mercenaries', ctx, 'core'))
            if fireteam:
                self.add('core', 'upgrades.json', {
                    'id': 'upgrade:mercenaries/sworn-brethren', 'owner': 'faction:mercenaries', 'name': 'Sworn Brethren',
                    'keywords': [{'kw': 'kw:fireteam'}], 'cost': 0, 'currency': 'ducats', 'for': [el['id']],
                    'text': next((a['text'] for a in el['abilities'] if a['name'] == 'Sworn Brethren'), '')})
        for i in d.get('armoury') or []:
            self.add('core', 'armoury-lines.json', self.line_el(i, 'mercenaries', 'faction:mercenaries', ctx, []))

    # ------------------------------------------------------------ Glory Items
    def glory(self):
        core = [k for k in self.bases() if self.side(k) == 'core']
        align = {k: self.y[k]['faction']['alignment'] for k in core}
        rows = {k: [] for k in core}
        for i in self.y['glory-items']['armoury']:
            st = i.get('stipulations') or {}
            fs = st.get('factions') or [k for k in core if not st.get('alignment') or align[k] == st['alignment']]
            for fid in fs:
                ctx = [fid, 'mercenaries']
                su = self.scope_units(ctx)
                el = self.line_el(i, f'glory-items/{fid}', f'table:glory-items/{fid}', ctx, su)
                if el['id'] in self.where:
                    self.log['glory line split by faction'].append(el['id'])
                    continue
                self.add('core', 'armoury-lines.json', el)
                rows[fid].append({'roll': '-', 'name': i['name'], 'links': [el['item']]})
        for fid in core:
            self.add('core', 'tables.json', {'id': f'table:glory-items/{fid}', 'name': f"Glory Items: {self.y[fid]['faction']['name']}",
                                             'kind': 'glory', 'owner': f'faction:{fid}', 'rows': rows[fid]})

    # ------------------------------------------------------------ Patrons
    def patrons_(self):
        for p in self.y['patrons']['patrons']:
            where = 'cf' if str(p.get('source', '')).startswith('Carcass Front') else 'core'
            pid = f"patron:{slug(p['name'])}"
            el = {'id': pid, 'name': p['name']}
            if p.get('alignment'):
                el['alignment'] = p['alignment']
            fs = [f'faction:{f}' for f in p.get('factions') or []]
            for v in p.get('variants') or []:  # a variant narrows only its own faction
                vid = self.fnames.get(slug(v))
                fs = [x for x in fs if x != 'faction:' + vid.split(':', 1)[1].split('/')[0]] + [vid]
            if where == 'core':
                cut = [x for x in fs if x.split(':', 1)[1].split('/')[0] in self.cf_factions()]
                if cut:
                    self.log['patron: expansion factions left out of core (contract gap)'].append(f'{pid}: {cut}')
                fs = [x for x in fs if x not in cut]
            if fs:
                el['factions'] = fs
            if p.get('text'):
                el['text'] = p['text'].strip()
            el['skills'] = []
            for s in p['skills']:
                sid = f"skill:{slug(p['name'])}/{slug(s['name'])}"
                self.skills[slug(s['name'])] = sid
                sk = {'id': sid, 'name': s['name'], 'text': (s.get('text') or '').strip()}
                if s.get('prices'):
                    sk['prices'] = [self.price(x, [], sid) for x in s['prices']]
                if s.get('limits'):
                    sk['limits'] = self.limits(s['limits'], [], sid)
                el['skills'].append(sk)
            self.add(where, 'patrons.json', el)

    # ------------------------------------------------------------ legal lists
    def legal_lists(self):
        for p in sorted((self.docs / 'packs').glob('legal-lists-*.yaml')):
            for key, block in (yaml.safe_load(p.read_text()) or {}).items():
                fid, _, vname = key.partition('::')
                target = f'variant:{fid}/{slug(vname)}' if vname else f'faction:{fid}'
                ctx = ([target.split(':', 1)[1]] if vname else []) + [fid, 'mercenaries']
                for legal in ('legal', 'illegal'):
                    for lst in block.get(legal) or []:
                        self.legal_list(target, lst, legal == 'legal', ctx, f'{p.name}:{key}:{lst["name"]}')

    def legal_list(self, target, lst, legal, ctx, at):
        el = {'target': target, 'name': lst['name'], 'legal': legal}
        if lst.get('expect'):
            el['expect'] = str(lst['expect'])
        if lst.get('patron'):
            el['patron'] = self.patrons.get(slug(lst['patron'])) or self.miss('patron', lst['patron'], at)
        el['models'] = []
        for m in lst.get('models') or []:
            o = {'unit': self.unit(m['entry'], ctx, at)}
            if m.get('n'):
                o['n'] = m['n']
            if m.get('kit'):
                o['kit'] = [self.item(n, ctx, at) for n in m['kit']]
            if m.get('upgrades'):
                o['upgrades'] = [self.upgrade(n, ctx) or self.miss('upgrade', n, at) for n in m['upgrades']]
            if m.get('skills'):
                o['skills'] = [self.skill(n, at) for n in m['skills']]
            el['models'].append(o)
        refs = [target] + ([el.get('patron')] if lst.get('patron') else []) + [x for m in el['models'] for x in [m['unit']] + m.get('kit', []) + m.get('upgrades', []) + m.get('skills', [])]
        if None in refs:
            self.log['legal list skipped (unresolved name)'].append(at)
            return
        where = 'cf' if any(self.where.get(x) == 'cf' for x in refs) else 'core'
        self.add(where, 'legal-lists.json', el)
