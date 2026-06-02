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
- **Besetzungs-Layer-Sperre (M12-001):** `Plan.besetzung_locked: bool`
  (Default `false`) sperrt nur die UI-Erfassung von Rotationen (Doctor→Bereich-DnD).
  Keine Backend-Validierung (weiche Validierung). Getrennt von `Shift.is_pinned`
  (Solver) und `Shift.is_locked` (Input-Shift, M12-002). ADR-089.
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
- **Availability-Snapshot-Pattern (M8-003):** Timefold-Constraints dürfen keine
  DB-Queries ausführen. Neue logisch-harte Constraints, die Arzt-Verfügbarkeit
  prüfen, müssen den Snapshot-Pattern nutzen: Verfügbarkeit vor dem Solve via
  `get_ina_availability_for_period()` pro Arzt berechnen und als immutable problem
  fact (`frozenset[date]`) in `SolverDoctor.unavailable_dates` speichern.
  `__eq__/__hash__` von `SolverDoctor` bleiben auf `doctor_id` — Snapshot ist
  kein Identitätsmerkmal. Neue logisch-harte Constraint = `mapping.py` erweitern
  + `constraints.py` ergänzen + `tarif_rules.py` ConstraintId + ADR.
- **Soft-Score-Pattern (M8-004):** Neue Soft-Constraints folgen demselben
  Snapshot-Pattern: Alle Inputs (FTE, Targets) vor dem Solve in `SolverDoctor`
  ablegen (`fte_percentage: int`, `fair_targets: dict[int, int]`). Constraint
  liest nur immutable problem facts — kein DB-Zugriff. `SOFT`-frozenset in
  `tarif_rules.py` erweitern. `__eq__/__hash__` von `SolverDoctor` bleiben auf
  `doctor_id`. Neue Soft-Constraint = `mapping.py` + `domain.py` + `constraints.py`
  + `tarif_rules.py` + ADR + `employment_period_service.py` (wenn FTE nötig).
- **Tarif-Werte (M8-005/M8-006, hardcoded in `backend/app/solver/tarif_rules.py`):**
  - `MAX_BD_PER_MONAT = 4` — § 7 Abs. 5a Satz 1 TV-Ärzte/TdL i.d.F. 9. ÄnderungsTV.
    Ausnahmen (5/Quartal per Satz 2, 7/Monat per Individualvereinbarung per Satz 4)
    sind Phase-B-Override-Fälle. Nie ohne explizite Anforderung ändern.
  - `MAX_WEEKEND_SHIFTS_PER_MONTH = 2` — Platzhalter, exakter TV-Ärzte/TdL-Wert
    noch durch Domänenexperten zu bestätigen. Wochenende = `weekday() in (5, 6)`.
  - `MIN_REST_HOURS = 11` — ArbZG §5 Abs. 1, gesetzlich fixiert.
  - `ShiftType.is_bereitschaftsdienst: bool` — Klassifizierungsfeld. Default `False`.
    Klinik konfiguriert welche ShiftTypes als BD zählen. Snapshot-Propagation:
    `to_solver()` liest `ShiftTypeORM.active == True` einmalig in eine Map und
    setzt `SolverShift.is_bereitschaftsdienst` via `.get(shift_type_id, False)`.
    Kein DB-Zugriff im Constraint (Snapshot-Pattern ADR-071).
  - `SolverShift.shift_start_minutes / shift_end_minutes: int | None` — Zeitdaten-
    Snapshot (M8-006): `to_solver()` berechnet `date.toordinal() * 1440 + time_minutes`
    aus `ShiftType.start_time/end_time`. Overnight-Shifts: `+1440` wenn `end < start`.
    Nullable times → `None` → Constraint überspringt (Graceful Degradation).
    `for_each_unique_pair`-Bidirektional-Filter: beide Richtungen (s1→s2, s2→s1) per
    `or`-Verknüpfung prüfen, da Paare ungeordnet sind.
  - `MAX_CONSECUTIVE_DAYS = 5` — Soft-Limit aufeinanderfolgende Arbeitstage. Platzhalter;
    durch Domänenexperten zu bestätigen (analog MAX_WEEKEND_SHIFTS_PER_MONTH).
    Pair-Ansatz: `for_each_unique_pair` + Ordinal-Diff == 5. `SolverShift.shift_date_ordinal: int`
    (in `__init__` gesetzt, JPy-sicher). ADR-087.
  - `MAX_WEEKLY_HOURS_MINUTES = 2880` (48 × 60) — ArbZG-Standard-Wochenstundenlimit.
    Opt-out BD-Stufe I: `MAX_WEEKLY_HOURS_MINUTES_BD1 = 58 * 60` (3480 min).
    Opt-out BD-Stufe II: `MAX_WEEKLY_HOURS_MINUTES_BD2 = 54 * 60` (3240 min).
    Helper `get_weekly_hours_limit(opt_out_level: int | None) -> int` gibt per-Arzt-Limit zurück.
    Snapshot: `SolverDoctor.max_weekly_hours_minutes: int` (Default 2880). ADR-088.
  - Neue regulatorisch-harte Constraint = `mapping.py` + `domain.py` +
    `constraints.py` + `tarif_rules.py` (ConstraintId + REGULATORISCH_HART) + ADR.
