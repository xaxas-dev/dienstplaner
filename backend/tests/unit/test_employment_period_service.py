from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401 – alle Modelle registrieren
from app.models.doctor import Doctor
from app.models.employment_period import EmploymentPeriod
from app.services.employment_period_service import get_fte_for_period


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def doctor(db: Session) -> Doctor:
    d = Doctor(name="Dr. Test", active=True)
    db.add(d)
    db.flush()
    return d


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_get_fte_keine_period_fallback_100(db: Session, doctor: Doctor) -> None:
    """Kein EmploymentPeriod vorhanden → Fallback 100."""
    result = get_fte_for_period(db, doctor.id, date(2026, 6, 1), date(2026, 6, 30))
    assert result == 100


def test_get_fte_einzelne_period_voll_ueberlappend(db: Session, doctor: Doctor) -> None:
    """Eine Periode mit 50%, deckt den gesamten Zeitraum ab → 50."""
    p = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2026, 1, 1),
        valid_to=date(2026, 12, 31),
        employment_percentage=50,
    )
    db.add(p)
    db.flush()

    result = get_fte_for_period(db, doctor.id, date(2026, 6, 1), date(2026, 6, 30))
    assert result == 50


def test_get_fte_zwei_perioden_zeitanteilig_gewichtet(db: Session, doctor: Doctor) -> None:
    """100% erste 15 Tage, 50% nächste 15 Tage → round((100*15 + 50*15)/30) = 75."""
    p1 = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 15),
        employment_percentage=100,
    )
    p2 = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2026, 6, 16),
        valid_to=date(2026, 6, 30),
        employment_percentage=50,
    )
    db.add_all([p1, p2])
    db.flush()

    result = get_fte_for_period(db, doctor.id, date(2026, 6, 1), date(2026, 6, 30))
    assert result == 75


def test_get_fte_open_ended_period(db: Session, doctor: Doctor) -> None:
    """Periode mit valid_to=None, begann vor Zeitraum → zählt für gesamten Bereich."""
    p = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2025, 1, 1),
        valid_to=None,
        employment_percentage=80,
    )
    db.add(p)
    db.flush()

    result = get_fte_for_period(db, doctor.id, date(2026, 6, 1), date(2026, 6, 30))
    assert result == 80


def test_get_fte_period_ausserhalb_zeitraum(db: Session, doctor: Doctor) -> None:
    """Periode endet vor query start → kein Overlap → Fallback 100."""
    p = EmploymentPeriod(
        doctor_id=doctor.id,
        valid_from=date(2026, 1, 1),
        valid_to=date(2026, 5, 31),
        employment_percentage=60,
    )
    db.add(p)
    db.flush()

    result = get_fte_for_period(db, doctor.id, date(2026, 6, 1), date(2026, 6, 30))
    assert result == 100
