from datetime import date

from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.models.ina_exclusion import INAExclusion


def list_exclusions_for_doctor(db: Session, doctor_id: int) -> list[INAExclusion]:
    return (
        db.query(INAExclusion)
        .filter(INAExclusion.doctor_id == doctor_id)
        .order_by(desc(INAExclusion.valid_from))
        .all()
    )


def list_active_exclusions_at(db: Session, doctor_id: int, target_date: date) -> list[INAExclusion]:
    return (
        db.query(INAExclusion)
        .filter(
            INAExclusion.doctor_id == doctor_id,
            INAExclusion.valid_from <= target_date,
            or_(INAExclusion.valid_to.is_(None), INAExclusion.valid_to >= target_date),
        )
        .all()
    )


def list_exclusions_in_period(
    db: Session, doctor_id: int, start_date: date, end_date: date
) -> list[INAExclusion]:
    return (
        db.query(INAExclusion)
        .filter(
            INAExclusion.doctor_id == doctor_id,
            INAExclusion.valid_from <= end_date,
            or_(INAExclusion.valid_to.is_(None), INAExclusion.valid_to >= start_date),
        )
        .all()
    )


def get_exclusion(db: Session, exclusion_id: int) -> INAExclusion | None:
    return db.get(INAExclusion, exclusion_id)


def create_exclusion(db: Session, doctor_id: int, data: dict) -> INAExclusion:
    excl = INAExclusion(doctor_id=doctor_id, **data)
    db.add(excl)
    db.flush()
    db.refresh(excl)
    return excl


def update_exclusion(db: Session, exclusion_id: int, data: dict) -> INAExclusion | None:
    excl = db.get(INAExclusion, exclusion_id)
    if excl is None:
        return None
    for key, value in data.items():
        setattr(excl, key, value)
    db.flush()
    db.refresh(excl)
    return excl


def delete_exclusion(db: Session, exclusion_id: int) -> bool:
    excl = db.get(INAExclusion, exclusion_id)
    if excl is None:
        return False
    db.delete(excl)
    db.flush()
    return True
