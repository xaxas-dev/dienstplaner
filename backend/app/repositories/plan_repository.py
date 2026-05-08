from sqlalchemy import desc
from sqlalchemy.orm import Session, selectinload

from app.models.plan import Plan, PlanStatus


def _with_relations(query):
    return query.options(
        selectinload(Plan.shifts),
        selectinload(Plan.rotation_assignments),
    )


def list_plans(db: Session, *, status: PlanStatus | None = None) -> list[Plan]:
    query = db.query(Plan)
    if status is not None:
        query = query.filter(Plan.status == status)
    return query.order_by(desc(Plan.valid_from)).all()


def get_plan(db: Session, plan_id: int) -> Plan | None:
    return _with_relations(db.query(Plan)).filter(Plan.id == plan_id).first()


def create_plan(db: Session, data: dict) -> Plan:
    plan = Plan(**data)
    db.add(plan)
    db.flush()
    return plan


def update_plan(db: Session, plan_id: int, data: dict) -> Plan | None:
    plan = db.get(Plan, plan_id)
    if plan is None:
        return None
    for key, value in data.items():
        setattr(plan, key, value)
    db.flush()
    return plan


def delete_plan(db: Session, plan_id: int) -> bool:
    plan = db.get(Plan, plan_id)
    if plan is None:
        return False
    db.delete(plan)
    db.flush()
    return True
