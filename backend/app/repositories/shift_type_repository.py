from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.models.shift_type import ShiftType


def list_shift_types(db: Session, *, include_inactive: bool = False) -> list[ShiftType]:
    query = db.query(ShiftType)
    if not include_inactive:
        query = query.filter(ShiftType.active.is_(True))
    return query.order_by(asc(ShiftType.display_order), asc(ShiftType.name)).all()


def get_shift_type(db: Session, shift_type_id: int) -> ShiftType | None:
    return db.get(ShiftType, shift_type_id)


def get_shift_type_by_short_name(db: Session, short_name: str) -> ShiftType | None:
    return db.query(ShiftType).filter(ShiftType.short_name == short_name).first()


def create_shift_type(db: Session, data: dict) -> ShiftType:
    st = ShiftType(**data)
    db.add(st)
    db.flush()
    db.refresh(st)
    return st


def update_shift_type(db: Session, shift_type_id: int, data: dict) -> ShiftType | None:
    st = db.get(ShiftType, shift_type_id)
    if st is None:
        return None
    for key, value in data.items():
        setattr(st, key, value)
    db.flush()
    db.refresh(st)
    return st


def delete_shift_type(db: Session, shift_type_id: int) -> bool:
    st = db.get(ShiftType, shift_type_id)
    if st is None:
        return False
    db.delete(st)
    db.flush()
    return True
