from datetime import datetime

from sqlalchemy.orm import Session

from app.models.springer_assignment import SpringerAssignment
from app.schemas.springer_assignment import SpringerAssignmentCreate


def get_by_plan(db: Session, plan_id: int) -> list[SpringerAssignment]:
    return (
        db.query(SpringerAssignment)
        .filter(SpringerAssignment.plan_id == plan_id)
        .order_by(SpringerAssignment.shift_date, SpringerAssignment.doctor_id)
        .all()
    )


def upsert(db: Session, plan_id: int, data: SpringerAssignmentCreate) -> SpringerAssignment:
    existing = (
        db.query(SpringerAssignment)
        .filter(
            SpringerAssignment.plan_id == plan_id,
            SpringerAssignment.shift_date == data.shift_date,
            SpringerAssignment.doctor_id == data.doctor_id,
        )
        .first()
    )
    if existing is not None:
        existing.target_department_id = data.target_department_id
        if data.notes is not None:
            existing.notes = data.notes
        existing.updated_at = datetime.now()
        db.flush()
        db.refresh(existing)
        return existing

    sa = SpringerAssignment(
        plan_id=plan_id,
        shift_date=data.shift_date,
        doctor_id=data.doctor_id,
        target_department_id=data.target_department_id,
        notes=data.notes,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(sa)
    db.flush()
    db.refresh(sa)
    return sa


def delete(db: Session, assignment_id: int) -> bool:
    sa = db.get(SpringerAssignment, assignment_id)
    if sa is None:
        return False
    db.delete(sa)
    db.flush()
    return True
