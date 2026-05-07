from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import shift_type_repository as st_repo
from app.schemas.shift_type import ShiftTypeCreate, ShiftTypeResponse, ShiftTypeUpdate
from app.services import shift_type_service
from app.services.exceptions import ShiftTypeNotFoundError

router = APIRouter(prefix="/shift-types", tags=["shift-types"])


@router.get("", response_model=list[ShiftTypeResponse])
def list_shift_types(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list:
    return st_repo.list_shift_types(db, include_inactive=include_inactive)


@router.get("/{shift_type_id}", response_model=ShiftTypeResponse)
def get_shift_type(shift_type_id: int, db: Session = Depends(get_db)):
    st = st_repo.get_shift_type(db, shift_type_id)
    if st is None:
        raise ShiftTypeNotFoundError(shift_type_id)
    return st


@router.post("", response_model=ShiftTypeResponse, status_code=status.HTTP_201_CREATED)
def create_shift_type(body: ShiftTypeCreate, db: Session = Depends(get_db)):
    return shift_type_service.create_shift_type_with_validation(db, body.model_dump())


@router.patch("/{shift_type_id}", response_model=ShiftTypeResponse)
def update_shift_type(shift_type_id: int, body: ShiftTypeUpdate, db: Session = Depends(get_db)):
    return shift_type_service.update_shift_type_with_validation(
        db, shift_type_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{shift_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift_type(shift_type_id: int, db: Session = Depends(get_db)) -> None:
    st = st_repo.get_shift_type(db, shift_type_id)
    if st is None:
        raise ShiftTypeNotFoundError(shift_type_id)
    st_repo.delete_shift_type(db, shift_type_id)
    db.commit()
