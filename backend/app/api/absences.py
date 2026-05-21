from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import doctor_repository as doctor_repo
from app.schemas.absence import AbsenceCreate, AbsenceResponse, AbsenceUpdate
from app.services import absence_service as svc
from app.services.exceptions import DoctorNotFoundError

router = APIRouter(tags=["absences"])


@router.get(
    "/doctors/{doctor_id}/absences",
    response_model=list[AbsenceResponse],
)
def list_absences(doctor_id: int, db: Session = Depends(get_db)) -> list:
    return svc.get_absences_for_doctor(db, doctor_id)


@router.post(
    "/doctors/{doctor_id}/absences",
    response_model=AbsenceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_absence(
    doctor_id: int,
    body: AbsenceCreate,
    db: Session = Depends(get_db),
) -> AbsenceResponse:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    data = body.model_dump(exclude={"doctor_id"})
    return svc.create_absence(db, doctor_id, data)


@router.patch(
    "/absences/{absence_id}",
    response_model=AbsenceResponse,
)
def update_absence(
    absence_id: int,
    body: AbsenceUpdate,
    db: Session = Depends(get_db),
) -> AbsenceResponse:
    data = body.model_dump(exclude_unset=True)
    return svc.update_absence(db, absence_id, data)


@router.delete(
    "/absences/{absence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_absence(
    absence_id: int,
    db: Session = Depends(get_db),
) -> Response:
    svc.delete_absence(db, absence_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
