from datetime import date

from sqlalchemy import asc
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.shift import Shift
from app.models.shift_type import ShiftType


def get_shift(db: Session, shift_id: int) -> Shift | None:
    """Holt eine einzelne Shift mit eager-loaded shift_type und doctor."""
    return (
        db.query(Shift)
        .options(joinedload(Shift.shift_type), joinedload(Shift.doctor))
        .filter(Shift.id == shift_id)
        .first()
    )


def update_shift(db: Session, shift_id: int, data: dict) -> Shift | None:
    """Aktualisiert spezifische Felder einer Shift.

    data enthält nur die zu setzenden Felder (Ergebnis von exclude_unset).
    Returns None wenn Shift nicht existiert.
    """
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if shift is None:
        return None
    for key, value in data.items():
        setattr(shift, key, value)
    db.flush()
    db.refresh(shift)
    return shift


def list_shifts_for_plan(db: Session, plan_id: int) -> list[Shift]:
    return (
        db.query(Shift)
        .join(Shift.shift_type)
        .filter(Shift.plan_id == plan_id)
        .options(selectinload(Shift.shift_type), selectinload(Shift.doctor))
        .order_by(asc(Shift.shift_date), asc(ShiftType.display_order))
        .all()
    )


def bulk_create_shifts(db: Session, shifts: list[dict]) -> list[Shift]:
    objs = [Shift(**s) for s in shifts]
    db.add_all(objs)
    db.flush()
    return objs


def clear_doctor_from_shifts_in_range(
    db: Session, plan_id: int, doctor_id: int, date_from: date, date_to: date
) -> int:
    """Entfernt doctor_id von nicht-gepinnten Shifts in einem Datumsbereich."""
    shifts = (
        db.query(Shift)
        .filter(
            Shift.plan_id == plan_id,
            Shift.doctor_id == doctor_id,
            Shift.shift_date >= date_from,
            Shift.shift_date <= date_to,
            Shift.is_pinned.is_(False),
        )
        .all()
    )
    for s in shifts:
        s.doctor_id = None
    db.flush()
    return len(shifts)


def delete_shifts_for_plan(db: Session, plan_id: int) -> int:
    count = db.query(Shift).filter(Shift.plan_id == plan_id).delete(synchronize_session="fetch")
    return count
