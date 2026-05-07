from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import qualification_repository as qual_repo
from app.schemas.qualification import (
    QualificationCreate,
    QualificationResponse,
    QualificationUpdate,
)
from app.services import qualification_service
from app.services.exceptions import QualificationNotFoundError

router = APIRouter(prefix="/qualifications", tags=["qualifications"])


@router.get("", response_model=list[QualificationResponse])
def list_qualifications(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list:
    return qual_repo.list_qualifications(db, include_inactive=include_inactive)


@router.get("/{qualification_id}", response_model=QualificationResponse)
def get_qualification(qualification_id: int, db: Session = Depends(get_db)):
    qual = qual_repo.get_qualification(db, qualification_id)
    if qual is None:
        raise QualificationNotFoundError(qualification_id)
    return qual


@router.post("", response_model=QualificationResponse, status_code=status.HTTP_201_CREATED)
def create_qualification(body: QualificationCreate, db: Session = Depends(get_db)):
    return qualification_service.create_qualification_with_validation(db, body.model_dump())


@router.patch("/{qualification_id}", response_model=QualificationResponse)
def update_qualification(
    qualification_id: int, body: QualificationUpdate, db: Session = Depends(get_db)
):
    return qualification_service.update_qualification_with_validation(
        db, qualification_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{qualification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_qualification(qualification_id: int, db: Session = Depends(get_db)) -> None:
    qualification_service.delete_qualification_with_check(db, qualification_id)
