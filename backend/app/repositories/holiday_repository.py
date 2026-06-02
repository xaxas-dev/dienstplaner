from datetime import date

from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.models.holiday import Holiday, HolidaySource


def get_holiday(db: Session, holiday_date: date) -> Holiday | None:
    return db.get(Holiday, holiday_date)


def list_holidays_for_year(db: Session, year: int) -> list[Holiday]:
    return (
        db.query(Holiday)
        .filter(extract("year", Holiday.date) == year)
        .order_by(Holiday.date)
        .all()
    )


def list_holidays_for_period(db: Session, from_date: date, to_date: date) -> list[Holiday]:
    return (
        db.query(Holiday)
        .filter(Holiday.date >= from_date, Holiday.date <= to_date)
        .order_by(Holiday.date)
        .all()
    )


def create_holiday(
    db: Session, holiday_date: date, name: str, source: HolidaySource
) -> Holiday:
    h = Holiday(date=holiday_date, name=name, source=source)
    db.add(h)
    return h


def delete_holiday(db: Session, holiday_date: date) -> bool:
    h = db.get(Holiday, holiday_date)
    if h is None:
        return False
    db.delete(h)
    return True
