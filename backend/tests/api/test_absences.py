from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Doctor


def _make_doctor(db: Session, name: str = "Abwesenheits-Testarzt") -> Doctor:
    doc = Doctor(name=name)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


class TestListAbsences:
    def test_list_empty(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        resp = client.get(f"/api/doctors/{doc.id}/absences")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_after_create(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {
            "doctor_id": doc.id,
            "absence_type": "URLAUB",
            "valid_from": "2026-07-01",
            "valid_to": "2026-07-14",
        }
        client.post(f"/api/doctors/{doc.id}/absences", json=payload)
        resp = client.get(f"/api/doctors/{doc.id}/absences")
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestCreateAbsence:
    def test_create_happy_path(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {
            "doctor_id": doc.id,
            "absence_type": "URLAUB",
            "valid_from": "2026-06-01",
            "valid_to": "2026-06-14",
            "notes": "Sommerurlaub",
        }
        resp = client.post(f"/api/doctors/{doc.id}/absences", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["absence_type"] == "URLAUB"
        assert data["valid_from"] == "2026-06-01"
        assert data["valid_to"] == "2026-06-14"
        assert data["notes"] == "Sommerurlaub"
        assert data["doctor_id"] == doc.id
        assert "id" in data

    def test_create_without_notes(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "Arzt-ohne-Notiz")
        payload = {
            "doctor_id": doc.id,
            "absence_type": "KRANKHEIT",
            "valid_from": "2026-03-10",
            "valid_to": "2026-03-15",
        }
        resp = client.post(f"/api/doctors/{doc.id}/absences", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["notes"] is None
        assert data["absence_type"] == "KRANKHEIT"
        assert data["valid_from"] == "2026-03-10"
        assert data["valid_to"] == "2026-03-15"

    def test_create_unknown_doctor_returns_404(self, client: TestClient, db: Session) -> None:
        payload = {
            "doctor_id": 99999,
            "absence_type": "URLAUB",
            "valid_from": "2026-01-01",
            "valid_to": "2026-01-07",
        }
        resp = client.post("/api/doctors/99999/absences", json=payload)
        assert resp.status_code == 404

    def test_create_invalid_date_range_returns_422(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "Validierungs-Arzt")
        payload = {
            "doctor_id": doc.id,
            "absence_type": "URLAUB",
            "valid_from": "2026-12-31",
            "valid_to": "2026-01-01",
        }
        resp = client.post(f"/api/doctors/{doc.id}/absences", json=payload)
        assert resp.status_code == 422

    def test_create_all_absence_types(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "Alle-Typen-Arzt")
        absence_types = [
            "URLAUB",
            "KRANKHEIT",
            "FORTBILDUNG",
            "ELTERNZEIT",
            "MUTTERSCHUTZ",
            "SONSTIGES",
        ]
        for i, atype in enumerate(absence_types):
            payload = {
                "doctor_id": doc.id,
                "absence_type": atype,
                "valid_from": f"2026-0{i + 1}-01",
                "valid_to": f"2026-0{i + 1}-05",
            }
            resp = client.post(f"/api/doctors/{doc.id}/absences", json=payload)
            assert resp.status_code == 201, f"Failed for type {atype}: {resp.json()}"


class TestUpdateAbsence:
    def test_update_notes(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {
            "doctor_id": doc.id,
            "absence_type": "SONSTIGES",
            "valid_from": "2026-04-01",
            "valid_to": "2026-04-05",
        }
        created = client.post(f"/api/doctors/{doc.id}/absences", json=payload).json()
        absence_id = created["id"]

        resp = client.patch(f"/api/absences/{absence_id}", json={"notes": "Neue Notiz"})
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Neue Notiz"

    def test_update_type(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "Typ-Arzt")
        payload = {
            "doctor_id": doc.id,
            "absence_type": "URLAUB",
            "valid_from": "2026-09-01",
            "valid_to": "2026-09-10",
        }
        created = client.post(f"/api/doctors/{doc.id}/absences", json=payload).json()
        absence_id = created["id"]

        resp = client.patch(f"/api/absences/{absence_id}", json={"absence_type": "ELTERNZEIT"})
        assert resp.status_code == 200
        assert resp.json()["absence_type"] == "ELTERNZEIT"

    def test_update_unknown_id_returns_404(self, client: TestClient, db: Session) -> None:
        resp = client.patch("/api/absences/99999", json={"notes": "Nicht existent"})
        assert resp.status_code == 404

    def test_update_invalid_date_range_returns_422(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "Datum-Arzt")
        payload = {
            "doctor_id": doc.id,
            "absence_type": "URLAUB",
            "valid_from": "2026-06-01",
            "valid_to": "2026-06-14",
        }
        created = client.post(f"/api/doctors/{doc.id}/absences", json=payload).json()
        absence_id = created["id"]

        resp = client.patch(f"/api/absences/{absence_id}", json={"valid_from": "2026-12-31"})
        assert resp.status_code == 422


class TestDeleteAbsence:
    def test_delete_happy_path(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {
            "doctor_id": doc.id,
            "absence_type": "KRANKHEIT",
            "valid_from": "2026-02-01",
            "valid_to": "2026-02-07",
        }
        created = client.post(f"/api/doctors/{doc.id}/absences", json=payload).json()
        absence_id = created["id"]

        resp = client.delete(f"/api/absences/{absence_id}")
        assert resp.status_code == 204

        list_resp = client.get(f"/api/doctors/{doc.id}/absences")
        assert list_resp.json() == []

    def test_delete_unknown_id_returns_404(self, client: TestClient, db: Session) -> None:
        resp = client.delete("/api/absences/99999")
        assert resp.status_code == 404
