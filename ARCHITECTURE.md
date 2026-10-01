# Architecture

The architecture lives as a model, not as prose: [LikeC4](https://likec4.dev) files in `architecture/`, checked
against the code by atlas (`tools/atlas`). This page says where to look and the rules the diagrams can't show.

## Where to look

| To | Open |
|---|---|
| See it drawn: landscape, each part, each feature's flow | `npm --prefix tools/atlas run serve` (or `run build`, then `architecture/site/index.html`) |
| Read it in a few kilobytes: every element, its files, its neighbours, every route | `architecture/MAP.md` |
| Ask it questions (agents) | the `likec4` MCP server in `.mcp.json` |
| Change it | the `.c4` files: `spec.c4` (vocabulary), `model/` (services, backend, frontend, database), `features/` (one flow each), `views.c4` |

`architecture/generated/` (routes, endpoints, tables) and `MAP.md` are written by `atlas update`; never edit them.
How the model and the code stay together is in `CONTRIBUTING.md` and `tools/atlas/README.md`.

## Rules the diagrams don't show

- **Routes call server modules.** A route queries the database itself only where no module owns that data yet.
- **`$lib/server` is server-only.** A component never imports it; pure modules in `lib/*` are shared and unit-tested.
- **The public snapshot is the only campaign view that leaves the server.** Vision cards and hidden progress never
  enter it.
- **Access is one decision.** `lib/server/access.ts` decides every request; `hooks.server.ts` carries it out.
- **Writes go through form actions** (`use:enhance`); JSON and streams live under `/api`.
- **Redis holds nothing durable.** Everything in it is rebuilt from Postgres.
- **Effects load only in the browser** (`lib/fx`).
