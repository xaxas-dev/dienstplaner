# Architektur

Der Dienstplaner besteht aus einem FastAPI-Backend (Python 3.12) und einem
React-18-Frontend (TypeScript). Beide kommunizieren über eine REST-JSON-API.
Das Backend speichert alle Daten in einer lokalen SQLite-Datenbank.
Die Anwendung läuft ausschließlich lokal als Single-User-Desktop-App.

Timefold Solver ist für Phase B (automatische Optimierung) vorbereitet;
Phase A läuft vollständig ohne Solver/JVM.

## Verzeichnisstruktur Backend

```
backend/
  app/
    api/           → HTTP-Router, Pydantic-Validierung (kein Business-Logic)
    services/      → Geschäftslogik (kein FastAPI-Import)
    repositories/  → Datenzugriff (SQLAlchemy)
    models/        → ORM-Modelle (SQLAlchemy)
    schemas/       → Pydantic DTOs (Request/Response)
    solver/        → Timefold-Integration (Phase B, isoliert)
                     tarif_rules.py — TarifRule-Protocol, REGISTERED_RULES
                     constraints.py — Constraint-Provider (Timefold)
  alembic/         → Datenbankmigrationen
  tests/
    unit/          → Services, Utilities
    integration/   → API-Endpunkte (TestClient)
```

## Verzeichnisstruktur Frontend

```
frontend/src/
  features/
    plans/
      components/
        PlanGrid.tsx         → Haupt-Grid-Komponente (Dienste-Ansicht)
        RotationGrid.tsx     → Bereiche-Ansicht mit DnD-Drop-Targets
        DoctorAssignPopover.tsx
        ContextPanel.tsx
      PlanPage.tsx
      PlanListPage.tsx
      usePlans.ts            → TanStack Query Hooks + Query-Key-Objekte
      usePlanShifts.ts
      usePlanConflicts.ts
      useAssignShift.ts
      useTarifWarnings.ts
      planGridUtils.ts       → pure Transformationsfunktion, kein React
    doctors/
    departments/
    absences/
    ...
  components/
    ui/              → shadcn/ui-Basis-Komponenten
    dp/              → Design-Primitives (Atelier-Look)
                       Chip.tsx, ShiftChip.tsx, ShiftCell.tsx, Avatar.tsx
                       KpiTile.tsx, Sparkline.tsx, CommandBar.tsx, KpiBar.tsx
    layout/          → AtelierShell.tsx, MiniRail.tsx
  hooks/             → Generische TanStack Query Hooks
  stores/            → Zustand-Stores
  lib/
    api/             → API-Client (typisiert aus OpenAPI-Schema)
    design/
      tokens.ts      → COLORS, RADII, SPACING, FONTS, hueFromId()
      shift-palette.ts → 8-Token-Pastellpalette, colorForShiftType()
```

## Kommunikationsfluss

```
Browser (Vite :5173)
    ↕ REST/JSON (via /api proxy)
FastAPI (:8000)
    api/          → validiert Pydantic-Schema, ruft Service
    services/     → Geschäftslogik, ruft Repository
    repositories/ → SQLAlchemy-Query gegen SQLite
```

Fehlerformat: RFC 9457 (Problem Details).
Datumsformat: ISO 8601.
Auth: keine (Single-User, lokal).

## Shell-Struktur

`AtelierShell` (ersetzt die ursprüngliche `AppShell`) ist der persistente
Layout-Wrapper:

- **MiniRail** (60 px links): Icon-Navigation mit Tooltips, Avatar, clinic_name Sub-Label
- **Content-Bereich** (rechts): Outlet für page-spezifischen Inhalt
- **CommandBar**: Page-spezifische Komponente; jede Seite rendert ihre eigene
  (Titel mit optionalem italic-Akzent, Breadcrumb, Filter-Chips, Primärbutton)

## Schlüssel-Patterns

### Weiche Validierung (Phase A)
Semantische Constraints (INA-Verfügbarkeit, Doppelbuchung) blockieren den
Schreibpfad nicht. Sie werden read-only durch die Konflikt-Engine berechnet
(`GET /api/plans/{id}/conflicts`) und im Frontend als Warn-Dots markiert.

### TanStack-Query-Hook-Konvention
Hooks co-located in `features/<feature>/`: Query-Key-Objekte exportieren,
damit andere Consumer invalidieren können. Nach Shift-Mutation werden
`shifts`, `conflicts` und `tarifWarnings` invalidiert.

### DnD-Pattern (Bereiche-Ansicht)
Drop auf RotationGrid-Zelle öffnet `RotationAssignPopover` (kein direkter
DB-Write im Drop-Handler, ADR-054). Drag-IDs: `doctor-{id}` und
`rotation-{departmentId}-{yyyy-MM-dd}`.
