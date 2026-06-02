"""Tests für holiday_service und holiday_repository."""
from datetime import date

from app.models.holiday import Holiday, HolidaySource
from app.repositories import holiday_repository as holiday_repo


def test_create_and_get_holiday(db):
    holiday_repo.create_holiday(db, date(2026, 1, 1), "Neujahr", HolidaySource.AUTO)
    db.commit()

    result = holiday_repo.get_holiday(db, date(2026, 1, 1))
    assert result is not None
    assert result.name == "Neujahr"
    assert result.source == HolidaySource.AUTO


def test_get_holiday_not_found(db):
    assert holiday_repo.get_holiday(db, date(2026, 6, 15)) is None


def test_list_holidays_for_year(db):
    holiday_repo.create_holiday(db, date(2026, 1, 1), "Neujahr", HolidaySource.AUTO)
    holiday_repo.create_holiday(db, date(2026, 12, 25), "Weihnachten", HolidaySource.AUTO)
    holiday_repo.create_holiday(db, date(2025, 1, 1), "Neujahr 2025", HolidaySource.AUTO)
    db.commit()

    result = holiday_repo.list_holidays_for_year(db, 2026)
    assert len(result) == 2
    assert all(h.date.year == 2026 for h in result)


def test_delete_holiday(db):
    holiday_repo.create_holiday(db, date(2026, 6, 15), "Brückentag", HolidaySource.MANUAL)
    db.commit()

    deleted = holiday_repo.delete_holiday(db, date(2026, 6, 15))
    db.commit()
    assert deleted is True
    assert holiday_repo.get_holiday(db, date(2026, 6, 15)) is None


def test_delete_holiday_not_found(db):
    assert holiday_repo.delete_holiday(db, date(2026, 6, 15)) is False


def test_list_holidays_for_period(db):
    holiday_repo.create_holiday(db, date(2026, 4, 3), "Karfreitag", HolidaySource.AUTO)
    holiday_repo.create_holiday(db, date(2026, 5, 1), "Tag der Arbeit", HolidaySource.AUTO)
    holiday_repo.create_holiday(db, date(2026, 1, 1), "Neujahr", HolidaySource.AUTO)
    db.commit()

    result = holiday_repo.list_holidays_for_period(db, date(2026, 4, 1), date(2026, 4, 30))
    assert len(result) == 1
    assert result[0].date == date(2026, 4, 3)
