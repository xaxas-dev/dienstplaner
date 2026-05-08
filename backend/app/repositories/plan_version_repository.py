from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.plan_version import PlanVersion


def list_versions(db: Session, plan_id: int) -> list[PlanVersion]:
    return (
        db.query(PlanVersion)
        .filter(PlanVersion.plan_id == plan_id)
        .order_by(desc(PlanVersion.version_number))
        .all()
    )


def get_version(db: Session, plan_id: int, version_number: int) -> PlanVersion | None:
    return (
        db.query(PlanVersion)
        .filter(PlanVersion.plan_id == plan_id, PlanVersion.version_number == version_number)
        .first()
    )


def create_version(
    db: Session, plan_id: int, snapshot_json: dict, comment: str | None = None
) -> PlanVersion:
    max_version = (
        db.query(func.max(PlanVersion.version_number))
        .filter(PlanVersion.plan_id == plan_id)
        .scalar()
        or 0
    )
    pv = PlanVersion(
        plan_id=plan_id,
        version_number=max_version + 1,
        snapshot_json=snapshot_json,
        comment=comment,
    )
    db.add(pv)
    db.flush()
    db.refresh(pv)
    return pv
