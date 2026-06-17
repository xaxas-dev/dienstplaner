from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models import Doctor
from app.services import absence_service as svc
from app.services.exceptions import AbsenceNotFoundError, AbsenceValidationError


def _make_doctor(db: Session, name: str = "Testarzt") -> Doctor:
    doc = Doctor(last_name=name)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


class TestCreateAbsence:
    def test_create_happy_path(self, db: Session) -> None:
        doc = _make_doctor(db)
        absence = svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "URLAUB",
                "valid_from": date(2026, 6, 1),
                "valid_to": date(2026, 6, 14),
                "notes": "Sommerurlaub",
            },
        )
        assert absence.id is not None
        assert absence.doctor_id == doc.id
        assert absence.absence_type == "URLAUB"
        assert str(absence.valid_from) == "2026-06-01"
        assert str(absence.valid_to) == "2026-06-14"

    def test_create_single_day(self, db: Session) -> None:
        doc = _make_doctor(db, "Einzel-Arzt")
        absence = svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "KRANKHEIT",
                "valid_from": date(2026, 5, 10),
                "valid_to": date(2026, 5, 10),
            },
        )
        assert absence.valid_from == absence.valid_to

    def test_create_raises_422_when_from_after_to(self, db: Session) -> None:
        doc = _make_doctor(db, "Validierungsarzt")
        with pytest.raises(AbsenceValidationError):
            svc.create_absence(
                db,
                doc.id,
                {
                    "absence_type": "URLAUB",
                    "valid_from": date(2026, 6, 30),
                    "valid_to": date(2026, 6, 1),
                },
            )


class TestGetAbsencesForDoctor:
    def test_returns_empty_for_new_doctor(self, db: Session) -> None:
        doc = _make_doctor(db)
        result = svc.get_absences_for_doctor(db, doc.id)
        assert result == []

    def test_returns_absences_for_doctor(self, db: Session) -> None:
        doc = _make_doctor(db)
        svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "FORTBILDUNG",
                "valid_from": date(2026, 3, 1),
                "valid_to": date(2026, 3, 3),
            },
        )
        svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "URLAUB",
                "valid_from": date(2026, 7, 1),
                "valid_to": date(2026, 7, 14),
            },
        )
        result = svc.get_absences_for_doctor(db, doc.id)
        assert len(result) == 2

    def test_does_not_return_other_doctors_absences(self, db: Session) -> None:
        doc1 = _make_doctor(db, "Arzt-1")
        doc2 = _make_doctor(db, "Arzt-2")
        svc.create_absence(
            db,
            doc1.id,
            {
                "absence_type": "URLAUB",
                "valid_from": date(2026, 1, 1),
                "valid_to": date(2026, 1, 7),
            },
        )
        result = svc.get_absences_for_doctor(db, doc2.id)
        assert result == []


class TestUpdateAbsence:
    def test_update_notes_happy_path(self, db: Session) -> None:
        doc = _make_doctor(db)
        absence = svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "SONSTIGES",
                "valid_from": date(2026, 4, 1),
                "valid_to": date(2026, 4, 5),
            },
        )
        updated = svc.update_absence(db, absence.id, {"notes": "Aktualisierter Kommentar"})
        assert updated.notes == "Aktualisierter Kommentar"

    def test_update_type_happy_path(self, db: Session) -> None:
        doc = _make_doctor(db)
        absence = svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "URLAUB",
                "valid_from": date(2026, 8, 1),
                "valid_to": date(2026, 8, 10),
            },
        )
        updated = svc.update_absence(db, absence.id, {"absence_type": "ELTERNZEIT"})
        assert updated.absence_type == "ELTERNZEIT"

    def test_update_raises_404_for_unknown_id(self, db: Session) -> None:
        with pytest.raises(AbsenceNotFoundError):
            svc.update_absence(db, 99999, {"notes": "Nicht existent"})

    def test_update_raises_422_when_from_after_to(self, db: Session) -> None:
        doc = _make_doctor(db)
        absence = svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "URLAUB",
                "valid_from": date(2026, 6, 1),
                "valid_to": date(2026, 6, 14),
            },
        )
        with pytest.raises(AbsenceValidationError):
            svc.update_absence(db, absence.id, {"valid_from": date(2026, 6, 30)})


class TestDeleteAbsence:
    def test_delete_happy_path(self, db: Session) -> None:
        doc = _make_doctor(db)
        absence = svc.create_absence(
            db,
            doc.id,
            {
                "absence_type": "KRANKHEIT",
                "valid_from": date(2026, 2, 1),
                "valid_to": date(2026, 2, 7),
            },
        )
        svc.delete_absence(db, absence.id)
        result = svc.get_absences_for_doctor(db, doc.id)
        assert result == []

    def test_delete_raises_404_for_unknown_id(self, db: Session) -> None:
        with pytest.raises(AbsenceNotFoundError):
            svc.delete_absence(db, 99999)
