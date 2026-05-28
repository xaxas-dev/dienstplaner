# Constraints

Constraint-Klassen: logisch hart (nie overridebar), regulatorisch hart
(overridebar per Override-Mechanismus A/B/C), soft (Optimierungsziele).
Alle Tarifregeln sind zentral in `backend/app/solver/tarif_rules.py` definiert.

## Inhaltsverzeichnis

- [Read-only Konflikt-Engine (M2-005)](#read-only-konflikt-engine-m2-005-vor-dem-solver)
- [Rotations-Zuweisung via Drag & Drop (M3-001)](#rotations-zuweisung-via-drag--drop-m3-001-phase-a)
- [INA-Verfügbarkeitsanzeige (M4-001)](#ina-verfügbarkeitsanzeige-m4-001-phase-a)
- [Solver-Constraints (M8-001, Timefold)](#solver-constraints-m8-001-timefold-integration)
  - [1. DOUBLE_BOOKED](#1-double_booked-logisch-hart-constraintiddouble_booked)
  - [Apply-Endpoint (M8-002)](#apply-endpoint-m8-002)
  - [2. ABSENT_DOCTOR](#2-absent_doctor-logisch-hart-constraintidabsent_doctor-m8-003)
  - [3. FAIR_DISTRIBUTION](#3-fair_distribution-soft-constraintidfair_distribution-m8-004)
  - [Folge-Milestones](#folge-milestones-noch-nicht-implementiert)
- [Tarif-Validation-Framework (M5-001)](#tarif-validation-framework-m5-001-phase-a)
- [Excel-Export (M6-001)](#excel-export-m6-001-phase-a)

---

## Read-only Konflikt-Engine (M2-005, vor dem Solver)

Vor der Solver-Integration existiert eine read-only Konflikt-Engine mit zwei Typen:

- **NOT_AVAILABLE** — Arzt ist einer Schicht zugewiesen, aber laut
  `get_ina_availability` nicht INA-verfügbar (blockierende Rotation,
  Abwesenheit, INAExclusion).
- **DOUBLE_BOOKED** — Arzt ist am selben Kalendertag mehreren Schichten
  zugewiesen.

Konflikte blockieren nichts (weiche Philosophie). Sie werden read-only über
`GET /api/plans/{plan_id}/conflicts` und eingebettet in
`GET /api/plans/{plan_id}/shifts` zurückgegeben.

## Rotations-Zuweisung via Drag & Drop (M3-001, Phase A)

Ärzte können per Drag & Drop auf RotationGrid-Zellen gezogen werden.
Der Drop schreibt **nicht direkt** in die DB — er öffnet den
`RotationAssignPopover`, in dem der User `valid_from`/`valid_to` bestätigt
(ADR-054). Kein Constraint-Check im Drop-Handler.

Drag-Source: `doctor-{id}` (Helper `makeDoctorDragId`/`parseDoctorDragId`).
Drop-Target: `rotation-{departmentId}-{yyyy-MM-dd}` (Helper
`makeRotationDropId`/`parseRotationDropId`).

`PointerSensor` mit `distance: 4` verhindert versehentliche Drags aus
Klick-Interaktionen. Screenreader-Announcements in Deutsch via
`DndContext.accessibility`.

## INA-Verfügbarkeitsanzeige (M4-001, Phase A)

Read-only Marker in RotationGrid (während Drag, `ring-amber-400/60`) und
DoctorAssignPopover (Amber-Dot am Avatar). Keine Schreibpfad-Blockade —
Drop und Auswahl bleiben in allen Fällen erlaubt (ADR-033).

Quelle: `get_ina_availability_for_period` aus `ina_availability_service.py`
(drei Quellen: aktive Rotation in blockierendem Bereich, INAExclusion,
Absence). Analog zur Konflikt-Engine (M2-005, ADR-035): read-only,
kein Caching, kein Schreibpfad-Eingriff.

Frontend-Hooks: `useDoctorAvailability` (per Doctor/Zeitraum, aktiviert
durch `activeDragDoctor`) und `useAvailabilityForDate` (via `useQueries`
für alle Ärzte an einem Datum im DoctorAssignPopover). Tooltip zeigt
`reasons` (z. B. „Rotation CK", „Abwesenheit: Urlaub").

Absence-Mutationen invalidieren `availabilityKeys` (domänenübergreifende
Cache-Invalidierung, da Absence eine der drei INA-Quellen ist).

## Solver-Constraints (M8-001, Timefold-Integration)

Implementiert in `backend/app/solver/constraints.py`.
Constraint-IDs und Klassifizierung in `backend/app/solver/tarif_rules.py`.

### 1. DOUBLE_BOOKED (logisch-hart, ConstraintId.DOUBLE_BOOKED)

**Regel:** Kein Arzt darf am selben Kalendertag mehr als einmal eingeplant sein.

**Klasse:** Logisch-hart — nie overridebar, kein Override-Mechanismus A/B/C.

**Implementierung:**
```python
cf.for_each_unique_pair(SolverShift,
    Joiners.equal(lambda s: s.shift_date),
    Joiners.equal(lambda s: s.doctor),
).filter(lambda s1, s2: s1.doctor is not None)
 .penalize(HardSoftScore.ONE_HARD)
 .as_constraint(ConstraintId.DOUBLE_BOOKED)
```

Offene Shifts (doctor=None) werden durch den Filter ausgeschlossen.
Penalty: −1 Hard pro verletztem Paar.

## Apply-Endpoint (M8-002)

`POST /api/plans/{id}/apply` schreibt Solver-Vorschläge in die DB — prüft
**keine** semantischen Constraints. Weiche Validierung wie Phase A:

- Datenkonsistenz hart: Plan existiert, Shift gehört zum Plan, Doctor aktiv.
- Gepinnte Shifts übersprungen (kein Fehler, in `skipped_pinned`).
- `is_pinned` wird nicht verändert.
- Konflikte werden **nicht** im Apply berechnet; Client refetcht
  `GET /plans/{id}/shifts` (Decoupling per ADR-038/ADR-051).

### 2. ABSENT_DOCTOR (logisch-hart, ConstraintId.ABSENT_DOCTOR, M8-003)

**Regel:** Kein Arzt darf an einem Datum eingeplant werden, an dem er nach
INA-Regeln nicht verfügbar ist (blockierende Rotation, INAExclusion, Absence).

**Klasse:** Logisch-hart — nie overridebar.

**Implementierung:**
```python
cf.for_each(SolverShift)
  .filter(lambda s: s.doctor is not None
      and s.shift_date in s.doctor.unavailable_dates)
  .penalize(HardSoftScore.ONE_HARD)
  .as_constraint(ConstraintId.ABSENT_DOCTOR)
```

**Availability-Snapshot-Pattern (ADR-071):** Timefold-Constraints dürfen
keine DB-Queries ausführen. Vor dem Solve berechnet `to_solver()` einmalig
`get_ina_availability_for_period(db, doctor_id, plan_start, plan_end)` pro
aktivem Arzt und speichert das Ergebnis als `unavailable_dates: frozenset[date]`
in `SolverDoctor`. Der Constraint-Filter ist ein O(1)-Set-Lookup.

**Wichtig:** `POST /apply` prüft ABSENT_DOCTOR nicht — weiche Validierung
Phase A (ADR-033). Manuelle Zuweisung eines abwesenden Arztes bleibt möglich.

### 3. FAIR_DISTRIBUTION (soft, ConstraintId.FAIR_DISTRIBUTION, M8-004)

**Regel:** Pro (Arzt, Schichttyp)-Kombination wird ein FTE-proportionales
Soll berechnet: `target(d, st) = floor(count_shifts_of_type(st) × fte(d) / sum_fte)`.
Jede Schicht, die das Soll eines Arztes überschreitet, erzeugt −1 Soft-Penalty.

**Klasse:** Soft — beeinflusst nur den Soft-Score, nie die Feasibility
(`hard_score >= 0`).

**FTE-Quelle:** `get_fte_for_period(db, doctor_id, plan_start, plan_end)` aus
`employment_period_service.py`. Zeitanteilig gewichtetes Mittel aus `EmploymentPeriod`-
Einträgen im Plan-Zeitraum. Fallback `100` wenn keine Period vorhanden.

**Snapshot:** Targets werden in `to_solver()` vorberechnet und als
`SolverDoctor.fair_targets: dict[int, int]` (shift_type_id → target_count)
übergeben. Kein DB-Zugriff im Constraint (ADR-071-Pattern).

**Implementierung:**
```python
cf.for_each(SolverShift)
  .filter(lambda s: s.doctor is not None)
  .group_by(lambda s: s.doctor, lambda s: s.shift_type_id, ConstraintCollectors.count())
  .filter(lambda doc, st, count: count > doc.fair_targets.get(st, 0))
  .penalize(HardSoftScore.ONE_SOFT, lambda doc, st, count: count - doc.fair_targets.get(st, 0))
  .as_constraint(ConstraintId.FAIR_DISTRIBUTION)
```

**Nur Über-Soll penalisiert** (Over-Target-Only). Ärzte mit 0 Schichten eines
Typs erscheinen nicht im Stream — keine Phantom-Pivot-Komplexität.

**Pinned Shifts** zählen in `actual`. Manuelle Ungleichverteilung durch Pinning
erzeugt unvermeidliche Penalty — erwartetes Verhalten.

### Folge-Milestones (noch nicht implementiert)

| Constraint-ID | Klasse | Beschreibung |
|---------------|--------|--------------|
| max-weekly-hours | Regulatorisch-hart | ArbZG max. Wochenstunden |
| min-rest-time | Regulatorisch-hart | Mindestruhezeit zwischen Diensten (TV-Ärzte/TdL) |

Keine Tarif-Werte dürfen ohne Rückfrage erfunden werden — alle regulatorischen
Constraints kommen erst nach Klärung mit Domänenexperten (OQ-006).

## Tarif-Validation-Framework (M5-001, Phase A)

Read-only Tarif-Warnings als zweiter Marker neben der Konflikt-Engine (ADR-060).
Pipeline in `backend/app/services/tarif_validation_service.py`, Endpoint
`GET /api/plans/{id}/tarif-warnings`.

**Plug-in-Architektur (ADR-059):**
- `TarifRule`-Protocol in `backend/app/solver/tarif_rules.py`: `id: ConstraintId`,
  `severity: TarifSeverity`, `evaluate(db, plan_id) -> list[TarifWarning]`
- `REGISTERED_RULES: list[TarifRule] = []` — leer im Prod-Code
- Neue Regeln implementieren das Protocol und werden in `REGISTERED_RULES` eingetragen
  (erst nach Klärung konkreter Tarif-Werte, OQ-006)

**Severity-Klassifizierung** (`TarifSeverity` StrEnum):
- `info` — Hinweis ohne Handlungsbedarf
- `warning` — Tarif-Risiko, sollte geprüft werden
- `critical` — klarer Verstoß (z. B. ArbZG-Grenzwert überschritten)

**Frontend-Marker (ADR-061):** Sand-Dot (§, oben links) am ShiftCell —
dezenter als Konflikt-Dot (!, oben rechts). Klick öffnet ContextPanel mit
`TarifWarning`-Liste (Severity-Chip + rule_id + message). Kein Schreibpfad-Eingriff.

**Noch nicht implementierte Constraints** (warten auf Domänenklärung):

| Constraint-ID | Klasse | Beschreibung |
|---------------|--------|--------------|
| max-weekly-hours | Regulatorisch-hart | TV-Ärzte/TdL + ArbZG max. Wochenstunden |
| min-rest-time | Regulatorisch-hart | Mindestruhezeit zwischen Diensten |
| max-consecutive-days | Regulatorisch-hart | Max. aufeinanderfolgende Arbeitstage |
| fairness-distribution | Soft | Implementiert (M8-004) — FTE-gewichtet, per ShiftType |

## Excel-Export (M6-001, Phase A)

Read-only Export des aktuellen Plan-Stands als `.xlsx`-Datei.
Kein Constraint-Check, kein Schreibpfad-Eingriff.

**Endpoint:** `GET /api/plans/{id}/export`
**Service:** `backend/app/services/plan_export_service.py` — `build_plan_xlsx(db, plan_id) -> bytes`
**Bibliothek:** `openpyxl` (Stack-Bestandteil)

**Schema (ADR-064 — Default bis Klinik-Tool-Spec vorliegt):**
Sheet `Dienste`. Spalten: `Datum`, `Wochentag`, `Schichttyp (Kurz)`,
`Schichttyp`, `Arzt-Kürzel`, `Arzt`, `Gepinnt`, `Notiz`.
Eine Zeile pro Shift. Sortierung: `shift_date ASC`, `display_order ASC`.
Datum als ISO-8601-String. Wochentag als deutsche Kurzform (Mo–So).

**Noch nicht implementiert:**
- Klinik-tool-spezifisches Schema (wartet auf OQ-007)
- Pivot-Layout (Datum × Schichttyp)
- Rotation-/Stammdaten-Sheets
