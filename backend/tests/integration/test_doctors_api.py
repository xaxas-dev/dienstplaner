
from fastapi.testclient import TestClient


def _create_doctor(client: TestClient, **kwargs) -> dict:
    payload = {"name": "Test Arzt", **kwargs}
    r = client.post("/api/doctors", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _create_qualification(client: TestClient, name: str) -> dict:
    """Erstellt eine Qualifikation direkt über die DB (kein Endpunkt in M1-002)."""
    from sqlalchemy.orm import Session

    from app.database import get_db
    from app.models.qualification import Qualification

    override = client.app.dependency_overrides.get(get_db)
    assert override is not None
    session: Session = next(override())
    q = Qualification(name=name)
    session.add(q)
    session.commit()
    session.refresh(q)
    return {"id": q.id, "name": q.name}


# ── Lesen ──────────────────────────────────────────────────────────────────────


def test_list_doctors_empty(client: TestClient) -> None:
    r = client.get("/api/doctors")
    assert r.status_code == 200
    assert r.json() == []


def test_create_doctor_minimal(client: TestClient) -> None:
    r = client.post("/api/doctors", json={"name": "Dr. Minimal"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Dr. Minimal"
    assert data["active"] is True
    assert data["is_facharzt"] is False
    assert data["doctor_type"] == "INTERNAL"


def test_create_doctor_full(client: TestClient) -> None:
    payload = {
        "name": "Dr. Vollständig",
        "short_name": "VV",
        "doctor_type": "INTERNAL",
        "weiterbildungsjahr": 3,
        "is_facharzt": False,
        "active": True,
        "notes": "Test-Notiz",
    }
    r = client.post("/api/doctors", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["short_name"] == "VV"
    assert data["weiterbildungsjahr"] == 3
    assert data["notes"] == "Test-Notiz"


def test_create_doctor_validation_facharzt_with_wbj(client: TestClient) -> None:
    r = client.post(
        "/api/doctors",
        json={"name": "Dr. Ungültig", "is_facharzt": True, "weiterbildungsjahr": 3},
    )
    assert r.status_code == 422
    assert "Weiterbildungsjahr" in r.json()["detail"]


def test_get_doctor_with_relations(client: TestClient) -> None:
    doctor = _create_doctor(client, name="Dr. Relations")
    did = doctor["id"]

    q1 = _create_qualification(client, "EEG-Befundung")
    q2 = _create_qualification(client, "Neurophysiologie")

    client.post(f"/api/doctors/{did}/qualifications/{q1['id']}", json={})
    client.post(f"/api/doctors/{did}/qualifications/{q2['id']}", json={})

    client.post(
        f"/api/doctors/{did}/employment-periods",
        json={"valid_from": "2024-01-01", "valid_to": "2024-06-30", "employment_percentage": 50},
    )
    client.post(
        f"/api/doctors/{did}/employment-periods",
        json={"valid_from": "2024-07-01", "employment_percentage": 100},
    )

    r = client.get(f"/api/doctors/{did}")
    assert r.status_code == 200
    data = r.json()
    assert len(data["employment_periods"]) == 2
    assert len(data["qualifications"]) == 2
    qual_names = {q["name"] for q in data["qualifications"]}
    assert "EEG-Befundung" in qual_names
    assert "Neurophysiologie" in qual_names


def test_get_doctor_404(client: TestClient) -> None:
    r = client.get("/api/doctors/99999")
    assert r.status_code == 404


def test_update_doctor_partial(client: TestClient) -> None:
    doctor = _create_doctor(client, name="Dr. Update", short_name="DU")
    did = doctor["id"]

    r = client.patch(f"/api/doctors/{did}", json={"notes": "Neue Notiz"})
    assert r.status_code == 200
    data = r.json()
    assert data["notes"] == "Neue Notiz"
    assert data["short_name"] == "DU"  # unverändert


def test_delete_doctor_cascades(client: TestClient) -> None:
    doctor = _create_doctor(client, name="Dr. Lösch")
    did = doctor["id"]

    client.post(
        f"/api/doctors/{did}/employment-periods",
        json={"valid_from": "2024-01-01", "employment_percentage": 100},
    )
    q = _create_qualification(client, "Zu löschende Quali")
    client.post(f"/api/doctors/{did}/qualifications/{q['id']}", json={})

    r = client.delete(f"/api/doctors/{did}")
    assert r.status_code == 204

    r = client.get(f"/api/doctors/{did}")
    assert r.status_code == 404


def test_create_employment_period_overlap(client: TestClient) -> None:
    doctor = _create_doctor(client, name="Dr. Overlap")
    did = doctor["id"]

    r1 = client.post(
        f"/api/doctors/{did}/employment-periods",
        json={"valid_from": "2024-01-01", "valid_to": "2024-12-31", "employment_percentage": 80},
    )
    assert r1.status_code == 201

    r2 = client.post(
        f"/api/doctors/{did}/employment-periods",
        json={"valid_from": "2024-06-01", "valid_to": "2025-06-30", "employment_percentage": 50},
    )
    assert r2.status_code == 422
    assert "berschneidung" in r2.json()["detail"]


def test_create_employment_period_unbefristet(client: TestClient) -> None:
    doctor = _create_doctor(client, name="Dr. Unbefristet")
    did = doctor["id"]

    r = client.post(
        f"/api/doctors/{did}/employment-periods",
        json={"valid_from": "2024-01-01", "employment_percentage": 100},
    )
    assert r.status_code == 201
    assert r.json()["valid_to"] is None


def test_add_and_remove_qualification(client: TestClient) -> None:
    doctor = _create_doctor(client, name="Dr. Quali")
    did = doctor["id"]
    q = _create_qualification(client, "Botox")

    r = client.post(f"/api/doctors/{did}/qualifications/{q['id']}", json={})
    assert r.status_code == 201
    assert r.json()["qualification_id"] == q["id"]

    r = client.get(f"/api/doctors/{did}")
    assert any(qr["id"] == q["id"] for qr in r.json()["qualifications"])

    r = client.delete(f"/api/doctors/{did}/qualifications/{q['id']}")
    assert r.status_code == 204

    r = client.get(f"/api/doctors/{did}")
    assert not any(qr["id"] == q["id"] for qr in r.json()["qualifications"])


def test_add_qualification_duplicate(client: TestClient) -> None:
    doctor = _create_doctor(client, name="Dr. Duplikat")
    did = doctor["id"]
    q = _create_qualification(client, "EEG Duplikat")

    client.post(f"/api/doctors/{did}/qualifications/{q['id']}", json={})
    r = client.post(f"/api/doctors/{did}/qualifications/{q['id']}", json={})
    assert r.status_code == 409


def test_include_inactive_filter(client: TestClient) -> None:
    _create_doctor(client, name="Dr. Aktiv", active=True)
    _create_doctor(client, name="Dr. Inaktiv", active=False)

    r = client.get("/api/doctors")
    names = [d["name"] for d in r.json()]
    assert "Dr. Aktiv" in names
    assert "Dr. Inaktiv" not in names

    r = client.get("/api/doctors?include_inactive=true")
    names = [d["name"] for d in r.json()]
    assert "Dr. Aktiv" in names
    assert "Dr. Inaktiv" in names
