from datetime import date

from sqlalchemy.orm import Session

from app.models import (
    Absence,
    AbsenceType,
    Department,
    Doctor,
    Plan,
    PlanStatus,
    RotationAssignment,
)
from app.models.ina_exclusion import INAExclusion, INAExclusionReason
from app.services.ina_availability_service import get_ina_availability

MONDAY = date(2026, 5, 4)
SATURDAY = date(2026, 5, 9)


def _make_doctor(db: Session, name: str = "Dr. Test") -> Doctor:
    doc = Doctor(last_name=name)
    db.add(doc)
    db.flush()
    return doc


def _make_dept(
    db: Session,
    name: str = "Testbereich",
    blocks_wd: bool = False,
    blocks_we: bool = False,
) -> Department:
    dept = Department(name=name, blocks_ina_weekdays=blocks_wd, blocks_ina_weekends=blocks_we)
    db.add(dept)
    db.flush()
    return dept


def _make_plan(db: Session) -> Plan:
    plan = Plan(
        name="Testplan",
        valid_from=date(2026, 5, 1),
        valid_to=date(2026, 5, 31),
        status=PlanStatus.DRAFT,
    )
    db.add(plan)
    db.flush()
    return plan


def _make_rotation(
    db: Session,
    plan: Plan,
    doctor: Doctor,
    dept: Department,
    valid_from: date = date(2026, 5, 1),
    valid_to: date = date(2026, 5, 31),
    is_einarbeitung: bool = False,
) -> RotationAssignment:
    ra = RotationAssignment(
        plan_id=plan.id,
        doctor_id=doctor.id,
        department_id=dept.id,
        valid_from=valid_from,
        valid_to=valid_to,
        is_einarbeitung=is_einarbeitung,
    )
    db.add(ra)
    db.flush()
    return ra


def test_available_no_blockers(db: Session) -> None:
    doc = _make_doctor(db)
    avail = get_ina_availability(db, doc.id, MONDAY)
    assert avail.available is True
    assert avail.reasons == []


def test_blocked_by_su_weekday(db: Session) -> None:
    doc = _make_doctor(db)
    plan = _make_plan(db)
    dept = _make_dept(db, "SU", blocks_wd=True, blocks_we=True)
    _make_rotation(db, plan, doc, dept)

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert avail.available is False
    assert any("SU" in r for r in avail.reasons)


def test_blocked_by_su_weekend(db: Session) -> None:
    doc = _make_doctor(db)
    plan = _make_plan(db)
    dept = _make_dept(db, "SU", blocks_wd=True, blocks_we=True)
    _make_rotation(db, plan, doc, dept)

    avail = get_ina_availability(db, doc.id, SATURDAY)
    assert avail.available is False
    assert any("SU" in r for r in avail.reasons)


def test_ck_blocked_weekday(db: Session) -> None:
    doc = _make_doctor(db)
    plan = _make_plan(db)
    dept = _make_dept(db, "Curschmann Klinik", blocks_wd=True, blocks_we=False)
    _make_rotation(db, plan, doc, dept)

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert avail.available is False
    assert any("Curschmann" in r for r in avail.reasons)


def test_ck_available_weekend(db: Session) -> None:
    doc = _make_doctor(db)
    plan = _make_plan(db)
    dept = _make_dept(db, "Curschmann Klinik", blocks_wd=True, blocks_we=False)
    _make_rotation(db, plan, doc, dept)

    avail = get_ina_availability(db, doc.id, SATURDAY)
    assert avail.available is True
    assert avail.reasons == []


def test_blocked_by_einarbeitung(db: Session) -> None:
    doc = _make_doctor(db)
    plan = _make_plan(db)
    # Department selbst blockiert nicht
    dept = _make_dept(db, "EMG", blocks_wd=False, blocks_we=False)
    _make_rotation(db, plan, doc, dept, is_einarbeitung=True)

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert avail.available is False
    assert any("Einarbeitung" in r for r in avail.reasons)


def test_blocked_by_pregnancy_exclusion(db: Session) -> None:
    doc = _make_doctor(db)
    excl = INAExclusion(
        doctor_id=doc.id,
        valid_from=date(2026, 1, 1),
        valid_to=None,
        reason=INAExclusionReason.SCHWANGERSCHAFT,
    )
    db.add(excl)
    db.flush()

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert avail.available is False
    assert "Schwangerschaft" in avail.reasons


def test_blocked_by_absence(db: Session) -> None:
    doc = _make_doctor(db)
    absence = Absence(
        doctor_id=doc.id,
        absence_type=AbsenceType.URLAUB,
        valid_from=date(2026, 5, 1),
        valid_to=date(2026, 5, 31),
    )
    db.add(absence)
    db.flush()

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert avail.available is False
    assert any("Abwesenheit" in r for r in avail.reasons)


def test_multiple_reasons(db: Session) -> None:
    doc = _make_doctor(db)
    plan = _make_plan(db)
    dept = _make_dept(db, "SU-Multi", blocks_wd=True, blocks_we=True)
    _make_rotation(db, plan, doc, dept, is_einarbeitung=True)
    excl = INAExclusion(
        doctor_id=doc.id,
        valid_from=date(2026, 5, 1),
        valid_to=None,
        reason=INAExclusionReason.SCHWANGERSCHAFT,
    )
    db.add(excl)
    db.flush()

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert avail.available is False
    assert len(avail.reasons) >= 3  # Rotation + Einarbeitung + Schwangerschaft


def test_exclusion_unbefristet(db: Session) -> None:
    doc = _make_doctor(db)
    excl = INAExclusion(
        doctor_id=doc.id,
        valid_from=date(2026, 1, 1),
        valid_to=None,
        reason=INAExclusionReason.SONSTIGES,
        notes="Langzeit",
    )
    db.add(excl)
    db.flush()

    future_date = date(2027, 6, 15)
    avail = get_ina_availability(db, doc.id, future_date)
    assert avail.available is False
    assert "Langzeit" in avail.reasons


def test_sonstiges_uses_notes(db: Session) -> None:
    doc = _make_doctor(db)
    excl = INAExclusion(
        doctor_id=doc.id,
        valid_from=date(2026, 5, 1),
        valid_to=None,
        reason=INAExclusionReason.SONSTIGES,
        notes="Besonderer Grund",
    )
    db.add(excl)
    db.flush()

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert "Besonderer Grund" in avail.reasons


def test_sonstiges_without_notes_fallback(db: Session) -> None:
    doc = _make_doctor(db)
    excl = INAExclusion(
        doctor_id=doc.id,
        valid_from=date(2026, 5, 1),
        valid_to=None,
        reason=INAExclusionReason.SONSTIGES,
        notes=None,
    )
    db.add(excl)
    db.flush()

    avail = get_ina_availability(db, doc.id, MONDAY)
    assert "Manuell ausgeschlossen" in avail.reasons
