# Dienstplaner

Lokale Schichtplanungs-Software für eine neurologische Universitätsklinik.

## Zweck

Unterstützt die Erstellung und Optimierung von Ärzte-Schichtplänen.
Ausgabe: Excel-Schnittstellendatei für das interne Klinik-Tool.

## Status

Projekt in aktiver Entwicklung. Konzeptphase abgeschlossen, Implementierung läuft.

## Tech-Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, SQLite, timefold-solver, openpyxl
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, dnd-kit
- **Tooling:** uv, pnpm, ruff, pytest, vitest, alembic

## Voraussetzungen

- Python 3.12+ (via uv verwaltet)
- Node.js 20+
- pnpm
- uv

## Setup

```powershell
# Repository klonen
git clone https://github.com/xaxas-dev/dienstplaner.git
cd dienstplaner

# Backend
cd backend
uv sync
uv run alembic upgrade head

# Frontend
cd ../frontend
pnpm install
```

## Starten

```powershell
# Beide Server mit einem Befehl (aus Projektroot)
.\dev.ps1
```

Frontend läuft auf http://localhost:5173
Backend läuft auf http://localhost:8000
API-Dokumentation: http://localhost:8000/docs

## Entwicklung

### Design-System
Das Frontend verwendet ein token-basiertes Design-System unter `frontend/src/lib/design/`:
- `tokens.ts` — Farben, Abstände, Fonts, Radien (Single Source of Truth)
- `shift-palette.ts` — Pastell-Farbpalette für Schichttypen (V/T/N/T1)

Tailwind-Klassen wie `bg-paper`, `text-ink`, `bg-warn-bg`, `rounded-cell` leiten aus diesen Tokens ab.
Keine Hex-Codes direkt in Komponenten — immer über Tokens.

Domänenspezifische UI-Primitives (Chip, ShiftChip, ShiftCell, Avatar, KpiTile, Sparkline) liegen in
`frontend/src/components/dp/`.

### Komponenten-Playground
Im Entwicklungsmodus ist eine Vorschau aller UI-Primitives unter `http://localhost:5173/playground` erreichbar.
Die Route ist im Production-Build deaktiviert.

### API-Typen aktualisieren
Nach jeder Änderung an Backend-Endpunkten oder Schemas:
```powershell
cd frontend && pnpm generate-api
```

## Lizenz

Apache 2.0 - siehe LICENSE
