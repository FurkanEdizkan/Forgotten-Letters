# tools/packs: the local rules generator

Builds the rules folders the app mounts (`rules/<set>/`, format: `app/src/lib/rules/pack.ts`) from the group's own
notes. Inputs and outputs are git-ignored and hold book text: nothing here ships rules content.

| Input (git-ignored) | Used for |
| --- | --- |
| `docs/packs/*.yaml` | factions, variants, units, armouries, upgrades, Glory Items, Patrons, mercenaries, campaign tables, keywords, legal/illegal example lists |
| `docs/reference/*.md` | tables the packs lack: Threshold, scenario selection, Rulebook and Carcass Front exploration, Vision cards, Hell on Earth weather |
| `docs/Trench Crusade/**.pdf` | compendium pages and scenarios, extracted with poppler's `pdftohtml -xml` (`pages.py`) |
| `rules/_src/core-1.0.1.patch.yaml` | the 1.0.1 → 1.0.2 changes, reversed (book wording; optional) |

Output: `rules/core-1.0.2/`, `rules/carcass-front-1.0/` (an expansion on core-1.0.2), `rules/core-1.0.1/` (when the
patch exists), and `rules/_build-log.txt` (every name that did not resolve, every contract gap worked around, every
fix applied).

## Run

Needs Python 3 with PyYAML and poppler (`pdftohtml`, from the same package as `pdftotext`). From the repository (or a worktree):

```sh
python3 tools/packs/build.py                       # docs and rules of the main checkout
python3 tools/packs/build.py --docs <docs> --out <rules>
python3 tools/packs/ids.py                         # self-check of the id and keyword rules
```

Then check every folder against the contract (from `app/`, Node 24):

```sh
node --experimental-strip-types scripts/rules-check.ts ../rules/core-1.0.2 ../rules/carcass-front-1.0 ../rules/core-1.0.1
```

## Trench Companion Preview

`rules/tc-preview/` (an expansion on `carcass-front-1.0`) is not built here: `app/scripts/tc-preview.ts` lays
Trench Companion's own Official → Preview changes over our books' data. Its inputs are `docs/tc/*.json`
(git-ignored, saved from Trench Companion), its log `rules/_build-log-tc-preview.txt`.

```sh
npx tsx scripts/tc-preview.ts                                                   # from app/
node --experimental-strip-types scripts/rules-check.ts --allow-replace ../rules/tc-preview
```

## Files

| File | Does |
| --- | --- |
| `build.py` | runs everything, writes the folders and the log |
| `ids.py` | the id scheme (`slug`) and keyword uses (`+1 DICE` → `{kw: kw:dice, value: 1}`) |
| `convert.py` | loads the packs; pass 1 registers every name (items deduplicated by profile) |
| `refs.py` | name → id lookups; selectors, limits, prices, stipulations |
| `elements.py` | factions, units, upgrades, armoury lines, keywords |
| `overlays.py` | variants (overlays), mercenaries, Glory Item tables, Patrons, legal lists |
| `tables.py` | campaign tables from `campaign.yaml` and the reference notes |
| `fixes.py` | data fixes (40-data-model §13) and approved defaults (41-open-questions) |
| `v101.py` | applies the 1.0.1 reversal patch to a copy of core-1.0.2 |
| `pages.py` | rule text pages and scenarios from the PDFs |

## Ids

`slug` = ASCII, lowercase, apostrophes dropped, other runs of characters become `-`.
`faction:<id>`, `variant:<faction>/<variant>`, `unit:<faction>[/<variant>]/<unit>`, `unit:mercenaries/<unit>`,
`item:<name>` (a second profile under the same name: `item:<name>/<owner>`), `line:<owner path>:<item>` (owner path:
the faction, `<faction>/<variant>`, `mercenaries`, `glory-items/<faction>`, or an exploration table),
`kw:<glossary name without its parameter>`, `upgrade:<owner path>/<name>`, `patron:<name>`,
`skill:<patron>/<skill>`, `table:<name>`, `scenario:<name>`, `page:<section>/<title>`.
