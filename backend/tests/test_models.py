from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Department,
    Doctor,
    DoctorQualification,
    DoctorType,
    EmploymentPeriod,
    OverrideScope,
    Qualification,
    RuleOverride,
    ShiftType,
)


def test_doctor_create_and_query(db: Session) -> None:
    doctor = Doctor(name="Max Mustermann", short_name="MM", doctor_type=DoctorType.INTERNAL)
    db.add(doctor)
    db.flush()

    result = db.get(Doctor, doctor.id)
    assert result is not None
    assert result.name == "Max Mustermann"
    assert result.short_name == "MM"
    assert result.doctor_type == DoctorType.INTERNAL
    assert result.rank is None
    assert result.active is True
    assert result.created_at is not None
    assert result.updated_at is not None


def test_employment_period_with_doctor(db: Session) -> None:
    doctor = Doctor(name="Dr. Teilzeit")
    db.add(doctor)
    db.flush()

    ep = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2024, 1, 1),
        valid_to=date(2024, 12, 31),
        employment_percentage=50,
    )
    db.add(ep)
    db.flush()

    db.refresh(doctor)
    assert len(doctor.employment_periods) == 1
    assert doctor.employment_periods[0].employment_percentage == 50
    assert doctor.employment_periods[0].valid_from == date(2024, 1, 1)


def test_department_external_flag(db: Session) -> None:
    dept = Department(
        name="Psychiatrie Test",
        is_external=True,
        is_shift_relevant=False,
        display_order=99,
    )
    db.add(dept)
    db.flush()

    result = db.get(Department, dept.id)
    assert result is not None
    assert result.is_external is True
    assert result.is_shift_relevant is False


def test_qualification_many_to_many(db: Session) -> None:
    doctor = Doctor(name="Dr. Qualifiziert")
    q1 = Qualification(name="EEG-Befundung Test")
    q2 = Qualification(name="Neurophysiologie Test")
    db.add_all([doctor, q1, q2])
    db.flush()

    dq1 = DoctorQualification(
        doctor_id=doctor.id,
        qualification_id=q1.id,
        acquired_at=date(2020, 6, 1),
    )
    dq2 = DoctorQualification(
        doctor_id=doctor.id,
        qualification_id=q2.id,
    )
    db.add_all([dq1, dq2])
    db.flush()

    db.refresh(doctor)
    assert len(doctor.doctor_qualifications) == 2
    qual_names = {dq.qualification.name for dq in doctor.doctor_qualifications}
    assert "EEG-Befundung Test" in qual_names
    assert "Neurophysiologie Test" in qual_names


def test_shift_type_unique_short_name(db: Session) -> None:
    st1 = ShiftType(name="V-Dienst Test", short_name="VT")
    db.add(st1)
    db.flush()

    st2 = ShiftType(name="V-Dienst Duplikat", short_name="VT")
    db.add(st2)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_rule_override_global_vs_doctor(db: Session) -> None:
    doctor = Doctor(name="Dr. Override")
    db.add(doctor)
    db.flush()

    global_override = RuleOverride(
        rule_key="max_bereitschaft_per_month",
        scope=OverrideScope.GLOBAL,
        override_value="6",
        reason="Globale Ausnahme",
    )
    doctor_override = RuleOverride(
        rule_key="max_bereitschaft_per_month",
        scope=OverrideScope.DOCTOR,
        doctor_id=doctor.id,
        override_value="4",
        valid_from=date(2024, 1, 1),
    )
    db.add_all([global_override, doctor_override])
    db.flush()

    g = db.get(RuleOverride, global_override.id)
    assert g is not None
    assert g.scope == OverrideScope.GLOBAL
    assert g.doctor_id is None

    d = db.get(RuleOverride, doctor_override.id)
    assert d is not None
    assert d.scope == OverrideScope.DOCTOR
    assert d.doctor_id == doctor.id
