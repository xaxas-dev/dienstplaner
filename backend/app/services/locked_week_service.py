from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.shift import Shift
from app.repositories import plan_repository
from app.schemas.locked_week import LockedWeekCreate, LockedWeekResult
from app.schemas.shift import ShiftResponse
from app.services.exceptions import PlanNotFoundError


def create_locked_week(db: Session, plan_id: int, data: LockedWeekCreate) -> LockedWeekResult:
    plan = plan_repository.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    if data.start_date.weekday() != 6:
        raise ValueError("start_date muss ein Sonntag sein")

    created: list[ShiftResponse] = []
    skipped: list[int] = []

    for i in range(5):  # Sonntag bis Donnerstag
        shift_date = data.start_date + timedelta(days=i)
        existing = (
            db.query(Shift)
            .filter(
                Shift.plan_id == plan_id,
                Shift.shift_date == shift_date,
                Shift.shift_type_id == data.shift_type_id,
            )
            .first()
        )
        if existing is not None:
            existing.doctor_id = data.doctor_id
            existing.is_locked = True
            db.flush()
            created.append(ShiftResponse.model_validate(existing))
        else:
            shift = Shift(
                plan_id=plan_id,
                shift_date=shift_date,
                shift_type_id=data.shift_type_id,
                doctor_id=data.doctor_id,
                is_locked=True,
            )
            db.add(shift)
            db.flush()
            created.append(ShiftResponse.model_validate(shift))

    db.commit()
    return LockedWeekResult(created=created, skipped=skipped)
