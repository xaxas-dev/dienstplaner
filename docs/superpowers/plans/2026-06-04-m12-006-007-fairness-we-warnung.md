# M12-006 + M12-007 Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live-Fairness-Zähler-Sidebar (M12-006) und weichen WE-vor/nach-Urlaub-Hinweis (M12-007) in den Dienstplaner-Plan-Editor einbauen.

**Architecture:** M12-007 fügt `WeekendAroundVacationRule` in die bestehende TarifRule-Plugin-Pipeline in `tarif_rules_impl.py` ein (kein Schema-Change). M12-006 fügt eine reine Aggregationsfunktion `buildFairnessStats()` und eine togglebare `FairnessSidebar`-Komponente in `PlanPage` hinzu (keine neuen API-Calls). Tasks A und B sind unabhängig und können parallel ausgeführt werden.

**Tech Stack:** Python 3.12 / SQLAlchemy / pytest (Task A); React 18 / TypeScript / Tailwind / vitest (Tasks B+C)

---

## File Map

**Neue Dateien:**
- `backend/tests/services/test_we_urlaub_rule.py` — pytest-Tests für WeekendAroundVacationRule
- `frontend/src/features/plans/fairnessUtils.ts` — pure Aggregationsfunktion, kein React
- `frontend/src/features/plans/tests/fairnessUtils.test.ts` — vitest Unit-Tests
- `frontend/src/features/plans/components/FairnessSidebar.tsx` — Sidebar-Komponente
- `frontend/src/features/plans/tests/FairnessSidebar.test.tsx` — Render-Tests

**Geänderte Dateien:**
- `backend/app/solver/tarif_rules.py` — `ConstraintId.WE_URLAUB` hinzufügen
- `backend/app/services/tarif_rules_impl.py` — `WeekendAroundVacationRule` implementieren + registrieren
- `frontend/src/features/plans/PlanPage.tsx` — Toggle-State + useMemo + FairnessSidebar einbinden

---

## Task A: Backend — WeekendAroundVacationRule (M12-007)

**Files:**
- Modify: `backend/app/solver/tarif_rules.py`
- Modify: `backend/app/services/tarif_rules_impl.py`
- Create: `backend/tests/services/test_we_urlaub_rule.py`

- [ ] **Step 1: `ConstraintId.WE_URLAUB` eintragen**

In `backend/app/solver/tarif_rules.py` den Abschnitt `class ConstraintId` erweitern — nach `MAX_CONSECUTIVE_DAYS`:

```python
    # --- Planungs-Hinweise (Phase A, kein Tarif-Hintergrund) ---
    WE_URLAUB = "we-urlaub"
```

- [ ] **Step 2: Failing Tests schreiben**

Neue Datei `backend/tests/services/test_we_urlaub_rule.py` erstellen:

