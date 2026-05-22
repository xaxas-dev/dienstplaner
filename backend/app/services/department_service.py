from sqlalchemy.orm import Session

from app.models.department import Department
from app.repositories import department_repository as dept_repo
from app.services.exceptions import DepartmentNotFoundError, DepartmentValidationError


def validate_department_data(data: dict) -> None:
    name = data.get("name", "")
    if not name or not name.strip():
        raise DepartmentValidationError("Name darf nicht leer sein")

    min_h = data.get("min_headcount")
    max_h = data.get("max_headcount")

    if min_h is not None and min_h < 0:
        raise DepartmentValidationError("Mindestbesetzung darf nicht negativ sein")
    if max_h is not None and max_h < 0:
        raise DepartmentValidationError("Maximalbesetzung darf nicht negativ sein")
    if min_h is not None and max_h is not None and min_h > max_h:
        raise DepartmentValidationError(
            f"Mindestbesetzung ({min_h}) darf nicht größer als Maximalbesetzung ({max_h}) sein"
        )


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
    merged = {
        "name": dept.name,
        "min_headcount": dept.min_headcount,
        "max_headcount": dept.max_headcount,
    }
    merged.update(data)
    validate_department_data(merged)
    dept_repo.update_department(db, department_id, data)
    db.commit()
    return dept_repo.get_department(db, department_id)  # type: ignore[return-value]


def delete_department_with_check(db: Session, department_id: int) -> None:
    dept = dept_repo.get_department(db, department_id)
    if dept is None:
        raise DepartmentNotFoundError(department_id)
    # Department-Nutzung in Plänen läuft über RotationAssignment (department_id FK).
    # Kein harter Guard hier — Phase A erlaubt Delete; Phase B ergänzt ggf. Constraint.
    dept_repo.delete_department(db, department_id)
    db.commit()
