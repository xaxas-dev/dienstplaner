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


from app.services import holiday_service


# ---------------------------------------------------------------------------
# Pure Helpers
# ---------------------------------------------------------------------------

def test_easter_2026():
    """Ostersonntag 2026 = 5. April."""
    from app.services.holiday_service import _easter
    assert _easter(2026) == date(2026, 4, 5)


def test_easter_2025():
    """Ostersonntag 2025 = 20. April."""
    from app.services.holiday_service import _easter
    assert _easter(2025) == date(2025, 4, 20)


def test_get_sh_holidays_2026_count():
    """SH hat 12 gesetzliche Feiertage (inkl. Reformationstag)."""
    holidays = holiday_service.get_sh_holidays_for_year(2026)
    assert len(holidays) == 12


def test_get_sh_holidays_2026_fixed():
    """Prüft Neujahr, Tag der Arbeit, Reformationstag, Weihnachten."""
    holidays = holiday_service.get_sh_holidays_for_year(2026)
    dates = {d for d, _ in holidays}
    assert date(2026, 1, 1) in dates   # Neujahr
    assert date(2026, 5, 1) in dates   # Tag der Arbeit
    assert date(2026, 10, 3) in dates  # Tag der Deutschen Einheit
    assert date(2026, 10, 31) in dates  # Reformationstag (SH)
    assert date(2026, 12, 25) in dates  # 1. Weihnachtstag
    assert date(2026, 12, 26) in dates  # 2. Weihnachtstag


def test_get_sh_holidays_2026_movable():
    """Prüft bewegliche Feiertage 2026."""
    holidays = holiday_service.get_sh_holidays_for_year(2026)
    dates = {d for d, _ in holidays}
    assert date(2026, 4, 3) in dates   # Karfreitag (Ostern 5.4. - 2)
    assert date(2026, 4, 5) in dates   # Ostersonntag
    assert date(2026, 4, 6) in dates   # Ostermontag
    assert date(2026, 5, 14) in dates  # Christi Himmelfahrt (Ostern + 39)
    assert date(2026, 5, 24) in dates  # Pfingstsonntag (Ostern + 49)
    assert date(2026, 5, 25) in dates  # Pfingstmontag (Ostern + 50)


def test_seed_sh_holidays_adds_entries(db):
    added = holiday_service.seed_sh_holidays(db, 2026)
    assert added == 12
    result = holiday_service.get_holiday_dates_for_period(
        db, date(2026, 1, 1), date(2026, 12, 31)
    )
    assert len(result) == 12


def test_seed_sh_holidays_idempotent(db):
    holiday_service.seed_sh_holidays(db, 2026)
    added_again = holiday_service.seed_sh_holidays(db, 2026)
    assert added_again == 0


def test_is_holiday_true(db):
    holiday_service.seed_sh_holidays(db, 2026)
    assert holiday_service.is_holiday(db, date(2026, 1, 1)) is True


def test_is_holiday_false(db):
    holiday_service.seed_sh_holidays(db, 2026)
    assert holiday_service.is_holiday(db, date(2026, 1, 2)) is False  # Werktag


def test_get_holiday_dates_for_period(db):
    holiday_service.seed_sh_holidays(db, 2026)
    result = holiday_service.get_holiday_dates_for_period(
        db, date(2026, 4, 1), date(2026, 4, 30)
    )
    # April 2026: Karfreitag (3.), Ostersonntag (5.), Ostermontag (6.)
    assert result == {date(2026, 4, 3), date(2026, 4, 5), date(2026, 4, 6)}
