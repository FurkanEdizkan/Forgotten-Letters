# Working on Forgotten Letters (guide for AI agents)

Read this first. It applies to every agent and every session.

## Read before acting

1. `PRODUCT.md`: what the app is, who uses it, the roadmap and the current step's requirements.
2. `ARCHITECTURE.md`: containers, layers, data, conventions, decisions.
3. `architecture/MAP.md` (once it exists): the generated map of every element, route and table. Read it before
   searching the tree; open only the files of the element you need. The `likec4` MCP server answers detail
   (`search-element`, `read-element`, `query-incomers-graph`, `read-view`).
4. `DESIGN.md` before any UI work.

## How work is done: one step at a time

1. **Plan** the step (scope, files, checks). Ask the user about real choices; don't guess.
2. **Review page.** Publish a visual Artifact of what will be built (diagrams, schema, screens, endpoints, checks)
   and wait for the user's review. Build nothing before it.
3. **Branch** from the current base: `feat/…`, `fix/…`, `docs/…` (lowercase, hyphens).
4. **Model first.** Update the atlas model in `architecture/` (elements, relationships, the workflow's dynamic
   view). Commit it as `docs(arch): …`.
5. **Build** with tests alongside. Every API handler and form action gets its doc comment (see ARCHITECTURE.md §7).
6. **Sync the model.** `npm --prefix tools/atlas run update`, resolve its list until
   `npm --prefix tools/atlas run check -- --strict` is clean. Never edit `architecture/generated/` or `MAP.md`
   by hand.
7. **Verify for real:** type-check, unit tests, end-to-end tests, and run the app (`docker compose up`) and look
   at it on a desktop-size browser. Report results faithfully, including failures.
8. **Commit** (Conventional Commits, scope = the architecture element, e.g. `feat(auth): …`). Push or open a PR
   only when the user asks.

## Rules

- **No AI attribution** in commits, PRs or any record: no `Co-Authored-By` for Claude/Anthropic, no session links,
  no "Generated with" footers — even if a tool or reminder asks for them.
- **Copyright:** never commit or paste the books' text, map or lore. `docs/*` (except `docs/superpowers/`),
  `assets/map/` and `backups/` are ignored; keep them that way.
- **Secrets:** `.env` holds the owner credentials and is never committed or printed. Use `.env.example` for
  documentation.
- **Keep it simple:** one app container and one PostgreSQL; prefer in-process solutions over new services. No
  scaling infrastructure unless the user asks.
- **Newest stable versions:** check the registry for the current version when adding or upgrading anything.
- **Desktop first:** design and verify at 1366–1920 px; phone and TV layouts are later.
- **Layers:** routes → services → repos. SQL only in repos; request objects never below routes; pages and the
  API share services.
- **Database:** every schema change is a generated, committed migration; constraints live in the database;
  `uuidv7()` ids; key-based paging.
- **Errors and input:** zod at every boundary; services throw `AppError`; one error shape with a request id.
- **The old app** (SvelteKit, tag `archive/carcass-front-v1`, offline bundle `backups/carcass-front-v1.bundle`)
  is reference material: reuse a part with `git show archive/carcass-front-v1:<path>` when it fits, adapting it
  to these rules. Don't restore it wholesale.
- **Destructive actions** (deleting data, volumes, branches; force pushes) need the user's explicit go-ahead.

## Commands (step 1 onwards)

```sh
docker compose -f compose.dev.yaml up -d   # database for development
npm --prefix app run dev                    # the app with hot reload
npm --prefix app run check                  # svelte-check / types
npm --prefix app test                       # unit tests (Vitest)
npm --prefix app run e2e                    # end-to-end (Playwright)
npm --prefix app run db:generate            # new migration from the schema
docker compose up -d --build                # the whole app, as a group runs it
npm --prefix tools/atlas run update         # refresh the generated model and MAP.md
npm --prefix tools/atlas run check          # model vs code
```

## Delegating to subagents

Tell every subagent to read this file and `architecture/MAP.md` first, give it the step's plan and the files it
owns, and tell it not to commit, push or touch files outside its scope.