- **Timefold-Python-API (empirisch verifiziert, timefold==1.24.0b0):**
  - Dekoratoren: `@planning_entity`, `@planning_solution`, `@constraint_provider`
  - Felder: `Annotated[Type, PlanningVariable(allows_unassigned=True)]`,
    `Annotated[bool, PlanningPin]`, `Annotated[int, PlanningId]`
  - Solution-Collections: `Annotated[list[T], ProblemFactCollectionProperty, ValueRangeProvider]`,
    `Annotated[list[E], PlanningEntityCollectionProperty]`
  - Score: `Annotated[HardSoftScore, PlanningScore]`
  - Constraint-Streams: `cf.for_each_unique_pair(..., Joiners.equal(...)).filter(...).penalize(...).as_constraint(name)`
  - Constraint-Streams (group_by, verifiziert M8-004): `cf.for_each(E).filter(...).group_by(lambda e: key1, lambda e: key2, ConstraintCollectors.count()).filter(lambda k1, k2, count: ...).penalize(HardSoftScore.ONE_SOFT, lambda k1, k2, count: ...).as_constraint(name)` — 2-Key-groupBy + 3-Arg-Lambda in filter/penalize funktioniert in timefold==1.24.0b0
  - Constraint-Streams (sum, verifiziert M8-007): `ConstraintCollectors.sum(lambda e: int_expr)` funktioniert in timefold==1.24.0b0; Ergebnis als dritter Wert in 3-Arg-Lambda
  - JPy-Einschränkung (ADR-086): `date.isocalendar()` wird im JVM-Interpreter als Liste `[year, week, weekday]` übergeben — kein NamedTuple-Attributzugriff (`.year`, `.week` scheitern). Stattdessen `iso[0]`, `iso[1]` verwenden. Gilt für alle Python-Objekte in Constraint-Lambdas die JVM-seitig ausgeführt werden.
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

### Frontend — Availability-Pattern (M4-001)
- **Hook `useDoctorAvailability`:** Lädt `GET /api/doctors/{id}/ina-availability?from=&to=`
  per doctor/Zeitraum. Disabled wenn `doctorId === null`. Query-Key-Objekt
  `availabilityKeys` exportiert (analog CLAUDE.md-Hook-Konvention).
- **Hook `useAvailabilityForDate`:** Nutzt `useQueries` für Mehrfach-Doctor-Lookup
  an einem Datum (DoctorAssignPopover). Teilt Query-Cache mit `useDoctorAvailability`.
- **Visual-Hint bleibt weich:** Amber-Ring im RotationGrid (`ring-amber-400/60`)
  und Amber-Dot im DoctorAssignPopover sind read-only. Kein Drop-Block, kein
  Auswahl-Block (ADR-033). Tooltip zeigt `reasons`.
- **Mutation-Invalidierung:** Absence-Mutationen invalidieren `absenceKeys[doctorId]`
  **und** `availabilityKeys` (da Absence eine der drei INA-Quellen ist).
