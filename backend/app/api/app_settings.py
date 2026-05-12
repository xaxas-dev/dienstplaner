from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import app_setting_repository as repo
from app.schemas.app_setting import AppSettingResponse, AppSettingUpdate
from app.services.exceptions import SettingNotFoundError

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=list[AppSettingResponse])
def list_settings(db: Session = Depends(get_db)) -> list:
    return repo.list_settings(db)


@router.get("/{key}", response_model=AppSettingResponse)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = repo.get_setting(db, key)
    if setting is None:
        raise SettingNotFoundError(key)
    return setting


@router.patch("/{key}", response_model=AppSettingResponse)
def update_setting(key: str, body: AppSettingUpdate, db: Session = Depends(get_db)):
    setting = repo.update_setting(db, key, body.value)
    if setting is None:
        raise SettingNotFoundError(key)
    db.commit()
    db.refresh(setting)
    return setting
