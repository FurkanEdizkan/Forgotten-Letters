# design-sync (committed engine)

The Claude Design sync **engine** — the deterministic scripts and sub-skill guides used to
sync this repo's design system to a claude.ai/design design-system project.

- `package-build.mjs` / `package-capture.mjs` / `package-validate.mjs` / `resync.mjs` — the
  converter + verification pipeline.
- `lib/` — shared adapters.
- `non-storybook/SKILL.md`, `storybook/SKILL.md` — the shape-specific guides.

The top-level orchestration guide is delivered by the `/design-sync` slash command in the
Claude Code harness (not a file here). This directory is committed so re-syncs are
self-contained: the repo's sync **inputs** live in `.design-sync/` (config, previews,
conventions), and this is the engine that consumes them.

Re-sync (from repo root):

```sh
node skills/design-sync/resync.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --out ./ds-bundle \
  --remote .design-sync/.cache/remote-sync.json
```

See `.design-sync/NOTES.md` for repo-specific setup and re-sync risks.
