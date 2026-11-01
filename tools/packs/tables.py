"""Campaign tables: the Trauma, Survival and Skill tables and the progression from docs/packs/campaign.yaml, and the
tables the packs lack (40-data-model §13), read at run time from the group's reference notes (docs/reference/*.md):
Threshold, scenario selection, Rulebook exploration, Carcass Front exploration, Vision cards, Hell on Earth weather.
No numbers live here: every row comes from those files."""
import collections
import re

from ids import slug
from convert import camel

KINDS = {'survival': 'survival', 'trauma': 'trauma'}


def md_table(path, heading):
    """The first markdown table after the heading that matches `heading` (a regex): header cells and row cells."""
    lines = path.read_text().splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith('#') and re.search(heading, l))
    rows = []
    for l in lines[start + 1:]:
        if l.startswith('#'):
            break
        if l.startswith('|'):
            rows.append([c.strip() for c in l.strip().strip('|').split('|')])
        elif rows:
            break
    head, body = rows[0], [r for r in rows[2:] if r]
    return head, body


def find_names(text, names):
    """Ids of the names mentioned in text, longest first, whole words only (Pistol is not in Automatic Pistol)."""
    cands = []
    for n, i in names:
        alts = {n, n.split('/')[0] if len(n.split('/')[0]) >= 8 else n, n.replace('-', ' '), n.replace(' Kit', "'s Kit")}
        cands += [(a, i) for a in alts]
    out = []
    for a, i in sorted(cands, key=lambda x: -len(x[0])):
        m = re.search(rf'(?<![\w-]){re.escape(a)}(?![\w-])', text, re.I)
        if m:
            text = text[:m.start()] + ' ' * len(a) + text[m.end():]
            if i not in out:
                out.append(i)
    return out


def plain(s):
    return re.sub(r'\*\*|`', '', s).strip()


