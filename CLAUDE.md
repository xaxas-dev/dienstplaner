# Projekt: Dienstplaner

## Zweck
Lokale Single-User-Software zur Erstellung von Ärzte-Schichtplänen
in einer neurologischen Universitätsklinik (UKSH Lübeck).
Tarifvertrag: TV-Ärzte/TdL.
Output: Excel-Schnittstellendatei für ein internes Klinik-Tool.

## Phasen-Modell (Rahmen für alle Aufgaben)
- **Phase A — Manueller Planungsassistent (aktuell):** Der User
  weist Schichten manuell zu. Das System unterstützt durch
  Verfügbarkeitsinfo und read-only Konflikt-Erkennung, blockiert
  aber nichts.
- **Phase B — Solver (später):** timefold-solver optimiert
  automatisch. Das Datenmodell ist von Anfang an solver-ready
  gebaut.

Konsequenz: Bis Phase B existiert keine harte Constraint-Prüfung im
Schreibpfad. Funktionen werden so gebaut, dass sie ohne Solver
funktionieren und der Solver später additiv aufsetzt.

## Tech-Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, SQLite, pydantic v2,
  timefold-solver (Phase B), openpyxl, alembic
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
  solver/       → Timefold-Integration (Phase B, isoliert, Adapter)

Frontend (Vite, Port 5173)
  features/     → fachliche Module (plan-grid, doctors, absences, ...)
  components/   → wiederverwendbare UI-Bausteine
    ui/         → shadcn/ui-Basis
    dp/         → Design-Primitives (Atelier-Look, ab M1-009)
    layout/     → Shell (MiniRail, AtelierShell, ab M1-010)
  hooks/        → TanStack Query Hooks
  stores/       → Zustand-Stores
  lib/          → API-Client (typisiert aus OpenAPI)
    design/     → Design-Tokens
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
- **INA-Verfügbarkeitsmodell:** Ob ein Arzt an einem Datum für
  INA-Dienste (V/T/N/T1) verfügbar ist, ergibt sich aus drei
  blockierenden Quellen: aktive Rotation in einem blockierenden
  Bereich, manueller INA-Ausschluss (INAExclusion), aktive
  Abwesenheit. Zentrale Funktion:
  `get_ina_availability(db, doctor_id, target_date)`. Diese Logik
  NICHT neu implementieren — immer den Service nutzen. CK ist
  Sonderfall (blockiert nur werktags).
- **Konflikt-Engine (M2-005):** `conflict_service.detect_conflicts(db, plan_id)`
  berechnet NOT_AVAILABLE und DOUBLE_BOOKED read-only pro Plan. Einmal pro
  Request aufrufen, Ergebnisse nach shift_id verteilen — nicht pro Shift
  einzeln neu berechnen. Consumer: GET /plans/{id}/conflicts und GET /plans/{id}/shifts.
- **Pin-Konzept:** Manuelle Zuweisungen sind automatisch gepinnt.
  Gepinnte Zuweisungen werden vom Solver nicht überschrieben.
  Pin ist pro Zuweisung lösbar (Variante C)
- **Weiche Validierung (Phase A):** Beim Schreiben einer
  Schicht-Zuweisung wird NUR Datenkonsistenz hart geprüft (Entität
  existiert, Doctor aktiv). Semantische Constraints (Verfügbarkeit,
  Doppelbuchung) blockieren NICHT. Sie werden read-only durch die
  Konflikt-Engine berechnet und im Frontend markiert. Claude Code
  darf hier KEINE harte Validierung "zur Sicherheit" einbauen.
- **Constraint-Klassen (Phase B):**
  1. Logisch hart (nie overridebar): Doppelbelegung, Einsatz bei Abwesenheit
  2. Regulatorisch hart (overridebar): Tarif, ArbZG
  3. Soft (Optimierungsziele): Fairness, Wünsche, Schichtfolgen
- **Override-Ebenen:** A (global/Plan), B (Arzt+Regel+Zeitraum), C (Einzelverstoß)
- **Tarifregeln:** Zentral in solver/tarif_rules.py, nie verstreut
- **Solver-Vorschlags-Diff (M8-001):** `POST /api/plans/{id}/solve` liefert
  `SolveResult` (proposed_assignments, hard_score, soft_score, feasible) —
  **KEIN DB-Write**. Gepinnte Shifts erscheinen nie im Diff. Die Phase-A-App
  startet ohne JVM (lazy imports).
- **Solver-Apply (M8-002):** `POST /api/plans/{id}/apply` nimmt
  `{proposed_assignments: [{shift_id, doctor_id}]}` im Body und schreibt
  `doctor_id` in die DB — **kein timefold/JVM nötig**. Gepinnte Shifts werden
  übersprungen (`skipped_pinned`), nicht überschrieben. `is_pinned` wird nicht
  gesetzt (Solver-Apply ≠ manuell). Konflikte nicht in der Response —
  Client invalidiert `shifts`+`conflicts` und refetcht. Einzelne Transaktion.
