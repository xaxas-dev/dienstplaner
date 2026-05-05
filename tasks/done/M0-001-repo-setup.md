# Task M0-001: Repo-Setup

## Ziel
Ein vollständiges, lauffähiges Projekt-Skelett für Backend und Frontend.
Am Ende startet ein einziges Skript beide Server, der Browser zeigt das
Frontend, das Frontend ruft erfolgreich einen Backend-Endpunkt auf.

## Kontext
Lies vor Beginn: CLAUDE.md
Neues Projekt, noch keine bestehenden Dateien außer .gitignore, README.md,
CLAUDE.md und dieser Aufgabe.

## Anforderungen

### Projektstruktur anlegen
```
dienstplaner/
├── backend/
├── frontend/
├── docs/
│   ├── architecture.md      (Stub, 3-5 Sätze Platzhalter)
│   ├── data-model.md        (Stub)
│   ├── constraints.md       (Stub)
│   ├── open-questions.md    (Stub)
│   └── decisions.md         (Stub)
├── tasks/
│   ├── open/
│   └── done/
├── .gitignore               (existiert bereits)
├── CLAUDE.md                (existiert bereits)
├── README.md                (existiert bereits)
├── LICENSE                  (Apache 2.0 Volltext)
├── CHANGELOG.md             (leer, Platzhalter)
└── dev.ps1                  (Start-Skript Windows)
```

### Backend (FastAPI-Skelett)

Technologien: Python 3.12 (via uv), FastAPI, SQLAlchemy, SQLite,
pydantic v2, alembic, ruff, pytest

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI-App, CORS für localhost:5173, /health Endpunkt
│   ├── config.py            # Settings via pydantic BaseSettings
│   ├── database.py          # SQLAlchemy Engine + Session, SQLite
│   ├── api/
│   │   ├── __init__.py
│   │   └── health.py        # GET /api/health → {"status": "ok", "version": "0.1.0"}
│   ├── models/
│   │   └── __init__.py
│   ├── schemas/
│   │   └── __init__.py
│   ├── services/
│   │   └── __init__.py
│   ├── repositories/
│   │   └── __init__.py
│   └── solver/
│       └── __init__.py
├── alembic/
│   ├── env.py
│   └── versions/            (leer)
├── tests/
│   ├── __init__.py
│   └── test_health.py       # Test: GET /api/health gibt 200 + {"status": "ok"}
├── alembic.ini
├── pyproject.toml
└── .python-version          # 3.12
```

pyproject.toml muss enthalten:
- Python 3.12 als Zielversion
- Abhängigkeiten: fastapi, uvicorn[standard], sqlalchemy, alembic,
  pydantic-settings, ruff (dev), pytest, pytest-asyncio, httpx (für Tests)
- ruff-Konfiguration: line-length 100, target-version py312
- pytest-Konfiguration: asyncio_mode = "auto"

CORS-Konfiguration in main.py:
- Erlaubte Origins: ["http://localhost:5173", "http://127.0.0.1:5173"]
- Erlaubte Methoden: alle
- Erlaubte Headers: alle

### Frontend (React-Skelett)

Technologien: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui,
TanStack Query, Zustand, pnpm

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx              # Einfache Startseite (siehe UI unten)
│   ├── lib/
│   │   └── api.ts           # Basis-API-Client (fetch mit Basis-URL)
│   └── components/
│       └── ui/              # shadcn/ui-Komponenten (initial leer)
├── index.html
├── package.json
├── tsconfig.json            # strict: true
├── vite.config.ts           # Proxy: /api → http://localhost:8000
└── tailwind.config.ts
```

Die Startseite (App.tsx) zeigt:
- Titel "Dienstplaner"
- Untertitel "Schichtplanungs-Software"
- Einen Button "Verbindung prüfen"
- Beim Klick: Aufruf von GET /api/health, Anzeige des Ergebnisses
  (Erfolg: grüner Text "Verbunden", Fehler: roter Text "Keine Verbindung")
- Kein Routing, keine Navigation, kein Login (kommt später)

Vite-Proxy damit CORS-Probleme im Dev-Modus vermieden werden:
```
/api → http://localhost:8000
```

### Start-Skript (dev.ps1)

Windows PowerShell-Skript das:
1. Backend startet (uv run uvicorn app.main:app --reload --port 8000)
2. Frontend startet (pnpm dev)
3. Beide in separaten PowerShell-Fenstern oder als Background-Jobs
4. Meldet: "Backend: http://localhost:8000 | Frontend: http://localhost:5173"

## Akzeptanzkriterien

- [ ] `.\dev.ps1` startet beide Server ohne Fehler
- [ ] http://localhost:5173 zeigt die Startseite
- [ ] Klick auf "Verbindung prüfen" zeigt "Verbunden" (grün)
- [ ] http://localhost:8000/docs zeigt die automatische API-Dokumentation
- [ ] `cd backend && uv run pytest` läuft grün (1 Test)
- [ ] `cd backend && uv run ruff check .` zeigt keine Fehler
- [ ] `cd frontend && pnpm type-check` zeigt keine TypeScript-Fehler
- [ ] Alle Ordner aus der Projektstruktur existieren (auch leere mit __init__.py)
- [ ] LICENSE-Datei enthält Apache 2.0 Volltext
- [ ] docs/-Stubs existieren mit sinnvollem Platzhalter-Inhalt

## Out of Scope
- Kein Datenmodell, keine Datenbankmigrationen mit Inhalt
- Keine weiteren API-Endpunkte außer /api/health
- Keine Authentifizierung
- Kein Routing im Frontend
- Keine shadcn/ui-Komponenten außer was für die Startseite nötig ist
- Kein macOS-Start-Skript (kommt später)
- Kein Docker

## Bekannte Stolperfallen
- timefold-solver NICHT installieren in diesem Schritt.
  Das Paket hat eigene Abhängigkeiten und wird in einem späteren
  Meilenstein separat eingebunden.
- pydantic v2 hat breaking changes zu v1. Alle pydantic-Imports
  aus pydantic v2 verwenden (BaseModel, Field, etc. direkt aus pydantic).
- SQLite-Datei soll unter backend/data/dienstplaner.db liegen,
  nicht im Projektroot. Ordner data/ in .gitignore aufnehmen.
- Windows-Pfade in Python: pathlib.Path verwenden, keine hartcodierten
  Slashes.
- CORS muss gesetzt sein, sonst schlägt der Frontend-Aufruf im Browser fehl.

## Annahmen die ich treffe
Keine. Bei Unklarheit stoppen und nachfragen.
