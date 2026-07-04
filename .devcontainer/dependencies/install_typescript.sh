#!/bin/bash

set -e

echo "Installing TypeScript and related tools..."

# Global TS tools (project-level linting/formatting via npm deps)
sudo npm install -g typescript ts-node tsx

# Verify installation
tsc --version

echo "TypeScript installed successfully!"
