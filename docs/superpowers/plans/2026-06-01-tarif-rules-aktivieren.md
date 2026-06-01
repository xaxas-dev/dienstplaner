# Tarif-Warnungen aktivieren (M11-001) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `REGISTERED_RULES` mit 4 konkreten Regelklassen befüllen, sodass der §-Dot im Plan-Grid echte Tarifverletzungen anzeigt; gleichzeitig Ebene-B-Override-Bug in `_is_overridden` fixen.

**Architecture:** 1 neues Service-File (`tarif_rules_impl.py`) enthält 4 TarifRule-Klassen und registriert sie per Seiteneffekt-Import beim Start. `tarif_validation_service.py` triggert die Registrierung via `import app.services.tarif_rules_impl`. Die Regel-IDs, Severity-Werte und Konstanten kommen aus `solver/tarif_rules.py` (unveränderter single-source-of-truth). Kein Zirkelimport: `tarif_rules_impl` importiert AUS `solver/tarif_rules`, nicht umgekehrt.

**Tech Stack:** Python 3.12, SQLAlchemy ORM (joinedload), pytest, existing `TarifRule` Protocol in `app/solver/tarif_rules.py`

---

## File Map

| File | Action | Verantwortung |
|------|--------|--------------|
| `backend/app/services/tarif_rules_impl.py` | CREATE | 4 Rule-Klassen + Selbstregistrierung am Modulende |
| `backend/app/services/tarif_validation_service.py` | MODIFY | Seiteneffekt-Import + `_is_overridden` Ebene-B-Fix |
| `backend/tests/services/test_tarif_rules_impl.py` | CREATE | Unit-Tests für alle 4 Regeln |
| `backend/tests/services/test_tarif_validation_service.py` | MODIFY | `test_registered_rules_is_empty_in_prod` aktualisieren |

---

## Task 1: MaxBdPerMonthRule

**Files:**
- Create: `backend/app/services/tarif_rules_impl.py`
- Create: `backend/tests/services/test_tarif_rules_impl.py`

- [ ] **Step 1: Testdatei mit Helpers und erstem failing Test anlegen**

```python
# backend/tests/services/test_tarif_rules_impl.py
from __future__ import annotations

from datetime import date, time

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401 — alle ORM-Modelle registrieren
from app.models.doctor import Doctor
from app.models.plan import Plan, PlanStatus
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.tarif_warning import TarifSeverity
from app.solver.tarif_rules import ConstraintId


# ---------------------------------------------------------------------------
# Test-Helpers
# ---------------------------------------------------------------------------


def _make_plan(db: Session) -> Plan:
    p = Plan(
        name="Testplan",
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


def _make_doctor(db: Session, name: str = "Dr. Test", opt_out_bd_level: int | None = None) -> Doctor:
    d = Doctor(name=name, opt_out_bd_level=opt_out_bd_level)
    db.add(d)
    db.flush()
    return d


def _make_shift_type(
    db: Session,
    name: str,
    short_name: str,
    is_bd: bool = False,
    start_time: time | None = None,
    end_time: time | None = None,
) -> ShiftType:
    st = ShiftType(
        name=name,
        short_name=short_name,
        is_bereitschaftsdienst=is_bd,
        start_time=start_time,
        end_time=end_time,
    )
    db.add(st)
    db.flush()
    return st


def _make_shift(
    db: Session,
    plan_id: int,
    shift_date: date,
    shift_type_id: int,
    doctor_id: int | None = None,
) -> Shift:
    s = Shift(
        plan_id=plan_id,
        shift_date=shift_date,
        shift_type_id=shift_type_id,
        doctor_id=doctor_id,
    )
    db.add(s)
    db.flush()
    return s


# ---------------------------------------------------------------------------
# MaxBdPerMonthRule
# ---------------------------------------------------------------------------


def test_max_bd_no_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    bd_type = _make_shift_type(db, "BD", "BD", is_bd=True)

    for day in range(1, 5):  # 4 BD-Shifts — genau am Limit
        _make_shift(db, plan.id, date(2026, 6, day), bd_type.id, doctor.id)

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)
    assert warnings == []


def test_max_bd_violation_produces_one_warning_per_excess_shift(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    bd_type = _make_shift_type(db, "BD", "BD", is_bd=True)

    shifts = []
    for day in range(1, 7):  # 6 BD-Shifts → 2 Excess (Shift #5 und #6)
        shifts.append(_make_shift(db, plan.id, date(2026, 6, day), bd_type.id, doctor.id))

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)

    assert len(warnings) == 2
    assert all(w.rule_id == ConstraintId.MAX_BD_PER_MONTH for w in warnings)
    assert all(w.severity == TarifSeverity.CRITICAL for w in warnings)
    assert all(w.doctor_id == doctor.id for w in warnings)
    excess_shift_ids = {shifts[4].id, shifts[5].id}
    assert {w.shift_id for w in warnings} == excess_shift_ids


def test_max_bd_unassigned_shifts_ignored(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    bd_type = _make_shift_type(db, "BD", "BD", is_bd=True)

    for day in range(1, 7):  # 6 BD-Shifts ohne doctor_id
        _make_shift(db, plan.id, date(2026, 6, day), bd_type.id, doctor_id=None)

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)
    assert warnings == []


def test_max_bd_non_bd_shifts_not_counted(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    normal_type = _make_shift_type(db, "Frühdienst", "F", is_bd=False)

    for day in range(1, 7):  # 6 Nicht-BD-Shifts
        _make_shift(db, plan.id, date(2026, 6, day), normal_type.id, doctor.id)

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)
    assert warnings == []
```