class Tables:
    def __init__(self, packs, docs):
        self.p, self.ref = packs, docs / 'reference'

    def add(self, where, el):
        self.p.add(where, 'tables.json', el)

    def effects(self, e, at):
        o = {}
        for k, v in (e or {}).items():
            if k == 'keywords':
                v = [self.p.kwu(x, at) for x in v]
            elif k == 'remove_keywords':
                v = [self.p.kwid(x, at) for x in v]
            elif k == 'limits':
                v = self.p.limits(v, [], at)
            elif k == 'lose_kit' and isinstance(v, dict) and 'keywords' in v:
                v = {'keywords': [self.p.kwid(x, at) for x in v['keywords']]}
            o[camel(k)] = v
        return o

    def campaign(self):
        c = self.p.y['campaign']
        for t in c['tables']:
            tid = f"table:{t['id']}"
            rows = []
            for r in t['rows']:
                row = {'roll': str(r['roll']), 'name': r['name']}
                if r.get('text'):
                    row['text'] = r['text'].strip()
                if r.get('effects'):
                    row['effects'] = self.effects(r['effects'], f"{tid}#{r['roll']}")
                rows.append(row)
            self.add('core', {'id': tid, 'name': t['name'], 'kind': KINDS.get(t['id'], 'skill'),
                              'dice': t.get('dice'), 'rows': rows})
        pr = c['progression']
        at = pr['advancement_at']
        rows = [{'roll': str(x), 'name': f'Advancement at {x} XP', 'effects': {'advancement': True}} for x in at]
        # Q79 (approved default): after the last printed box, an advancement every 3 XP.
        rows.append({'roll': f'{at[-1]}+3n', 'name': 'Then every 3 XP', 'effects': {'advancement': True, 'every': 3,
                                                                                    'option': 'q79'}})
        rows.append({'roll': '-', 'name': 'Promotion', 'effects': {camel(k): v for k, v in pr['promotion'].items()}})
        rows.append({'roll': '-', 'name': 'Advancement Roll', 'effects': {camel(k): v for k, v in pr['advancement'].items()}})
        self.add('core', {'id': 'table:progression', 'name': 'Experience and Promotion', 'kind': 'progression', 'rows': rows})

    def threshold(self):
        _, body = md_table(self.ref / '06a-campaign-play.md', r'6\.3 Warband Threshold Table')
        rows, vals = [], []
        for g, duc, fs in body:
            duc, fs = int(plain(duc)), int(plain(fs))
            vals.append((duc, fs))
            rows.append({'roll': plain(g), 'name': f'Game {plain(g)}',
                         'effects': {'thresholdDucats': duc, 'fieldStrength': fs}})
        # Q78 (approved default): past the last row, keep the table's usual step per game.
        dd = collections.Counter(b[0] - a[0] for a, b in zip(vals, vals[1:])).most_common(1)[0][0]
        df = collections.Counter(b[1] - a[1] for a, b in zip(vals, vals[1:])).most_common(1)[0][0]
        rows.append({'roll': f'{len(vals) + 1}+', 'name': 'Each game past the table',
                     'effects': {'thresholdDucatsPerGame': dd, 'fieldStrengthPerGame': df, 'option': 'q78'}})
        self.add('core', {'id': 'table:threshold', 'name': 'Warband Threshold Table', 'kind': 'threshold', 'rows': rows})

    def scenario_select(self):
        head, body = md_table(self.ref / '05-scenarios.md', r'4\.2 Selecting a campaign scenario')
        scen = {slug(s['name']): s['id'] for s in self.p.out['core']['scenarios.json']}
        for col in range(1, len(head)):
            rows = []
            for r in body:
                name, sid = plain(r[col]), scen.get(slug(plain(r[col])))
                row = {'roll': plain(r[0]), 'name': name[:120]}
                if sid:
                    row['links'] = [sid]
                rows.append(row)
            self.add('core', {'id': f'table:scenario-selection/{slug(plain(head[col]))}',
                              'name': f'Campaign scenario: {plain(head[col])}'[:120], 'kind': 'other', 'dice': 'D6',
                              'rows': rows})

        m = re.search(r'\*\*Final Battle \(Battle (\d+)\):\*\* (?:The )?([^(\n]+?) \(', (self.ref / '05-scenarios.md').read_text())
        if m:
            sid = scen.get(slug(m[2])) or scen.get(slug('The ' + m[2]))
            row = {'roll': m[1], 'name': m[2]}
            if sid:
                row['links'] = [sid]
            self.add('core', {'id': 'table:scenario-selection/final-battle', 'name': 'Campaign scenario: Final Battle',
                              'kind': 'other', 'rows': [row]})

    def rows3(self, path, heading, links_from=None):
        _, body = md_table(path, heading)
        rows = []
        for r in body:
            row = {'roll': plain(r[0])[:20], 'name': plain(r[1])[:120]}
            if len(r) > 2:
                row['text'] = plain(' | '.join(r[2:]))
            if links_from:
                links = find_names(row['name'] + ' | ' + row.get('text', ''), links_from)
                if links:
                    row['links'] = links
            rows.append(row)
        return rows

    def item_names(self, where):
        return [(el['name'], el['id']) for el in self.p.out['core']['items.json']] + (
            [(el['name'], el['id']) for el in self.p.out['cf']['items.json']] if where == 'cf' else [])

    def exploration_rb(self):
        f = self.ref / '06b-exploration.md'
        self.add('core', {'id': 'table:exploration-dice', 'name': 'Exploration Dice', 'kind': 'other',
                          'rows': self.rows3(f, r'2\. Exploration Dice')})
        self.add('core', {'id': 'table:exploration-locations', 'name': 'Exploration Location Tables by games played',
                          'kind': 'other', 'rows': self.rows3(f, r'4\. Choosing the Location Table')})
        self.add('core', {'id': 'table:exploration-skills', 'name': 'Exploration Skills', 'kind': 'other',
                          'rows': [dict(r, roll='-') for r in self.skill_rows(f)]})
        names = self.item_names('core')
        for key, h in (('common', r'Common Exploration'), ('rare', r'Rare Exploration'), ('legendary', r'Legendary Exploration')):
            self.add('core', {'id': f'table:exploration-{key}', 'name': f'{key.title()} Exploration Location Table',
                              'kind': 'exploration', 'dice': 'Exploration Roll', 'rows': self.rows3(f, h, names)})

    def skill_rows(self, f):
        _, body = md_table(f, r'Exploration Skills')
        return [{'name': plain(r[0]), 'text': plain(r[1])} for r in body]

    def carcass_front(self):
        f, names = self.ref / '20-carcass-front-campaign.md', self.item_names('cf')
        for key in ('Favour', 'Relic', 'Supplies', 'Territories'):
            self.add('cf', {'id': f'table:carcass-front/{slug(key)}', 'name': f'{key} Exploration Table',
                            'kind': 'exploration', 'dice': '3D6', 'owner': None,
                            'rows': self.rows3(f, rf'17\.\d {key} Exploration Table', names)})
        g = self.ref / '22-carcass-front-cards-and-weather.md'
        head, body = md_table(g, r'1\. Vision cards')
        cvp = [int(m[1]) if (m := re.search(r'\((\d+) CVP\)', h)) else None for h in head]
        rows = []
        for r in body:
            tiers = [{'cvp': cvp[i], 'goal': plain(r[i])} for i in (2, 3, 4)]
            rows.append({'roll': plain(r[0]), 'name': plain(r[1]),
                         'text': '\n'.join(f"Tier {n} ({t['cvp']} CVP): {t['goal']}" for n, t in enumerate(tiers, 1)),
                         'effects': {'tiers': tiers}})
        self.add('cf', {'id': 'table:carcass-front/vision-cards', 'name': 'Vision Cards', 'kind': 'other', 'rows': rows})
        self.add('cf', {'id': 'table:carcass-front/hell-on-earth', 'name': 'Hell on Earth Weather Events', 'kind': 'other',
                        'dice': '2D6', 'rows': self.rows3(g, r'2\. Hell on Earth')})
        for el in self.p.out['cf']['tables.json']:
            if el.get('owner') is None:
                el.pop('owner', None)

    def all(self):
        self.campaign()
        self.threshold()
        self.scenario_select()
        self.exploration_rb()
        self.carcass_front()
        for w in ('core', 'cf'):
            for el in self.p.out[w]['tables.json']:
                if el.get('dice') is None:
                    el.pop('dice', None)

