"""Build core-1.0.1 from core-1.0.2: apply the reversal patch (rules/_src/core-1.0.1.patch.yaml, git-ignored, it
holds book wording). Strict: every op that does not match goes to `failed`, never silently skipped."""
import copy

import yaml


def at_path(el, path):
    *head, last = path.split('.')
    for k in head:
        el = el.setdefault(k, {})
    return el, last


def apply(files: dict, patch_path):
    """files: {file name: [elements]} (deep-copied here). Returns (files, manifest overrides, failed, done)."""
    files = copy.deepcopy(files)
    patch = yaml.safe_load(patch_path.read_text())
    failed, done = [], 0
    for c in (patch.get('changes') or []) + (patch.get('extraChanges') or []):
        row, file = c.get('row', '?'), c.get('file')
        lst = files.setdefault(file, [])
        if 'add' in c:
            lst.append(c['add'])
            done += 1
            continue
        el = next((e for e in lst if e.get('id') == c.get('id')), None)
        owner = None
        if el is None:  # a Patron's skill lives inside its patron
            for e in lst:
                el = next((s for s in e.get('skills', []) if s.get('id') == c.get('id')), None)
                if el:
                    owner = e
                    break
        if el is None:
            failed.append(f"{row}: no {c.get('id')} in {file}")
            continue
        if c.get('remove'):
            (owner['skills'] if owner else lst).remove(el)
            done += 1
            continue
        if 'row_roll' in c:
            r = next((r for r in el['rows'] if r['roll'] == str(c['row_roll'])), None)
            if r is None:
                failed.append(f"{row}: no row {c['row_roll']} in {c['id']}")
                continue
            el = r
        ok = True
        for path, v in (c.get('set') or {}).items():
            obj, k = at_path(el, path)
            obj[k] = v
        for kw in c.get('addKeywords') or []:
            el.setdefault('keywords', []).append(kw)
        for d in c.get('dropKeywords') or []:
            kid, _, val = str(d).partition('=')
            keep = [k for k in el.get('keywords', []) if not (k['kw'] == kid and (not val or str(k.get('value')) == val))]
            if len(keep) == len(el.get('keywords', [])):
                failed.append(f"{row}: {c['id']} has no keyword {d}")
                ok = False
            el['keywords'] = keep
        for a in c.get('addAbilities') or []:
            el.setdefault('abilities', []).append({'name': a['name'], 'text': a['text']})
        for n in c.get('dropAbilities') or []:
            keep = [a for a in el.get('abilities', []) if a['name'] != n]
            if len(keep) == len(el.get('abilities', [])):
                failed.append(f"{row}: {c['id']} has no ability {n}")
                ok = False
            el['abilities'] = keep
        for a in c.get('setAbility') or []:
            ab = next((x for x in el.get('abilities', []) if x['name'] == a['name']), None)
            if ab is None:
                failed.append(f"{row}: {c['id']} has no ability {a['name']}")
                ok = False
                continue
            ab['text'] = a.get('text', ab['text'])
            if a.get('rename'):
                ab['name'] = a['rename']
        for t in c.get('replaceText') or []:
            obj, k = at_path(el, t['path'])
            if t['from'] not in str(obj.get(k, '')):
                failed.append(f"{row}: {c['id']}.{t['path']} lacks the 1.0.2 text")
                ok = False
                continue
            obj[k] = obj[k].replace(t['from'], t['to'])
        done += ok
    for c in patch.get('legalLists') or []:  # 1.0.2 example lists rewritten to a 1.0.1 rule
        lst = [x for x in files.get('legal-lists.json', []) if x['target'] == c['target'] and x['name'] == c['name']]
        if not lst:
            failed.append(f"legal list not found: {c['target']} {c['name']}")
            continue
        for x in lst:
            if c.get('remove'):
                files['legal-lists.json'].remove(x)
                continue
            x.update(c.get('set') or {})
            for k in c.get('unset') or []:
                x.pop(k, None)
        done += 1
    return files, patch.get('manifest') or {}, failed, done, patch.get('notReversed') or []
