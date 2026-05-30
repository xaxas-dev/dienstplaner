# Task M8-007: Solver-Constraint MAX_WEEKLY_HOURS (regulatorisch-hart)

## Ziel

Zweite regulatorisch-harte Solver-Constraint auf Basis der in M8-006 eingeführten
Zeitdaten-Snapshots (`shift_start_minutes`, `shift_end_minutes`): Kein Arzt darf
mehr als 48 Stunden pro ISO-Kalenderwoche arbeiten (ArbZG §3 Abs. 1).

Opt-out-Stufen (BD-I: 58 h, BD-II: 54 h nach §7 Abs. 5 TV-Ärzte/TdL) sind
Out of Scope für Phase B — einheitliche 48-h-Schwelle für alle Ärzte.

## Bindende Entscheidungen

1. **Einheitliche 48-h-Schwelle** für Phase B: Kein per-Arzt-Opt-out-Feld,
   keine Alembic-Migration. Opt-out ist selten und erfordert Individualvereinbarung
   — M8-007+ bei Bedarf.

2. **ISO-Wochengruppierung:** `_iso_week_key(start_minutes)` gibt `(year, week)`-Tuple
   zurück. Jahreswechsel korrekt (ISO-Jahr ≠ Kalenderjahr bei Dezember/Januar).

3. **`ConstraintCollectors.sum()` verifiziert** (Spike via Tests):
   `ConstraintCollectors.sum(lambda s: duration)` funktioniert in timefold==1.24.0b0.

4. **JPy-Einschränkung (ADR-086):** `date.isocalendar()` liefert im JVM-Interpreter
   eine Liste `[year, week, weekday]`, kein Python-NamedTuple. Attributzugriff
   `.year`/`.week` scheitert — Index-Zugriff `iso[0]`/`iso[1]` nötig.
   Gilt für alle Python-Objekte in Timefold-Constraint-Lambdas.

5. **Penalty-Gewicht:** `total_min - MAX_WEEKLY_HOURS_MINUTES` (Überschuss-Minuten).
   Skaliert linear mit Schwere.

## Umgesetzte Sub-Schritte

### A — Tariff-Konstanten & ConstraintId
- `ConstraintId.MAX_WEEKLY_HOURS = "max-weekly-hours"` in `tarif_rules.py`
- `MAX_WEEKLY_HOURS_MINUTES: int = 48 * 60` (2880)
- `REGULATORISCH_HART` frozenset erweitert

### B — Constraint-Implementierung
- `_iso_week_key(start_minutes: int) -> tuple[int, int]` in `constraints.py`
- `max_weekly_hours()` via `group_by(doctor, iso_week, sum(duration))`
- In `constraint_definitions` eingehängt (zwischen `min_rest_time` und `fair_distribution`)
- JPy-Index-Zugriff statt NamedTuple-Attribute (ADR-086)

### C — Tests + E501-Fixes
- 4 neue Tests: Grenzwert 48h, Überschuss 1min (→ hard_score −1), 2-Wochen-Verteilung,
  Null-Zeiten (Graceful Degradation)
- Pre-existing E501-Fehler in MIN_REST-Tests (M8-006-Code) mit Hilfsvariablen behoben

## Akzeptanzkriterien (alle erfüllt)

- [x] `ConstraintId.MAX_WEEKLY_HOURS` + `MAX_WEEKLY_HOURS_MINUTES = 2880`
- [x] `REGULATORISCH_HART` enthält `MAX_WEEKLY_HOURS`
- [x] `max_weekly_hours()` Constraint implementiert, in `constraint_definitions` eingehängt
- [x] `_iso_week_key()` ISO-Wochentrennung korrekt (inkl. Jahreswechsel)
- [x] `ConstraintCollectors.sum()` verifiziert (timefold==1.24.0b0)
- [x] 4 Constraint-Tests grün
- [x] 432 Backend-Tests insgesamt grün
- [x] ruff clean
- [x] ADR-086 in decisions.md
- [x] constraints.md: Abschnitt 7 MAX_WEEKLY_HOURS + Folge-Milestones aktualisiert
- [x] CLAUDE.md: sum()-API + JPy-Einschränkung dokumentiert

## Out of Scope

- Opt-out-Stufen per Arzt (BD-I: 58 h, BD-II: 54 h) — M8-007+
- `Doctor.opt_out_bd_level`-Feld + Alembic-Migration
- Frontend-Anzeige der Wochenstunden-Verletzung im Solver-Diff
- Override-Mechanismus A/B/C

## Abschluss

- **Datum:** 2026-05-30
- **Branch:** main (direkt)
- **Commits:**
  - `docs: M9-001 milestone closure — ADR-084/085, roadmap update`
  - `feat(solver): M8-007 MAX_WEEKLY_HOURS Constraint (ArbZG §3, 48 h/Woche)`
  - `docs: M8-007 abschluss — ADR-086, constraints.md, CLAUDE.md`
- **Testergebnis:** 432 Backend-Tests grün; ruff clean; kein JPy-NamedTuple-Fehler.
- **Offene Voraussetzungen:** Java 17+ (Eclipse Temurin 21) für Solver-Tests.
  Opt-out-Stufen für M8-007+ geplant (OQ-010).
