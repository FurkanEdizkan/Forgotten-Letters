#!/usr/bin/env bash
# Download the project's agent skills listed in skills-lock.json (the skills themselves aren't in git),
# then link them where Claude Code looks for them.
#
#   ./install_skills.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v npx >/dev/null || { echo "Node.js (npx) is required." >&2; exit 1; }

npx -y skills experimental_install </dev/null

mkdir -p .claude/skills
for dir in .agents/skills/*/; do
	name="$(basename "$dir")"
	[[ -e ".claude/skills/$name" ]] || ln -s "../../.agents/skills/$name" ".claude/skills/$name"
done
echo "Installed $(ls .agents/skills | wc -l) skills into .agents/skills (linked into .claude/skills)."
