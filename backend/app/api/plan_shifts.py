from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import shift_repository as shift_repo
from app.schemas.conflict import ShiftConflict
from app.schemas.shift import ShiftWithDetails
from app.services import conflict_service

router = APIRouter(prefix="/plans/{plan_id}/shifts", tags=["plan-shifts"])


@router.get("", response_model=list[ShiftWithDetails])
def list_shifts(plan_id: int, db: Session = Depends(get_db)) -> list[ShiftWithDetails]:
    shifts = shift_repo.list_shifts_for_plan(db, plan_id)

    # Konflikte einmal pro Request berechnen, dann nach shift_id zuordnen.
    # detect_conflicts wirft PlanNotFoundError (→ 404) bei unbekanntem Plan.
    plan_conflicts = conflict_service.detect_conflicts(db, plan_id)
    conflicts_by_shift: dict[int, list[ShiftConflict]] = defaultdict(list)
    for conflict in plan_conflicts.conflicts:
        conflicts_by_shift[conflict.shift_id].append(conflict)

    result: list[ShiftWithDetails] = []
    for shift in shifts:
        shift_data = ShiftWithDetails.model_validate(shift, from_attributes=True)
        shift_data.conflicts = conflicts_by_shift.get(shift.id, [])
        result.append(shift_data)

    return result
