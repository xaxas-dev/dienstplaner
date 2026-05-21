from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Doctor


def _make_doctor(db: Session, name: str = "INA-Testarzt") -> Doctor:
    doc = Doctor(name=name)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


class TestINAExclusionCRUD:
    def test_list_empty(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        resp = client.get(f"/api/doctors/{doc.id}/ina-exclusions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_exclusion(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {
            "valid_from": "2026-01-01",
            "valid_to": None,
            "reason": "SCHWANGERSCHAFT",
            "notes": None,
        }
        resp = client.post(f"/api/doctors/{doc.id}/ina-exclusions", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["reason"] == "SCHWANGERSCHAFT"
        assert data["valid_from"] == "2026-01-01"
        assert data["valid_to"] is None
        assert data["doctor_id"] == doc.id

    def test_list_after_create(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {"valid_from": "2026-03-01", "reason": "EINARBEITUNG"}
        client.post(f"/api/doctors/{doc.id}/ina-exclusions", json=payload)
        resp = client.get(f"/api/doctors/{doc.id}/ina-exclusions")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_update_exclusion(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {"valid_from": "2026-01-01", "reason": "SCHWANGERSCHAFT"}
        created = client.post(f"/api/doctors/{doc.id}/ina-exclusions", json=payload).json()
        excl_id = created["id"]

        resp = client.patch(f"/api/ina-exclusions/{excl_id}", json={"notes": "Aktualisiert"})
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Aktualisiert"

    def test_delete_exclusion(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {"valid_from": "2026-01-01", "reason": "SONSTIGES"}
        created = client.post(f"/api/doctors/{doc.id}/ina-exclusions", json=payload).json()
        excl_id = created["id"]

        resp = client.delete(f"/api/ina-exclusions/{excl_id}")
        assert resp.status_code == 204

        list_resp = client.get(f"/api/doctors/{doc.id}/ina-exclusions")
        assert list_resp.json() == []

    def test_delete_not_found(self, client: TestClient, db: Session) -> None:
        resp = client.delete("/api/ina-exclusions/99999")
        assert resp.status_code == 404

    def test_validation_valid_from_after_valid_to(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {
            "valid_from": "2026-12-01",
            "valid_to": "2026-01-01",
            "reason": "SCHWANGERSCHAFT",
        }
        resp = client.post(f"/api/doctors/{doc.id}/ina-exclusions", json=payload)
        assert resp.status_code == 422

    def test_unknown_doctor_returns_404(self, client: TestClient, db: Session) -> None:
        payload = {"valid_from": "2026-01-01", "reason": "SONSTIGES"}
        resp = client.post("/api/doctors/99999/ina-exclusions", json=payload)
        assert resp.status_code == 404


class TestINAAvailabilityEndpoint:
    def test_single_date_available(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "Avail-Arzt")
        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-04", "to": "2026-05-04"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert "2026-05-04" in data
        assert data["2026-05-04"]["available"] is True
        assert data["2026-05-04"]["reasons"] == []

    def test_period_range(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "Range-Arzt")
        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-01", "to": "2026-05-03"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3

    def test_missing_params(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "NoParam-Arzt")
        resp = client.get(f"/api/doctors/{doc.id}/ina-availability")
        assert resp.status_code == 422

    def test_from_after_to(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db, "BadRange-Arzt")
        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-31", "to": "2026-05-01"},
        )
        assert resp.status_code == 422


class TestSeedBlocksCorrectValues:
    def test_department_blocks_values(self, db: Session) -> None:
        from app.models import Department

        su = db.query(Department).filter(Department.name == "SU").first()
        if su is not None:
            assert su.blocks_ina_weekdays is True
            assert su.blocks_ina_weekends is True

        ck = db.query(Department).filter(Department.name == "Curschmann Klinik").first()
        if ck is not None:
            assert ck.blocks_ina_weekdays is True
            assert ck.blocks_ina_weekends is False

        emg = db.query(Department).filter(Department.name == "EMG").first()
        if emg is not None:
            assert emg.blocks_ina_weekdays is False
            assert emg.blocks_ina_weekends is False
