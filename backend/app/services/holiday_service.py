from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.holiday import HolidaySource
from app.repositories import holiday_repository as holiday_repo


def _easter(year: int) -> date:
    """Gauss-Algorithmus für Ostersonntag."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    lo = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * lo) // 451
    month = (h + lo - 7 * m + 114) // 31
    day = ((h + lo - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def get_sh_holidays_for_year(year: int) -> list[tuple[date, str]]:
    """Gibt alle gesetzlichen Feiertage in Schleswig-Holstein zurück."""
    easter = _easter(year)
    return [
        (date(year, 1, 1), "Neujahr"),
        (easter - timedelta(days=2), "Karfreitag"),
        (easter, "Ostersonntag"),
        (easter + timedelta(days=1), "Ostermontag"),
        (date(year, 5, 1), "Tag der Arbeit"),
        (easter + timedelta(days=39), "Christi Himmelfahrt"),
        (easter + timedelta(days=49), "Pfingstsonntag"),
        (easter + timedelta(days=50), "Pfingstmontag"),
        (date(year, 10, 3), "Tag der Deutschen Einheit"),
        (date(year, 10, 31), "Reformationstag"),
        (date(year, 12, 25), "1. Weihnachtstag"),
        (date(year, 12, 26), "2. Weihnachtstag"),
    ]


def seed_sh_holidays(db: Session, year: int) -> int:
    """Fügt SH-Feiertage für `year` als AUTO-Einträge hinzu, falls noch nicht vorhanden.

    Gibt Anzahl neu eingefügter Einträge zurück.
    """
    holidays = get_sh_holidays_for_year(year)
    added = 0
    for h_date, h_name in holidays:
        if holiday_repo.get_holiday(db, h_date) is None:
            holiday_repo.create_holiday(db, h_date, h_name, HolidaySource.AUTO)
            added += 1
    db.commit()
    return added


def is_holiday(db: Session, d: date) -> bool:
    return holiday_repo.get_holiday(db, d) is not None


def get_holiday_dates_for_period(db: Session, from_date: date, to_date: date) -> set[date]:
    holidays = holiday_repo.list_holidays_for_period(db, from_date, to_date)
    return {h.date for h in holidays}
