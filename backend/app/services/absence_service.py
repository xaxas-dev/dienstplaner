from sqlalchemy.orm import Session

from app.models.absence import Absence
from app.repositories import absence_repository as repo
from app.services.exceptions import AbsenceNotFoundError, AbsenceValidationError


def _validate_date_range(data: dict) -> None:
    valid_from = data.get("valid_from")
    valid_to = data.get("valid_to")
    if valid_from is not None and valid_to is not None and valid_from > valid_to:
        raise AbsenceValidationError("Startdatum darf nicht nach dem Enddatum liegen")


def create_absence(db: Session, doctor_id: int, data: dict) -> Absence:
    _validate_date_range(data)
    absence = repo.create_absence(db, doctor_id, data)
    db.commit()
    db.refresh(absence)
    return absence


def get_absences_for_doctor(db: Session, doctor_id: int) -> list[Absence]:
    return repo.list_absences_for_doctor(db, doctor_id)


def update_absence(db: Session, absence_id: int, data: dict) -> Absence:
    absence = repo.get_absence(db, absence_id)
    if absence is None:
        raise AbsenceNotFoundError(absence_id)

    merged = {
        "valid_from": absence.valid_from,
        "valid_to": absence.valid_to,
        "absence_type": absence.absence_type,
        "notes": absence.notes,
    }
    merged.update({k: v for k, v in data.items() if v is not None})
    _validate_date_range(merged)

    updated = repo.update_absence(db, absence_id, data)
    if updated is None:
        raise AbsenceNotFoundError(absence_id)
    db.commit()
    db.refresh(updated)
    return updated


def delete_absence(db: Session, absence_id: int) -> None:
    absence = repo.get_absence(db, absence_id)
    if absence is None:
        raise AbsenceNotFoundError(absence_id)
    repo.delete_absence(db, absence_id)
    db.commit()
