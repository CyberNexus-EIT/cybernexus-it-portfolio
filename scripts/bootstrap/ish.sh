#!/bin/sh

# CyberNexus IT Portfolio
# File: bootstrap/ish.sh
# Purpose: iSH / Alpine Linux development environment bootstrap

set -eu

PROJECT_DIR="${CYBERNEXUS_PROJECT_DIR:-$HOME/cybernexus-it-portfolio}"

echo "=============================================="
echo " CyberNexus IT Portfolio"
echo " iSH / Alpine Linux Bootstrap"
echo "=============================================="
echo

# ------------------------------------------------
# Environment check
# ------------------------------------------------

if [ "$(uname -s 2>/dev/null || true)" != "Linux" ]; then
    echo "Error: This script requires a Linux-compatible environment."
    exit 1
fi

if ! command -v apk >/dev/null 2>&1; then
    echo "Error: apk was not found."
    echo "This script is intended for iSH / Alpine Linux."
    exit 1
fi

echo "[1/7] Updating Alpine package indexes..."
apk update

echo
echo "[2/7] Upgrading installed packages..."
apk upgrade

# ------------------------------------------------
# Base packages
# ------------------------------------------------

echo
echo "[3/7] Installing development packages..."

apk add \
    bash \
    coreutils \
    curl \
    wget \
    git \
    openssh \
    nano \
    neovim \
    zip \
    unzip \
    tar \
    gzip \
    grep \
    sed \
    findutils \
    which \
    file \
    procps \
    util-linux \
    tree \
    jq \
    openssl \
    ca-certificates \
    build-base \
    python3 \
    py3-pip \
    nodejs \
    npm \
    sqlite \
    sqlite-dev

# ------------------------------------------------
# Certificates
# ------------------------------------------------

echo
echo "[4/7] Updating CA certificates..."

if command -v update-ca-certificates >/dev/null 2>&1; then
    update-ca-certificates
fi

# ------------------------------------------------
# Project directories
# ------------------------------------------------

echo
echo "[5/7] Preparing CyberNexus project structure..."

mkdir -p "$PROJECT_DIR"

cd "$PROJECT_DIR"

mkdir -p \
    bootstrap \
    frontend \
    frontend/css \
    frontend/js \
    backend \
    database \
    infrastructure \
    security \
    reports

# ------------------------------------------------
# Project files
# ------------------------------------------------

echo
echo "[6/7] Creating missing project files..."

create_file() {
    file="$1"

    if [ ! -e "$file" ]; then
        touch "$file"
        echo "Created: $file"
    else
        echo "Exists:  $file"
    fi
}

# Bootstrap
create_file "bootstrap/windows.ps1"
create_file "bootstrap/macos.sh"
create_file "bootstrap/linux.sh"
create_file "bootstrap/termux.sh"
create_file "bootstrap/ish.sh"

# Frontend HTML
create_file "frontend/index.html"
create_file "frontend/portfolio.html"
create_file "frontend/projects.html"
create_file "frontend/skills.html"
create_file "frontend/experience.html"
create_file "frontend/contact.html"
create_file "frontend/privacy.html"
create_file "frontend/terms.html"

# Frontend CSS
create_file "frontend/css/theme.css"
create_file "frontend/css/typography.css"
create_file "frontend/css/spacing.css"
create_file "frontend/css

