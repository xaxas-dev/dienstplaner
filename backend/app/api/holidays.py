from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.holiday import HolidaySource
from app.repositories import holiday_repository as holiday_repo
from app.schemas.holiday import HolidayCreate, HolidayResponse, HolidaySeedRequest
from app.services import holiday_service

router = APIRouter(prefix="/holidays", tags=["holidays"])


@router.get("", response_model=list[HolidayResponse])
def list_holidays(year: int, db: Session = Depends(get_db)) -> list[HolidayResponse]:
    return holiday_repo.list_holidays_for_year(db, year)


@router.post("/seed", response_model=dict)
def seed_holidays(data: HolidaySeedRequest, db: Session = Depends(get_db)) -> dict:
    added = holiday_service.seed_sh_holidays(db, data.year)
    return {"added": added, "year": data.year}


@router.post("", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
def create_holiday(data: HolidayCreate, db: Session = Depends(get_db)):
    existing = holiday_repo.get_holiday(db, data.date)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Feiertag für dieses Datum existiert bereits")
    h = holiday_repo.create_holiday(db, data.date, data.name, HolidaySource.MANUAL)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{holiday_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(holiday_date: date, db: Session = Depends(get_db)) -> None:
    existing = holiday_repo.get_holiday(db, holiday_date)
    if existing is None:
        raise HTTPException(status_code=404, detail="Feiertag nicht gefunden")
    holiday_repo.delete_holiday(db, holiday_date)
    db.commit()