```python
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.absence import Absence, AbsenceType
from app.models.doctor import Doctor
from app.models.plan import Plan, PlanStatus
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.tarif_warning import TarifSeverity
from app.solver.tarif_rules import ConstraintId


# ---------------------------------------------------------------------------
# Helpers
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


def _make_doctor(db: Session, name: str = "Dr. Test") -> Doctor:
    d = Doctor(name=name)
    db.add(d)
    db.flush()
    return d


def _make_shift_type(db: Session, name: str = "N", short_name: str = "N") -> ShiftType:
    st = ShiftType(name=name, short_name=short_name)
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


def _make_absence(
    db: Session,
    doctor_id: int,
    absence_type: AbsenceType,
    valid_from: date,
    valid_to: date,
) -> Absence:
    a = Absence(
        doctor_id=doctor_id,
        absence_type=absence_type,
        valid_from=valid_from,
        valid_to=valid_to,
    )
    db.add(a)
    db.flush()
    return a


# Urlaub: Montag 8. Juni bis Freitag 12. Juni 2026
# Juni 2026: 1. = Mo, 6. = Sa, 7. = So, 8. = Mo, 12. = Fr, 13. = Sa, 14. = So
VACATION_FROM = date(2026, 6, 8)   # Montag
VACATION_TO   = date(2026, 6, 12)  # Freitag
SA_BEFORE     = date(2026, 6, 6)   # Samstag, 2 Tage vor Urlaub  → Warning
SO_BEFORE     = date(2026, 6, 7)   # Sonntag,  1 Tag  vor Urlaub  → Warning
SA_AFTER      = date(2026, 6, 13)  # Samstag, 1 Tag  nach Urlaub → Warning
SO_AFTER      = date(2026, 6, 14)  # Sonntag, 2 Tage nach Urlaub → Warning
FR_BEFORE     = date(2026, 6, 5)   # Freitag  (Werktag)           → kein Warning
MO_AFTER      = date(2026, 6, 15)  # Montag   (Werktag)           → kein Warning
SA_OUTSIDE    = date(2026, 6, 20)  # Samstag, 8 Tage nach Urlaub → kein Warning (außerh. 7-Tage-Fenster)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestWeekendAroundVacationRule:

    def test_saturday_before_vacation_generates_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, SA_BEFORE, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 1
        assert warnings[0].shift_date == SA_BEFORE
        assert warnings[0].doctor_id == doctor.id
        assert warnings[0].rule_id == ConstraintId.WE_URLAUB
        assert warnings[0].severity == TarifSeverity.INFO

    def test_sunday_before_vacation_generates_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, SO_BEFORE, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 1
        assert warnings[0].shift_date == SO_BEFORE

    def test_saturday_after_vacation_generates_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, SA_AFTER, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 1
        assert warnings[0].shift_date == SA_AFTER

    def test_sunday_after_vacation_generates_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, SO_AFTER, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 1
        assert warnings[0].shift_date == SO_AFTER

    def test_friday_before_vacation_no_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, FR_BEFORE, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 0

    def test_monday_after_vacation_no_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, MO_AFTER, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 0

    def test_krankheit_absence_no_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, SA_BEFORE, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.KRANKHEIT, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 0

    def test_unassigned_shift_no_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, SA_BEFORE, st.id, doctor_id=None)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 0

    def test_saturday_outside_7_day_window_no_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        # SA_OUTSIDE = 20. Juni = 8 Tage nach VACATION_TO (12. Juni) → außerhalb range(1,8)
        _make_shift(db, plan.id, SA_OUTSIDE, st.id, doctor.id)
        _make_absence(db, doctor.id, AbsenceType.URLAUB, VACATION_FROM, VACATION_TO)

        warnings = WeekendAroundVacationRule().evaluate(db, plan.id)

        assert len(warnings) == 0
```

- [ ] **Step 3: Tests laufen lassen — müssen FAIL**

```
cd backend
uv run pytest tests/services/test_we_urlaub_rule.py -v
```

Erwartetes Ergebnis: `ImportError` oder `AttributeError` — `WeekendAroundVacationRule` existiert noch nicht.

- [ ] **Step 4: `WeekendAroundVacationRule` implementieren**

In `backend/app/services/tarif_rules_impl.py`:

**4a.** Import-Zeile für `datetime` auf `date`, `time`, `timedelta` erweitern (aktuelle Zeile: `from datetime import time`):

```python
from datetime import date, time, timedelta
```

**4b.** Imports für `Absence` und `AbsenceType` nach den bestehenden Model-Imports ergänzen:

```python
from app.models.absence import Absence, AbsenceType
```

**4c.** Hilfsfunktion `_vacation_weekend_dates` vor der Klasse `MaxBdPerMonthRule` einfügen:

```python
def _vacation_weekend_dates(valid_from: date, valid_to: date) -> set[date]:
    """Sa+So im 7-Tage-Fenster unmittelbar vor valid_from und nach valid_to."""
    result: set[date] = set()
    for delta in range(1, 8):
        d_before = valid_from - timedelta(days=delta)
        if d_before.weekday() in (5, 6):
            result.add(d_before)
        d_after = valid_to + timedelta(days=delta)
        if d_after.weekday() in (5, 6):
            result.add(d_after)
    return result
```

