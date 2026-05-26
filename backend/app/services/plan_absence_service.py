from datetime import date

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.absence import Absence
from app.models.rotation_assignment import RotationAssignment
from app.repositories import plan_repository as plan_repo
from app.services.exceptions import PlanNotFoundError


def get_absences_for_plan(db: Session, plan_id: int) -> list[Absence]:
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    doctor_ids_subq = (
        db.query(RotationAssignment.doctor_id)
        .filter(RotationAssignment.plan_id == plan_id)
        .distinct()
        .scalar_subquery()
    )

    return (
        db.query(Absence)
        .filter(
            Absence.doctor_id.in_(doctor_ids_subq),
            Absence.valid_from <= plan.valid_to,
            Absence.valid_to >= plan.valid_from,
        )
        .order_by(Absence.valid_from)
        .all()
    )