- **Timefold-Python-API (empirisch verifiziert, timefold==1.24.0b0):**
  - Dekoratoren: `@planning_entity`, `@planning_solution`, `@constraint_provider`
  - Felder: `Annotated[Type, PlanningVariable(allows_unassigned=True)]`,
    `Annotated[bool, PlanningPin]`, `Annotated[int, PlanningId]`
  - Solution-Collections: `Annotated[list[T], ProblemFactCollectionProperty, ValueRangeProvider]`,
    `Annotated[list[E], PlanningEntityCollectionProperty]`
  - Score: `Annotated[HardSoftScore, PlanningScore]`
  - Constraint-Streams: `cf.for_each_unique_pair(..., Joiners.equal(...)).filter(...).penalize(...).as_constraint(name)`
  - Config: `SolverConfig(solution_class=..., entity_class_list=[...], score_director_factory_config=ScoreDirectorFactoryConfig(constraint_provider_function=fn), termination_config=TerminationConfig(spent_limit=Duration(seconds=N)))`
  - Solve: `SolverFactory.create(config).build_solver().solve(problem)`
  - JVM-Prerequisite: Java 17+ (empfohlen: Eclipse Temurin 21)
  - NICHT aus dem Gedächtnis ergänzen — immer gegen Spike/Doku verifizieren

Details: docs/data-model.md, docs/constraints.md

## Konventionen

### Python
- ruff für Lint und Format (Konfiguration in pyproject.toml)
- Enums immer als `enum.StrEnum` — nie als `(str, Enum)` (ruff UP042)
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
- Shift hat UNIQUE-Constraint `(plan_id, shift_date, shift_type_id)`:
  bei mehreren Test-Shifts am selben Plan+Tag → verschiedene ShiftTypes verwenden
- vitest für Frontend: Pflicht für komplexe Komponenten (PlanGrid, etc.)
- Tests laufen lokal grün vor jedem Merge

### Git
- Conventional Commits: feat:, fix:, refactor:, docs:, test:, chore:
- Ein Feature-Branch pro Aufgabe, Branch-Name entspricht
  Aufgaben-ID: task/M0-001-repo-setup
- Aufgaben-Briefings liegen in tasks/open/, nach Abschluss
  verschoben nach tasks/done/
- Aufgaben werden in Sub-Schritten mit Stop-Gates abgearbeitet:
  nach jedem Sub-Schritt Commit und auf Review warten

### Milestone-Abschluss-Checkliste (letzter Sub-Schritt / F-Schritt)
Am Ende jedes Milestones **muss** Claude Code folgende Dateien aktualisieren,
bevor der Abschluss-Commit erstellt wird:
1. `tasks/done/M{X}-{YYY}-*.md` — alle `[ ]` → `[x]`; Abschnitt „Abschluss"
   anhängen: Datum, Branch-Name, Commit-Liste, Testergebnis, ggf. offene
   Voraussetzungen (z. B. JVM, externe Deps).
2. `docs/open-questions.md` — während des Milestones beantwortete Fragen auf
   Status „Entschieden" setzen (inkl. Datum); neue offene Fragen eintragen.
3. `docs/decisions.md` — neue ADRs für alle bindenden Entscheidungen des
   Milestones (Architektur, Technologiewahl, bewusste Scope-Grenzen).
4. `docs/constraints.md` — implementierte Constraints dokumentieren /
   Platzhalter ausbauen.
5. `CLAUDE.md` — neue Konventionen oder verifizierten API-Wissen eintragen,
   das für Folge-Milestones relevant ist.
Diese Checkliste gilt auch wenn Sub-Schritt F im Briefing nicht explizit alle
Punkte nennt.

### API
- REST/JSON, snake_case
- GET /api/plans/{id}/shifts liefert 404 für unbekannte plan_id (seit M2-005,
  vorher: 200 + [])
- Datumsangaben als ISO 8601
- Fehler nach RFC 9457 (Problem Details)
- Keine Auth (Single-User, lokal)
- Read-collection nested unter Parent (/api/plans/{id}/shifts),
  update-single per globaler ID (/api/shifts/{id})

### Frontend — Plan-Feature (M2-003)
- TanStack-Query-Hooks co-located in `features/plans/`: `usePlans`, `usePlanShifts`,
  `usePlanConflicts`, `useAssignShift`. Query-Key-Objekte (`planKeys`, `shiftQueryKeys`,
  `conflictQueryKeys`) exportieren, damit andere Consumer invalidieren können.
- `planGridUtils.ts` ist eine pure Transformationsfunktion (kein React) — Grid-Logik
  dort isolieren, nicht in PlanGrid.tsx einbetten. Macht sie voll testbar ohne Rendering.