**4d.** Klasse `WeekendAroundVacationRule` nach `MaxWeeklyHoursRule` einfügen:

```python
class WeekendAroundVacationRule:
    id = ConstraintId.WE_URLAUB
    severity = TarifSeverity.INFO

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
            )
            .all()
        )
        if not shifts:
            return []

        doctor_ids = {s.doctor_id for s in shifts}

        absences = (
            db.query(Absence)
            .filter(
                Absence.doctor_id.in_(doctor_ids),
                Absence.absence_type == AbsenceType.URLAUB,
            )
            .all()
        )

        weekend_dates_by_doctor: dict[int, set[date]] = {}
        for absence in absences:
            dates = _vacation_weekend_dates(absence.valid_from, absence.valid_to)
            weekend_dates_by_doctor.setdefault(absence.doctor_id, set()).update(dates)

        warnings: list[TarifWarning] = []
        for shift in shifts:
            if shift.shift_date in weekend_dates_by_doctor.get(shift.doctor_id, set()):
                warnings.append(
                    TarifWarning(
                        shift_id=shift.id,
                        doctor_id=shift.doctor_id,
                        shift_date=shift.shift_date,
                        rule_id=self.id,
                        severity=self.severity,
                        message="Dienst am WE direkt vor/nach Urlaub",
                    )
                )
        return warnings
```

**4e.** Regel in `REGISTERED_RULES` registrieren — am Ende der Datei `_registry.REGISTERED_RULES.extend([...])` um `WeekendAroundVacationRule()` erweitern:

```python
_registry.REGISTERED_RULES.extend(
    [
        MaxBdPerMonthRule(),
        MaxWeekendsPerMonthRule(),
        MinRestTimeRule(),
        MaxWeeklyHoursRule(),
        WeekendAroundVacationRule(),
    ]
)
```

- [ ] **Step 5: Tests laufen lassen — müssen PASS**

```
cd backend
uv run pytest tests/services/test_we_urlaub_rule.py -v
```

Erwartetes Ergebnis: 9 tests passed.

- [ ] **Step 6: Vollständige Backend-Test-Suite**

```
cd backend
uv run pytest --ignore=tests/solver -q
```

Erwartetes Ergebnis: Alle Tests grün (Solver-Test ignoriert — pre-existing JVM-Problem unter Windows).

- [ ] **Step 7: Commit**

```bash
git add backend/app/solver/tarif_rules.py \
        backend/app/services/tarif_rules_impl.py \
        backend/tests/services/test_we_urlaub_rule.py
git commit -m "feat(M12-007): WeekendAroundVacationRule — TarifWarning INFO für WE vor/nach Urlaub"
```

---

## Task B: Frontend — `fairnessUtils.ts` pure function (M12-006)

**Files:**
- Create: `frontend/src/features/plans/fairnessUtils.ts`
- Create: `frontend/src/features/plans/tests/fairnessUtils.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

Neue Datei `frontend/src/features/plans/tests/fairnessUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildFairnessStats } from '../fairnessUtils'
import type { ShiftWithDetails, RotationAssignmentWithDetails, Doctor } from '@/lib/types'
import type { components } from '@/lib/api-types'

type ShiftTypeResponse = components['schemas']['ShiftTypeResponse']

