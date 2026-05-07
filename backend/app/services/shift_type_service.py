from sqlalchemy.orm import Session

from app.models.shift_type import ShiftType
from app.repositories import shift_type_repository as st_repo
from app.services.exceptions import ShiftTypeNotFoundError, ShiftTypeValidationError


def validate_shift_type_data(data: dict) -> None:
    applies_on_weekdays = data.get("applies_on_weekdays", True)
    applies_on_weekend = data.get("applies_on_weekend", False)
    if not applies_on_weekdays and not applies_on_weekend:
        raise ShiftTypeValidationError("Schichttyp muss mindestens an einem Tag-Typ gelten")

    start_time = data.get("start_time")
    end_time = data.get("end_time")
    if start_time is not None and end_time is not None and start_time == end_time:
        raise ShiftTypeValidationError("start_time und end_time dürfen nicht identisch sein")


def create_shift_type_with_validation(db: Session, data: dict) -> ShiftType:
    validate_shift_type_data(data)
    st = st_repo.create_shift_type(db, data)
    db.commit()
    db.refresh(st)
    return st


def update_shift_type_with_validation(db: Session, shift_type_id: int, data: dict) -> ShiftType:
    st = st_repo.get_shift_type(db, shift_type_id)
    if st is None:
        raise ShiftTypeNotFoundError(shift_type_id)

    merged = {
        "applies_on_weekdays": st.applies_on_weekdays,
        "applies_on_weekend": st.applies_on_weekend,
        "start_time": st.start_time,
        "end_time": st.end_time,
    }
    merged.update(data)
    validate_shift_type_data(merged)

    st_repo.update_shift_type(db, shift_type_id, data)
    db.commit()
    return st_repo.get_shift_type(db, shift_type_id)  # type: ignore[return-value]
