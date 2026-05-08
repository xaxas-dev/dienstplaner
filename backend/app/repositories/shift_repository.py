from sqlalchemy import asc
from sqlalchemy.orm import Session, selectinload

from app.models.shift import Shift
from app.models.shift_type import ShiftType


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


def delete_shifts_for_plan(db: Session, plan_id: int) -> int:
    count = db.query(Shift).filter(Shift.plan_id == plan_id).delete(synchronize_session="fetch")
    return count
