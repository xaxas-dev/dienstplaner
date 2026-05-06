from fastapi.testclient import TestClient


def _create_qual(client: TestClient, **kwargs) -> dict:
    payload = {"name": "Test Qual", **kwargs}
    r = client.post("/api/qualifications", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _create_doctor(client: TestClient, name: str = "Dr. Test") -> dict:
    r = client.post("/api/doctors", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


# ── Basis-CRUD ─────────────────────────────────────────────────────────────────


def test_list_empty(client: TestClient) -> None:
    r = client.get("/api/qualifications")
    assert r.status_code == 200
    assert r.json() == []


def test_create_minimal(client: TestClient) -> None:
    r = client.post("/api/qualifications", json={"name": "EEG"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "EEG"
    assert data["active"] is True
    assert data["short_name"] is None


def test_create_full(client: TestClient) -> None:
    payload = {
        "name": "Neurophysiologie",
        "short_name": "NP",
        "description": "Befundung neurophysiologischer Messungen",
        "active": True,
    }
    r = client.post("/api/qualifications", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["short_name"] == "NP"
    assert data["description"] == "Befundung neurophysiologischer Messungen"


def test_get_404(client: TestClient) -> None:
    r = client.get("/api/qualifications/9999")
    assert r.status_code == 404


def test_update_partial(client: TestClient) -> None:
    qual = _create_qual(client, name="Alt")
    r = client.patch(f"/api/qualifications/{qual['id']}", json={"name": "Neu"})
    assert r.status_code == 200
    assert r.json()["name"] == "Neu"


def test_delete_204(client: TestClient) -> None:
    qual = _create_qual(client)
    r = client.delete(f"/api/qualifications/{qual['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/api/qualifications/{qual['id']}")
    assert r2.status_code == 404


def test_include_inactive_filter(client: TestClient) -> None:
    _create_qual(client, name="Aktiv", active=True)
    _create_qual(client, name="Inaktiv", active=False)
    r = client.get("/api/qualifications")
    names = [q["name"] for q in r.json()]
    assert "Aktiv" in names
    assert "Inaktiv" not in names
    r2 = client.get("/api/qualifications?include_inactive=true")
    assert len(r2.json()) == 2


# ── Spezifische Tests ──────────────────────────────────────────────────────────


def test_delete_in_use(client: TestClient) -> None:
    qual = _create_qual(client, name="EEG-Befundung")
    doctor = _create_doctor(client, "Dr. EEG")
    # Qualifikation dem Arzt zuweisen
    r = client.post(f"/api/doctors/{doctor['id']}/qualifications/{qual['id']}")
    assert r.status_code == 201

    # DELETE auf die Qualifikation selbst → 422
    r_del = client.delete(f"/api/qualifications/{qual['id']}")
    assert r_del.status_code == 422
    detail = r_del.json()["detail"]
    assert "Dr. EEG" in detail


def test_delete_unused(client: TestClient) -> None:
    qual = _create_qual(client, name="Unused Qual")
    r = client.delete(f"/api/qualifications/{qual['id']}")
    assert r.status_code == 204


def test_unique_name(client: TestClient) -> None:
    _create_qual(client, name="EEG")
    r = client.post("/api/qualifications", json={"name": "EEG"})
    assert r.status_code == 422
    assert "existiert bereits" in r.json()["detail"]
