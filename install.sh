#!/usr/bin/env bash
# Einrichtungsskript für Dienstplaner (macOS)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$SCRIPT_DIR/backend"
FRONTEND="$SCRIPT_DIR/frontend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
step() { echo -e "\n${YELLOW}▶${NC} $*"; }

# ── Voraussetzungen ────────────────────────────────────────────────────────────

step "Prüfe Voraussetzungen..."

if [[ "$(uname)" != "Darwin" ]]; then
  fail "Dieses Skript ist nur für macOS."
fi

if ! command -v node &>/dev/null; then
  fail "Node.js nicht gefunden. Bitte installieren: https://nodejs.org"
fi
NODE_VER=$(node --version)
ok "Node.js $NODE_VER"

if ! command -v pnpm &>/dev/null; then
  fail "pnpm nicht gefunden. Installieren mit: npm install -g pnpm"
fi
ok "pnpm $(pnpm --version)"

# ── uv installieren (falls nicht vorhanden) ────────────────────────────────────

step "Prüfe uv..."

if ! command -v uv &>/dev/null && [ ! -f "$HOME/.local/bin/uv" ]; then
  echo "  Installiere uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ok "uv installiert"
else
  ok "uv bereits vorhanden"
fi

# uv in aktuelle Shell-Session laden
if [ -f "$HOME/.local/bin/env" ]; then
  source "$HOME/.local/bin/env"
fi

# ── npm-Cache-Berechtigungen reparieren ────────────────────────────────────────
# Tritt auf wenn früher mit sudo npm gearbeitet wurde (root-owned cache-Einträge)

NPM_CACHE=$(npm config get cache 2>/dev/null || echo "$HOME/.npm")
if [ -d "$NPM_CACHE" ] && [ "$(stat -f '%Su' "$NPM_CACHE" 2>/dev/null)" = "root" ]; then
  warn "npm-Cache gehört root — verwende eigenes Cache-Verzeichnis (~/.npm-cache-user)"
  npm config set cache "$HOME/.npm-cache-user"
fi
NPM_CACHE=$(npm config get cache)

# ── Python-Backend ─────────────────────────────────────────────────────────────

step "Richte Python-Backend ein..."

# Windows-venv entfernen falls vorhanden (erkennbar an Scripts/ statt bin/)
if [ -d "$BACKEND/.venv/Scripts" ]; then
  warn "Windows-venv gefunden — wird gelöscht und neu erstellt"
  rm -rf "$BACKEND/.venv"
fi

# Verwaiste d:-Artefakte aus fehlgeschlagener Windows-Pfad-Auflösung entfernen
[ -d "$BACKEND/d:" ] && rm -rf "$BACKEND/d:"

if [ ! -d "$BACKEND/.venv" ]; then
  echo "  Erstelle venv mit Python 3.12..."
  uv venv "$BACKEND/.venv" --python 3.12
  ok "venv erstellt"
else
  ok "venv bereits vorhanden"
fi

echo "  Installiere Python-Abhängigkeiten..."
(cd "$BACKEND" && uv sync --dev --quiet)
ok "Python-Abhängigkeiten installiert"

# ── Frontend ───────────────────────────────────────────────────────────────────

step "Richte Frontend ein..."

echo "  Installiere npm-Pakete..."
(cd "$FRONTEND" && CI=true pnpm install --reporter=silent)
ok "Frontend-Abhängigkeiten installiert"

# ── Claude-Plugins ─────────────────────────────────────────────────────────────

step "Installiere Claude-Plugins..."

# claude CLI aus VSCode-Extension finden (versionsneutral)
CLAUDE_CLI=$(ls "$HOME/.vscode/extensions/anthropic.claude-code-"*/resources/native-binary/claude 2>/dev/null \
  | sort -V | tail -1)

# ── claude-mem ──

if echo '{}' | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if 'claude-mem@thedotmack' in d.get('plugins',{}) else 1)" \
   < "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null; then
  ok "claude-mem bereits installiert"
else
  echo "  Installiere claude-mem..."
  npx --cache "$NPM_CACHE" claude-mem install 2>&1 \
    | grep -E "(OK|Complete|Error|FEHLER)" || true
  ok "claude-mem installiert"
fi

# ── caveman ──

if echo '{}' | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if 'caveman@caveman' in d.get('plugins',{}) else 1)" \
   < "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null; then
  ok "caveman bereits installiert"
elif [ -n "$CLAUDE_CLI" ]; then
  echo "  Installiere caveman..."
  "$CLAUDE_CLI" plugin marketplace add JuliusBrussee/caveman 2>&1 | grep -v "^$" || true
  "$CLAUDE_CLI" plugin install caveman@caveman 2>&1 | grep -v "^$" || true
  ok "caveman installiert"
else
  warn "claude CLI nicht gefunden — caveman übersprungen. Manuell installieren:"
  warn "  claude plugin marketplace add JuliusBrussee/caveman"
  warn "  claude plugin install caveman@caveman"
fi

# ── Fertig ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}Installation abgeschlossen.${NC}"
echo ""
echo "  Projekt starten:       ./dev.sh"
echo "  Backend allein:        cd backend && uv run uvicorn app.main:app --reload --port 8000"
echo "  Frontend allein:       cd frontend && pnpm dev"
echo ""
echo "  claude-mem Worker starten (einmalig pro Maschine):"
echo "    npx --cache $NPM_CACHE claude-mem start"
