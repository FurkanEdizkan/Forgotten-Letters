#!/usr/bin/env bash
# Compile the app's Tailwind v4 utility classes + @theme tokens into a static
# stylesheet for design-sync (cfg.cssEntry). The DS ships utility-class CSS that
# is normally JIT-compiled by Next; this produces a self-contained equivalent.
# Re-run on every re-sync (wired as cfg.buildCmd). Output is gitignored (.cache).
set -euo pipefail
cd "$(dirname "$0")/.."
# The DS is the repo itself, not an installed package. The converter uses
# PKG_DIR = node_modules/<pkg>, so give it a CLEAN package root exposing
# package.json + src (via symlink) but NOT node_modules — a self-symlink to the
# repo root would make the .d.ts descendant scan loop forever. Synth-entry mode
# then discovers components from src/. Recreated here so re-sync is automatic.
PKGROOT=".ds-sync/pkgroot"
mkdir -p "$PKGROOT"
printf '{"name":"forgotten-letters","version":"0.1.0"}\n' > "$PKGROOT/package.json"
ln -sfn "$(pwd)/src" "$PKGROOT/src"
ln -sfn "../.ds-sync/pkgroot" node_modules/forgotten-letters
mkdir -p .design-sync/.cache
node .ds-sync/node_modules/.bin/tailwindcss \
  -i src/app/globals.css -o .design-sync/.cache/_tw-raw.css --minify
# Final stylesheet lives INSIDE pkgroot: the converter resolves cfg.cssEntry
# relative to PKG_DIR (node_modules/<pkg> -> pkgroot) and rejects paths outside it.
cat .design-sync/fonts-header.css .design-sync/.cache/_tw-raw.css \
  > "$PKGROOT/compiled.css"
echo "compiled.css: $(wc -c < "$PKGROOT/compiled.css") bytes"
