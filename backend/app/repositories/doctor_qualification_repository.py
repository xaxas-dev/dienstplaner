from datetime import date

from sqlalchemy.orm import Session

from app.models.doctor_qualification import DoctorQualification
from app.models.qualification import Qualification


def get_doctor_qualification(
    db: Session, doctor_id: int, qualification_id: int
) -> DoctorQualification | None:
    return db.get(DoctorQualification, (doctor_id, qualification_id))


def add_qualification(
    db: Session,
    doctor_id: int,
    qualification_id: int,
    *,
    acquired_at: date | None = None,
    expires_at: date | None = None,
) -> DoctorQualification:
    dq = DoctorQualification(
        doctor_id=doctor_id,
        qualification_id=qualification_id,
        acquired_at=acquired_at,
        expires_at=expires_at,
    )
    db.add(dq)
    db.flush()
    db.refresh(dq)
    return dq


def remove_qualification(db: Session, doctor_id: int, qualification_id: int) -> bool:
    dq = db.get(DoctorQualification, (doctor_id, qualification_id))
    if dq is None:
        return False
    db.delete(dq)
    db.flush()
    return True


def list_qualifications_for_doctor(db: Session, doctor_id: int) -> list[Qualification]:
    return (
        db.query(Qualification)
        .join(DoctorQualification, DoctorQualification.qualification_id == Qualification.id)
        .filter(DoctorQualification.doctor_id == doctor_id)
        .order_by(Qualification.name)
        .all()
    )
