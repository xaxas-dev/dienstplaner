# Design: Tarif-Warnungen aktivieren (M11-001)

**Datum:** 2026-06-01  
**Status:** Genehmigt  
**Scope:** Backend-only. 1 neues File, 2 geänderte Files.

---

## Ziel

`REGISTERED_RULES` in `tarif_rules.py` mit 4 konkreten Regelklassen befüllen, sodass der §-Dot im Plan-Grid echte Tarifverletzungen anzeigt. Gleichzeitig Bug-Fix: Ebene-B-Overrides (Arzt + Regel) wurden bisher im `_is_overridden`-Check ignoriert.

---

## Kontext

- **M5-001** lieferte die Pipeline: `TarifRule`-Protocol, leerer `REGISTERED_RULES`-Regelsatz, `GET /api/plans/{id}/tarif-warnings`, §-Dot im ShiftCell.
- **OQ-006** ist entschieden: alle Regelwerte sind hardcodiert in `tarif_rules.py`.
- **M8-005–M8-007** implementierten dieselben Constraints für den Solver — die Logik ist dort bereits verifiziert.
- `_is_overridden` in `tarif_validation_service.py` hat `snapshot.doctor_overrides` nie ausgewertet (Bug, 2 Zeilen Fix).

---

## Architektur

```
backend/app/services/tarif_rules_impl.py       NEU  — 4 Rule-Klassen
backend/app/services/tarif_validation_service.py    — Fix _is_overridden
backend/app/solver/tarif_rules.py                   — REGISTERED_RULES befüllen
backend/tests/services/test_tarif_rules_impl.py NEU — Tests (≥8 Tests)
```

`tarif_rules_impl` importiert von `tarif_rules` (Konstanten, Protocol). `tarif_rules` importiert am Ende von `tarif_rules_impl` und registriert Instanzen → kein Zirkelimport.

---

## Rule-Implementierungen

### 1. MaxBdPerMonthRule

- **Constraint-ID:** `max-bd-per-month`
- **Severity:** CRITICAL
- **Logik:** Alle zugewiesenen Shifts im Plan mit `ShiftType.is_bereitschaftsdienst = True`, gruppiert nach `doctor_id`, sortiert `shift_date ASC`. Ab Shift #5 → eine `TarifWarning` pro Excess-Shift.
- **Warning-Felder:** `shift_id` (Excess-Shift) + `doctor_id` gesetzt.
- **Override-Ebenen:** A (Plan-global), B (Arzt-level), C (Einzel-Shift).
- **Wert:** `MAX_BD_PER_MONAT = 4` (§ 7 Abs. 5a Satz 1 TV-Ärzte/TdL).

### 2. MaxWeekendsPerMonthRule

- **Constraint-ID:** `max-weekends-per-month`
- **Severity:** WARNING (Wert 2 ist Platzhalter — exakter TV-Ärzte/TdL-Wert noch zu bestätigen, analog CLAUDE.md)
- **Logik:** Alle zugewiesenen Shifts mit `shift_date.weekday() in (5, 6)`, gruppiert nach `doctor_id`, sortiert `shift_date ASC`. Ab Shift #3 → Warning.
- **Warning-Felder:** `shift_id` + `doctor_id`.
- **Override-Ebenen:** A, B, C.
- **Wert:** `MAX_WEEKEND_SHIFTS_PER_MONTH = 2`.

### 3. MinRestTimeRule

- **Constraint-ID:** `min-rest-time`
- **Severity:** CRITICAL (ArbZG §5 Abs. 1)
- **Logik:** Pro Arzt alle Shifts mit ShiftType-Zeiten laden, nach `(shift_date, start_time)` sortieren. Für jedes aufeinanderfolgende Paar:
  - `end_minutes = date.toordinal() * 1440 + end_time_minutes`
  - Overnight: wenn `end_time < start_time` → `end_minutes += 1440`
  - `gap = start_of_next_minutes - end_minutes`
  - `start_time` oder `end_time` ist `None` → Paar überspringen (Graceful Degradation)
  - `gap < MIN_REST_HOURS * 60 (660 min)` → Warning
