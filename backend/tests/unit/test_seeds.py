"""Unit-Tests fuer Seed-Daten."""

from datetime import date
from math import ceil

import pytest

from app.models import Department, Doctor, DoctorType, EmploymentPeriod, INAExclusion
from app.models.ina_exclusion import INAExclusionReason
from scripts.seed_departments import DEPARTMENTS, HEADCOUNT_DEFAULTS
from scripts.seed_shift_types import SHIFT_TYPES


def test_seed_ck_has_requires_full_time() -> None:
    ck = next((d for d in DEPARTMENTS if d["name"] == "Curschmann Klinik"), None)
    assert ck is not None, "Curschmann Klinik fehlt in DEPARTMENTS"
    assert ck.get("requires_full_time") is True


def test_seed_other_departments_no_requires_full_time() -> None:
    for dept in DEPARTMENTS:
        if dept["name"] != "Curschmann Klinik":
            assert dept.get("requires_full_time", False) is False, (
                f"{dept['name']} sollte requires_full_time=False haben"
            )


def test_seed_two_new_departments() -> None:
    names = [d["name"] for d in DEPARTMENTS]
    assert "Intensiv (NCH)" in names
    assert "Intensiv extern" in names
    assert len(DEPARTMENTS) == 23


def test_seed_new_departments_are_external() -> None:
    nch = next(d for d in DEPARTMENTS if d["name"] == "Intensiv (NCH)")
    ext = next(d for d in DEPARTMENTS if d["name"] == "Intensiv extern")
    assert nch["is_external"] is True
    assert ext["is_external"] is True
    assert nch["display_order"] == 22
    assert ext["display_order"] == 23


def test_seed_headcount_defaults_all_departments_covered() -> None:
    dept_names = {d["name"] for d in DEPARTMENTS}
    for name in HEADCOUNT_DEFAULTS:
        assert name in dept_names, f"HEADCOUNT_DEFAULTS enthaelt unbekannten Bereich: {name}"
    assert len(HEADCOUNT_DEFAULTS) == 23


def test_seed_headcount_su_values() -> None:
    assert HEADCOUNT_DEFAULTS["SU"] == (6, 8)
    assert HEADCOUNT_DEFAULTS["ZIP"] == (0, 1)
    assert HEADCOUNT_DEFAULTS["Curschmann Klinik"] == (None, None)


def test_seed_t1_present() -> None:
    t1 = next((s for s in SHIFT_TYPES if s.get("short_name") == "T1"), None)
    assert t1 is not None, "T1 fehlt in SHIFT_TYPES"
    assert t1["name"] == "Tagdienst INA"
    assert t1["applies_on_weekdays"] is True
    assert t1["applies_on_weekend"] is False
    assert t1["display_order"] == 4


def _seed_departments_for_doctor_seed(db) -> None:
    for dept_data in DEPARTMENTS:
        db.add(Department(**dept_data))
    db.commit()


def test_doctor_seed_creates_department_count_plus_two_doctors(db) -> None:
    from scripts.seed_doctors import apply_seed

    _seed_departments_for_doctor_seed(db)

    inserted, skipped, total = apply_seed(db)

    doctors = db.query(Doctor).all()
    assert inserted == len(DEPARTMENTS) + 2
    assert skipped == 0
    assert total == len(DEPARTMENTS) + 2
    assert len(doctors) == len(DEPARTMENTS) + 2

    names = [doctor.name for doctor in doctors]
    short_names = [doctor.short_name for doctor in doctors]
    assert len(names) == len(set(names))
    assert len(short_names) == len(set(short_names))
    assert all(short_name for short_name in short_names)

    assert sum(doctor.doctor_type == DoctorType.EXTERNAL for doctor in doctors) == 4
    assert sum(not doctor.active for doctor in doctors) == 1

    today = date.today()
    entry_dates = [doctor.entry_date for doctor in doctors]
    assert all(
        entry_date == doctor.virtual_entry_date for entry_date, doctor in zip(entry_dates, doctors)
    )
    assert all(entry_date is not None for entry_date in entry_dates)
    assert all(0 <= (today - entry_date).days <= 8 * 366 for entry_date in entry_dates)

    sorted_entry_dates = sorted(entry_dates)
    gaps = [
        (later - earlier).days for earlier, later in zip(sorted_entry_dates, sorted_entry_dates[1:])
    ]
    assert max(gaps) - min(gaps) <= 2

    part_time_count = ceil(len(doctors) * 0.10)
    latest_periods = {
        ep.doctor_id: ep
        for ep in db.query(EmploymentPeriod).filter(EmploymentPeriod.valid_to.is_(None)).all()
    }
    part_time_periods = [
        period for period in latest_periods.values() if period.employment_percentage < 100
    ]
    assert len(part_time_periods) == part_time_count
    assert {period.employment_percentage for period in part_time_periods} <= {50, 60, 80}

    for doctor in doctors:
        periods = sorted(doctor.employment_periods, key=lambda period: period.valid_from)
        assert periods
        for earlier, later in zip(periods, periods[1:]):
            assert earlier.valid_to is not None
            assert earlier.valid_to < later.valid_from
        if doctor.active:
            assert periods[-1].valid_to is None
        else:
            assert periods[-1].valid_to is not None
            assert periods[-1].valid_to < today

    exclusions = db.query(INAExclusion).all()
    assert len(exclusions) == 2
    assert {exclusion.reason for exclusion in exclusions} == {
        INAExclusionReason.EINARBEITUNG,
        INAExclusionReason.SONSTIGES,
    }
    assert all(exclusion.valid_from <= today for exclusion in exclusions)
    assert all(
        exclusion.valid_to is None or exclusion.valid_to >= today for exclusion in exclusions
    )


def test_doctor_seed_is_idempotent_and_does_not_update_existing_seed_doctors(db) -> None:
    from scripts.seed_doctors import apply_seed

    _seed_departments_for_doctor_seed(db)
    apply_seed(db)
    first_doctor = db.query(Doctor).order_by(Doctor.name).first()
    first_doctor.short_name = "MANUAL"
    db.commit()

    inserted, skipped, total = apply_seed(db)

    db.refresh(first_doctor)
    assert inserted == 0
    assert skipped == len(DEPARTMENTS) + 2
    assert total == len(DEPARTMENTS) + 2
    assert first_doctor.short_name == "MANUAL"
    assert db.query(Doctor).count() == len(DEPARTMENTS) + 2


def test_doctor_seed_requires_existing_departments(db) -> None:
    from scripts.seed_doctors import apply_seed

    with pytest.raises(RuntimeError, match="seed_departments.py"):
        apply_seed(db)
