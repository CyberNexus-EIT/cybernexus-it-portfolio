#!/data/data/com.termux/files/usr/bin/bash

# CyberNexus IT Portfolio
# File: bootstrap/termux.sh
# Purpose: Android / Termux development environment bootstrap
# Project: IT Portfolio
# Brand/Company/Firm: CyberNexus PH
# DevSecOps Engineer: Mark C. Pangilinan

set -Eeuo pipefail

PROJECT_NAME="cybernexus-it-portfolio"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

log() {
    printf '\n[CyberNexus] %s\n' "$*"
}

warn() {
    printf '\n[WARNING] %s\n' "$*" >&2
}

fail() {
    printf '\n[ERROR] %s\n' "$*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

package_installed() {
    dpkg-query -W -f='${Status}' "$1" 2>/dev/null \
        | grep -q 'install ok installed'
}

install_package() {
    local package="$1"

    if package_installed "$package"; then
        log "Already installed: ${package}"
        return 0
    fi

    log "Installing: ${package}"
    pkg install -y "$package"
}

ensure_directory() {
    local directory="$1"

    if [[ -d "$directory" ]]; then
        log "Directory exists: ${directory}"
    else
        mkdir -p "$directory"
        log "Created directory: ${directory}"
    fi
}

ensure_file() {
    local file="$1"

    if [[ -e "$file" ]]; then
        log "File exists: ${file}"
    else
        touch "$file"
        log "Created file: ${file}"
    fi
}

check_termux() {
    if [[ -z "${PREFIX:-}" ]]; then
        fail "This script must run inside Termux."
    fi

    if [[ ! -d "$PREFIX" ]]; then
        fail "Termux PREFIX directory was not detected."
    fi

    log "Termux environment detected."
}

update_packages() {
    log "Updating Termux package information."

    pkg update -y

    log "Upgrading installed Termux packages."

    pkg upgrade -y
}

install_base_tools() {
    log "Installing base development tools."

    local packages=(
        bash
        coreutils
        curl
        wget
        git
        openssh
        nano
        neovim
        zip
        unzip
        tar
        gzip
        grep
        sed
        findutils
        which
        file
        procps
        util-linux
        tree
        jq
        openssl
        ca-certificates
        clang
        make
        pkg-config
        python
        nodejs
        sqlite
    )

    local package

    for package in "${packages[@]}"; do
        install_package "$package"
    done
}

configure_storage() {
    if command_exists termux-setup-storage; then
        log "Checking Termux shared-storage access."

        if [[ ! -d "${HOME}/storage" ]]; then
            log "Requesting Termux storage permission."
            termux-setup-storage || warn "Storage permission was not granted."
        else
            log "Termux storage access already exists."
        fi
    else
        warn "termux-setup-storage is unavailable."
    fi
}

configure_git() {
    if command_exists git; then
        log "Git detected."

        git config --global init.defaultBranch main 2>/dev/null || true
        git config --global core.autocrlf input 2>/dev/null || true
    fi
}

configure_npm() {
    if ! command_exists npm; then
        warn "npm was not found after Node.js installation."
        return 0
    fi

    log "npm detected: $(npm --version)"
    log "Node.js detected: $(node --version)"
}

configure_python() {
    if ! command_exists python; then
        warn "Python was not found after installation."
        return 0
    fi

    log "Python detected: $(python --version 2>&1)"

    python -m ensurepip --upgrade >/dev/null 2>&1 || true
}

create_project_structure() {
    log "Checking CyberNexus project structure."

    local directories=(
        "${PROJECT_ROOT}/bootstrap"
        "${PROJECT_ROOT}/frontend"
        "${PROJECT_ROOT}/frontend/css"
        "${PROJECT_ROOT}/frontend/js"
        "${PROJECT_ROOT}/backend"
        "${PROJECT_ROOT}/database"
        "${PROJECT_ROOT}/infrastructure"
        "${PROJECT_ROOT}/security"
        "${PROJECT_ROOT}/reports"
    )

    local directory

    for directory in "${directories[@]}"; do
        ensure_directory "$directory"
    done

    # Native mobile folders are intentionally not created here.
    # They should only exist once they contain multiple implementation files.
}

create_required_files() {
    log "Checking required project files."

    local files=(
        "${PROJECT_ROOT}/bootstrap/windows.ps1"
        "${PROJECT_ROOT}/bootstrap/macos.sh"
        "${PROJECT_ROOT}/bootstrap/linux.sh"
        "${PROJECT_ROOT}/bootstrap/termux.sh"
        "${PROJECT_ROOT}/bootstrap/ish.sh"

        "${PROJECT_ROOT}/frontend/index.html"
        "${PROJECT_ROOT}/frontend/portfolio.html"
        "${PROJECT_ROOT}/frontend/projects.html"
        "${PROJECT_ROOT}/frontend/skills.html"
        "${PROJECT_ROOT}/frontend/experience.html"
        "${PROJECT_ROOT}/frontend/contact.html"
        "${PROJECT_ROOT}/frontend/privacy.html"
        "${PROJECT_ROOT}/frontend/terms.html"

        "${PROJECT_ROOT}/frontend/css/theme.css"
        "${PROJECT_ROOT}/frontend/css/typography.css"
        "${PROJECT_ROOT}/frontend/css/spacing.css"
        "${PROJECT_ROOT}/frontend/css/layout.css"
        "${PROJECT_ROOT}/frontend/css/style.css"
        "${PROJECT_ROOT}/frontend/css/responsive.css"

        "${PROJECT_ROOT}/frontend/js/state.js"
        "${PROJECT_ROOT}/frontend/js/http-user.js"
        "${PROJECT_ROOT}/frontend/js/api-user.js"
        "${PROJECT_ROOT}/frontend/js/auth-user.js"
        "${PROJECT_ROOT}/frontend/js/account-user.js"
        "${PROJECT_ROOT}/frontend/js/web-app.js"
        "${PROJECT_ROOT}/frontend/js/chat.js"
        "${PROJECT_ROOT}/frontend/js/voice.js"

        "${PROJECT_ROOT}/backend/backend.py"
        "${PROJECT_ROOT}/backend/session.py"
        "${PROJECT_ROOT}/backend/ai.py"
        "${PROJECT_ROOT}/backend/automation.py"
        "${PROJECT_ROOT}/backend/main-script.py"

        "${PROJECT_ROOT}/database/schema.sql"
        "${PROJECT_ROOT}/database/data.sql"
        "${PROJECT_ROOT}/database/query.sql"

        "${PROJECT_ROOT}/infrastructure/Caddyfile"
        "${PROJECT_ROOT}/infrastructure/main.tf"
        "${PROJECT_ROOT}/infrastructure/deployment.yaml"

        "${PROJECT_ROOT}/security/eslint.config.js"
        "${PROJECT_ROOT}/security/semgrep.yml"
        "${PROJECT_ROOT}/security/gitleaks.toml"

        "${PROJECT_ROOT}/reports/print.ps"
        "${PROJECT_ROOT}/reports/transform.xsl"

        "${PROJECT_ROOT}/core.c"
        "${PROJECT_ROOT}/types.ts"
        "${PROJECT_ROOT}/render.yaml"
        "${PROJECT_ROOT}/run.sh"
        "${PROJECT_ROOT}/task.sh"
    )

    local file

    for file in "${files[@]}"; do
        ensure_file "$file"
    done
}

set_script_permissions() {
    log "Setting executable permissions."

    chmod +x "${PROJECT_ROOT}/run.sh" 2>/dev/null || true
    chmod +x "${PROJECT_ROOT}/task.sh" 2>/dev/null || true

    find "${PROJECT_ROOT}/bootstrap" \
        -type f \
        -name '*.sh' \
        -exec chmod +x {} \; 2>/dev/null || true
}

initialize_git() {
    if ! command_exists git; then
        warn "Git is unavailable."
        return 0
    fi

    if [[ -d "${PROJECT_ROOT}/.git" ]]; then
        log "Git repository already initialized."
        return 0
    fi

    log "Initializing Git repository."

    git -C "$PROJECT_ROOT" init -b main
}

check_versions() {
    log "CyberNexus development environment."

    printf '\n%-16s %s\n' "Termux" "${PREFIX:-unknown}"

    if command_exists bash; then
        printf '%-16s %s\n' "Bash" "$(bash --version | head -n 1)"
    fi

    if command_exists git; then
        printf '%-16s %s\n' "Git" "$(git --version)"
    fi

    if command_exists nvim; then
        printf '%-16s %s\n' "Neovim" "$(nvim --version | head -n 1)"
    fi

    if command_exists python; then
        printf '%-16s %s\n' "Python" "$(python --version 2>&1)"
    fi

    if command_exists node; then
        printf '%-16s %s\n' "Node.js" "$(node --version)"
    fi

    if command_exists npm; then
        printf '%-16s %s\n' "npm" "$(npm --version)"
    fi

    if command_exists sqlite3; then
        printf '%-16s %s\n' "SQLite" "$(sqlite3 --version | awk '{print $1}')"
    fi

    if command_exists curl; then
        printf '%-16s %s\n' "cURL" "$(curl --version | head -n 1)"
    fi

    if command_exists ssh; then
        printf '%-16s %s\n' "OpenSSH" "$(ssh -V 2>&1)"
    fi
}

print_summary() {
    printf '\n'
    printf '%s\n' '============================================================'
    printf '%s\n' ' CyberNexus IT Portfolio - Termux Bootstrap Complete'
    printf '%s\n' '============================================================'
    printf '\n'
    printf 'Project root:\n  %s\n' "$PROJECT_ROOT"
    printf '\n'
    printf 'Environment:\n'
    printf '  Android → Termux → CyberNexus development environment\n'
    printf '\n'
    printf 'Primary tools:\n'
    printf '  Git, OpenSSH, Neovim, Python, Node.js, npm, SQLite, cURL\n'
    printf '\n'
    printf 'Next development command:\n'
    printf '  cd "%s"\n' "$PROJECT_ROOT"
    printf '\n'
    printf 'Then inspect the project:\n'
    printf '  tree\n'
    printf '\n'
}

main() {
    log "Starting ${PROJECT_NAME} Termux bootstrap."

    check_termux
    update_packages
    install_base_tools
    configure_storage
    configure_git
    configure_npm
    configure_python
    create_project_structure
    create_required_files
    set_script_permissions
    initialize_git
    check_versions
    print_summary
}

main "$@"

