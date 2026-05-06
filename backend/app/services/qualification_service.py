from sqlalchemy.orm import Session

from app.models.qualification import Qualification
from app.repositories import qualification_repository as qual_repo
from app.services.exceptions import (
    QualificationInUseError,
    QualificationNotFoundError,
    QualificationValidationError,
)


def validate_qualification_data(data: dict) -> None:
    name = data.get("name", "")
    if not name or not name.strip():
        raise QualificationValidationError("Name darf nicht leer sein")


def create_qualification_with_validation(db: Session, data: dict) -> Qualification:
    validate_qualification_data(data)
    if qual_repo.get_qualification_by_name(db, data["name"]) is not None:
        raise QualificationValidationError(
            f"Qualifikation mit Name '{data['name']}' existiert bereits"
        )
    qual = qual_repo.create_qualification(db, data)
    db.commit()
    db.refresh(qual)
    return qual


def update_qualification_with_validation(
    db: Session, qualification_id: int, data: dict
) -> Qualification:
    qual = qual_repo.get_qualification(db, qualification_id)
    if qual is None:
        raise QualificationNotFoundError(qualification_id)
    if "name" in data:
        validate_qualification_data(data)
    qual_repo.update_qualification(db, qualification_id, data)
    db.commit()
    return qual_repo.get_qualification(db, qualification_id)  # type: ignore[return-value]


def delete_qualification_with_check(db: Session, qualification_id: int) -> None:
    from app.models.doctor_qualification import DoctorQualification

    qual = qual_repo.get_qualification(db, qualification_id)
    if qual is None:
        raise QualificationNotFoundError(qualification_id)

    doctor_names = (
        db.query(DoctorQualification)
        .filter(DoctorQualification.qualification_id == qualification_id)
        .with_entities(DoctorQualification.doctor_id)
        .all()
    )
    if doctor_names:
        from app.models.doctor import Doctor

        ids = [row[0] for row in doctor_names]
        doctors = db.query(Doctor).filter(Doctor.id.in_(ids)).order_by(Doctor.name).all()
        names = [d.name for d in doctors]
        raise QualificationInUseError(names)

    qual_repo.delete_qualification(db, qualification_id)
    db.commit()
