from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.absence import Absence


def list_absences_for_doctor(db: Session, doctor_id: int) -> list[Absence]:
    return (
        db.query(Absence)
        .filter(Absence.doctor_id == doctor_id)
        .order_by(desc(Absence.valid_from))
        .all()
    )


def get_absence(db: Session, absence_id: int) -> Absence | None:
    return db.get(Absence, absence_id)


def create_absence(db: Session, doctor_id: int, data: dict) -> Absence:
    absence = Absence(doctor_id=doctor_id, **data)
    db.add(absence)
    db.flush()
    db.refresh(absence)
    return absence


def update_absence(db: Session, absence_id: int, data: dict) -> Absence | None:
    absence = db.get(Absence, absence_id)
    if absence is None:
        return None
    for key, value in data.items():
        setattr(absence, key, value)
    db.flush()
    db.refresh(absence)
    return absence


def delete_absence(db: Session, absence_id: int) -> bool:
    absence = db.get(Absence, absence_id)
    if absence is None:
        return False
    db.delete(absence)
    db.flush()
    return True
