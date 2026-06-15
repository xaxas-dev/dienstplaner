from datetime import date

from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.models.employment_period import EmploymentPeriod


def get_employment_period_covering_date(
    db: Session, doctor_id: int, target_date: date
) -> EmploymentPeriod | None:
    """Gibt den EP zurück, dessen Zeitraum target_date enthält, oder None."""
    return (
        db.query(EmploymentPeriod)
        .filter(
            EmploymentPeriod.doctor_id == doctor_id,
            EmploymentPeriod.valid_from <= target_date,
            or_(
                EmploymentPeriod.valid_to.is_(None),
                EmploymentPeriod.valid_to >= target_date,
            ),
        )
        .first()
    )


def list_employment_periods(db: Session, doctor_id: int) -> list[EmploymentPeriod]:
    return (
        db.query(EmploymentPeriod)
        .filter(EmploymentPeriod.doctor_id == doctor_id)
        .order_by(desc(EmploymentPeriod.valid_from))
        .all()
    )


def get_employment_period(db: Session, ep_id: int) -> EmploymentPeriod | None:
    return db.get(EmploymentPeriod, ep_id)


def create_employment_period(db: Session, doctor_id: int, data: dict) -> EmploymentPeriod:
    ep = EmploymentPeriod(doctor_id=doctor_id, **data)
    db.add(ep)
    db.flush()
    db.refresh(ep)
    return ep


def update_employment_period(db: Session, ep_id: int, data: dict) -> EmploymentPeriod | None:
    ep = db.get(EmploymentPeriod, ep_id)
    if ep is None:
        return None
    for key, value in data.items():
        setattr(ep, key, value)
    db.flush()
    db.refresh(ep)
    return ep


def delete_employment_period(db: Session, ep_id: int) -> bool:
    ep = db.get(EmploymentPeriod, ep_id)
    if ep is None:
        return False
    db.delete(ep)
    db.flush()
    return True