- [ ] **Step 2: Test ausführen — erwartet FAIL (ImportError)**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py::test_max_bd_no_violation -v
```
Erwartet: `ImportError: cannot import name 'MaxBdPerMonthRule'`

- [ ] **Step 3: `tarif_rules_impl.py` mit MaxBdPerMonthRule anlegen**

```python
# backend/app/services/tarif_rules_impl.py
from __future__ import annotations

from datetime import time

from sqlalchemy.orm import Session, joinedload

from app.models.doctor import Doctor
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.tarif_warning import TarifSeverity, TarifWarning
from app.solver.tarif_rules import (
    MAX_BD_PER_MONAT,
    MAX_WEEKEND_SHIFTS_PER_MONTH,
    MIN_REST_HOURS,
    ConstraintId,
    get_weekly_hours_limit,
)


class MaxBdPerMonthRule:
    id = ConstraintId.MAX_BD_PER_MONTH
    severity = TarifSeverity.CRITICAL

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .join(ShiftType, Shift.shift_type_id == ShiftType.id)
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
                ShiftType.is_bereitschaftsdienst.is_(True),
            )
            .order_by(Shift.doctor_id, Shift.shift_date)
            .all()
        )
        by_doctor: dict[int, list[Shift]] = {}
        for s in shifts:
            by_doctor.setdefault(s.doctor_id, []).append(s)

        warnings: list[TarifWarning] = []
        for doctor_id, doctor_shifts in by_doctor.items():
            for excess in doctor_shifts[MAX_BD_PER_MONAT:]:
                warnings.append(
                    TarifWarning(
                        shift_id=excess.id,
                        doctor_id=doctor_id,
                        shift_date=excess.shift_date,
                        rule_id=self.id,
                        severity=self.severity,
                        message=f"Mehr als {MAX_BD_PER_MONAT} BD/Monat (§ 7 Abs. 5a TV-Ärzte/TdL)",
                    )
                )
        return warnings
