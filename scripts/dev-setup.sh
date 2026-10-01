#!/usr/bin/env bash
# One-time set-up for working on the project: the app's dependencies, the architecture tool (atlas, with LikeC4
# for the site and the MCP server), and the git hooks in scripts/hooks (they only print, never block).
#
#   ./scripts/dev-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
(cd app && npm ci)
(cd tools/atlas && npm ci)
git config core.hooksPath scripts/hooks
echo "Ready. The architecture: architecture/MAP.md, or the site with: npm --prefix tools/atlas run serve"
