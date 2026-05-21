from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import doctor_repository as doctor_repo
from app.repositories import employment_period_repository as ep_repo
from app.schemas.doctor import DoctorCreate, DoctorResponse, DoctorUpdate, DoctorWithRelations
from app.schemas.doctor_qualification import DoctorQualificationBody, DoctorQualificationResponse
from app.schemas.employment_period import (
    EmploymentPeriodBody,
    EmploymentPeriodResponse,
    EmploymentPeriodUpdate,
)
from app.schemas.ina_availability import INAAvailabilityEntry
from app.services import doctor_service
from app.services.exceptions import DoctorNotFoundError, EmploymentPeriodNotFoundError
from app.services.ina_availability_service import get_ina_availability_for_period

router = APIRouter(prefix="/doctors", tags=["doctors"])


# ── Ärzte ─────────────────────────────────────────────────────────────────────


@router.get("", response_model=list[DoctorWithRelations])
def list_doctors(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list:
    return doctor_repo.list_doctors(db, include_inactive=include_inactive)


@router.get("/{doctor_id}", response_model=DoctorWithRelations)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = doctor_repo.get_doctor(db, doctor_id)
    if doctor is None:
        raise DoctorNotFoundError(doctor_id)
    return doctor


@router.get("/{doctor_id}/ina-availability", response_model=dict[str, INAAvailabilityEntry])
def get_ina_availability_range(
    doctor_id: int,
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    db: Session = Depends(get_db),
) -> dict[str, INAAvailabilityEntry]:
    doctor = doctor_repo.get_doctor(db, doctor_id)
    if doctor is None:
        raise DoctorNotFoundError(doctor_id)
    if from_date > to_date:
        raise HTTPException(
            status_code=422,
            detail="'from' darf nicht nach 'to' liegen.",
        )
    raw = get_ina_availability_for_period(db, doctor_id, from_date, to_date)
    return {
        d.isoformat(): INAAvailabilityEntry(available=entry.available, reasons=entry.reasons)
        for d, entry in raw.items()
    }


@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(body: DoctorCreate, db: Session = Depends(get_db)):
    data = body.model_dump()
    return doctor_service.create_doctor_with_validation(db, data)


@router.patch("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(doctor_id: int, body: DoctorUpdate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    return doctor_service.update_doctor_with_validation(db, doctor_id, data)


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(doctor_id: int, db: Session = Depends(get_db)) -> None:
    doctor = doctor_repo.get_doctor(db, doctor_id)
    if doctor is None:
        raise DoctorNotFoundError(doctor_id)
    doctor_repo.delete_doctor(db, doctor_id)
    db.commit()


# ── Beschäftigungszeiträume ───────────────────────────────────────────────────


@router.post(
    "/{doctor_id}/employment-periods",
    response_model=EmploymentPeriodResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_employment_period(
    doctor_id: int, body: EmploymentPeriodBody, db: Session = Depends(get_db)
) -> EmploymentPeriodResponse:
    data = body.model_dump()
    return doctor_service.add_employment_period_with_validation(db, doctor_id, data)


# ── Qualifikationen ────────────────────────────────────────────────────────────


@router.post(
    "/{doctor_id}/qualifications/{qualification_id}",
    response_model=DoctorQualificationResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_qualification(
    doctor_id: int,
    qualification_id: int,
    body: DoctorQualificationBody = DoctorQualificationBody(),
    db: Session = Depends(get_db),
) -> DoctorQualificationResponse:
    from app.repositories.doctor_qualification_repository import get_doctor_qualification

    doctor_service.add_qualification_to_doctor(
        db,
        doctor_id,
        qualification_id,
        acquired_at=body.acquired_at,
        expires_at=body.expires_at,
    )
    dq = get_doctor_qualification(db, doctor_id, qualification_id)
    return dq  # type: ignore[return-value]


@router.delete(
    "/{doctor_id}/qualifications/{qualification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_qualification(
    doctor_id: int, qualification_id: int, db: Session = Depends(get_db)
) -> None:
    doctor_service.remove_qualification_from_doctor(db, doctor_id, qualification_id)


# ── EmploymentPeriod-Endpunkte ohne doctor_id im Pfad ────────────────────────

ep_router = APIRouter(prefix="/employment-periods", tags=["employment-periods"])


@ep_router.patch("/{ep_id}", response_model=EmploymentPeriodResponse)
def update_employment_period(
    ep_id: int, body: EmploymentPeriodUpdate, db: Session = Depends(get_db)
) -> EmploymentPeriodResponse:
    data = body.model_dump(exclude_unset=True)
    return doctor_service.update_employment_period_with_validation(db, ep_id, data)


@ep_router.delete("/{ep_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employment_period(ep_id: int, db: Session = Depends(get_db)) -> None:
    ep = ep_repo.get_employment_period(db, ep_id)
    if ep is None:
        raise EmploymentPeriodNotFoundError(ep_id)
    ep_repo.delete_employment_period(db, ep_id)
    db.commit()
