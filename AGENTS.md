# Working on Carcass Front (for agents)

**Rule: read `architecture/MAP.md` before you search or open any code.** It is cheaper than grepping and tells you
which files matter. Search the tree only for what the map doesn't answer.

**Start from the map, not the tree.** `architecture/MAP.md` names every part of the system, the files each part is
made of, what it uses and what uses it, every route, and each feature's flow, in a few thousand tokens. Find
the element there, then open only its files. For more detail, query the `likec4` MCP server (`search-element`,
`read-element`, `query-incomers-graph`, `query-outgoers-graph`, `read-view`).

**Architecture first.** Follow `CONTRIBUTING.md`:
1. Read the map, and the feature's view in `architecture/features/`.
2. When the change alters the structure, update the `.c4` model first.
3. Implement.
4. Run `npm --prefix tools/atlas run update` and resolve every item it lists in the model, until
   `npm --prefix tools/atlas run check` says the model and the code agree.

Never edit `architecture/generated/` or `MAP.md` by hand; `update` writes them.

**If a session starts with "Architecture behind on <branch>"**, this branch changed code the model doesn't
reflect yet. Update the model and run `update` before changing more code.

**Conventions:** branches and commits as in `CONTRIBUTING.md` (Conventional Branch and Commits, with the
architecture's parts as scopes). Commit only when asked. Never commit copyrighted material (the books' map, rules
or lore): see `.gitignore`.
