from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting


def list_settings(db: Session) -> list[AppSetting]:
    return db.query(AppSetting).order_by(AppSetting.key).all()


def get_setting(db: Session, key: str) -> AppSetting | None:
    return db.query(AppSetting).filter(AppSetting.key == key).first()


def update_setting(db: Session, key: str, value: str) -> AppSetting | None:
    setting = get_setting(db, key)
    if setting is None:
        return None
    setting.value = value
    db.flush()
    db.refresh(setting)
    return setting
