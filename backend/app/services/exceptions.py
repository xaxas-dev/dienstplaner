class DoctorNotFoundError(Exception):
    def __init__(self, doctor_id: int) -> None:
        super().__init__(f"Arzt mit ID {doctor_id} nicht gefunden")
        self.doctor_id = doctor_id


class EmploymentPeriodNotFoundError(Exception):
    def __init__(self, ep_id: int) -> None:
        super().__init__(f"Beschäftigungszeitraum mit ID {ep_id} nicht gefunden")
        self.ep_id = ep_id


class EmploymentPeriodOverlapError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class DoctorValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class QualificationNotFoundError(Exception):
    def __init__(self, qualification_id: int) -> None:
        super().__init__(f"Qualifikation mit ID {qualification_id} nicht gefunden")
        self.qualification_id = qualification_id


class DuplicateQualificationError(Exception):
    def __init__(self, doctor_id: int, qualification_id: int) -> None:
        super().__init__(
            f"Qualifikation {qualification_id} ist Arzt {doctor_id} bereits zugewiesen"
        )
        self.doctor_id = doctor_id
        self.qualification_id = qualification_id


class DepartmentNotFoundError(Exception):
    def __init__(self, department_id: int) -> None:
        super().__init__(f"Bereich mit ID {department_id} nicht gefunden")
        self.department_id = department_id


class DepartmentValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class ShiftTypeNotFoundError(Exception):
    def __init__(self, shift_type_id: int) -> None:
        super().__init__(f"Schichttyp mit ID {shift_type_id} nicht gefunden")
        self.shift_type_id = shift_type_id


class ShiftTypeValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class QualificationInUseError(Exception):
    def __init__(self, doctor_names: list[str]) -> None:
        self.doctor_names = doctor_names
        if len(doctor_names) <= 10:
            names_str = ", ".join(doctor_names)
        else:
            names_str = ", ".join(doctor_names[:10]) + f" ... und {len(doctor_names) - 10} weitere"
        super().__init__(f"Qualifikation wird noch von folgenden Ärzten verwendet: {names_str}")
        self.detail = str(self)


class QualificationValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class RuleOverrideNotFoundError(Exception):
    def __init__(self, override_id: int) -> None:
        super().__init__(f"Regelüberschreibung mit ID {override_id} nicht gefunden")
        self.override_id = override_id


class RuleOverrideValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class PlanNotFoundError(Exception):
    def __init__(self, plan_id: int) -> None:
        super().__init__(f"Plan mit ID {plan_id} nicht gefunden")
        self.plan_id = plan_id


class PlanValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class RotationNotFoundError(Exception):
    def __init__(self, rotation_id: int) -> None:
        super().__init__(f"Rotationszuweisung mit ID {rotation_id} nicht gefunden")
        self.rotation_id = rotation_id


class RotationValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class ShiftNotFoundError(Exception):
    def __init__(self, shift_id: int) -> None:
        super().__init__(f"Schicht mit ID {shift_id} nicht gefunden")
        self.shift_id = shift_id


class ShiftValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class INAExclusionNotFoundError(Exception):
    def __init__(self, exclusion_id: int) -> None:
        super().__init__(f"INA-Ausschluss mit ID {exclusion_id} nicht gefunden")
        self.exclusion_id = exclusion_id


class INAExclusionValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class SettingNotFoundError(Exception):
    def __init__(self, key: str) -> None:
        super().__init__(f"Einstellung '{key}' nicht gefunden")
        self.key = key
