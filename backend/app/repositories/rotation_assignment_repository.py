from sqlalchemy import asc
from sqlalchemy.orm import Session, selectinload

from app.models.doctor import Doctor
from app.models.rotation_assignment import RotationAssignment


def list_rotations_for_plan(db: Session, plan_id: int) -> list[RotationAssignment]:
    return (
        db.query(RotationAssignment)
        .join(RotationAssignment.doctor)
        .filter(RotationAssignment.plan_id == plan_id)
        .options(
            selectinload(RotationAssignment.doctor),
            selectinload(RotationAssignment.department),
        )
        .order_by(asc(Doctor.name), asc(RotationAssignment.valid_from))
        .all()
    )


def get_rotation(db: Session, rotation_id: int) -> RotationAssignment | None:
    return db.get(RotationAssignment, rotation_id)


def create_rotation(db: Session, plan_id: int, data: dict) -> RotationAssignment:
    ra = RotationAssignment(plan_id=plan_id, **data)
    db.add(ra)
    db.flush()
    db.refresh(ra)
    return ra


def update_rotation(db: Session, rotation_id: int, data: dict) -> RotationAssignment | None:
    ra = db.get(RotationAssignment, rotation_id)
    if ra is None:
        return None
    for key, value in data.items():
        setattr(ra, key, value)
    db.flush()
    db.refresh(ra)
    return ra


def delete_rotation(db: Session, rotation_id: int) -> bool:
    ra = db.get(RotationAssignment, rotation_id)
    if ra is None:
        return False
    db.delete(ra)
    db.flush()
    return True


def bulk_create_rotations(db: Session, rotations: list[dict]) -> list[RotationAssignment]:
    objs = [RotationAssignment(**r) for r in rotations]
    db.add_all(objs)
    db.flush()
    return objs
