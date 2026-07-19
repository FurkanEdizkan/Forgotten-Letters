#!/bin/bash

set -e

echo "Installing common development tools..."

sudo apt-get update
sudo apt-get install -y \
    vim \
    tmux \
    htop \
    tree \
    jq \
    ripgrep \
    fd-find \
    bat \
    fzf \
    unzip \
    zip \
    tar \
    gzip \
    postgresql-client \
    net-tools \
    dnsutils \
    iputils-ping

# Symlinks for modern CLI tools
sudo ln -s /usr/bin/batcat /usr/local/bin/bat 2>/dev/null || true
sudo ln -s /usr/bin/fdfind /usr/local/bin/fd 2>/dev/null || true

echo "Common tools installed successfully!"
