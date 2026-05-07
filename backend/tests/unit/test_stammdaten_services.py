from datetime import date

import pytest

from app.services.department_service import validate_department_data
from app.services.exceptions import (
    DepartmentValidationError,
    QualificationValidationError,
    RuleOverrideValidationError,
    ShiftTypeValidationError,
)
from app.services.qualification_service import validate_qualification_data
from app.services.rule_override_service import validate_rule_override_data
from app.services.shift_type_service import validate_shift_type_data

# ── department_service ─────────────────────────────────────────────────────────


def test_department_name_empty_raises() -> None:
    with pytest.raises(DepartmentValidationError, match="leer"):
        validate_department_data({"name": ""})


def test_department_name_whitespace_raises() -> None:
    with pytest.raises(DepartmentValidationError, match="leer"):
        validate_department_data({"name": "   "})


def test_department_valid_name_ok() -> None:
    validate_department_data({"name": "Neurologie"})


# ── shift_type_service ─────────────────────────────────────────────────────────


def test_shift_type_no_day_type_raises() -> None:
    with pytest.raises(ShiftTypeValidationError, match="Tag-Typ"):
        validate_shift_type_data({"applies_on_weekdays": False, "applies_on_weekend": False})


def test_shift_type_weekdays_only_ok() -> None:
    validate_shift_type_data({"applies_on_weekdays": True, "applies_on_weekend": False})


def test_shift_type_weekend_only_ok() -> None:
    validate_shift_type_data({"applies_on_weekdays": False, "applies_on_weekend": True})


def test_shift_type_identical_times_raises() -> None:
    from datetime import time

    with pytest.raises(ShiftTypeValidationError, match="identisch"):
        validate_shift_type_data(
            {
                "applies_on_weekdays": True,
                "start_time": time(8, 0),
                "end_time": time(8, 0),
            }
        )


def test_shift_type_night_shift_over_midnight_ok() -> None:
    from datetime import time

    validate_shift_type_data(
        {
            "applies_on_weekdays": True,
            "applies_on_weekend": True,
            "start_time": time(21, 0),
            "end_time": time(7, 0),
        }
    )


# ── qualification_service ──────────────────────────────────────────────────────


def test_qualification_name_empty_raises() -> None:
    with pytest.raises(QualificationValidationError, match="leer"):
        validate_qualification_data({"name": ""})


def test_qualification_valid_name_ok() -> None:
    validate_qualification_data({"name": "EEG"})


# ── rule_override_service ──────────────────────────────────────────────────────


def test_rule_override_doctor_scope_without_id_raises() -> None:
    with pytest.raises(RuleOverrideValidationError, match="doctor_id"):
        validate_rule_override_data(
            {"rule_key": "K", "override_value": "1", "scope": "DOCTOR", "doctor_id": None}
        )


def test_rule_override_global_scope_with_id_raises() -> None:
    with pytest.raises(RuleOverrideValidationError, match="doctor_id"):
        validate_rule_override_data(
            {"rule_key": "K", "override_value": "1", "scope": "GLOBAL", "doctor_id": 1}
        )


def test_rule_override_valid_from_after_valid_to_raises() -> None:
    with pytest.raises(RuleOverrideValidationError, match="valid_from"):
        validate_rule_override_data(
            {
                "rule_key": "K",
                "override_value": "1",
                "scope": "GLOBAL",
                "valid_from": date(2025, 6, 1),
                "valid_to": date(2025, 1, 1),
            }
        )


def test_rule_override_valid_date_range_ok() -> None:
    validate_rule_override_data(
        {
            "rule_key": "K",
            "override_value": "1",
            "scope": "GLOBAL",
            "valid_from": date(2025, 1, 1),
            "valid_to": date(2025, 12, 31),
        }
    )


def test_rule_override_empty_rule_key_raises() -> None:
    with pytest.raises(RuleOverrideValidationError, match="rule_key"):
        validate_rule_override_data({"rule_key": "", "override_value": "1", "scope": "GLOBAL"})


def test_rule_override_empty_value_raises() -> None:
    with pytest.raises(RuleOverrideValidationError, match="override_value"):
        validate_rule_override_data({"rule_key": "K", "override_value": "", "scope": "GLOBAL"})
