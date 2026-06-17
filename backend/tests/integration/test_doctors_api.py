from fastapi.testclient import TestClient


def _create_doctor(client: TestClient, **kwargs) -> dict:
    payload = {"last_name": "Test Arzt", **kwargs}
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
    r = client.post("/api/doctors", json={"last_name": "Minimal"})
    assert r.status_code == 201
    data = r.json()
    assert data["last_name"] == "Minimal"
    assert data["first_name"] == ""
    assert data["name"] == "Minimal"          # computed field
    assert data["active"] is True
    assert data["rank"] is None
    assert data["doctor_type"] == "INTERNAL"


def test_create_doctor_full(client: TestClient) -> None:
    payload = {
        "first_name": "Anna",
        "last_name": "Vollständig",
        "salutation": "Frau",
        "title": "Dr.",
        "short_name": "VV",
        "doctor_type": "INTERNAL",
        "rank": None,
        "active": True,
        "notes": "Test-Notiz",
    }
    r = client.post("/api/doctors", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["first_name"] == "Anna"
    assert data["last_name"] == "Vollständig"
    assert data["salutation"] == "Frau"
    assert data["name"] == "Anna Vollständig"  # computed field
    assert data["title"] == "Dr."
    assert data["short_name"] == "VV"
    assert data["weiterbildungsjahr"] is None


def test_create_doctor_facharzt(client: TestClient) -> None:
    r = client.post(
        "/api/doctors",
        json={"last_name": "Facharzt", "rank": "FACHARZT"},
    )
    assert r.status_code == 201
    assert r.json()["rank"] == "FACHARZT"
    assert r.json()["weiterbildungsjahr"] is None


def test_get_doctor_with_relations(client: TestClient) -> None:
    doctor = _create_doctor(client, last_name="Relations")
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
    doctor = _create_doctor(client, last_name="Update", short_name="DU")
    did = doctor["id"]

    r = client.patch(f"/api/doctors/{did}", json={"notes": "Neue Notiz", "title": "PD"})
    assert r.status_code == 200
    data = r.json()
    assert data["notes"] == "Neue Notiz"
    assert data["title"] == "PD"
    assert data["short_name"] == "DU"  # unverändert


def test_update_doctor_allows_clearing_title(client: TestClient) -> None:
    doctor = _create_doctor(client, last_name="Titel", title="Prof.")
    did = doctor["id"]

    r = client.patch(f"/api/doctors/{did}", json={"title": None})
    assert r.status_code == 200
    assert r.json()["title"] is None


def test_create_doctor_salutation(client: TestClient) -> None:
    r = client.post("/api/doctors", json={"first_name": "Max", "last_name": "Berger", "salutation": "Herr"})
    assert r.status_code == 201
    data = r.json()
    assert data["salutation"] == "Herr"
    assert data["name"] == "Max Berger"


def test_delete_doctor_cascades(client: TestClient) -> None:
    doctor = _create_doctor(client, last_name="Lösch")
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
    doctor = _create_doctor(client, last_name="Overlap")
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
    doctor = _create_doctor(client, last_name="Unbefristet")
    did = doctor["id"]

    r = client.post(
        f"/api/doctors/{did}/employment-periods",
        json={"valid_from": "2024-01-01", "employment_percentage": 100},
    )
    assert r.status_code == 201
    assert r.json()["valid_to"] is None


def test_add_and_remove_qualification(client: TestClient) -> None:
    doctor = _create_doctor(client, last_name="Quali")
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
    doctor = _create_doctor(client, last_name="Duplikat")
    did = doctor["id"]
    q = _create_qualification(client, "EEG Duplikat")

    client.post(f"/api/doctors/{did}/qualifications/{q['id']}", json={})
    r = client.post(f"/api/doctors/{did}/qualifications/{q['id']}", json={})
    assert r.status_code == 409


def test_include_inactive_filter(client: TestClient) -> None:
    _create_doctor(client, last_name="Aktiv", active=True)
    _create_doctor(client, last_name="Inaktiv", active=False)

    r = client.get("/api/doctors")
    last_names = [d["last_name"] for d in r.json()]
    assert "Aktiv" in last_names
    assert "Inaktiv" not in last_names

    r = client.get("/api/doctors?include_inactive=true")
    last_names = [d["last_name"] for d in r.json()]
    assert "Aktiv" in last_names
    assert "Inaktiv" in last_names


def test_doctor_weiterbildungsjahr_computed_facharzt(client: TestClient) -> None:
    r = client.post(
        "/api/doctors",
        json={"last_name": "Facharzt WBJ", "rank": "FACHARZT", "entry_date": "2020-01-01"},
    )
    assert r.status_code == 201
    assert r.json()["weiterbildungsjahr"] is None


def test_doctor_weiterbildungsjahr_computed_no_entry_date(client: TestClient) -> None:
    r = client.post("/api/doctors", json={"last_name": "Kein Eintr."})
    assert r.status_code == 201
    assert r.json()["weiterbildungsjahr"] is None


def test_doctor_weiterbildungsjahr_computed_normal(client: TestClient) -> None:
    r = client.post(
        "/api/doctors",
        json={"last_name": "WBJ3", "entry_date": "2024-05-01"},
    )
    assert r.status_code == 201
    wbj = r.json()["weiterbildungsjahr"]
    # entry_date=2024-05-01, heute=2026-06-17 → ~2 Jahre → WBJ=3
    assert wbj == 3


def test_doctor_weiterbildungsjahr_computed_future(client: TestClient) -> None:
    r = client.post(
        "/api/doctors",
        json={"last_name": "Zukünftig", "entry_date": "2099-01-01"},
    )
    assert r.status_code == 201
    assert r.json()["weiterbildungsjahr"] is None


def test_doctor_with_entry_dates(client: TestClient) -> None:
    payload = {
        "last_name": "Eintrittsdaten",
        "entry_date": "2020-03-01",
        "virtual_entry_date": "2019-09-01",
    }
    r = client.post("/api/doctors", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["entry_date"] == "2020-03-01"
    assert data["virtual_entry_date"] == "2019-09-01"

    r2 = client.get(f"/api/doctors/{data['id']}")
    assert r2.status_code == 200
    assert r2.json()["entry_date"] == "2020-03-01"
    assert r2.json()["virtual_entry_date"] == "2019-09-01"
