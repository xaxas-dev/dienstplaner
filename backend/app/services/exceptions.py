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
