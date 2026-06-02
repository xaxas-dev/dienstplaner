import pytest
from pydantic import ValidationError

from app.schemas.shift import ShiftUpdate


def test_shift_update_empty_dict_accepted() -> None:
    u = ShiftUpdate.model_validate({})
    assert u.doctor_id is None
    assert u.is_pinned is None
    assert u.notes is None
    # exclude_unset: kein Feld gesetzt
    assert u.model_dump(exclude_unset=True) == {}


def test_shift_update_single_field() -> None:
    u = ShiftUpdate.model_validate({"is_pinned": True})
    assert u.model_dump(exclude_unset=True) == {"is_pinned": True}
    assert u.doctor_id is None


def test_shift_update_doctor_id_explicit_none() -> None:
    # doctor_id=None explizit gesetzt → taucht in exclude_unset auf (Zuweisung aufheben)
    u = ShiftUpdate.model_validate({"doctor_id": None})
    data = u.model_dump(exclude_unset=True)
    assert "doctor_id" in data
    assert data["doctor_id"] is None


def test_shift_update_all_fields() -> None:
    u = ShiftUpdate.model_validate({"doctor_id": 5, "is_pinned": True, "notes": "Test"})
    data = u.model_dump(exclude_unset=True)
    assert data == {"doctor_id": 5, "is_pinned": True, "notes": "Test"}


def test_shift_update_extra_field_rejected() -> None:
    with pytest.raises(ValidationError):
        ShiftUpdate.model_validate({"doctorid": 5})  # Tippfehler


def test_shift_response_has_is_locked() -> None:
    """ShiftResponse muss is_locked exponieren."""
    from app.schemas.shift import ShiftResponse

    fields = ShiftResponse.model_fields
    assert "is_locked" in fields
    assert fields["is_locked"].default is False
