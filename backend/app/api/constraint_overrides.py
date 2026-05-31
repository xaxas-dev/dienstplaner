from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import constraint_override_repository as repo
from app.repositories.shift_repository import list_shifts_for_plan
from app.schemas.constraint_override import ConstraintOverrideCreate, ConstraintOverrideResponse
from app.services import constraint_override_service as svc
from app.services.exceptions import ConstraintOverrideNotFoundError

router = APIRouter(prefix="/constraint-overrides", tags=["constraint-overrides"])


@router.post("", response_model=ConstraintOverrideResponse, status_code=status.HTTP_201_CREATED)
def create_constraint_override(body: ConstraintOverrideCreate, db: Session = Depends(get_db)):
    return svc.create_override(db, body.model_dump())


@router.get("", response_model=list[ConstraintOverrideResponse])
def list_constraint_overrides(plan_id: int | None = None, db: Session = Depends(get_db)):
    if plan_id is not None:
        shifts = list_shifts_for_plan(db, plan_id)
        if not shifts:
            return []
        plan_start = min(s.shift_date for s in shifts)
        plan_end = max(s.shift_date for s in shifts)
        shift_ids = {s.id for s in shifts}
        return repo.list_for_plan(db, plan_id, plan_start, plan_end, shift_ids)
    return []


@router.delete("/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_constraint_override(override_id: int, db: Session = Depends(get_db)) -> None:
    if repo.get_override(db, override_id) is None:
        raise ConstraintOverrideNotFoundError(override_id)
    svc.delete_override(db, override_id)


doctor_overrides_router = APIRouter(
    prefix="/doctors/{doctor_id}/constraint-overrides",
    tags=["constraint-overrides"],
)


@doctor_overrides_router.get("", response_model=list[ConstraintOverrideResponse])
def list_doctor_constraint_overrides(doctor_id: int, db: Session = Depends(get_db)):
    return repo.list_for_doctor(db, doctor_id)
