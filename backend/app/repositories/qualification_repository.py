from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.models.qualification import Qualification


def list_qualifications(
    db: Session, *, include_inactive: bool = False
) -> list[Qualification]:
    query = db.query(Qualification)
    if not include_inactive:
        query = query.filter(Qualification.active.is_(True))
    return query.order_by(asc(Qualification.name)).all()


def get_qualification(db: Session, qualification_id: int) -> Qualification | None:
    return db.get(Qualification, qualification_id)


def get_qualification_by_name(db: Session, name: str) -> Qualification | None:
    return db.query(Qualification).filter(Qualification.name == name).first()


def create_qualification(db: Session, data: dict) -> Qualification:
    qual = Qualification(**data)
    db.add(qual)
    db.flush()
    db.refresh(qual)
    return qual


def update_qualification(
    db: Session, qualification_id: int, data: dict
) -> Qualification | None:
    qual = db.get(Qualification, qualification_id)
    if qual is None:
        return None
    for key, value in data.items():
        setattr(qual, key, value)
    db.flush()
    db.refresh(qual)
    return qual


def delete_qualification(db: Session, qualification_id: int) -> bool:
    qual = db.get(Qualification, qualification_id)
    if qual is None:
        return False
    db.delete(qual)
    db.flush()
    return True
