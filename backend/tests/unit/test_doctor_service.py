from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models.doctor import DoctorType
from app.models.employment_period import EmploymentPeriod
from app.services.doctor_service import (
    _periods_overlap,
    validate_doctor_data,
    validate_employment_period_overlap,
)
from app.services.exceptions import EmploymentPeriodOverlapError

# ── validate_doctor_data ───────────────────────────────────────────────────────


def test_validate_doctor_data_noop() -> None:
    # validate_doctor_data hat keine Validierungsregeln mehr; sollte immer durchlaufen
    validate_doctor_data({"rank": "FACHARZT", "doctor_type": DoctorType.INTERNAL})
    validate_doctor_data({})
    validate_doctor_data({"rank": None, "doctor_type": DoctorType.EXTERNAL})


# ── _periods_overlap ───────────────────────────────────────────────────────────


def test_periods_no_overlap_before() -> None:
    assert not _periods_overlap(
        date(2024, 1, 1),
        date(2024, 6, 30),
        date(2024, 7, 1),
        date(2024, 12, 31),
    )


def test_periods_no_overlap_after() -> None:
    assert not _periods_overlap(
        date(2024, 7, 1),
        date(2024, 12, 31),
        date(2024, 1, 1),
        date(2024, 6, 30),
    )


def test_periods_overlap_partial() -> None:
    assert _periods_overlap(
        date(2024, 1, 1),
        date(2024, 8, 31),
        date(2024, 6, 1),
        date(2024, 12, 31),
    )


def test_periods_overlap_fully_contained() -> None:
    assert _periods_overlap(
        date(2024, 1, 1),
        date(2024, 12, 31),
        date(2024, 3, 1),
        date(2024, 9, 30),
    )


def test_periods_overlap_unbounded_b() -> None:
    assert _periods_overlap(
        date(2024, 1, 1),
        date(2024, 12, 31),
        date(2024, 6, 1),
        None,
    )


def test_periods_no_overlap_unbounded_a_starts_after() -> None:
    assert not _periods_overlap(
        date(2025, 1, 1),
        None,
        date(2024, 1, 1),
        date(2024, 12, 31),
    )


def test_periods_overlap_both_unbounded() -> None:
    assert _periods_overlap(date(2024, 1, 1), None, date(2025, 1, 1), None)


# ── validate_employment_period_overlap (mit DB) ────────────────────────────────


def test_validate_overlap_no_conflict(db: Session) -> None:
    from app.models.doctor import Doctor

    doctor = Doctor(last_name="Overlap Test 1")
    db.add(doctor)
    db.flush()

    ep = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2024, 1, 1),
        valid_to=date(2024, 6, 30),
        employment_percentage=50,
    )
    db.add(ep)
    db.flush()

    validate_employment_period_overlap(db, doctor.id, date(2024, 7, 1), date(2024, 12, 31))


def test_validate_overlap_conflict_raises(db: Session) -> None:
    from app.models.doctor import Doctor

    doctor = Doctor(last_name="Overlap Test 2")
    db.add(doctor)
    db.flush()

    ep = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2024, 1, 1),
        valid_to=date(2024, 12, 31),
        employment_percentage=100,
    )
    db.add(ep)
    db.flush()

    with pytest.raises(EmploymentPeriodOverlapError):
        validate_employment_period_overlap(db, doctor.id, date(2024, 6, 1), date(2025, 3, 31))


def test_validate_overlap_exclude_self(db: Session) -> None:
    from app.models.doctor import Doctor

    doctor = Doctor(last_name="Overlap Test 3")
    db.add(doctor)
    db.flush()

    ep = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2024, 1, 1),
        valid_to=date(2024, 12, 31),
        employment_percentage=80,
    )
    db.add(ep)
    db.flush()

    # Darf sich nicht mit sich selbst überschneiden
    validate_employment_period_overlap(
        db, doctor.id, date(2024, 3, 1), date(2024, 9, 30), exclude_ep_id=ep.id
    )
