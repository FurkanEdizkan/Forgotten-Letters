#!/bin/bash
set -e

# Ensure workspace ownership
if [ -d /workspace ]; then
  sudo chown -R developer:developer /workspace 2>/dev/null || true
fi

# Install project dependencies if package.json exists
if [ -f /workspace/package.json ]; then
  echo "📦 Installing project dependencies..."
  cd /workspace && npm install
fi

exec "$@"