# Contributing

How work moves from an idea to `main`. The architecture is the source of truth: when a change alters the structure,
the model in `architecture/` changes first, and the code follows it.

## Set-up

```sh
./scripts/dev-setup.sh     # app and atlas dependencies, git hooks (they print, never block)
./install_skills.sh        # agent skills (optional)
```

## The order of work

For every feature or fix that touches the structure (a new module, route, table, service, or a new dependency
between parts):

1. **Branch** from `main` (see Branches below).
2. **Read the map.** `architecture/MAP.md`, the feature's view in `architecture/features/` if it has one, or the
   site: `npm --prefix tools/atlas run serve`.
3. **Change the model first.** Describe the new or changed elements, relationships and the feature's flow in the
   `.c4` files. Commit it alone as `docs(arch): …`.
4. **Implement**, with tests.
5. **Update the architecture.** `npm --prefix tools/atlas run update` refreshes the generated part (routes,
   endpoints, tables) and `MAP.md`, then lists what still needs a decision in the model. Resolve the list until
   `npm --prefix tools/atlas run check` says the model and the code agree.
6. **Merge** into `main` with `git merge --no-ff`, message `merge: <branch> into main`.

A change inside one element (a bug fix, a tweak) needs no model change. Nothing blocks a commit, but
`atlas status` (also shown when switching branches and when an agent session starts) says when a branch changed
code without updating the model.

## Branches

[Conventional Branch](https://conventionalbranch.org): `<type>/<short-description>`, lowercase, words joined by
hyphens.

| Type | For |
|---|---|
| `feat` | a new feature |
| `fix` | a bug fix |
| `hotfix` | an urgent fix to what is deployed |
| `refactor` | a change that neither fixes nor adds |
| `docs` | documentation or the architecture model only |
| `test` | tests only |
| `chore` | tooling, dependencies, housekeeping |
| `ci` | pipelines |
| `release` | preparing a release, e.g. `release/v1.2.0` |

Examples: `feat/access-modes`, `fix/battle-zoom-out`, `docs/live-map-flow`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `<type>(<scope>): <description>`, imperative, lowercase
start, no trailing period, header up to 72 characters, body lines up to 100.

Types are the branch types above, plus `perf`, `build`, `style` and `revert`. **Scopes are the architecture's
parts and features**, so a commit points at its place on the map:

| Scope | Part of the model |
|---|---|
| `access`, `auth`, `requests` | access gate, accounts and sign-in, account requests |
| `campaign`, `muster`, `rounds`, `battles` | campaign and battles |
| `warbands`, `builder`, `rules`, `studio` | warbands, rules engine, Faction Studio |
| `map`, `fx`, `weather`, `lore` | live map, effects engine, map and weather |
| `live` | live snapshot and stream |
| `admin`, `ui` | admin console, components |
| `db`, `api`, `files`, `backup`, `audit` | stores, endpoints, uploads, backup, audit |
| `deploy`, `e2e`, `arch`, `atlas` | compose and scripts, end-to-end tests, the model, the atlas tool |

Breaking changes: `!` after the scope, and a `BREAKING CHANGE:` footer saying how to move on.

## Tests

- `cd app && npm test`: unit tests, next to their modules.
- `./scripts/e2e.sh`: sign-in and access, end to end, on a throwaway stack.
- `cd tools/atlas && npm test`: the architecture tool.
- `TESTING.md`: the manual pass on real devices.
