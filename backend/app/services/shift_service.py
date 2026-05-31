from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.shift import Shift
from app.repositories import shift_repository as shift_repo
from app.schemas.shift import ShiftUpdate
from app.services.exceptions import ShiftNotFoundError, ShiftValidationError


def update_shift(db: Session, shift_id: int, update: ShiftUpdate) -> Shift:
    """Aktualisiert eine Shift. Validiert nur Datenkonsistenz.

    Raises:
        ShiftNotFoundError: shift_id existiert nicht.
        ShiftValidationError: doctor_id verweist auf nicht-existierenden
            oder inaktiven Doctor.

    Semantische Constraints (Verfügbarkeit, Qualifikation, Doppelbuchung)
    werden NICHT geprüft. Konflikte werden read-only durch die
    Konflikt-Engine (M2-005) zurückgegeben.
    """
    data = update.model_dump(exclude_unset=True)

    if "doctor_id" in data and data["doctor_id"] is not None:
        doctor = db.query(Doctor).filter(Doctor.id == data["doctor_id"]).first()
        if doctor is None:
            raise ShiftValidationError(f"Arzt mit ID {data['doctor_id']} existiert nicht")
        if not doctor.active:
            raise ShiftValidationError(
                f"Arzt {doctor.name} ist inaktiv und kann nicht zugewiesen werden"
            )

    shift = shift_repo.update_shift(db, shift_id, data)
    if shift is None:
        raise ShiftNotFoundError(shift_id)

    db.commit()
    db.refresh(shift)
    return shift