- `useAssignShift` invalidiert nach onSuccess beide Queries (shifts + conflicts):
  Konfliktberechnung ist server-seitig, kein optimistic update.
- Click-outside-Handler: `useEffect + document.addEventListener('mousedown', ...)` statt
  Backdrop-Div. Backdrop-Div-Ansatz funktioniert in jsdom-Tests nicht
  (`user.click(document.body)` traversiert nicht in den React-Component-Tree).
- Stub-Komponenten während Entwicklung: `export function X(_props: unknown) { return null }`
  erlaubt TypeScript-Kompilierung bevor Abhängigkeiten fertig sind.
- CSS-Grid-Zeilen in PlanGrid: `<Fragment key="row-{id}">` statt `<>` — bare Fragments
  können keinen key tragen, was React-Warnings erzeugt.
- Warn-Dot in ShiftCell: `e.stopPropagation()` im onClick des Dots trennt Dot-Klick
  (→ ContextPanel) von Zell-Klick (→ DoctorAssignPopover).
- Grid-Surface-Konvention (M2-006): PlanGrid lebt in einem
  `rounded-2xl border border-line bg-card overflow-hidden`-Wrapper in PlanPage.tsx.
  Sticky-Spalten müssen `bg-card` sein (nicht `bg-paper`) — sonst papierfarbene Naht
  beim Horizontal-Scroll. `bg-card` = Weiß via shadcn-Variable `hsl(var(--card))`,
  nicht der dp-Surface-Wert #FFFCF5 — das ist gewollt, keinen neuen Token einführen.
  Leere Zellen: solide `border-line` + `bg-paper/50` (kein `border-dashed`).

### Frontend — DnD-Pattern (M3-001)
- **DnD nur in Bereiche-Ansicht:** Drag & Drop ist für Rotations-Zuweisung
  (Arzt → Bereich). Dienste-Ansicht (Schicht-Zuweisung per Klick-Popover)
  bleibt unverändert — DnD dort ist separater Folge-Milestone (ADR-053).
- **Drop öffnet Popover, schreibt nicht direkt:** Drop auf RotationGrid-Zelle
  setzt `preselectedDragDoctorId` und öffnet `RotationAssignPopover`.
  User bestätigt `valid_from`/`valid_to`. Kein direkter DB-Write im
  Drop-Handler (ADR-054).
- **Drag-ID-Konvention:**
  - Drag-Source: `doctor-{id}` — Helpers `makeDoctorDragId` /
    `parseDoctorDragId` in `DoctorDragSource.tsx`
  - Drop-Target: `rotation-{departmentId}-{yyyy-MM-dd}` — Helpers
    `makeRotationDropId` / `parseRotationDropId` in `RotationGrid.tsx`
- **DragOverlay:** `DoctorDragOverlayToken` (in `DoctorDragSource.tsx`)
  rendert das gezogene Token am Cursor (`shadow-lg`). `activeDragDoctor`-State
  in PlanPage: gesetzt in `onDragStart`, gecleart in `onDragEnd`/`onDragCancel`.
- **ActivationConstraint:** `PointerSensor` mit `distance: 4` verhindert
  versehentliche Drags aus Klick-Interaktionen.
- **Screenreader:** Deutsche Announcements in `DndContext.accessibility`
  nutzen `active.data.current.doctorName` und `over.data.current.departmentName`.
  Diese Felder werden in `useDraggable`/`useDroppable` als `data` mitgegeben.
- **Tab-Style:** Aktiver Tab in PlanPage nutzt Underline
  (`border-b-2 border-accent text-ink`), nicht Pill — Terracotta-Pill
  kollidiert visuell mit Doctor-Avataren (ADR-055).

## Was Claude Code NICHT tun soll
- Keine neuen Bibliotheken ohne explizite Rückfrage einführen
- Keine Bibliotheksfunktionen verwenden, die nicht in der Doku existieren
  (timefold-solver-python ist jung, halluzinationsgefährdet)
- Keine Annahmen über Klinikdaten oder Tarif-Werte erfinden
- Keine harte Validierung von semantischen Constraints in den
  Schreibpfad einbauen (siehe "Weiche Validierung")
- Die INA-Verfügbarkeitslogik nicht duplizieren — immer
  get_ina_availability nutzen
- Keine Tests überspringen wenn die Aufgabe Tests fordert
- Keine Mock-Daten oder Testdaten in Produktions-Code einchecken
- Bewusste Abweichungen von docs/design-implementation.md nur,
  wenn sie im Aufgaben-Briefing explizit dokumentiert sind
- Bei Unklarheit: in der Aufgabe nachsehen oder stoppen und nachfragen
- Keine Änderungen außerhalb des in der Aufgabe definierten Scope

## Offene Annahmen
Siehe docs/open-questions.md
Bevor eine Annahme getroffen wird, dort nachsehen ob sie schon entschieden ist.
