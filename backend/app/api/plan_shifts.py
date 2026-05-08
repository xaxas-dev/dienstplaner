from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import shift_repository as shift_repo
from app.schemas.shift import ShiftWithDetails

router = APIRouter(prefix="/plans/{plan_id}/shifts", tags=["plan-shifts"])


@router.get("", response_model=list[ShiftWithDetails])
def list_shifts(plan_id: int, db: Session = Depends(get_db)) -> list:
    return shift_repo.list_shifts_for_plan(db, plan_id)
