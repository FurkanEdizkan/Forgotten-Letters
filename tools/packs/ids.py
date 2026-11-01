"""Ids and keyword uses: the naming scheme every generated rules folder follows (see app/src/lib/rules/pack.ts)."""
import re
import unicodedata


# Letters NFKD does not reduce to ASCII (Turkish dotless i, German sharp s, …): transliterate them first.
TRANSLIT = str.maketrans({'ı': 'i', 'İ': 'I', 'ß': 'ss', 'ẞ': 'SS', 'ø': 'o', 'Ø': 'O', 'æ': 'ae', 'Æ': 'AE',
                          'œ': 'oe', 'Œ': 'OE', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'þ': 'th', 'ð': 'd'})


def slug(s) -> str:
    """`Sultan’s Favour` → `sultans-favour`, `Yüzbaşı` → `yuzbasi`: ASCII, lowercase, apostrophes dropped,
    other runs become '-'."""
    s = unicodedata.normalize('NFKD', str(s).translate(TRANSLIT)).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r"['`]", '', s)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def kw_slug(name: str) -> str:
    """A glossary name without its parameter: `AUTOMATIC (X)` → `automatic`, `+/- DICE` → `dice`."""
    name = re.sub(r'\(.*?\)|\[.*?\]|\+/-', ' ', name)
    return slug(name)


# Old spellings that name the same keyword (Q2: one key, aliases beside it).
KW_ALIASES = {
    'ARMOUR-PIERCING': 'ARMOUR PIERCING',
    'IGNORES COVER': 'IGNORE COVER',
    'IGNORE OFF-HAND': 'IGNORE OFF-HAND WEAPON',
}
# Keywords that take another keyword or a modifier as their value.
PREFIXED = ('NEGATE', 'IGNORE')
OWN = {'IGNORE ARMOUR'}


def kw_use(text: str, known: set[str], miss=None) -> dict:
    """`+1 DICE` → {kw: kw:dice, value: 1}; `NEGATE FEAR` → {kw: kw:negate, value: kw:fear}; `BLAST 3"` → value '3"'."""
    s = KW_ALIASES.get(text.strip(), text.strip())

    def ref(name):
        k = kw_slug(name)
        if k not in known and miss is not None:
            miss(name)
        return f'kw:{k}'

    m = re.fullmatch(r'([+-]\d+) (DICE|INJURY DICE|INJURY MODIFIER)', s)
    if m:
        return {'kw': ref(m[2]), 'value': int(m[1])}
    m = re.fullmatch(r'AMMUNITION \((.+)\)', s)
    if m:
        inner = KW_ALIASES.get(m[1], m[1])
        return {'kw': ref('AMMUNITION'), 'value': f'kw:{kw_slug(inner)}' if kw_slug(inner) in known else inner}
    head, _, rest = s.partition(' ')
    if head in PREFIXED and rest and s not in OWN:
        if head == 'NEGATE':
            return {'kw': ref(head), 'value': ref(rest)}
        return {'kw': ref(head), 'value': rest}
    m = re.fullmatch(r'(.+?) (\d+)(")?', s)
    if m:
        return {'kw': ref(m[1]), 'value': f'{m[2]}"' if m[3] else int(m[2])}
    return {'kw': ref(s)}


def kw_param(name: str):
    if '(X")' in name:
        return 'X"'
    if '(X)' in name or '+/-' in name:
        return 'X'
    if '[' in name or '(KEYWORD)' in name:
        return 'keyword'
    return None


if __name__ == '__main__':
    k = {'dice', 'negate', 'fear', 'blast', 'automatic', 'ammunition', 'critical', 'ignore', 'ignore-armour'}
    assert slug('Sultan’s Favour') == 'sultans-favour'
    assert slug('Yüzbaşı') == 'yuzbasi' and slug('Güreş') == 'gures' and slug('Straße') == 'strasse'
    assert slug("Fida'i of Alamut – The Cabal") == 'fidai-of-alamut-the-cabal'
    assert kw_slug('AUTOMATIC (X)') == 'automatic' and kw_slug('+/- INJURY DICE') == 'injury-dice'
    assert kw_use('+1 DICE', k) == {'kw': 'kw:dice', 'value': 1}
    assert kw_use('NEGATE FEAR', k) == {'kw': 'kw:negate', 'value': 'kw:fear'}
    assert kw_use('BLAST 3"', k) == {'kw': 'kw:blast', 'value': '3"'}
    assert kw_use('AUTOMATIC 2', k) == {'kw': 'kw:automatic', 'value': 2}
    assert kw_use('AMMUNITION (CRITICAL)', k) == {'kw': 'kw:ammunition', 'value': 'kw:critical'}
    assert kw_use('AMMUNITION (+1 DICE)', k) == {'kw': 'kw:ammunition', 'value': '+1 DICE'}
    assert kw_use('IGNORES COVER', k) == {'kw': 'kw:ignore', 'value': 'COVER'}
    assert kw_use('IGNORE ARMOUR', k) == {'kw': 'kw:ignore-armour'}
    print('ok')