```

- [ ] **Step 4: Tests ausführen — erwartet PASS**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -k "max_bd" -v
```
Erwartet: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/tarif_rules_impl.py backend/tests/services/test_tarif_rules_impl.py
git commit -m "feat(tarif): MaxBdPerMonthRule + Tests (M11-001 Task 1)"
```

---

## Task 2: MaxWeekendsPerMonthRule

**Files:**
- Modify: `backend/app/services/tarif_rules_impl.py`
- Modify: `backend/tests/services/test_tarif_rules_impl.py`

- [ ] **Step 1: Tests anhängen**

```python
# Ans Ende von test_tarif_rules_impl.py anhängen:

# ---------------------------------------------------------------------------
# MaxWeekendsPerMonthRule
# ---------------------------------------------------------------------------


def test_max_weekends_no_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeekendsPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # June 2026: Sa=6, So=7 → Wochenende KW23; 13, 14 → KW24
    we_type = _make_shift_type(db, "WE-Dienst", "WE")

    # Genau 2 Wochenend-Shifts
    _make_shift(db, plan.id, date(2026, 6, 6), we_type.id, doctor.id)   # Sa
    _make_shift(db, plan.id, date(2026, 6, 7), we_type.id, doctor.id)   # So

    warnings = MaxWeekendsPerMonthRule().evaluate(db, plan.id)
    assert warnings == []


def test_max_weekends_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeekendsPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    we_type = _make_shift_type(db, "WE-Dienst2", "WE2")

    # 3 Wochenend-Shifts → 1 Excess
    shifts = [
        _make_shift(db, plan.id, date(2026, 6, 6), we_type.id, doctor.id),   # Sa
        _make_shift(db, plan.id, date(2026, 6, 7), we_type.id, doctor.id),   # So
        _make_shift(db, plan.id, date(2026, 6, 13), we_type.id, doctor.id),  # Sa
    ]

    warnings = MaxWeekendsPerMonthRule().evaluate(db, plan.id)

    assert len(warnings) == 1
    assert warnings[0].rule_id == ConstraintId.MAX_WEEKENDS_PER_MONTH
    assert warnings[0].severity == TarifSeverity.WARNING
    assert warnings[0].doctor_id == doctor.id
    assert warnings[0].shift_id == shifts[2].id