- **Warning-Felder:** `shift_id` des zweiten Shifts (der zu früh beginnt) + `doctor_id`.
- **Override-Ebenen:** A, B, C.
- **Wert:** `MIN_REST_HOURS = 11`.

### 4. MaxWeeklyHoursRule

- **Constraint-ID:** `max-weekly-hours`
- **Severity:** CRITICAL (ArbZG §3)
- **Logik:** Pro Arzt Shifts nach ISO-Woche (year + week-number) gruppieren. Shift-Dauer: `end_minutes - start_minutes` (overnight +1440). Shifts mit `None`-Zeiten → Dauer 0 (überspringen). Limit: `get_weekly_hours_limit(doctor.opt_out_bd_level)`. Verletzung → eine Warning pro (Arzt, Woche).
- **Warning-Felder:** `shift_id=None` (Woche ist kein einzelner Shift), `doctor_id` gesetzt. Message enthält Woche + tatsächliche Minuten + Limit.
- **Override-Ebenen:** A (Plan-global), B (Arzt-level). Ebene C nicht anwendbar (`shift_id=None`).
- **Wert:** `MAX_WEEKLY_HOURS_MINUTES` per `get_weekly_hours_limit(opt_out_level)`.

---

## _is_overridden Fix

`tarif_validation_service._is_overridden` bekommt Ebene-B-Prüfung:

```python
def _is_overridden(warning: TarifWarning, snapshot: OverrideSnapshot) -> bool:
    cid = warning.rule_id
    if cid in snapshot.disabled_constraints:
        return True
    if warning.doctor_id is not None and cid in snapshot.doctor_overrides.get(
        warning.doctor_id, frozenset()
    ):
        return True
    if warning.shift_id is not None and cid in snapshot.shift_overrides.get(
        warning.shift_id, frozenset()
    ):
        return True
    return False
```

---

## Tests (`test_tarif_rules_impl.py`)

Pro Regel mind. 1 positiver (keine Verletzung) + 1 negativer (Verletzung) Test:

| Test | Beschreibung |
|------|-------------|
| `test_max_bd_no_violation` | 3 BD-Shifts → 0 Warnings |
| `test_max_bd_violation` | 5 BD-Shifts → 1 Warning für Shift #5, shift_id korrekt |
| `test_max_weekends_no_violation` | 2 Wochenend-Shifts → 0 Warnings |
| `test_max_weekends_violation` | 3 Wochenend-Shifts → 1 Warning |
| `test_min_rest_no_violation` | Zwei Shifts mit 12h Abstand → 0 Warnings |
| `test_min_rest_violation` | Zwei Shifts mit 8h Abstand → 1 Warning (zweiter Shift) |
| `test_min_rest_none_times_skipped` | Shift ohne Zeitdaten → 0 Warnings (Graceful Degradation) |
| `test_max_weekly_no_violation` | 48h/Woche exakt → 0 Warnings |
| `test_max_weekly_violation` | 50h/Woche → 1 Warning mit shift_id=None |
| `test_doctor_override_suppresses` | Ebene-B-Override → Warning unterdrückt |

Monkeypatch-Pattern (CLAUDE.md): `monkeypatch.setattr(tarif_rules_module, "REGISTERED_RULES", [rule_under_test])`.

---

## Out of Scope

- Keine Frontend-Änderungen (§-Dot existiert bereits)
- Keine neuen API-Endpoints (Pipeline existiert)
- Kein Ebene-B-Frontend-UI für doctor-level Overrides (existiert in DoctorDetailPage, M10-001)
- `MAX_CONSECUTIVE_DAYS` und `FAIR_DISTRIBUTION` sind Solver-only Soft-Constraints — kein `TarifRule`-Equivalent nötig

---

## Offene Annahmen

Keine. OQ-006 ist entschieden, alle Werte hardcodiert.
