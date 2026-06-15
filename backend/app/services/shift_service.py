from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.shift import Shift
from app.repositories import shift_repository as shift_repo
from app.schemas.shift import ShiftPlanCreate, ShiftUpdate
from app.services.exceptions import PlanNotFoundError, ShiftNotFoundError, ShiftValidationError


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


def create_or_assign_shift(db: Session, plan_id: int, data: ShiftPlanCreate) -> Shift:
    """Erstellt Shift oder setzt doctor_id falls (plan, Datum, Typ) schon existiert.

    Raises:
        PlanNotFoundError: plan_id existiert nicht.
        ShiftValidationError: doctor_id ungültig oder Arzt inaktiv.
    """
    from app.repositories import plan_repository

    if plan_repository.get_plan(db, plan_id) is None:
        raise PlanNotFoundError(plan_id)

    if data.doctor_id is not None:
        doctor = db.query(Doctor).filter(Doctor.id == data.doctor_id).first()
        if doctor is None:
            raise ShiftValidationError(f"Arzt mit ID {data.doctor_id} existiert nicht")
        if not doctor.active:
            raise ShiftValidationError(
                f"Arzt {doctor.name} ist inaktiv und kann nicht zugewiesen werden"
            )

    existing = (
        db.query(Shift)
        .filter(
            Shift.plan_id == plan_id,
            Shift.shift_date == data.shift_date,
            Shift.shift_type_id == data.shift_type_id,
        )
        .first()
    )

    if existing is not None:
        existing.doctor_id = data.doctor_id
        db.flush()
        shift_id = existing.id
    else:
        new_shift = Shift(
            plan_id=plan_id,
            shift_date=data.shift_date,
            shift_type_id=data.shift_type_id,
            doctor_id=data.doctor_id,
            is_pinned=data.is_pinned,
            notes=data.notes,
        )
        db.add(new_shift)
        db.flush()
        shift_id = new_shift.id

    db.commit()
    result = shift_repo.get_shift(db, shift_id)
    assert result is not None
    return result
