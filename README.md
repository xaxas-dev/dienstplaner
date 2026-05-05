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

### API-Typen aktualisieren
Nach jeder Änderung an Backend-Endpunkten oder Schemas:
```powershell
cd frontend && pnpm generate-api
```

## Lizenz

Apache 2.0 - siehe LICENSE
