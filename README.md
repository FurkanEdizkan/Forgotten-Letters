# Forgotten Letters

A campaign tracker for Trench Crusade's *Carcass Front*, starting over on 2026-10-03. The stack is not chosen yet;
the project is rebuilt step by step.

## What is kept

| Where | What |
|---|---|
| `assets/blender/` | The Blender scenes for the map effects and tokens, and the faction seals (`seals/`). |
| `assets/fx/` | The effect sprite sheets rendered from them (`.webp` + frame `.json`). |
| `assets/map/` | The campaign map extracted from the book (local only, never committed). |
| `docs/` | The books (`Trench Crusade/`, `Factions/`) and the rule packs read from them (`packs/`), local only; design specs in `superpowers/`. |
| `tools/atlas/` | The architecture atlas (LikeC4 model, map and checks). |
| `tools/blender-mcp/` | The Blender MCP bridge (see `.mcp.json`). |

## The first version

The whole first app (SvelteKit, Postgres, the live map, warband builder, rules editor) is in git history:

- `git checkout archive/carcass-front-v1` (its last state; `archive/carcass-front-v1-main` is its `main`);
- `git show archive/carcass-front-v1:<path>` for one file;
- `backups/carcass-front-v1.bundle` holds every branch, offline (`git clone backups/carcass-front-v1.bundle`).
