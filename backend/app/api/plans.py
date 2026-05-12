from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.plan import PlanStatus
from app.repositories import plan_repository as plan_repo
from app.schemas.plan import (
    CloneResult,
    PlanClone,
    PlanCreate,
    PlanResponse,
    PlanUpdate,
    PlanWithRelations,
)
from app.services import plan_service
from app.services.exceptions import PlanNotFoundError

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanResponse])
def list_plans(status: str | None = None, db: Session = Depends(get_db)) -> list:
    plan_status = PlanStatus(status) if status else None
    return plan_repo.list_plans(db, status=plan_status)


@router.get("/{plan_id}", response_model=PlanWithRelations)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    return plan


@router.post("", response_model=PlanWithRelations, status_code=status.HTTP_201_CREATED)
def create_plan(body: PlanCreate, db: Session = Depends(get_db)):
    shift_type_ids = body.shift_type_ids
    data = body.model_dump(exclude={"shift_type_ids"})
    return plan_service.create_plan_with_shifts(db, data, shift_type_ids=shift_type_ids)


@router.patch("/{plan_id}", response_model=PlanWithRelations)
def update_plan(plan_id: int, body: PlanUpdate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        return plan_service.update_plan_status(db, plan_id, data)
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    plan_repo.update_plan(db, plan_id, data)
    db.commit()
    return plan_repo.get_plan(db, plan_id)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: int, db: Session = Depends(get_db)) -> None:
    deleted = plan_repo.delete_plan(db, plan_id)
    if not deleted:
        raise PlanNotFoundError(plan_id)
    db.commit()


@router.post("/{plan_id}/clone", response_model=CloneResult, status_code=status.HTTP_201_CREATED)
def clone_plan(plan_id: int, body: PlanClone, db: Session = Depends(get_db)):
    data = body.model_dump()
    new_plan, copied, skipped = plan_service.clone_plan(db, plan_id, data)
    return CloneResult(plan=new_plan, rotations_copied=copied, rotations_skipped=skipped)
