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
    d = Doctor(last_name=name)
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

    def test_no_absence_no_warning(self, db: Session) -> None:
        from app.services.tarif_rules_impl import WeekendAroundVacationRule

        plan = _make_plan(db)
        doctor = _make_doctor(db)
        st = _make_shift_type(db)
        _make_shift(db, plan.id, SA_BEFORE, st.id, doctor.id)
        # No absence created at all

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
