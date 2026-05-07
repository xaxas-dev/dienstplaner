from sqlalchemy.orm import Session

from app.models.department import Department
from app.repositories import department_repository as dept_repo
from app.services.exceptions import DepartmentNotFoundError, DepartmentValidationError


def validate_department_data(data: dict) -> None:
    name = data.get("name", "")
    if not name or not name.strip():
        raise DepartmentValidationError("Name darf nicht leer sein")


def create_department_with_validation(db: Session, data: dict) -> Department:
    validate_department_data(data)
    dept = dept_repo.create_department(db, data)
    db.commit()
    db.refresh(dept)
    return dept


def update_department_with_validation(db: Session, department_id: int, data: dict) -> Department:
    dept = dept_repo.get_department(db, department_id)
    if dept is None:
        raise DepartmentNotFoundError(department_id)
    if "name" in data:
        validate_department_data(data)
    dept_repo.update_department(db, department_id, data)
    db.commit()
    return dept_repo.get_department(db, department_id)  # type: ignore[return-value]


def delete_department_with_check(db: Session, department_id: int) -> None:
    dept = dept_repo.get_department(db, department_id)
    if dept is None:
        raise DepartmentNotFoundError(department_id)
    # TODO: wenn Plan-Modul existiert, prüfen ob Department in Plänen verwendet wird
    dept_repo.delete_department(db, department_id)
    db.commit()
