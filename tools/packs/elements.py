"""Pass 2: build the elements of every pack (factions, variants, units, upgrades, armoury lines, Glory tables,
mercenaries, patrons, keywords). Variants are written as overlays: same-named rule keys replace the faction's
(pack.ts), so the merged list is written wherever the variant sets a list key."""
from ids import KW_ALIASES, kw_param, kw_slug, slug

STAT_KEYS = ('movement', 'ranged', 'melee', 'armour', 'base')
KIND = {'Tag': 'tag', 'Effect': 'effect', 'Tag, Effect': 'both', 'Effect, Tag': 'both'}


def by_name(base, later):
    names = {x.get('name') for x in later if x.get('name')}
    return [x for x in base if not x.get('name') or x['name'] not in names] + later


class Elements:
    def build(self):
        from convert import availability  # noqa: E402 (shared helper)
        self.availability = availability
        self.keywords()
        for key in self.bases():
            self.faction(key)
        self.mercenaries()
        self.glory()
        for key in self.variants():
            self.variant(key)
        self.patrons_()
        self.legal_lists()

    # ------------------------------------------------------------ keywords
    def keywords(self):
        for k in self.y['glossary']['keywords']:
            el = {'id': f"kw:{kw_slug(k['name'])}", 'name': k['name'], 'kind': KIND[k['kind']]}
            if kw_param(k['name']):
                el['param'] = kw_param(k['name'])
            el['text'] = k['text'].strip()
            aliases = [a for a, t in KW_ALIASES.items() if kw_slug(t) == kw_slug(k['name'])]
            if aliases:
                el['aliases'] = aliases
            self.add('core', 'keywords.json', el)

    # ------------------------------------------------------------ units, upgrades, lines
    def scope_units(self, ctx):
        """Units of these scopes and of every variant of a faction among them ("ELITE" expands to all of them)."""
        scopes = list(ctx) + [sc for sc in self.units if '/' in sc and sc.split('/')[0] in ctx and sc not in ctx]
        return [u for sc in scopes for u in self.units.get(sc, {}).values()]

    def unit_el(self, u, scope, owner, ctx, where):
        uid = f"unit:{scope}/{slug(u['name'])}"
        at = uid
        el = {'id': uid, 'owner': owner, 'name': u['name'], 'category': u['category'],
              'availability': self.availability(u.get('availability', 'any')),
              'cost': u.get('cost', 0), 'currency': u.get('currency', 'ducats'),
              'stats': {k: str(v) for k, v in (u.get('stats') or {}).items() if k in STAT_KEYS and v is not None},
              'keywords': [self.kwu(k, at) for k in u.get('keywords') or []],
              'abilities': [{'name': a['name'], 'text': (a.get('text') or '').strip()} for a in u.get('abilities') or []]}
        y = u.get('kit') or {}
        kit = {}
        if y.get('fixed'):
            kit['fixed'] = [i for i in (self.item(n, ctx, at) for n in y['fixed']) if i]
        if y.get('nothing_else'):
            kit['nothingElse'] = True
        if y.get('except'):
            kit['except'] = y['except']
        if y.get('hands'):
            kit['hands'] = y['hands']
        if y.get('loadouts'):
            kit['loadouts'] = [[[self.item(n, ctx, at) for n in s] if isinstance(s, list) else self.item(s, ctx, at)
                                for s in lo] for lo in y['loadouts']]
        if y.get('counts_as'):
            kit['countsAs'] = self.unit(y['counts_as'], ctx[1:], None) or self.unit(y['counts_as'], ctx, at)
        if 'recruit' in y:
            kit['recruit'] = y['recruit']
        if y.get('heavy_one_hand'):
            kit['heavyOneHand'] = y['heavy_one_hand']
        if y.get('items'):
            kit['items'] = {self.item(n, ctx, at): self.stipulations(s, ctx, at, []) for n, s in y['items'].items()}
        if y.get('limits'):
            kit['limits'] = self.limits(y['limits'], ctx, at)
        for n, p in (y.get('prices') or {}).items():  # this entry's own price for an armoury item
            cost, cur = (p['cost'], p.get('currency', 'ducats')) if isinstance(p, dict) else (p, 'ducats')
            self.prices[ctx[0]].append({'items': {'items': [self.item(n, ctx, at)]}, 'cost': cost,
                                        'currency': cur, 'who': {'units': [uid]}})
        if y.get('swap'):  # contract gap: no kit swap; nearest fit is an upgrade priced at the extra cost
            sw = y['swap']
            up = {'id': f"upgrade:{scope}/{slug(u['name'])}-{slug(sw['to'])}", 'owner': owner,
                  'name': f"{sw['to']} instead of {sw['from']}", 'cost': sw['extra'], 'currency': 'ducats',
                  'for': [uid], 'text': u.get('battlekit_note', '').strip() or f"Swap {sw['from']} for {sw['to']}."}
            self.add(where, 'upgrades.json', up)
            self.log['kit.swap written as an upgrade (contract gap)'].append(uid)
        self.unknown(y, 'fixed nothing_else except hands loadouts counts_as recruit heavy_one_hand items limits prices swap', at)
        el['kit'] = kit
        if u.get('hired_by') is not None:
            el['hiredBy'] = self.hired_by(u['hired_by'], uid)
        text = '\n\n'.join(x.strip() for x in (u.get('battlekit_note'), u.get('powers')) if x)
        if text:
            el['text'] = text
        if u.get('description'):
            el['lore'] = u['description'].strip()
        self.unknown(u, 'name category variant availability stats kit hired_by cost currency keywords abilities '
                        'battlekit_note powers description', at)
        return el

    def upgrade_el(self, u, scope, owner, ctx):
        uid = f"upgrade:{scope}/{slug(u['name'])}"
        el = {'id': uid, 'owner': owner, 'name': u['name']}
        if u.get('group'):
            el['group'] = u['group']
        kws = ([u['keyword']] if u.get('keyword') else []) + (u.get('keywords') or [])
        if kws:
            el['keywords'] = [self.kwu(k, uid) for k in kws]
        el['cost'] = u.get('cost', 0)
        el['currency'] = u.get('currency', 'ducats')
        if u.get('max') is not None:
            el['max'] = u['max']
        limits = self.limits(u.get('limits'), ctx, uid)
        units, other = [], {'keywords': [], 'upgrades': [], 'holding': []}
        for n in u.get('for') or []:
            if self.is_kw(n):
                other['keywords'].append(f'kw:{kw_slug(n)}')
            elif (x := self.unit(n, ctx, None)):
                units.append(x)
            elif (x := self.upgrade(n, ctx)):
                other['upgrades'].append(x)
            elif (x := self.item(n, ctx, None)):
                other['holding'].append(x)
            else:
                self.miss('upgrade for name', n, uid)
        other = {k: v for k, v in other.items() if v}
        if other:  # "ELITE only", "models with Fianna": a limit (any-of), so promoted or upgraded models stay eligible
            sels = ([{'units': units}] if units else []) + [
                {'holding': {'items': v}} if k == 'holding' else {k: v} for k, v in other.items()]
            limits.append({'text': f"{u['name']} is only for {' or '.join(map(str, u['for']))}"[:300], 'upgrades': [uid],
                           'max': 0, 'who': {'not': sels[0] if len(sels) == 1 else {'any': sels}}})
            units = []
        if units:
            el['for'] = units
        if u.get('hands'):
            el['hands'] = u['hands']
        if limits:
            el['limits'] = limits
        if u.get('text'):
            el['text'] = u['text'].strip()
        self.unknown(u, 'name keyword keywords group cost currency max for hands limits text', uid)
        return el

    def line_el(self, i, owner_path, owner, ctx, at_scope_units):
        s = slug(i['name'])
        lid = f'line:{owner_path}:{s}'
        el = {'id': lid, 'owner': owner, 'item': self.item(i['name'], ctx, lid),
              'cost': i.get('cost', 0), 'currency': i.get('currency', 'ducats')}
        if i.get('limit') is not None:
            el['limit'] = i['limit']
        st = self.stipulations(i.get('stipulations') or {}, ctx, lid, at_scope_units)
        if st:
            el['stipulations'] = st
        self.lines[owner_path][s] = lid
        return el

    def hired_by(self, h, at):
        o = {}
        if h.get('alignment'):
            o['alignment'] = h['alignment']
        ids = []
        for n in h.get('by') or []:
            if n.lower() in ('fallen', 'faithful'):
                o['alignment'] = n.lower()
                continue
            fid = self.fnames.get(slug(n))
            if not fid:
                self.miss('hired_by name', n, at)
            elif fid.split(':', 1)[1].split('/')[0] in self.cf_factions():
                self.hire_cf[fid].append(at)
            else:
                ids.append(fid)
        if ids:
            o['factions'] = ids
        return o

    def cf_factions(self):
        from convert import CF_FACTIONS
        return CF_FACTIONS

    # ------------------------------------------------------------ factions and variants
    def rules_common(self, r, ctx, at, scope):
        """The factionRules keys a pack sets, converted (names → ids)."""
        o = {}
        for a, b in (('start_ducats', 'startDucats'), ('start_glory', 'startGlory'), ('fireteams', 'fireteams')):
            if r.get(a) is not None:
                o[b] = r[a]
        if r.get('leader'):
            o['leader'] = self.unit(r['leader'], ctx, at)
        if r.get('caps'):
            o['caps'] = [{'unit': self.unit(c['name'], ctx, at), 'max': c['max'], 'name': c['name']} for c in r['caps']]
        if r.get('free_items'):
            o['freeItems'] = [self.item(n, ctx, at) for n in r['free_items']]
        if r.get('limits'):
            o['limits'] = self.limits(r['limits'], ctx, at)
        if r.get('prices'):
            o['prices'] = [self.price(p, ctx, at) for p in r['prices']]
        if r.get('patron'):
            o['patron'] = self.patrons.get(slug(r['patron'])) or self.miss('patron', r['patron'], at)
        return o

    def must(self, r, ctx, at, drop=()):
        out = []
        for m in r.get('must_include') or []:
            u = self.unit(m['name'], ctx, at)
            if u and u not in drop:
                out += [u] * int(m.get('n', 1))  # contract has no count: the id repeats n times
                if int(m.get('n', 1)) > 1:
                    self.log['mustInclude n>1 written as repeated ids'].append(f"{u} x{m['n']}")
        return out

    def excluded(self, names, ctx, at, fid):
        out = []
        for n in names or []:
            if slug(n) == 'mercenaries':
                out.append('faction:mercenaries')
                continue
            r = (self.unit(n, ctx, None) or self.upgrade(n, ctx) or self.line(n, [fid])
                 or self.unit(n, ['mercenaries'], None) or self.glory_line(n, fid))
            if r:
                out.append(r)
            else:
                self.miss('excluded name', n, at)
        return out

    def glory_line(self, n, fid):
        return self.lines.get(f'glory-items/{fid}', {}).get(slug(n))

    def faction(self, key):
        d, fid = self.y[key], key
        where, ctx, r = self.side(fid), [fid, 'mercenaries'], self.y[key].get('rules') or {}
        f = d['faction']
        for u in d.get('units') or []:
            self.add(where, 'units.json', self.unit_el(u, fid, f'faction:{fid}', ctx, where))
        for u in r.get('upgrades') or []:
            self.add(where, 'upgrades.json', self.upgrade_el(u, fid, f'faction:{fid}', ctx))
        su = self.scope_units(ctx)
        for i in d.get('armoury') or []:
            self.add(where, 'armoury-lines.json', self.line_el(i, fid, f'faction:{fid}', ctx, su))
        el = {'id': f'faction:{fid}', 'name': f['name'], 'alignment': f['alignment'],
              'startDucats': r.get('start_ducats', 0), 'startGlory': r.get('start_glory', 0)}
        rc = self.rules_common(r, ctx, el['id'], fid)
        rc.pop('startDucats', None), rc.pop('startGlory', None)
        el.update(rc)
        for c in el.get('caps', []):
            c.pop('name', None)
        if self.prices.get(fid):  # units' own kit prices join the faction's price rules
            el['prices'] = el.get('prices', []) + self.prices[fid]
        mi = self.must(r, ctx, el['id'])
        if mi:
            el['mustInclude'] = mi
        ex = self.excluded(r.get('excluded'), ctx, el['id'], fid)
        if ex:
            el['excluded'] = ex
        self.unknown(r, 'start_ducats start_glory excluded must_include leader optional caps free_items fireteams '
                        'upgrades limits prices patron requires_variant text', el['id'])
        if r.get('requires_variant'):  # Q63: the Sins stay variants; a Court warband must pick one
            el['requiresVariant'] = True
        if r.get('text'):
            el['text'] = r['text'].strip()
        if f.get('description'):
            el['lore'] = f['description'].strip()
        self.add(where, 'factions.json', el)
