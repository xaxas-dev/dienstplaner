from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import doctor_repository as doctor_repo
from app.repositories import plan_repository as plan_repo
from app.schemas.wish import WishCreateBody, WishResponse, WishUpdate
from app.services import wish_service
from app.services.exceptions import DoctorNotFoundError, PlanNotFoundError

doctor_wishes_router = APIRouter(tags=["wishes"])
wishes_router = APIRouter(tags=["wishes"])
plan_wishes_router = APIRouter(tags=["wishes"])


@doctor_wishes_router.get("/doctors/{doctor_id}/wishes", response_model=list[WishResponse])
def list_wishes(doctor_id: int, db: Session = Depends(get_db)) -> list:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    return wish_service.get_wishes_by_doctor(db, doctor_id)


@doctor_wishes_router.post(
    "/doctors/{doctor_id}/wishes",
    response_model=WishResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wish(doctor_id: int, body: WishCreateBody, db: Session = Depends(get_db)) -> WishResponse:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    return wish_service.create_wish(db, doctor_id, body.model_dump())


@wishes_router.patch("/wishes/{wish_id}", response_model=WishResponse)
def update_wish(wish_id: int, body: WishUpdate, db: Session = Depends(get_db)) -> WishResponse:
    return wish_service.update_wish(db, wish_id, body.model_dump(exclude_unset=True))


@wishes_router.delete("/wishes/{wish_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wish(wish_id: int, db: Session = Depends(get_db)) -> Response:
    wish_service.delete_wish(db, wish_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@plan_wishes_router.get("/plans/{plan_id}/wishes", response_model=list[WishResponse])
def list_plan_wishes(plan_id: int, db: Session = Depends(get_db)) -> list:
    if plan_repo.get_plan(db, plan_id) is None:
        raise PlanNotFoundError(plan_id)
    return wish_service.get_wishes_for_plan_period(db, plan_id)