def test_max_weekends_weekday_shifts_not_counted(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeekendsPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    wd_type = _make_shift_type(db, "Wochentag", "WT")

    for day in range(1, 6):  # Mo–Fr
        _make_shift(db, plan.id, date(2026, 6, day), wd_type.id, doctor.id)

    warnings = MaxWeekendsPerMonthRule().evaluate(db, plan.id)
    assert warnings == []
```

- [ ] **Step 2: Test ausführen — erwartet FAIL**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -k "max_weekends" -v
```
Erwartet: `ImportError: cannot import name 'MaxWeekendsPerMonthRule'`

- [ ] **Step 3: MaxWeekendsPerMonthRule zu `tarif_rules_impl.py` hinzufügen**

```python
# Nach MaxBdPerMonthRule einfügen:

class MaxWeekendsPerMonthRule:
    id = ConstraintId.MAX_WEEKENDS_PER_MONTH
    severity = TarifSeverity.WARNING

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
            )
            .order_by(Shift.doctor_id, Shift.shift_date)
            .all()
        )
        by_doctor: dict[int, list[Shift]] = {}
        for s in shifts:
            if s.shift_date.weekday() in (5, 6):
                by_doctor.setdefault(s.doctor_id, []).append(s)

        warnings: list[TarifWarning] = []
        for doctor_id, doctor_shifts in by_doctor.items():
            for excess in doctor_shifts[MAX_WEEKEND_SHIFTS_PER_MONTH:]:
                warnings.append(
                    TarifWarning(
                        shift_id=excess.id,
                        doctor_id=doctor_id,
                        shift_date=excess.shift_date,
                        rule_id=self.id,
                        severity=self.severity,
                        message=f"Mehr als {MAX_WEEKEND_SHIFTS_PER_MONTH} Wochenend-Dienste/Monat",
                    )
                )
        return warnings
```

- [ ] **Step 4: Tests ausführen — erwartet PASS**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -k "max_weekends" -v
```
Erwartet: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/tarif_rules_impl.py backend/tests/services/test_tarif_rules_impl.py
git commit -m "feat(tarif): MaxWeekendsPerMonthRule + Tests (M11-001 Task 2)"
```

---

## Task 3: MinRestTimeRule

**Files:**
- Modify: `backend/app/services/tarif_rules_impl.py`
- Modify: `backend/tests/services/test_tarif_rules_impl.py`

- [ ] **Step 1: Tests anhängen**

```python
# Ans Ende von test_tarif_rules_impl.py anhängen:

# ---------------------------------------------------------------------------
# MinRestTimeRule
# ---------------------------------------------------------------------------


def test_min_rest_no_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # Tag-Dienst: 08:00–16:00 → Ruhezeit bis nächsten Tag 08:00 = 16h > 11h
    tag_type = _make_shift_type(db, "Tag", "T", start_time=time(8, 0), end_time=time(16, 0))

    _make_shift(db, plan.id, date(2026, 6, 1), tag_type.id, doctor.id)
    _make_shift(db, plan.id, date(2026, 6, 2), tag_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)
    assert warnings == []


def test_min_rest_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # Spätdienst: 14:00–22:00 auf June 1
    spaet_type = _make_shift_type(db, "Spät", "S", start_time=time(14, 0), end_time=time(22, 0))
    # Frühdienst: 06:00–14:00 auf June 2 → Ruhezeit = 22:00–06:00 = 8h < 11h
    frueh_type = _make_shift_type(db, "Früh", "Fr", start_time=time(6, 0), end_time=time(14, 0))

    _make_shift(db, plan.id, date(2026, 6, 1), spaet_type.id, doctor.id)
    shift2 = _make_shift(db, plan.id, date(2026, 6, 2), frueh_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)

    assert len(warnings) == 1
    assert warnings[0].rule_id == ConstraintId.MIN_REST_TIME
    assert warnings[0].severity == TarifSeverity.CRITICAL
    assert warnings[0].shift_id == shift2.id
    assert warnings[0].doctor_id == doctor.id
    assert "8h 0min" in warnings[0].message


def test_min_rest_overnight_shift_handled(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # Nachtdienst: 20:00–08:00 (overnight) auf June 1 → endet June 2 08:00
    nacht_type = _make_shift_type(db, "Nacht", "N", start_time=time(20, 0), end_time=time(8, 0))
    # Folgedienst: 12:00 June 2 → Ruhezeit 08:00–12:00 = 4h < 11h → Violation
    mittag_type = _make_shift_type(db, "Mittag", "M", start_time=time(12, 0), end_time=time(20, 0))

    _make_shift(db, plan.id, date(2026, 6, 1), nacht_type.id, doctor.id)
    shift2 = _make_shift(db, plan.id, date(2026, 6, 2), mittag_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)

    assert len(warnings) == 1
    assert warnings[0].shift_id == shift2.id


def test_min_rest_missing_times_skipped(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # ShiftType ohne Zeiten → Paar überspringen
    no_time_type = _make_shift_type(db, "Allgemein", "AG", start_time=None, end_time=None)

    _make_shift(db, plan.id, date(2026, 6, 1), no_time_type.id, doctor.id)
    _make_shift(db, plan.id, date(2026, 6, 2), no_time_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)
    assert warnings == []
```

- [ ] **Step 2: Test ausführen — erwartet FAIL**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -k "min_rest" -v
```
Erwartet: `ImportError: cannot import name 'MinRestTimeRule'`

- [ ] **Step 3: MinRestTimeRule zu `tarif_rules_impl.py` hinzufügen**

```python
# Nach MaxWeekendsPerMonthRule einfügen:

class MinRestTimeRule:
    id = ConstraintId.MIN_REST_TIME
    severity = TarifSeverity.CRITICAL

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .options(joinedload(Shift.shift_type))
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
            )
            .all()
        )
        by_doctor: dict[int, list[Shift]] = {}
        for s in shifts:
            by_doctor.setdefault(s.doctor_id, []).append(s)

        min_gap = MIN_REST_HOURS * 60
        warnings: list[TarifWarning] = []
        for doctor_id, doctor_shifts in by_doctor.items():
            sorted_shifts = sorted(
                doctor_shifts,
                key=lambda s: (s.shift_date, s.shift_type.start_time or time.min),
            )
            for i in range(len(sorted_shifts) - 1):
                s1 = sorted_shifts[i]
                s2 = sorted_shifts[i + 1]
                if s1.shift_type.end_time is None or s2.shift_type.start_time is None:
                    continue
                base1 = s1.shift_date.toordinal() * 1440
                end_m = s1.shift_type.end_time.hour * 60 + s1.shift_type.end_time.minute
                start1_m = (
                    s1.shift_type.start_time.hour * 60 + s1.shift_type.start_time.minute
                    if s1.shift_type.start_time
                    else 0
                )
                if end_m < start1_m:  # overnight
                    end_m += 1440
                end_abs = base1 + end_m
                start2_abs = (
                    s2.shift_date.toordinal() * 1440
                    + s2.shift_type.start_time.hour * 60
                    + s2.shift_type.start_time.minute
                )
                gap = start2_abs - end_abs
                if gap < min_gap:
                    warnings.append(
                        TarifWarning(
                            shift_id=s2.id,
                            doctor_id=doctor_id,
                            shift_date=s2.shift_date,
                            rule_id=self.id,
                            severity=self.severity,
                            message=(
                                f"Ruhezeit {gap // 60}h {gap % 60}min"
                                f" < {MIN_REST_HOURS}h (ArbZG §5)"
                            ),
                        )
                    )
        return warnings