- **Kein neuer Design-Token** für Availability-Hints — Tailwind-Klassen `ring-amber-400/60`,
  `bg-amber-400` direkt (konsistent mit bestehender Warning-Palette).

### Frontend — Tarif-Warnings-Pattern (M5-001)
- **Hook `useTarifWarnings`:** Lädt `GET /api/plans/{id}/tarif-warnings` per Plan.
  Disabled wenn `planId === null`. Query-Key-Objekt `tarifWarningKeys` co-located in
  `features/plans/useTarifWarnings.ts` (analog `conflictQueryKeys`).
- **Verteilung in PlanPage:** `tarifWarningsByShift: Record<number, TarifWarning[]>` wird
  aus `tarifWarningsData.warnings` per `shift_id` aufgebaut und an PlanGrid übergeben.
  Plan-globale Warnings (shift_id === null) werden gefiltert — kein Cell-Marker.
- **Sand-Dot bleibt weich (ADR-060):** Kein Schreibpfad-Eingriff, kein Drop-Block,
  kein Auswahl-Block. Sand-Dot (§, `bg-sand border border-warn-line`) oben links am
  ShiftCell — Konflikt-Dot (!, `bg-warn`) oben rechts bleibt unverändert (ADR-061).
- **Cache-Invalidierung bei Shift-Mutation:** `useAssignShift` invalidiert nach
  `onSuccess` zusätzlich `tarifWarningKeys.byPlan(planId)` — konsistent mit
  ADR-043 (kein optimistic update). Mutation → Refetch shifts + conflicts + tarifWarnings.
- **ContextPanel-Erweiterung:** Prop `tarifWarnings?: TarifWarning[]`; Sektion
  „Tarif-Warnungen" unterhalb Konflikte; Severity-Chip (info=Sand, warning=warn-bg,
  critical=warn) + rule_id + message pro Eintrag.
- **Kein neuer Design-Token:** Sand-Token (`bg-sand`, ADR-031) und `warn`-Border
  (`border-warn-line`) wiederverwendet.

### Backend — Tarif-Plug-in-Pipeline (M5-001)
- **`TarifRule`-Protocol** in `backend/app/solver/tarif_rules.py`: Attribute
  `id: ConstraintId`, `severity: TarifSeverity`; Methode
  `evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]`.
  Keine ABC, kein Mixin — Python-3.12-Protocol-Idiom.
- **`REGISTERED_RULES: list[TarifRule] = []`** leer im Prod-Code. Neue Regeln
  implementieren das Protocol und werden nur nach Klärung konkreter Tarif-Werte
  (OQ-006) eingetragen. `grep REGISTERED_RULES backend/app/` findet nur Definition.
- **Monkeypatching in Tests:** `monkeypatch.setattr(tarif_rules_module, "REGISTERED_RULES", [...])`
  — Service importiert `from app.solver import tarif_rules as _tarif_rules` (Modul-Referenz,
  nicht `from ... import REGISTERED_RULES`), damit Monkeypatch greift.
- **`TarifSeverity`-StrEnum** lebt in `backend/app/schemas/tarif_warning.py`;
  `tarif_rules.py` importiert von dort — keine Doppeldefinition, kein Zirkel-Import.
- **`compute_tarif_warnings(db, plan_id)`** in `tarif_validation_service.py`: analog
  `conflict_service.detect_conflicts` — Plan-Load → 404 via `PlanNotFoundError` →
  alle registrierten Regeln aufrufen → Warnings aggregieren (keine Deduplizierung).

### Backend — Plan-Excel-Export (M6-001)
- **Service-Layering streng:** `openpyxl`-Imports nur in
  `backend/app/services/plan_export_service.py`. `api/plans.py` ruft
  ausschließlich `build_plan_xlsx(db, plan_id)` auf — kein Workbook-Code in `api/`.
- **`build_plan_xlsx(db, plan_id) -> bytes`:** Plan laden via
  `plan_repository.get_plan`; `None` → `PlanNotFoundError`. Workbook
  in-memory via `BytesIO`, `wb.save(buffer)`, `buffer.getvalue()` zurückgeben.
  `seek(0)` nicht vergessen wenn `BytesIO` weiter übergeben wird.
