from sqlalchemy import asc
from sqlalchemy.orm import Session, selectinload

from app.models.doctor import Doctor


def _with_relations(query):
    return query.options(
        selectinload(Doctor.employment_periods),
        selectinload(Doctor.qualifications),
    )


def list_doctors(db: Session, *, include_inactive: bool = False) -> list[Doctor]:
    query = _with_relations(db.query(Doctor))
    if not include_inactive:
        query = query.filter(Doctor.active.is_(True))
    return query.order_by(asc(Doctor.last_name), asc(Doctor.first_name)).all()


def get_doctor(db: Session, doctor_id: int) -> Doctor | None:
    return _with_relations(db.query(Doctor)).filter(Doctor.id == doctor_id).first()


def create_doctor(db: Session, data: dict) -> Doctor:
    doctor = Doctor(**data)
    db.add(doctor)
    db.flush()
    db.refresh(doctor)
    return doctor


def update_doctor(db: Session, doctor_id: int, data: dict) -> Doctor | None:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        return None
    for key, value in data.items():
        setattr(doctor, key, value)
    db.flush()
    db.refresh(doctor)
    return doctor


def delete_doctor(db: Session, doctor_id: int) -> bool:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        return False
    db.delete(doctor)
    db.flush()
    return True
