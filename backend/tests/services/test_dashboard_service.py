from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models import (
    Absence,
    AbsenceType,
    Department,
    Doctor,
    DoctorType,
    Plan,
    RotationAssignment,
    Shift,
    ShiftType,
)
from app.services import dashboard_service as svc
from app.services.exceptions import PlanNotFoundError


# ---------------------------------------------------------------------------
# Fixtures / Helpers
# ---------------------------------------------------------------------------

def _doctor(db: Session, name: str = "Max Muster") -> Doctor:
    doc = Doctor(last_name=name, doctor_type=DoctorType.INTERNAL)
    db.add(doc)
    db.flush()
    return doc


def _shift_type(db: Session, short_name: str = "V", display_order: int = 1) -> ShiftType:
    st = ShiftType(
        name=f"Dienst-{short_name}",
        short_name=short_name,
        applies_on_weekdays=True,
        applies_on_weekend=True,
        display_order=display_order,
    )
    db.add(st)
    db.flush()
    return st


def _plan(db: Session, valid_from: date, valid_to: date) -> Plan:
    p = Plan(name="Testplan", valid_from=valid_from, valid_to=valid_to)
    db.add(p)
    db.flush()
    return p


def _shift(db: Session, plan: Plan, st: ShiftType, shift_date: date, doctor: Doctor | None = None) -> Shift:
    s = Shift(plan_id=plan.id, shift_type_id=st.id, shift_date=shift_date, doctor_id=doctor.id if doctor else None)
    db.add(s)
    db.flush()
    return s


def _department(db: Session, name: str = "Station A") -> Department:
    dept = Department(name=name)
    db.add(dept)
    db.flush()
    return dept


def _rotation(db: Session, plan: Plan, doctor: Doctor, dept: Department, valid_from: date, valid_to: date) -> RotationAssignment:
    ra = RotationAssignment(
        plan_id=plan.id,
        doctor_id=doctor.id,
        department_id=dept.id,
        valid_from=valid_from,
        valid_to=valid_to,
    )
    db.add(ra)
    db.flush()
    return ra


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBuildDashboardSummary:
    def test_plan_not_found_raises(self, db: Session) -> None:
        with pytest.raises(PlanNotFoundError):
            svc.build_dashboard_summary(db, plan_id=9999, target_date=date(2026, 5, 15))

    def test_empty_plan_kpis(self, db: Session) -> None:
        plan = _plan(db, date(2026, 5, 1), date(2026, 5, 31))
        result = svc.build_dashboard_summary(db, plan.id, date(2026, 5, 15))
        assert result.plan_id == plan.id
        assert result.kpis.coverage_pct == 0.0
        assert result.kpis.open_shifts == 0
        assert result.kpis.conflicts == 0
        assert result.kpis.on_leave == 0

    def test_coverage_pct_partial(self, db: Session) -> None:
        plan = _plan(db, date(2026, 5, 1), date(2026, 5, 31))
        doc = _doctor(db)
        st = _shift_type(db)
        _shift(db, plan, st, date(2026, 5, 15), doc)    # gefüllt
        _shift(db, plan, st, date(2026, 5, 16))          # leer
        result = svc.build_dashboard_summary(db, plan.id, date(2026, 5, 15))
        assert result.kpis.coverage_pct == pytest.approx(0.5)
        assert result.kpis.open_shifts == 1

    def test_today_shifts_grouped_by_type(self, db: Session) -> None:
        plan = _plan(db, date(2026, 5, 1), date(2026, 5, 31))
        doc = _doctor(db)
        st_v = _shift_type(db, "V", display_order=1)
        st_n = _shift_type(db, "N", display_order=2)
        target = date(2026, 5, 15)
        _shift(db, plan, st_v, target, doc)
        _shift(db, plan, st_n, target)        # leer → kein Arzt
        _shift(db, plan, st_v, date(2026, 5, 16), doc)  # anderer Tag → nicht heute

        result = svc.build_dashboard_summary(db, plan.id, target)
        assert len(result.today_shifts) == 2
        names = [s.shift_type_short_name for s in result.today_shifts]
        assert "V" in names
        assert "N" in names
        v_shift = next(s for s in result.today_shifts if s.shift_type_short_name == "V")
        assert len(v_shift.doctors) == 1
        assert v_shift.doctors[0].name == "Max Muster"

    def test_coverage_by_department(self, db: Session) -> None:
        plan = _plan(db, date(2026, 5, 1), date(2026, 5, 31))
        doc1 = _doctor(db, "Dr. Alpha")
        doc2 = _doctor(db, "Dr. Beta")
        dept = _department(db, "Neurologie")
        target = date(2026, 5, 15)
        _rotation(db, plan, doc1, dept, date(2026, 5, 1), date(2026, 5, 31))   # aktiv
        _rotation(db, plan, doc2, dept, date(2026, 6, 1), date(2026, 6, 30))   # nicht aktiv am target

        result = svc.build_dashboard_summary(db, plan.id, target)
        assert len(result.coverage_by_department) == 1
        bar = result.coverage_by_department[0]
        assert bar.department_name == "Neurologie"
        assert bar.total == 2
        assert bar.filled == 1
        assert bar.pct == pytest.approx(0.5)

    def test_attention_open_shift_today(self, db: Session) -> None:
        plan = _plan(db, date(2026, 5, 1), date(2026, 5, 31))
        st = _shift_type(db)
        target = date(2026, 5, 15)
        _shift(db, plan, st, target)  # offen

        result = svc.build_dashboard_summary(db, plan.id, target)
        warn_items = [a for a in result.attention if a.severity == "warning"]
        assert len(warn_items) == 1
        assert "unbesetzt" in warn_items[0].message

    def test_attention_upcoming_absence(self, db: Session) -> None:
        plan = _plan(db, date(2026, 5, 1), date(2026, 5, 31))
        doc = _doctor(db)
        tomorrow = date(2026, 5, 16)
        absence = Absence(
            doctor_id=doc.id,
            absence_type=AbsenceType.URLAUB,
            valid_from=tomorrow,
            valid_to=date(2026, 5, 20),
        )
        db.add(absence)
        db.flush()

        result = svc.build_dashboard_summary(db, plan.id, date(2026, 5, 15))
        info_items = [a for a in result.attention if a.severity == "info"]
        assert len(info_items) == 1
        assert "morgen" in info_items[0].message
        assert info_items[0].person_name == "Max Muster"

    def test_on_leave_count(self, db: Session) -> None:
        plan = _plan(db, date(2026, 5, 1), date(2026, 5, 31))
        doc1 = _doctor(db, "Dr. Urlaub")
        doc2 = _doctor(db, "Dr. Krank")
        target = date(2026, 5, 15)
        for doc in [doc1, doc2]:
            db.add(Absence(
                doctor_id=doc.id,
                absence_type=AbsenceType.URLAUB,
                valid_from=date(2026, 5, 10),
                valid_to=date(2026, 5, 20),
            ))
        db.flush()

        result = svc.build_dashboard_summary(db, plan.id, target)
        assert result.kpis.on_leave == 2