- **`GET /api/plans/{id}/export`** mit `StreamingResponse(BytesIO(data))` +
  MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` +
  `Content-Disposition: attachment; filename="<slug>.xlsx"`. `GET` statt `POST`
  (idempotent, kein Body, Browser-Direkt-Download — ADR-063).
- **Slug-Konvention:** `re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-")` +
  `.xlsx`; Fallback `plan-{id}.xlsx` bei leerem Slug.
- **Default-Schema (ADR-064):** Ein Sheet `Dienste`. Spalten: Datum,
  Wochentag, Schichttyp (Kurz), Schichttyp, Arzt-Kürzel, Arzt, Gepinnt,
  Notiz. Sortierung: `shift_date ASC`, `display_order ASC`. Datum als
  ISO-8601-String. Wochentag: `("Mo","Di","Mi","Do","Fr","Sa","So")[weekday()]`.
  Schema-Anpassung für klinikinternes Tool folgt nach Klärung von OQ-007.

### Frontend — Plan-Excel-Export (M6-001)
- **Direkt-Download via `window.location.assign`:** Export-Button in
  `CommandBar.primaryAction` → `onClick: () => window.location.assign(\`/api/plans/\${id}/export\`)`.
  Kein `fetch`, kein Blob, kein URL.createObjectURL — `GET`+`Content-Disposition`
  triggert den Browser-Download direkt.
- **Kein neuer Hook, kein Query-Key:** Export ist idempotent und zustandslos;
  TanStack Query nicht involviert.
- **jsdom-Test für `window.location.assign`:**
  `Object.defineProperty(window, 'location', { value: { assign: vi.fn() }, writable: true })`
  — direktes Überschreiben wirft in jsdom.

### Frontend — Logo & Branding (M7-001)
- **LogoMark-Komponente:** `frontend/src/components/dp/LogoMark.tsx` exportiert `LogoMarkSvg`, `LogoMark`, `LogoWordmark`. Default: size=38, bg=Terrakotta `#C66A3D`, fg=Creme `#FFF8EF`, radius=12, pulse=false.
- **Pulse-Animation:** aktiv nur wenn `pulse={true}`. CSS-Keyframes in `frontend/src/index.css` (`[data-pulse] .dp-logo-bars [data-bar]`). `@media (prefers-reduced-motion: reduce)` deaktiviert Animation.
- **Kein Plan-Generator-Store in Phase A:** `pulse` bleibt `false`. Phase B verdrahtet `isGenerating`.

### Frontend — Plan-Grid-Affordance (M7-001)
- **Layer-Priorität in ShiftCell:** filled → dragging → hover-target → idle-dot. Einfacher visueller `else-if`-Switch — keine komplexe State-Maschine.
- **Hover-State auf PlanGrid-Level:** `useState<{row, col}|null>` — kein per-Zellen-State. `onMouseLeave` des Grid-Containers resettet. `onFocus` auf ShiftCell triggert denselben Crosshair für Keyboard-Nutzer.
- **Ebene E (Drag-Modus) visuell bereit:** ShiftCell akzeptiert `dragState` und `dragPreviewDoctor` Props. DnD-Verdrahtung in Dienste-Ansicht folgt in Phase B (ADR-053 bleibt offen).
- **Farben ohne neue Tokens:** `#D6CCB6` (Dot Werktag), `#CBC2AC` (Dot Wochenende), `#FAF0DC` (Row-Tint), `#FBE5D6` (Header-BG), `rgba(198,106,61,0.08)` (Crosshair-Zell-BG) — direkte Hex-Werte, kein neuer Token.
- **`DragState` exportiert:** `export type DragState` in `ShiftCell.tsx` — Consumer können den Typ importieren ohne Doppeldefinition.
- **ShiftCell-Größe:** `w-full h-full` (kein `aspect-square`) — passt zum RotationDropCell-Muster, kein Overflow bei breiten Spalten.
- **Grid-Spaltenbreite:** `minmax(36px, 1fr)` in beiden Grids (PlanGrid + RotationGrid) — skaliert auf Containerbreite, scrollt ab < 36px.

