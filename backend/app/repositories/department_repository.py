from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.models.department import Department


def list_departments(db: Session, *, include_inactive: bool = False) -> list[Department]:
    query = db.query(Department)
    if not include_inactive:
        query = query.filter(Department.active.is_(True))
    return query.order_by(asc(Department.display_order), asc(Department.name)).all()


def get_department(db: Session, department_id: int) -> Department | None:
    return db.get(Department, department_id)


def get_department_by_name(db: Session, name: str) -> Department | None:
    return db.query(Department).filter(Department.name == name).first()


def create_department(db: Session, data: dict) -> Department:
    dept = Department(**data)
    db.add(dept)
    db.flush()
    db.refresh(dept)
    return dept


def update_department(db: Session, department_id: int, data: dict) -> Department | None:
    dept = db.get(Department, department_id)
    if dept is None:
        return None
    for key, value in data.items():
        setattr(dept, key, value)
    db.flush()
    db.refresh(dept)
    return dept


def delete_department(db: Session, department_id: int) -> bool:
    dept = db.get(Department, department_id)
    if dept is None:
        return False
    db.delete(dept)
    db.flush()
    return True
