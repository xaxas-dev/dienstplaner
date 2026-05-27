from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import rotation_assignment_repository as rotation_repo
from app.repositories import shift_repository as shift_repo
from app.schemas.rotation_assignment import (
    RotationAssignmentCreate,
    RotationAssignmentResponse,
    RotationAssignmentUpdate,
    RotationAssignmentWithDetails,
)
from app.services import plan_service
from app.services.exceptions import RotationNotFoundError

plan_rotations_router = APIRouter(prefix="/plans/{plan_id}/rotations", tags=["rotations"])
rotations_router = APIRouter(prefix="/rotations", tags=["rotations"])


@plan_rotations_router.get("", response_model=list[RotationAssignmentWithDetails])
def list_rotations(plan_id: int, db: Session = Depends(get_db)) -> list:
    return rotation_repo.list_rotations_for_plan(db, plan_id)


@plan_rotations_router.post(
    "", response_model=RotationAssignmentResponse, status_code=status.HTTP_201_CREATED
)
def create_rotation(plan_id: int, body: RotationAssignmentCreate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"plan_id"})
    return plan_service.create_rotation_with_validation(db, plan_id, data)


@rotations_router.patch("/{rotation_id}", response_model=RotationAssignmentResponse)
def update_rotation(
    rotation_id: int, body: RotationAssignmentUpdate, db: Session = Depends(get_db)
):
    data = body.model_dump(exclude_unset=True)
    return plan_service.update_rotation_with_validation(db, rotation_id, data)


@rotations_router.delete("/{rotation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rotation(rotation_id: int, db: Session = Depends(get_db)) -> None:
    ra = rotation_repo.get_rotation(db, rotation_id)
    if ra is None:
        raise RotationNotFoundError(rotation_id)
    shift_repo.clear_doctor_from_shifts_in_range(
        db, ra.plan_id, ra.doctor_id, ra.valid_from, ra.valid_to
    )
    rotation_repo.delete_rotation(db, rotation_id)
    db.commit()
