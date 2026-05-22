# Constraints

Constraint-Klassen: logisch hart (nie overridebar), regulatorisch hart
(overridebar per Override-Mechanismus A/B/C), soft (Optimierungsziele).
Alle Tarifregeln sind zentral in `backend/app/solver/tarif_rules.py` definiert.

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

### Folge-Milestones (noch nicht implementiert)

| Constraint-ID | Klasse | Beschreibung |
|---------------|--------|--------------|
| absent-doctor | Logisch-hart | Arzt ist abwesend (Absence/INAExclusion/blockierende Rotation) |
| max-weekly-hours | Regulatorisch-hart | ArbZG max. Wochenstunden |
| min-rest-time | Regulatorisch-hart | Mindestruhezeit zwischen Diensten (TV-Ärzte/TdL) |
| fairness-distribution | Soft | Gleichmäßige Dienstverteilung unter Ärzte |

Keine Tarif-Werte dürfen ohne Rückfrage erfunden werden — alle regulatorischen
Constraints kommen erst nach Klärung mit Domänenexperten.

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
| fairness-distribution | Soft | Gleichmäßige Dienstverteilung |

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