function makeShiftType(overrides: Partial<ShiftTypeResponse> = {}): ShiftTypeResponse {
  return {
    id: 1,
    name: 'Nachtdienst',
    short_name: 'N',
    applies_on_weekdays: true,
    applies_on_weekend: true,
    start_time: null,
    end_time: null,
    display_order: 0,
    active: true,
    notes: null,
    is_bereitschaftsdienst: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeShift(overrides: Partial<ShiftWithDetails>): ShiftWithDetails {
  return {
    id: 1,
    plan_id: 1,
    shift_date: '2026-06-01',
    shift_type_id: 1,
    is_pinned: false,
    is_locked: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeRotation(overrides: Partial<RotationAssignmentWithDetails>): RotationAssignmentWithDetails {
  return {
    id: 1,
    plan_id: 1,
    doctor_id: 1,
    department_id: 1,
    valid_from: '2026-06-01',
    valid_to: '2026-06-30',
    is_einarbeitung: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeDoctor(overrides: Partial<Doctor>): Doctor {
  return {
    id: 1,
    name: 'Müller, Anna',
    short_name: 'AM',
    doctor_type: 'INTERNAL',
    is_facharzt: true,
    active: true,
    weiterbildungsjahr: null,
    entry_date: null,
    virtual_entry_date: null,
    notes: null,
    opt_out_bd_level: null,
    employment_periods: [],
    qualifications: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildFairnessStats', () => {
  it('counts shifts per doctor with filter_group breakdown', () => {
    const stNacht = makeShiftType({ id: 1, filter_group: 'Nacht' })
    const stTag = makeShiftType({ id: 2, filter_group: 'Tag' })

    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: 1, shift_type_id: 1, shift_type: stNacht }),
      makeShift({ id: 2, doctor_id: 1, shift_type_id: 2, shift_type: stTag }),
      makeShift({ id: 3, doctor_id: 2, shift_type_id: 1, shift_type: stNacht }),
    ]
    const rotations: RotationAssignmentWithDetails[] = [
      makeRotation({ id: 1, doctor_id: 1 }),
      makeRotation({ id: 2, doctor_id: 2 }),
    ]
    const doctors: Doctor[] = [
      makeDoctor({ id: 1, name: 'Müller, Anna', short_name: 'AM' }),
      makeDoctor({ id: 2, name: 'Schmidt, Bert', short_name: 'BS' }),
    ]

    const { stats, groups } = buildFairnessStats(shifts, rotations, doctors)

    expect(groups).toEqual(['Nacht', 'Tag'])

    const anna = stats.find((s) => s.doctorId === 1)!
    expect(anna.total).toBe(2)
    expect(anna.byGroup['Nacht']).toBe(1)
    expect(anna.byGroup['Tag']).toBe(1)

    const bert = stats.find((s) => s.doctorId === 2)!
    expect(bert.total).toBe(1)
    expect(bert.byGroup['Nacht']).toBe(1)
    expect(bert.byGroup['Tag']).toBe(0)
  })

  it('excludes shifts without doctor_id from all counts', () => {
    const st = makeShiftType({ filter_group: 'Nacht' })
    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: undefined, shift_type: st }),
    ]
    const rotations: RotationAssignmentWithDetails[] = [makeRotation({ doctor_id: 1 })]
    const doctors: Doctor[] = [makeDoctor({ id: 1 })]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats[0].total).toBe(0)
  })

  it('counts shift without filter_group only in total, not in groups', () => {
    const stNoGroup = makeShiftType({ id: 1, filter_group: null })
    const stWithGroup = makeShiftType({ id: 2, filter_group: 'Nacht' })
    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: 1, shift_type: stNoGroup }),
      makeShift({ id: 2, doctor_id: 1, shift_type: stWithGroup }),
    ]
    const rotations: RotationAssignmentWithDetails[] = [makeRotation({ doctor_id: 1 })]
    const doctors: Doctor[] = [makeDoctor({ id: 1 })]

    const { stats, groups } = buildFairnessStats(shifts, rotations, doctors)

    expect(groups).toEqual(['Nacht'])
    expect(stats[0].total).toBe(2)
    expect(stats[0].byGroup['Nacht']).toBe(1)
  })

  it('includes doctor with rotation but zero shifts (all zeros)', () => {
    const shifts: ShiftWithDetails[] = []
    const rotations: RotationAssignmentWithDetails[] = [makeRotation({ doctor_id: 1 })]
    const doctors: Doctor[] = [makeDoctor({ id: 1 })]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats).toHaveLength(1)
    expect(stats[0].total).toBe(0)
  })

  it('excludes doctors without rotation even if they have shifts', () => {
    const st = makeShiftType({ filter_group: 'Nacht' })
    const shifts: ShiftWithDetails[] = [
      makeShift({ id: 1, doctor_id: 99, shift_type: st }),
    ]
    const rotations: RotationAssignmentWithDetails[] = []
    const doctors: Doctor[] = [makeDoctor({ id: 99 })]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats).toHaveLength(0)
  })

  it('sorts stats alphabetically by doctor name', () => {
    const shifts: ShiftWithDetails[] = []
    const rotations: RotationAssignmentWithDetails[] = [
      makeRotation({ id: 1, doctor_id: 1 }),
      makeRotation({ id: 2, doctor_id: 2 }),
    ]
    const doctors: Doctor[] = [
      makeDoctor({ id: 1, name: 'Zander, Carla' }),
      makeDoctor({ id: 2, name: 'Auer, Stefan' }),
    ]

    const { stats } = buildFairnessStats(shifts, rotations, doctors)

    expect(stats[0].doctorName).toBe('Auer, Stefan')
    expect(stats[1].doctorName).toBe('Zander, Carla')
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen FAIL**

```
cd frontend
pnpm vitest run src/features/plans/tests/fairnessUtils.test.ts
```

Erwartetes Ergebnis: `Error: Cannot find module '../fairnessUtils'`

- [ ] **Step 3: `fairnessUtils.ts` implementieren**

Neue Datei `frontend/src/features/plans/fairnessUtils.ts`:

```typescript
import type { ShiftWithDetails, RotationAssignmentWithDetails, Doctor } from '@/lib/types'

export interface FairnessStat {
  doctorId: number
  doctorName: string
  shortName: string | null
  total: number
  byGroup: Record<string, number>
}

export function buildFairnessStats(
  shifts: ShiftWithDetails[],
  rotations: RotationAssignmentWithDetails[],
  doctors: Doctor[],
): { stats: FairnessStat[]; groups: string[] } {
  const rotationDoctorIds = new Set(rotations.map((r) => r.doctor_id))

  const groups = [
    ...new Set(
      shifts
        .map((s) => s.shift_type?.filter_group)
        .filter((g): g is string => g != null && g !== ''),
    ),
  ].sort()

  const statsByDoctor = new Map<number, FairnessStat>()
  for (const doctorId of rotationDoctorIds) {
    const doctor = doctors.find((d) => d.id === doctorId)
    if (!doctor) continue
    statsByDoctor.set(doctorId, {
      doctorId,
      doctorName: doctor.name,
      shortName: doctor.short_name ?? null,
      total: 0,
      byGroup: Object.fromEntries(groups.map((g) => [g, 0])),
    })
  }

  for (const shift of shifts) {
    if (shift.doctor_id == null) continue
    const stat = statsByDoctor.get(shift.doctor_id)
    if (!stat) continue
    stat.total++
    const group = shift.shift_type?.filter_group
    if (group && group in stat.byGroup) {
      stat.byGroup[group]++
    }
  }

  const stats = [...statsByDoctor.values()].sort((a, b) =>
    a.doctorName.localeCompare(b.doctorName, 'de'),
  )

  return { stats, groups }
}
```

- [ ] **Step 4: Tests laufen lassen — müssen PASS**

```
cd frontend
pnpm vitest run src/features/plans/tests/fairnessUtils.test.ts
```

Erwartetes Ergebnis: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/fairnessUtils.ts \
        frontend/src/features/plans/tests/fairnessUtils.test.ts
git commit -m "feat(M12-006): fairnessUtils — pure Fairness-Aggregation pro Arzt/Gruppe"
```

---

## Task C: Frontend — FairnessSidebar + PlanPage-Integration (M12-006)

**Files:**
- Create: `frontend/src/features/plans/components/FairnessSidebar.tsx`
- Create: `frontend/src/features/plans/tests/FairnessSidebar.test.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

**Abhängigkeit:** Task B muss abgeschlossen sein (fairnessUtils.ts existieren).

- [ ] **Step 1: Failing Render-Tests schreiben**

Neue Datei `frontend/src/features/plans/tests/FairnessSidebar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FairnessSidebar } from '../components/FairnessSidebar'
import type { FairnessStat } from '../fairnessUtils'

const STATS: FairnessStat[] = [
  {
    doctorId: 1,
    doctorName: 'Müller, Anna',
    shortName: 'AM',
    total: 3,
    byGroup: { Nacht: 2, Tag: 1 },
  },
  {
    doctorId: 2,
    doctorName: 'Schmidt, Bert',
    shortName: 'BS',
    total: 1,
    byGroup: { Nacht: 1, Tag: 0 },
  },
]
const GROUPS = ['Nacht', 'Tag']

describe('FairnessSidebar', () => {
  it('renders group headers and sum column', () => {
    render(<FairnessSidebar stats={STATS} groups={GROUPS} onClose={vi.fn()} />)

    expect(screen.getByText('Nacht')).toBeInTheDocument()
    expect(screen.getByText('Tag')).toBeInTheDocument()
    expect(screen.getByText('∑')).toBeInTheDocument()
  })

  it('renders short names for each doctor', () => {
    render(<FairnessSidebar stats={STATS} groups={GROUPS} onClose={vi.fn()} />)

    expect(screen.getByText('AM')).toBeInTheDocument()
    expect(screen.getByText('BS')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FairnessSidebar stats={STATS} groups={GROUPS} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /schließen/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows empty-state message when stats is empty', () => {
    render(<FairnessSidebar stats={[]} groups={[]} onClose={vi.fn()} />)

    expect(screen.getByText(/keine ärzte/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen FAIL**

```
cd frontend
pnpm vitest run src/features/plans/tests/FairnessSidebar.test.tsx
```

Erwartetes Ergebnis: `Error: Cannot find module '../components/FairnessSidebar'`

- [ ] **Step 3: `FairnessSidebar.tsx` implementieren**

Neue Datei `frontend/src/features/plans/components/FairnessSidebar.tsx`:

```tsx
import { X } from 'lucide-react'
import type { FairnessStat } from '../fairnessUtils'

interface FairnessSidebarProps {
  stats: FairnessStat[]
  groups: string[]
  onClose: () => void
}

export function FairnessSidebar({ stats, groups, onClose }: FairnessSidebarProps) {
  const colTemplate = `1fr ${groups.map(() => '2.25rem').join(' ')} 2.25rem`

  return (
    <div className="w-60 shrink-0 flex flex-col border border-line rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <span className="text-xs font-semibold text-ink">Fairness</span>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-3 hover:text-ink transition"
          aria-label="Schließen"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Spalten-Header */}
      <div
        className="grid border-b border-line text-[10px] text-ink-3 font-medium bg-paper/40"
        style={{ gridTemplateColumns: colTemplate }}
      >
        <div className="px-2 py-1.5">Arzt</div>
        {groups.map((g) => (
          <div key={g} className="px-1 py-1.5 text-center truncate" title={g}>
            {g}
          </div>
        ))}
        <div className="px-1 py-1.5 text-center">∑</div>
      </div>

      {/* Arzt-Zeilen */}
      <div className="flex-1 overflow-y-auto">
        {stats.length === 0 ? (
          <div className="px-3 py-4 text-xs text-ink-3 text-center">Keine Ärzte im Plan</div>
        ) : (
          stats.map((stat) => (
            <div
              key={stat.doctorId}
              className="grid border-b border-line last:border-0 text-xs hover:bg-paper/60 transition-colors"
              style={{ gridTemplateColumns: colTemplate }}
            >
              <div className="px-2 py-1.5 truncate text-ink" title={stat.doctorName}>
                {stat.shortName ?? stat.doctorName}
              </div>
              {groups.map((g) => (
                <div
                  key={g}
                  className={`px-1 py-1.5 text-center tabular-nums ${
                    stat.byGroup[g] > 0 ? 'text-ink' : 'text-ink-3'
                  }`}
                >
                  {stat.byGroup[g]}
                </div>
              ))}
              <div
                className={`px-1 py-1.5 text-center font-medium tabular-nums ${
                  stat.total > 0 ? 'text-ink' : 'text-ink-3'
                }`}
              >
                {stat.total}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Render-Tests laufen lassen — müssen PASS**

```
cd frontend
pnpm vitest run src/features/plans/tests/FairnessSidebar.test.tsx
```

Erwartetes Ergebnis: 4 tests passed.

- [ ] **Step 5: PlanPage.tsx — Imports ergänzen**

In `frontend/src/features/plans/PlanPage.tsx`:

**5a.** `BarChart2` zur Lucide-Import-Zeile hinzufügen (die Zeile beginnt mit `import { FileDown, ...`):

```tsx
import { FileDown, Trash2, ChevronDown, ChevronLeft, ChevronRight, Zap, Settings, MoonStar, Star, BarChart2 } from 'lucide-react'
```

**5b.** Nach den bestehenden Feature-Imports (z.B. nach dem `WishFormDialog`-Import) hinzufügen:

```tsx
import { FairnessSidebar } from './components/FairnessSidebar'
import { buildFairnessStats } from './fairnessUtils'
```

- [ ] **Step 6: PlanPage.tsx — State und useMemo**

**6a.** Nach dem `showWishes`-State (Zeile mit `const [showWishes, setShowWishes] = useState(true)`) einfügen:

```tsx
const [showFairness, setShowFairness] = useState(false)
```

**6b.** Nach den bestehenden `useMemo`-Aufrufen (z.B. nach `kpiTiles` oder `selectedCellKeys`) einfügen:

```tsx
const { stats: fairnessStats, groups: fairnessGroups } = useMemo(
  () => buildFairnessStats(shifts, rotations, doctors),
  [shifts, rotations, doctors],
)
```

- [ ] **Step 7: PlanPage.tsx — Toggle-Button**

Den bestehenden Wunsch-Toggle-Block (die `<div className="px-6 pb-1 ...">`) erweitern — den Fairness-Button direkt nach dem Wünsche-Button einfügen:

Vorher:
```tsx
      <div className="px-6 pb-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowWishes((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
            showWishes
              ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
              : 'bg-paper border-line text-ink-3 hover:bg-line',
          )}
          aria-pressed={showWishes}
          title="Wünsche im Grid anzeigen / ausblenden"
        >
          <Star className="size-3" />
          Wünsche
        </button>
      </div>
```

Nachher:
```tsx
      <div className="px-6 pb-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowWishes((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
            showWishes
              ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
              : 'bg-paper border-line text-ink-3 hover:bg-line',
          )}
          aria-pressed={showWishes}
          title="Wünsche im Grid anzeigen / ausblenden"
        >
          <Star className="size-3" />
          Wünsche
        </button>
        <button
          type="button"
          onClick={() => setShowFairness((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
            showFairness
              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
              : 'bg-paper border-line text-ink-3 hover:bg-line',
          )}
          aria-pressed={showFairness}
          title="Fairness-Zähler ein-/ausblenden"
        >
          <BarChart2 className="size-3" />
          Fairness
        </button>
      </div>
```

- [ ] **Step 8: PlanPage.tsx — FairnessSidebar einbinden**

Im Haupt-Flex-Container (die `<div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">`) `FairnessSidebar` zwischen Grid-Div und ContextPanel einfügen:

Vorher:
```tsx
        {contextShift && (
          <ContextPanel
            ...
          />
        )}
```

Nachher:
```tsx
        {showFairness && (
          <FairnessSidebar
            stats={fairnessStats}
            groups={fairnessGroups}
            onClose={() => setShowFairness(false)}
          />
        )}
        {contextShift && (
          <ContextPanel
            ...
          />
        )}
```

- [ ] **Step 9: TypeScript-Check**

```
cd frontend
pnpm tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 10: Vollständige Frontend-Test-Suite**

```
cd frontend
pnpm vitest run
```

Erwartetes Ergebnis: Alle Tests grün, keine Regressionen.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/features/plans/components/FairnessSidebar.tsx \
        frontend/src/features/plans/tests/FairnessSidebar.test.tsx \
        frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(M12-006): FairnessSidebar — Toggle-Panel mit Live-Dienstzähler pro Arzt/Gruppe"
```

---

## Task D: Milestone-Abschluss

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `docs/decisions.md`
- Modify: `docs/constraints.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Roadmap aktualisieren**

In `docs/roadmap.md` beide Status-Felder ändern:

```markdown
| M12-006 | Fairness-Zähler-Sidebar | ✅ Abgeschlossen (2026-06-04) |
| M12-007 | Hinweis WE vor/nach Urlaub | ✅ Abgeschlossen (2026-06-04) |
```

- [ ] **Step 2: ADRs in `docs/decisions.md` eintragen**

Die Datei öffnen, das letzte ADR identifizieren (derzeit ADR-093 aus M12-005), dann zwei neue Zeilen in der bestehenden Tabelle ergänzen:

```markdown
| ADR-094 | M12-006 | Fairness-Zähler als reine Frontend-Aggregation (kein neuer API-Endpoint). `buildFairnessStats(shifts, rotations, doctors)` in `fairnessUtils.ts` aggregiert über bereits geladene Daten. Toggle-Panel statt permanenter Sidebar (Grid-Breite erhalten). |
| ADR-095 | M12-007 | WE-vor/nach-Urlaub-Hinweis als `WeekendAroundVacationRule` in der TarifRule-Plugin-Pipeline (`TarifSeverity.INFO`, `ConstraintId.WE_URLAUB`). 7-Tage-Fenster beidseitig, nur URLAUB-Abwesenheiten. Kein Schema-Change. |
```

- [ ] **Step 3: `docs/constraints.md` ergänzen**

Die Datei öffnen, am Ende einen neuen Abschnitt für M12-007 anfügen (Format wie bestehende Abschnitte):

```markdown
## Planungs-Hinweise (M12-007, Phase A)

Weiche Hinweise ohne Schreibpfad-Block (Phase-A-Prinzip). Erscheinen als `TarifSeverity.INFO`
im bestehenden §-Dot-Kanal.

### WE_URLAUB — Dienst am WE vor/nach Urlaub

- **ID:** `ConstraintId.WE_URLAUB` (`"we-urlaub"`)
- **Klasse:** `WeekendAroundVacationRule` in `tarif_rules_impl.py`
- **Severity:** INFO
- **Regel:** Shift-Datum liegt im 7-Tage-Fenster (Sa/So) unmittelbar vor `Absence.valid_from`
  oder nach `Absence.valid_to`, wenn `Absence.absence_type == URLAUB`.
- **Abgrenzung:** Nur URLAUB (nicht KRANKHEIT etc.); nur zugewiesene Shifts (`doctor_id is not None`).
```

- [ ] **Step 4: `CLAUDE.md` ergänzen**

In `CLAUDE.md` im Abschnitt „Domänen-Konzepte" nach dem Fokus-Filter-Eintrag (M12-005) einfügen:

```markdown
- **Fairness-Sidebar (M12-006):** Toggle-Panel in `PlanPage` (`showFairness: boolean`,
  Session-only). `buildFairnessStats(shifts, rotations, doctors)` in `fairnessUtils.ts`
  aggregiert pro Arzt mit Rotation: Gesamt-Zähler + Aufschlüsselung nach `filter_group`-Labels
  (dynamisch aus Shift-Daten). `FairnessSidebar.tsx` rendert Grid-Tabelle mit dynamischen Spalten.
  Kein neuer API-Endpoint. ADR-094.
- **WE-vor/nach-Urlaub-Hinweis (M12-007):** `WeekendAroundVacationRule` in
  `backend/app/services/tarif_rules_impl.py` (`TarifSeverity.INFO`, `ConstraintId.WE_URLAUB`).
  Findet Sa+So im 7-Tage-Fenster vor `valid_from` und nach `valid_to` jeder URLAUB-Abwesenheit.
  Weicher §-Dot-Hinweis, kein Schreibpfad-Block. Kein Schema-Change. ADR-095.
```

- [ ] **Step 5: Abschluss-Commit**

```bash
git add docs/roadmap.md docs/decisions.md docs/constraints.md CLAUDE.md
git commit -m "docs: M12-006+007 Abschluss — ADR-094/095, Roadmap, CLAUDE.md, constraints.md"
```
