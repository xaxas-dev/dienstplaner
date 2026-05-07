from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import department_repository as dept_repo
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate
from app.services import department_service
from app.services.exceptions import DepartmentNotFoundError

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentResponse])
def list_departments(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list:
    return dept_repo.list_departments(db, include_inactive=include_inactive)


@router.get("/{department_id}", response_model=DepartmentResponse)
def get_department(department_id: int, db: Session = Depends(get_db)):
    dept = dept_repo.get_department(db, department_id)
    if dept is None:
        raise DepartmentNotFoundError(department_id)
    return dept


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(body: DepartmentCreate, db: Session = Depends(get_db)):
    return department_service.create_department_with_validation(db, body.model_dump())


@router.patch("/{department_id}", response_model=DepartmentResponse)
def update_department(department_id: int, body: DepartmentUpdate, db: Session = Depends(get_db)):
    return department_service.update_department_with_validation(
        db, department_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(department_id: int, db: Session = Depends(get_db)) -> None:
    department_service.delete_department_with_check(db, department_id)