```

- [ ] **Step 4: Tests ausführen — erwartet PASS**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -k "min_rest" -v
```
Erwartet: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/tarif_rules_impl.py backend/tests/services/test_tarif_rules_impl.py
git commit -m "feat(tarif): MinRestTimeRule + Tests (M11-001 Task 3)"
```

---

## Task 4: MaxWeeklyHoursRule

**Files:**
- Modify: `backend/app/services/tarif_rules_impl.py`
- Modify: `backend/tests/services/test_tarif_rules_impl.py`

- [ ] **Step 1: Tests anhängen**

```python
# Ans Ende von test_tarif_rules_impl.py anhängen:

# ---------------------------------------------------------------------------
# MaxWeeklyHoursRule
# ---------------------------------------------------------------------------


def test_max_weekly_no_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeeklyHoursRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # 5 Shifts × 9h = 45h < 48h Limit
    nine_h = _make_shift_type(db, "9h-Dienst", "9H", start_time=time(8, 0), end_time=time(17, 0))

    for day in range(1, 6):  # Mo–Fr KW23 (June 1–5, 2026)
        _make_shift(db, plan.id, date(2026, 6, day), nine_h.id, doctor.id)

    warnings = MaxWeeklyHoursRule().evaluate(db, plan.id)
    assert warnings == []


def test_max_weekly_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeeklyHoursRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # 5 Shifts × 11h = 55h > 48h Limit
    eleven_h = _make_shift_type(db, "11h-Dienst", "11H", start_time=time(7, 0), end_time=time(18, 0))

    for day in range(1, 6):  # Mo–Fr KW23
        _make_shift(db, plan.id, date(2026, 6, day), eleven_h.id, doctor.id)

    warnings = MaxWeeklyHoursRule().evaluate(db, plan.id)

    assert len(warnings) == 1
    assert warnings[0].rule_id == ConstraintId.MAX_WEEKLY_HOURS
    assert warnings[0].severity == TarifSeverity.CRITICAL
    assert warnings[0].doctor_id == doctor.id
    assert warnings[0].shift_id is None
    assert "55h 0min" in warnings[0].message


