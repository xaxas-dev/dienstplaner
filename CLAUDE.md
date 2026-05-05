# Projekt: Dienstplaner

## Zweck
Lokale Single-User-Software zur Erstellung von Ärzte-Schichtplänen
in einer neurologischen Universitätsklinik (UKSH Lübeck).
Tarifvertrag: TV-Ärzte/TdL.
Output: Excel-Schnittstellendatei für ein internes Klinik-Tool.

## Tech-Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, SQLite, pydantic v2,
  timefold-solver, openpyxl, alembic
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui,
  dnd-kit, TanStack Query, Zustand
- **Tooling:** uv (Python), pnpm (Node), ruff (lint+format), pytest, vitest
- **Deployment:** Lokale App auf Windows und macOS, Single User

## Architektur
```
Backend (FastAPI, Port 8000)
  api/          → HTTP-Router, pydantic-Validierung
  services/     → Geschäftslogik (kein FastAPI-Import hier)
  repositories/ → Datenzugriff (SQLAlchemy)
  models/       → ORM-Modelle
  schemas/      → Pydantic DTOs
  solver/       → Timefold-Integration (isoliert, Adapter-Pattern)

Frontend (Vite, Port 5173)
  features/     → fachliche Module (plan-grid, doctors, absences, ...)
  components/   → wiederverwendbare UI-Bausteine (shadcn/ui-Basis)
  hooks/        → TanStack Query Hooks
  stores/       → Zustand-Stores
  lib/          → API-Client (typisiert aus OpenAPI)
```

Details: docs/architecture.md

## Domänen-Konzepte (Pflichtlektüre)
- **Zwei Planungsebenen:** Rotation (monatsweise, Arzt einer Station zugeordnet)
  und Schicht (täglich, konkrete Dienste)
- **Rotations-Exklusivität:** Wer auf einer Rotation ist, kann in dem Monat
  keine Dienste auf anderen Rotationen leisten (Ausnahmen existieren, sind
  am Arzt/Rotation konfigurierbar)
- **Zeitabhängiger Beschäftigungsumfang:** Teilzeit-Prozentsatz ist nicht
  statisch, sondern per Zeitraum am Arzt hinterlegt (siehe EmploymentPeriod)
- **Geteilte Rotationen:** Zwei Teilzeit-Ärzte können sich eine Rotation teilen
- **Pin-Konzept:** Manuelle Zuweisungen sind automatisch gepinnt.
  Gepinnte Zuweisungen werden vom Solver nicht überschrieben.
  Pin ist pro Zuweisung lösbar (Variante C)
- **Constraint-Klassen:**
  1. Logisch hart (nie overridebar): Doppelbelegung, Einsatz bei Abwesenheit
  2. Regulatorisch hart (overridebar): Tarif, ArbZG
  3. Soft (Optimierungsziele): Fairness, Wünsche, Schichtfolgen
- **Override-Ebenen:** A (global/Plan), B (Arzt+Regel+Zeitraum), C (Einzelverstoß)
- **Tarifregeln:** Zentral in solver/tarif_rules.py, nie verstreut

Details: docs/data-model.md, docs/constraints.md

## Konventionen

### Python
- ruff für Lint und Format (Konfiguration in pyproject.toml)
- Type Hints überall, keine ungetypten Funktionen
- snake_case für alles außer Klassen
- Docstrings nur für nicht-offensichtliche Funktionen
- Keine Business-Logik in api/, keine FastAPI-Imports in services/

### TypeScript
- strict mode aktiv
- PascalCase für Komponenten und Typen, camelCase sonst
- Keine any, keine ts-ignore ohne Kommentar
- Props immer explizit typisiert

### Tests
- pytest für Backend: Pflicht für alle services/ und solver/ Module
- Jeder Constraint braucht mindestens einen positiven und einen negativen Test
- vitest für Frontend: Pflicht für komplexe Komponenten (PlanGrid, etc.)
- Tests laufen lokal grün vor jedem Merge

### Git
- Conventional Commits: feat:, fix:, refactor:, docs:, test:, chore:
- Ein Feature-Branch pro Aufgabe (tasks/open/)
- Branch-Name entspricht Aufgaben-ID: task/M0-001-repo-setup

### API
- REST/JSON, snake_case
- Datumsangaben als ISO 8601
- Fehler nach RFC 9457 (Problem Details)
- Keine Auth (Single-User, lokal)

## Was Claude Code NICHT tun soll
- Keine neuen Bibliotheken ohne explizite Rückfrage einführen
- Keine Bibliotheksfunktionen verwenden, die nicht in der Doku existieren
  (timefold-solver-python ist jung, halluzinationsgefährdet)
- Keine Annahmen über Klinikdaten oder Tarif-Werte erfinden
- Keine Tests überspringen wenn die Aufgabe Tests fordert
- Keine Mock-Daten oder Testdaten in Produktions-Code einchecken
- Bei Unklarheit: in der Aufgabe nachsehen oder stoppen und nachfragen
- Keine Änderungen außerhalb des in der Aufgabe definierten Scope

## Offene Annahmen
Siehe docs/open-questions.md
Bevor eine Annahme getroffen wird, dort nachsehen ob sie schon entschieden ist.
