from sqlalchemy.orm import Session

from app.models.wish import Wish
from app.repositories import wish_repository as repo
from app.services.exceptions import WishNotFoundError


def get_wishes_by_doctor(db: Session, doctor_id: int) -> list[Wish]:
    return repo.get_wishes_by_doctor(db, doctor_id)


def get_wishes_for_plan_period(db: Session, plan_id: int) -> list[Wish]:
    return repo.get_wishes_for_plan_period(db, plan_id)


def create_wish(db: Session, doctor_id: int, data: dict) -> Wish:
    w = repo.create_wish(db, doctor_id, data)
    db.commit()
    db.refresh(w)
    return w


def update_wish(db: Session, wish_id: int, data: dict) -> Wish:
    w = repo.update_wish(db, wish_id, data)
    if w is None:
        raise WishNotFoundError(wish_id)
    db.commit()
    db.refresh(w)
    return w


def delete_wish(db: Session, wish_id: int) -> None:
    ok = repo.delete_wish(db, wish_id)
    if not ok:
        raise WishNotFoundError(wish_id)
    db.commit()
