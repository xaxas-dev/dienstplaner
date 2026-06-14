from datetime import date

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.employment_period import EmploymentPeriod
from app.models.qualification import Qualification
from app.repositories import doctor_qualification_repository as dq_repo
from app.repositories import doctor_repository as doctor_repo
from app.repositories import employment_period_repository as ep_repo
from app.services.exceptions import (
    DoctorNotFoundError,
    DuplicateQualificationError,
    EmploymentPeriodNotFoundError,
    EmploymentPeriodOverlapError,
    QualificationNotFoundError,
)


def _periods_overlap(from_a: date, to_a: date | None, from_b: date, to_b: date | None) -> bool:
    """Zwei Zeiträume überschneiden sich, wenn keiner vollständig vor dem anderen liegt."""
    a_before_b = to_a is not None and to_a < from_b
    b_before_a = to_b is not None and to_b < from_a
    return not (a_before_b or b_before_a)


def validate_doctor_data(data: dict) -> None:
    # entry_date vs. virtual_entry_date werden absichtlich nicht gegeneinander
    # validiert: virtual_entry_date kann durch Anrechnungszeiten auch VOR dem
    # realen Eintrittsdatum liegen.
    pass


def validate_employment_period_overlap(
    db: Session,
    doctor_id: int,
    valid_from: date,
    valid_to: date | None,
    *,
    exclude_ep_id: int | None = None,
) -> None:
    existing = ep_repo.list_employment_periods(db, doctor_id)
    for ep in existing:
        if exclude_ep_id is not None and ep.id == exclude_ep_id:
            continue
        if _periods_overlap(valid_from, valid_to, ep.valid_from, ep.valid_to):
            to_str = str(ep.valid_to) if ep.valid_to else "unbefristet"
            raise EmploymentPeriodOverlapError(
                f"Überschneidung mit bestehendem Eintrag ({ep.valid_from} – {to_str})"
            )


def create_doctor_with_validation(db: Session, data: dict) -> Doctor:
    validate_doctor_data(data)
    doctor = doctor_repo.create_doctor(db, data)
    db.commit()
    db.refresh(doctor)
    return doctor


def update_doctor_with_validation(db: Session, doctor_id: int, data: dict) -> Doctor:
    doctor = doctor_repo.get_doctor(db, doctor_id)
    if doctor is None:
        raise DoctorNotFoundError(doctor_id)

    merged = {
        "doctor_type": doctor.doctor_type,
        "rank": doctor.rank,
    }
    merged.update(data)
    validate_doctor_data(merged)

    updated = doctor_repo.update_doctor(db, doctor_id, data)
    db.commit()
    db.refresh(updated)
    return doctor_repo.get_doctor(db, doctor_id)  # type: ignore[return-value]


def add_employment_period_with_validation(
    db: Session, doctor_id: int, data: dict
) -> EmploymentPeriod:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    validate_employment_period_overlap(db, doctor_id, data["valid_from"], data.get("valid_to"))
    ep = ep_repo.create_employment_period(db, doctor_id, data)
    db.commit()
    db.refresh(ep)
    return ep


def update_employment_period_with_validation(
    db: Session, ep_id: int, data: dict
) -> EmploymentPeriod:
    ep = ep_repo.get_employment_period(db, ep_id)
    if ep is None:
        raise EmploymentPeriodNotFoundError(ep_id)

    merged_from = data.get("valid_from", ep.valid_from)
    merged_to = data.get("valid_to", ep.valid_to)
    validate_employment_period_overlap(
        db, ep.doctor_id, merged_from, merged_to, exclude_ep_id=ep_id
    )

    updated = ep_repo.update_employment_period(db, ep_id, data)
    db.commit()
    db.refresh(updated)
    return updated  # type: ignore[return-value]


def add_qualification_to_doctor(
    db: Session,
    doctor_id: int,
    qualification_id: int,
    *,
    acquired_at: date | None = None,
    expires_at: date | None = None,
) -> None:
    from app.models.doctor_qualification import DoctorQualification

    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    if db.get(Qualification, qualification_id) is None:
        raise QualificationNotFoundError(qualification_id)
    if db.get(DoctorQualification, (doctor_id, qualification_id)) is not None:
        raise DuplicateQualificationError(doctor_id, qualification_id)

    dq_repo.add_qualification(
        db, doctor_id, qualification_id, acquired_at=acquired_at, expires_at=expires_at
    )
    db.commit()


def remove_qualification_from_doctor(db: Session, doctor_id: int, qualification_id: int) -> None:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    removed = dq_repo.remove_qualification(db, doctor_id, qualification_id)
    if removed:
        db.commit()
