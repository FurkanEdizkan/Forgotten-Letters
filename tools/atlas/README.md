# atlas

A living architecture: a [LikeC4](https://likec4.dev) model of a codebase, kept honest against the code, with a
compact map for people and coding agents.

- **You design** in LikeC4 `.c4` files: elements (services, modules, page groups), relationships, and one dynamic
  view per feature with its decisions.
- **atlas reads the code** (imports, SvelteKit routes and actions, Drizzle tables, compose services), writes the
  mechanical part of the model (one element per route, endpoint and table), and tells you where the model and the
  code disagree.
- **Everyone reads `MAP.md`**: every element with its files, neighbours and routes, and every feature's flow, in a
  few thousand tokens. An agent finds its way there instead of searching the tree.

Nothing here is specific to one project: the project supplies `atlas.config.json`.

## Install

Node 22.22 or later (TypeScript runs as is; no build step).

```sh
cd tools/atlas && npm ci
```

## Configure: `atlas.config.json` at the project root

```json
{
  "model": "architecture",
  "title": "My app architecture",
  "base": "main",
  "extract": {
    "imports": ["src/**/*.ts", "src/**/*.svelte"],
    "alias": { "$lib": "src/lib" },
    "sveltekit": "src/routes",
    "drizzle": "src/lib/server/db/schema.ts",
    "compose": "compose.yaml"
  }
}
```

Every extractor is optional. Paths are relative to the project root.

## Link the model to the code

Elements say what they are made of, in metadata:

```
auth = module 'Accounts and sign-in' {
  description 'Sessions and cookies, the sign-in doors, hashing.'
  metadata {
    code 'src/lib/server/{auth,signin,passwords}{,.spec}.ts'   // a path, a glob, or a list
  }
}
accounts = layer 'Accounts' {
  metadata { tables ['user', 'session'] }                    // Drizzle tables it groups
}
db = store 'PostgreSQL' {
  metadata { services ['db', 'pgdata'] }                     // compose services and volumes it is
}
```

A file belongs to the element with the most specific matching pattern (a file path beats a glob; a longer glob
beats a shorter one).

## Commands

```sh
atlas update          # refresh generated/*.c4, MAP.md and map.json; list what the model still needs (.atlas/todo.md)
atlas check           # where the model and the code disagree (--strict: exit 1 if they do)
atlas status          # has this branch changed code without changing the model? (--brief: one line, or nothing)
atlas map             # rewrite MAP.md and map.json only
atlas extract         # write the code facts to <model>/.atlas/facts.json
atlas serve | build   # the LikeC4 site: live, or static (hash routing; opens from disk)
```

`npm run <command>` works from this folder; `npm --prefix tools/atlas run <command>` from the project root.

### What `check` reports

| Issue | Means | Fix in the model |
|---|---|---|
| unowned file | code no element's `code` covers | add it to an element, or describe a new one |
| missing code | a `code` pattern that matches nothing | moved, renamed or deleted: fix the pattern |
| unmodelled import | element A imports from element B, with no relationship between them (or their parents) | add `A -> B 'what for'` |
| unmodelled table / service | a table in no group, a compose service or volume in no element | list it in `tables` / `services` |
| undocumented handler | an exported `+server` method or a form action with no doc comment (summary and `Who:` at least) | in the code: add the comment (see below) |

Imports from route files are not reported: `update` writes them as generated relationships.

### Tables in Postgres schemas

Both `pgTable('user', …)` and tables in a schema are read: `const auth = pgSchema('auth')` then
`auth.table('users', …)` in the same file gives the table `users` (its `schema`, `auth`, is kept in the facts). List
it in `tables` by the name as written: `tables ['users']`.

### Handler doc comments

The JSDoc block directly above each exported handler in `+server.ts` (`export const GET`, `export async function
POST`, … any of GET POST PUT PATCH DELETE HEAD OPTIONS) and above each form action key in `+page.server.ts`
(`export const actions = { name: async (…) => … }`) documents it:

```ts
/**
 * One-line summary of what it does.
 * Who: who may call it.
 * In: input shape.
 * Out: output.
 * Errors: error statuses and codes.
 */
export const POST: RequestHandler = async (event) => { … };
```

Lines without a tag continue the summary or the tag above them. The facts keep it per route as `docs` (keyed `GET`,
`action:default`, …); the generated page or endpoint element lists each documented handler in its description, and
MAP.md puts each summary beside its method or action. `check` reports a handler without a summary and a `Who:`
line.

### Generated vs curated

`update` reads the curated model alone (the `.c4` files outside `generated/`), then writes `generated/routes.c4`
and `generated/tables.c4` from the code: each route folder becomes a `page` or `endpoint` element (with its
methods and form actions) under the curated element that owns its files, with an `imports` relationship to each
curated element it uses; each table becomes a `table` element under its group. Commit both: a pull request then
shows how it changes the architecture.

### Branch status

`status` compares the branch with `base` (committed, staged, unstaged and untracked files). If code changed and no
curated `.c4` file did, it names the elements whose code changed, the files no element owns, and the feature views
that walk through them. Use it in a session-start hook or a `post-checkout` git hook; it never blocks.

## For agents

- Read `MAP.md` first; open only the files of the element you need.
- Ask the LikeC4 MCP server (`likec4 mcp <model dir>`) for detail: `search-element`, `read-element`,
  `query-incomers-graph`, `read-view`.
- After changing structure: update the `.c4` files, run `atlas update`, resolve its list.

## Required element kinds

Generated elements use the kinds `page`, `endpoint` and `table`, and the relationship kind `imports`: declare them
in your `specification`.

## Test

```sh
npm test
```
