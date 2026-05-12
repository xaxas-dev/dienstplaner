from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import doctor_repository as doctor_repo
from app.repositories import ina_exclusion_repository as repo
from app.schemas.ina_exclusion import (
    INAAvailabilityResponse,
    INAExclusionCreate,
    INAExclusionResponse,
    INAExclusionUpdate,
)
from app.services import ina_availability_service as avail_svc
from app.services import ina_exclusion_service as excl_svc
from app.services.exceptions import (
    DoctorNotFoundError,
)

router = APIRouter(tags=["ina-exclusions"])


@router.get(
    "/doctors/{doctor_id}/ina-exclusions",
    response_model=list[INAExclusionResponse],
)
def list_ina_exclusions(doctor_id: int, db: Session = Depends(get_db)) -> list:
    return repo.list_exclusions_for_doctor(db, doctor_id)


@router.post(
    "/doctors/{doctor_id}/ina-exclusions",
    response_model=INAExclusionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ina_exclusion(
    doctor_id: int,
    body: INAExclusionCreate,
    db: Session = Depends(get_db),
) -> INAExclusionResponse:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    data = body.model_dump()
    return excl_svc.create_exclusion_with_validation(db, doctor_id, data)


@router.patch(
    "/ina-exclusions/{exclusion_id}",
    response_model=INAExclusionResponse,
)
def update_ina_exclusion(
    exclusion_id: int,
    body: INAExclusionUpdate,
    db: Session = Depends(get_db),
) -> INAExclusionResponse:
    data = body.model_dump(exclude_unset=True)
    return excl_svc.update_exclusion_with_validation(db, exclusion_id, data)


@router.delete(
    "/ina-exclusions/{exclusion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_ina_exclusion(
    exclusion_id: int,
    db: Session = Depends(get_db),
) -> Response:
    deleted = repo.delete_exclusion(db, exclusion_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"INA-Ausschluss {exclusion_id} nicht gefunden")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/doctors/{doctor_id}/ina-availability",
    response_model=list[INAAvailabilityResponse],
)
def get_ina_availability(
    doctor_id: int,
    date_param: date | None = Query(default=None, alias="date"),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> list[INAAvailabilityResponse]:
    if date_param is not None:
        avail = avail_svc.get_ina_availability(db, doctor_id, date_param)
        return [
            INAAvailabilityResponse(
                date=date_param, available=avail.available, reasons=avail.reasons
            )
        ]

    if from_date is not None and to_date is not None:
        if from_date > to_date:
            raise HTTPException(status_code=422, detail="from darf nicht nach to liegen")
        avail_map = avail_svc.get_ina_availability_for_period(db, doctor_id, from_date, to_date)
        return [
            INAAvailabilityResponse(date=d, available=a.available, reasons=a.reasons)
            for d, a in sorted(avail_map.items())
        ]

    raise HTTPException(
        status_code=422,
        detail="Entweder 'date' oder 'from' und 'to' müssen angegeben werden",
    )