### Frontend — Dashboard-Pattern (M7-002)
- **`GET /api/plans/current`** liefert 200+Plan oder 204 (kein Plan für heute) — kein 404.
  Route muss in `plans.py` VOR `/{plan_id}` definiert sein (FastAPI matcht sonst gegen `plan_id="current"`).
- **`GET /api/plans/{id}/dashboard?today=YYYY-MM-DD`** aggregiert KPIs, today_shifts,
  coverage_by_department, attention in einer Response. Service `dashboard_service.py`
  wiederverwendet `conflict_service.detect_conflicts` — nie duplizieren.
- **Hook `useCurrentPlan`:** 204 → `null` via custom `fetch` (nicht `apiGet`, da 204 kein Body).
  Query-Key-Objekt `currentPlanKeys` exportiert.
- **Hook `useDashboardSummary`:** `enabled: planId != null`. Query-Keys `dashboardKeys`.
- **Dashboard-Types** manuell in `frontend/src/lib/types.ts` ergänzt (OpenAPI-Generator läuft
  nicht auf Feature-Branches — manuell hinzufügen, bei Merge generieren lassen).
- **Empty-State-Pattern:** Wenn `currentPlan === null`, alle Karten zeigen
  „Kein Plan für diesen Monat", KPI-Tiles zeigen `—`, CTA → `/plans/new`.
- **Keine neuen `dp/`-Primitives** für Dashboard — Komponenten inline in `features/today/`.
- **Layout:** `grid grid-cols-[1.4fr_1fr] gap-7 px-10 py-6`. Karten: `rounded-2xl bg-card border border-line p-5`.

### Frontend — shadcn/ui-Fallstricke
- **SelectItem darf keinen Leerstring als value haben** (`value=""` wirft Radix-Runtime-Error). Für „keine Auswahl" / nullable Felder Sentinel `"__none__"` verwenden und im `onValueChange`-Handler auf `null` mappen: `(v) => field.onChange(v === '__none__' ? null : v)`.
- **MiniRail aktive Items:** Farbe `bg-[#C66A3D] text-[#FFF8EF]` (Terrakotta/Creme = Logo-Farben), nicht `bg-ink text-paper`.

### Frontend — Command-Palette-Pattern (M1-012)
- **`CommandPaletteProvider`** sitzt in `App.tsx` innerhalb `BrowserRouter`, außerhalb `<Routes>`. Registriert globalen `keydown`-Listener für `metaKey || ctrlKey + K`. Rendert `<CommandPalette />` intern.
- **`useCommandPalette()`** aus `@/features/command-palette/useCommandPalette` — wirft außerhalb Provider. Liefert `{ isOpen, open, close, toggle }`.
- **Hotkey-Pattern:** Ein Listener, beide Modifier (`metaKey || ctrlKey`) — kein OS-Branch. Nur Anzeige verzweigt via `lib/platform.ts`.
- **Plattform-Helper:** `isMac()`, `getModifierKey()`, `getModifierGlyph()` in `frontend/src/lib/platform.ts`. Nicht verstreut. Mac → `⌘K`, Win/Linux → `Strg+K`.
- **Entity-Items lazy:** `useEntityItems(isOpen)` — alle 3 Queries mit `enabled: isOpen`. Query-Keys (`doctorKeys`, `planKeys`, `departmentKeys`) aus Feature-Hooks wiederverwenden — nicht neu definieren.
- **Recents:** Storage-Key `dp-command-palette-recents`, max 5, deduped per `id`. API: `getRecents()`, `pushRecent()`, `clearRecents()` in `features/command-palette/recents.ts`.
- **Tests:** Pages mit `CommandBar` müssen `useCommandPalette` mocken: `vi.mock('@/features/command-palette/useCommandPalette', () => ({ useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }) }))`.