def test_max_weekly_opt_out_bd1_raises_limit(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeeklyHoursRule

    plan = _make_plan(db)
    # BD-Stufe I: Limit = 58h/Woche → 5 × 11h = 55h erlaubt
    doctor = _make_doctor(db, opt_out_bd_level=1)
    eleven_h = _make_shift_type(db, "BD1-Dienst", "B1H", start_time=time(7, 0), end_time=time(18, 0))

    for day in range(1, 6):
        _make_shift(db, plan.id, date(2026, 6, day), eleven_h.id, doctor.id)

    warnings = MaxWeeklyHoursRule().evaluate(db, plan.id)
    assert warnings == []  # 55h < 58h → keine Verletzung


def test_max_weekly_shifts_without_times_skipped(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeeklyHoursRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    no_time = _make_shift_type(db, "Zeitlos", "ZL", start_time=None, end_time=None)

    for day in range(1, 6):
        _make_shift(db, plan.id, date(2026, 6, day), no_time.id, doctor.id)

    warnings = MaxWeeklyHoursRule().evaluate(db, plan.id)
    assert warnings == []
```

- [ ] **Step 2: Test ausführen — erwartet FAIL**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -k "max_weekly" -v
```
Erwartet: `ImportError: cannot import name 'MaxWeeklyHoursRule'`

- [ ] **Step 3: MaxWeeklyHoursRule zu `tarif_rules_impl.py` hinzufügen**

```python
# Nach MinRestTimeRule einfügen:

class MaxWeeklyHoursRule:
    id = ConstraintId.MAX_WEEKLY_HOURS
    severity = TarifSeverity.CRITICAL

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .options(joinedload(Shift.shift_type))
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
            )
            .all()
        )
        doctor_ids = {s.doctor_id for s in shifts}
        doctors: dict[int, Doctor] = {
            d.id: d
            for d in db.query(Doctor).filter(Doctor.id.in_(doctor_ids)).all()
        }
        weekly: dict[tuple[int, int, int], int] = {}
        for s in shifts:
            st = s.shift_type
            if st.start_time is None or st.end_time is None:
                continue
            start_m = st.start_time.hour * 60 + st.start_time.minute
            end_m = st.end_time.hour * 60 + st.end_time.minute
            duration = end_m - start_m
            if duration < 0:
                duration += 1440
            iso = s.shift_date.isocalendar()
            key = (s.doctor_id, iso[0], iso[1])  # JPy-safe: iso[0]=year, iso[1]=week
            weekly[key] = weekly.get(key, 0) + duration

        warnings: list[TarifWarning] = []
        for (doctor_id, iso_year, iso_week), total in weekly.items():
            doctor = doctors.get(doctor_id)
            limit = get_weekly_hours_limit(doctor.opt_out_bd_level if doctor else None)
            if total > limit:
                warnings.append(
                    TarifWarning(
                        shift_id=None,
                        doctor_id=doctor_id,
                        shift_date=None,
                        rule_id=self.id,
                        severity=self.severity,
                        message=(
                            f"KW {iso_week}/{iso_year}: {total // 60}h {total % 60}min"
                            f" > {limit // 60}h Limit (ArbZG §3)"
                        ),
                    )
                )
        return warnings
```

- [ ] **Step 4: Tests ausführen — erwartet PASS**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -k "max_weekly" -v
```
Erwartet: 4 passed

- [ ] **Step 5: Alle bisherigen Tests grün**

```
cd backend && python -m pytest tests/services/test_tarif_rules_impl.py -v
```
Erwartet: alle 15 Tests passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/tarif_rules_impl.py backend/tests/services/test_tarif_rules_impl.py
git commit -m "feat(tarif): MaxWeeklyHoursRule + Tests (M11-001 Task 4)"
```

---

## Task 5: `_is_overridden` Ebene-B-Fix

**Files:**
- Modify: `backend/app/services/tarif_validation_service.py`
- Modify: `backend/tests/services/test_tarif_validation_service.py`

- [ ] **Step 1: Failing Test für Ebene-B-Unterdrückung anhängen**

```python
# Ans Ende von test_tarif_validation_service.py anhängen:


def test_doctor_level_override_suppresses_warning(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ebene-B-Override (doctor_id + constraint_id) muss Warning unterdrücken."""
    from app.models.doctor import Doctor
    from app.services.constraint_override_service import OverrideSnapshot

    plan = _make_plan(db)
    doctor = Doctor(name="Dr. Override-Test")
    db.add(doctor)
    db.flush()

    class _DoctorWarnRule:
        id = "max-bd-per-month"
        severity = "critical"

        def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
            return [
                TarifWarning(
                    rule_id=self.id,
                    severity=TarifSeverity.CRITICAL,
                    doctor_id=doctor.id,
                    message="BD-Limit überschritten",
                )
            ]

    monkeypatch.setattr(tarif_rules_module, "REGISTERED_RULES", [_DoctorWarnRule()])

    mock_snapshot = OverrideSnapshot(
        doctor_overrides={doctor.id: frozenset(["max-bd-per-month"])}
    )
    monkeypatch.setattr(svc, "get_override_snapshot", lambda _db, _pid: mock_snapshot)

    result = svc.compute_tarif_warnings(db, plan.id)

    assert result.warning_count == 0, "Ebene-B-Override muss Warning unterdrücken"
```

- [ ] **Step 2: Test ausführen — erwartet FAIL**

```
cd backend && python -m pytest tests/services/test_tarif_validation_service.py::test_doctor_level_override_suppresses_warning -v
```
Erwartet: FAIL — `AssertionError: Ebene-B-Override muss Warning unterdrücken` (warning_count == 1, nicht 0)

- [ ] **Step 3: `_is_overridden` in `tarif_validation_service.py` fixen**

Aktuelle Funktion (Zeilen 31–39) ersetzen:

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

- [ ] **Step 4: Test ausführen — erwartet PASS**

```
cd backend && python -m pytest tests/services/test_tarif_validation_service.py -v
```
Erwartet: alle Tests passed (einschließlich neuem Test)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/tarif_validation_service.py backend/tests/services/test_tarif_validation_service.py
git commit -m "fix(tarif): Ebene-B-Override in _is_overridden ausgewertet (M11-001 Task 5)"
```

---

## Task 6: Selbstregistrierung + veralteten Test aktualisieren

**Files:**
- Modify: `backend/app/services/tarif_rules_impl.py` (Selbstregistrierung anhängen)
- Modify: `backend/app/services/tarif_validation_service.py` (Seiteneffekt-Import)
- Modify: `backend/tests/services/test_tarif_validation_service.py` (veralteter Test)

- [ ] **Step 1: Selbstregistrierung am Ende von `tarif_rules_impl.py` anhängen**

```python
# Ans Ende von backend/app/services/tarif_rules_impl.py anhängen:

# Selbstregistrierung — läuft einmal beim ersten Import dieses Moduls.
# Zirkelimport-sicher: tarif_rules.py importiert NICHT von hier.
import app.solver.tarif_rules as _registry  # noqa: E402

_registry.REGISTERED_RULES.extend(
    [
        MaxBdPerMonthRule(),
        MaxWeekendsPerMonthRule(),
        MinRestTimeRule(),
        MaxWeeklyHoursRule(),
    ]
)
```

- [ ] **Step 2: Seiteneffekt-Import in `tarif_validation_service.py` einfügen**

Direkt nach den bestehenden Imports einfügen (vor `def compute_tarif_warnings`):

```python
import app.services.tarif_rules_impl  # noqa: F401 — triggert REGISTERED_RULES-Befüllung
```

Vollständige Import-Sektion nach Änderung:

```python
from __future__ import annotations

import app.services.tarif_rules_impl  # noqa: F401 — triggert REGISTERED_RULES-Befüllung
from sqlalchemy.orm import Session

from app.repositories import plan_repository
from app.schemas.tarif_warning import PlanTarifWarnings, TarifWarning
from app.services.constraint_override_service import OverrideSnapshot, get_override_snapshot
from app.services.exceptions import PlanNotFoundError
from app.solver import tarif_rules as _tarif_rules
```

- [ ] **Step 3: Veralteten Test in `test_tarif_validation_service.py` aktualisieren**

Bestehenden Test ersetzen:

```python
# ALT — löschen:
def test_registered_rules_is_empty_in_prod() -> None:
    """Stellt sicher, dass REGISTERED_RULES im Prod-Code leer bleibt."""
    assert tarif_rules_module.REGISTERED_RULES == []


# NEU — ersetzen durch:
def test_registered_rules_contains_all_four_prod_rules() -> None:
    """REGISTERED_RULES enthält nach OQ-006-Klärung genau die 4 aktiven Prod-Regeln."""
    from app.services.tarif_rules_impl import (
        MaxBdPerMonthRule,
        MaxWeekendsPerMonthRule,
        MaxWeeklyHoursRule,
        MinRestTimeRule,
    )

    rule_types = {type(r) for r in tarif_rules_module.REGISTERED_RULES}
    assert MaxBdPerMonthRule in rule_types
    assert MaxWeekendsPerMonthRule in rule_types
    assert MinRestTimeRule in rule_types
    assert MaxWeeklyHoursRule in rule_types
    assert len(tarif_rules_module.REGISTERED_RULES) == 4
```

- [ ] **Step 4: Gesamte Test-Suite für betroffene Files ausführen**

```
cd backend && python -m pytest tests/services/ -v
```
Erwartet: alle Tests passed

- [ ] **Step 5: Vollständige Backend-Test-Suite**

```
cd backend && python -m pytest -v
```
Erwartet: alle Tests passed, keine neuen Failures

- [ ] **Step 6: Final Commit**

```bash
git add backend/app/services/tarif_rules_impl.py backend/app/services/tarif_validation_service.py backend/tests/services/test_tarif_validation_service.py
git commit -m "feat(tarif): REGISTERED_RULES aktiviert — 4 Prod-Regeln registriert (M11-001)"
```

---

## Self-Review Ergebnis

**Spec-Coverage:**
- ✅ MaxBdPerMonthRule — Task 1
- ✅ MaxWeekendsPerMonthRule — Task 2
- ✅ MinRestTimeRule — Task 3
- ✅ MaxWeeklyHoursRule — Task 4
- ✅ `_is_overridden` Ebene-B-Fix — Task 5
- ✅ Selbstregistrierung + Seiteneffekt-Import — Task 6
- ✅ `test_registered_rules_is_empty_in_prod` aktualisiert — Task 6
- ✅ Monkeypatch-Kompatibilität erhalten — Task 6 Seiteneffekt-Ansatz

**Typ-Konsistenz:**
- `ConstraintId` (StrEnum) als `class.id` — erfüllt `TarifRule.id: str` via StrEnum < str ✓
- `TarifSeverity` (StrEnum) als `class.severity` — erfüllt `TarifRule.severity: str` ✓
- `shift_id=None` in MaxWeeklyHoursRule — TarifWarning.shift_id ist `int | None` ✓

**Placeholder-Scan:** Keine TBDs, keine Lücken.

**Bekannte Einschränkungen (kein Scope dieses Plans):**
- Kein Frontend-UI für Ebene-B doctor-level Overrides (existiert bereits in M10-001)
- `MAX_WEEKEND_SHIFTS_PER_MONTH = 2` bleibt Platzhalter (per CLAUDE.md-Notiz)
