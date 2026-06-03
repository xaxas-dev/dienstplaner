from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.models.wish import Wish


def get_wish(db: Session, wish_id: int) -> Wish | None:
    return db.get(Wish, wish_id)


def get_wishes_by_doctor(db: Session, doctor_id: int) -> list[Wish]:
    return (
        db.query(Wish)
        .filter(Wish.doctor_id == doctor_id)
        .order_by(Wish.wish_date.asc().nullslast(), Wish.id.asc())
        .all()
    )


def get_wishes_for_plan_period(db: Session, plan_id: int) -> list[Wish]:
    from app.repositories import plan_repository as plan_repo
    from app.models.rotation_assignment import RotationAssignment

    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        return []

    doctor_ids = [
        row[0]
        for row in db.query(RotationAssignment.doctor_id)
        .filter(RotationAssignment.plan_id == plan_id)
        .distinct()
        .all()
    ]
    if not doctor_ids:
        return []

    return (
        db.query(Wish)
        .filter(
            Wish.doctor_id.in_(doctor_ids),
            or_(
                and_(
                    Wish.wish_date.isnot(None),
                    Wish.wish_date >= plan.valid_from,
                    Wish.wish_date <= plan.valid_to,
                ),
                Wish.day_of_week.isnot(None),
                and_(Wish.wish_date.is_(None), Wish.day_of_week.is_(None)),
            ),
        )
        .all()
    )


def create_wish(db: Session, doctor_id: int, data: dict) -> Wish:
    w = Wish(doctor_id=doctor_id, **data)
    db.add(w)
    return w


def update_wish(db: Session, wish_id: int, data: dict) -> Wish | None:
    w = db.get(Wish, wish_id)
    if w is None:
        return None
    for k, v in data.items():
        setattr(w, k, v)
    return w


def delete_wish(db: Session, wish_id: int) -> bool:
    w = db.get(Wish, wish_id)
    if w is None:
        return False
    db.delete(w)
    return True
