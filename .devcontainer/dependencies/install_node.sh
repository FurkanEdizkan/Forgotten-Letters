#!/bin/bash

set -e

echo "Installing Node.js and npm..."

# Install Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install pnpm
sudo npm install -g pnpm

echo "Node.js installed successfully!"
