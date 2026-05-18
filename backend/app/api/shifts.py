from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.shift import ShiftUpdate, ShiftWithDetails
from app.services import shift_service

router = APIRouter(prefix="/shifts", tags=["shifts"])


@router.patch("/{shift_id}", response_model=ShiftWithDetails)
def patch_shift(
    shift_id: int,
    update: ShiftUpdate,
    db: Session = Depends(get_db),
) -> ShiftWithDetails:
    return shift_service.update_shift(db, shift_id, update)
