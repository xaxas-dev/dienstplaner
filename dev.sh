#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$SCRIPT_DIR/backend"
FRONTEND="$SCRIPT_DIR/frontend"

# Load uv into PATH
if [ -f "$HOME/.local/bin/env" ]; then
  source "$HOME/.local/bin/env"
fi

echo "Starte Dienstplaner..."
echo ""

echo "[1/2] Wende Datenbank-Migrationen an..."
(cd "$BACKEND" && uv run alembic upgrade head)

echo "[2/2] Starte Backend und Frontend..."
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "API-Docs: http://localhost:8000/docs"
echo ""
echo "Beenden mit Ctrl+C"
echo ""

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "Beendet."
}
trap cleanup INT TERM

(cd "$BACKEND" && uv run uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

(cd "$FRONTEND" && pnpm dev) &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