### Frontend — Unified Plan Grid (M2-007)
- **Kein Dual-Tab mehr:** `PlanPage` hat keinen `view`-State und keine Tab-UI. `UnifiedPlanGrid` ist die einzige Grid-Komponente. `PlanGrid.tsx`, `RotationGrid.tsx`, `planGridUtils.ts`, `rotationGridUtils.ts` sind gelöscht.
- **Row-Derivation:** `buildUnifiedRows(departments, rotations)` in `unifiedGridUtils.ts` (pure Funktion). Gibt `UnifiedRow[]` zurück — drei Typen: `header`, `placeholder`, `rotation`. Für jeden aktiven Bereich: ein Header + Rotation-Zeile pro `RotationAssignment` (oder Placeholder wenn leer). Mehrere Ärzte pro Bereich = mehrere Zeilen unter demselben Header.
- **Cell-Rendering-Priorität:** `resolveCell(row, dayKey, shifts, absences)` → Absence-Code vor Shift-Code vor leer. Absence-Code-Mapping in `absenceCode()`: URLAUB→U, KRANKHEIT→K, FORTBILDUNG→Fo, ELTERNZEIT→EZ, MUTTERSCHUTZ→MuSchu, SONSTIGES→DIV. `inRotation`-Flag steuert Hintergrundfarbe + Opacity.
- **Bereichsfarbe:** `getDepartmentColor(department)` in `bereichColors.ts` — eigene Farbe wenn gesetzt, sonst `display_order % 8` auf 8-Farben-Fallback-Palette. `getDepartmentColorMuted(department)` gibt Hex + `'40'` (25% Alpha).
- **DnD-ID-Konventionen (ergänzt M3-001-Konventionen):**
  - Drag-Source ShiftType: `shift-{shiftTypeId}` — Helpers `makeShiftTypeDragId` / `parseShiftTypeDragId` in `ShiftTypeDragBar.tsx`
  - Drop-Target Bereich-Header: `rotation-header-{deptId}` — Helpers `makeBereichHeaderDropId` / `parseBereichHeaderDropId` in `BereichHeaderRow.tsx`
  - Drop-Target Tag-Zelle: `cell-{rotationId}-{yyyy-MM-dd}` — Helper `makeCellDropId` in `UnifiedShiftCell.tsx`; Parsen inline in `PlanPage` via Regex
- **ShiftType-Drop-Auflösung:** Drop `shift-{id}` auf `cell-{rotationId}-{day}` → rotationId → doctor_id → Shift via `findShiftId(shifts, day, shiftTypeId)` → Toast (nicht verfügbar) / Toast (gepinnt) / confirm (Überschreiben) / PATCH. Keine harte Verfügbarkeitsprüfung (ADR-080).
- **Fokus-V/N-Toggle:** `focusMode: 'alle' | 'vn'` als Session-State in `PlanPage`. `UnifiedShiftCell` dimmt Nicht-V/N-Zellen bei `focusMode === 'vn'`. `ShiftTypeDragBar` dimmt Nicht-V/N-Chips. Kein URL-Param.
- **`GET /api/plans/{id}/absences`:** Liefert alle Abwesenheiten von Ärzten mit aktiver Rotation im Plan, deren Periode den Plan-Zeitraum überlappt. Hook `usePlanAbsences` mit Query-Key `planAbsenceKeys.byPlan(planId)`.
- **`Department.color`:** Nullable Hex-String (`VARCHAR(9)`). Frontend: `<input type="color">` + Reset-Button in `DepartmentFormDialog`. Backend: in `DepartmentBase`, `DepartmentUpdate`, `DepartmentRead` als `color: str | None`.

## Entwicklungs-Workflow
- **Implementierung immer via `superpowers:subagent-driven-development`:** Für alle
  Implementierungsaufgaben mit Implementierungsplan (aus `superpowers:writing-plans`)
  stets den Subagent-Driven-Weg wählen. Kein Inline-Coding im Haupt-Thread.
  Frischer Subagent pro Task + Spec-Review + Code-Quality-Review nach jedem Task.
- **Brainstorming vor Implementierung:** `superpowers:brainstorming` → Plan →
  `superpowers:subagent-driven-development`. Diese Reihenfolge nie überspringen.

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
