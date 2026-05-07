from fastapi.testclient import TestClient


def _create_dept(client: TestClient, **kwargs) -> dict:
    payload = {"name": "Test Bereich", **kwargs}
    r = client.post("/api/departments", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _seed_departments(client: TestClient) -> None:
    from app.database import get_db
    from app.models.department import Department

    _I = {"is_external": False, "is_shift_relevant": True}
    _E = {"is_external": True, "is_shift_relevant": False}
    departments = [
        {"name": "511/LBEST", "short_name": "LBEST", "display_order": 1, **_I},
        {"name": "511", "short_name": "511", "display_order": 2, **_I},
        {"name": "ITS", "short_name": "ITS", "display_order": 3, **_I},
        {"name": "SU-Stationsarzt", "short_name": "SU-SA", "display_order": 4, **_I},
        {"name": "SU", "short_name": "SU", "display_order": 5, **_I},
        {"name": "Duplex", "short_name": "Du", "display_order": 6, **_I},
        {"name": "Poli", "short_name": "Poli", "display_order": 7, **_I},
        {"name": "Poli/EMG", "short_name": "Poli/EMG", "display_order": 8, **_I},
        {"name": "EMG", "short_name": "EMG", "display_order": 9, **_I},
        {"name": "Springer", "short_name": "Spr", "display_order": 10, **_I},
        {"name": "Parkinson Komplextherapie", "short_name": "ParkiKomp", "display_order": 11, **_I},
        {"name": "Tagesklinik", "short_name": "TK", "display_order": 12, **_I},
        {"name": "Neuromotorik-TK", "short_name": "NM-TK", "display_order": 13, **_I},
        {"name": "Poli/Botox/THS", "short_name": None, "display_order": 14, **_I},
        {"name": "Poli/Botox", "short_name": None, "display_order": 15, **_I},
        {"name": "MS-Sprechstunde/Konsile", "short_name": "MS", "display_order": 16, **_I},
        {"name": "Forschung", "short_name": "Fo", "display_order": 17, **_I},
        {"name": "Curschmann Klinik", "short_name": "CK", "display_order": 18, **_I},
        {"name": "Intensiv Innere", "short_name": None, "display_order": 19, **_E},
        {"name": "Psychiatrie", "short_name": None, "display_order": 20, **_E},
        {"name": "ZIP", "short_name": None, "display_order": 21, **_E},
    ]
    override = client.app.dependency_overrides.get(get_db)
    assert override is not None
    session = next(override())
    for d in departments:
        session.add(Department(**d))
    session.commit()


# ── Basis-CRUD ─────────────────────────────────────────────────────────────────


def test_list_empty(client: TestClient) -> None:
    r = client.get("/api/departments")
    assert r.status_code == 200
    assert r.json() == []


def test_create_minimal(client: TestClient) -> None:
    r = client.post("/api/departments", json={"name": "Neurologie"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Neurologie"
    assert data["active"] is True
    assert data["is_external"] is False
    assert data["is_shift_relevant"] is True
    assert data["display_order"] == 0


def test_create_full(client: TestClient) -> None:
    payload = {
        "name": "ITS",
        "short_name": "ITS",
        "is_external": False,
        "is_shift_relevant": True,
        "active": True,
        "display_order": 3,
        "notes": "Intensivstation",
    }
    r = client.post("/api/departments", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["short_name"] == "ITS"
    assert data["display_order"] == 3
    assert data["notes"] == "Intensivstation"


def test_create_external_department(client: TestClient) -> None:
    r = client.post(
        "/api/departments",
        json={"name": "Psychiatrie", "is_external": True, "is_shift_relevant": False},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["is_external"] is True
    assert data["is_shift_relevant"] is False


def test_get_404(client: TestClient) -> None:
    r = client.get("/api/departments/9999")
    assert r.status_code == 404


def test_update_partial(client: TestClient) -> None:
    dept = _create_dept(client, name="Alt")
    r = client.patch(f"/api/departments/{dept['id']}", json={"name": "Neu"})
    assert r.status_code == 200
    assert r.json()["name"] == "Neu"


def test_delete_204(client: TestClient) -> None:
    dept = _create_dept(client)
    r = client.delete(f"/api/departments/{dept['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/api/departments/{dept['id']}")
    assert r2.status_code == 404


def test_include_inactive_filter(client: TestClient) -> None:
    _create_dept(client, name="Aktiv", active=True)
    inactive = _create_dept(client, name="Inaktiv", active=False)
    # Standardmäßig ohne inaktive
    r = client.get("/api/departments")
    names = [d["name"] for d in r.json()]
    assert "Aktiv" in names
    assert "Inaktiv" not in names
    # Mit include_inactive=true beide sichtbar
    r2 = client.get("/api/departments?include_inactive=true")
    names2 = [d["name"] for d in r2.json()]
    assert inactive["id"] in [d["id"] for d in r2.json()]
    assert len(names2) == 2


def test_sort_by_display_order(client: TestClient) -> None:
    _create_dept(client, name="Z-Bereich", display_order=10)
    _create_dept(client, name="A-Bereich", display_order=1)
    _create_dept(client, name="M-Bereich", display_order=5)
    r = client.get("/api/departments")
    data = r.json()
    orders = [d["display_order"] for d in data]
    assert orders == sorted(orders)
    assert data[0]["name"] == "A-Bereich"


def test_seed_data_present(client: TestClient) -> None:
    _seed_departments(client)
    r = client.get("/api/departments?include_inactive=true")
    assert r.status_code == 200
    assert len(r.json()) == 21


def test_department_requires_full_time(client: TestClient) -> None:
    r = client.post(
        "/api/departments",
        json={"name": "Curschmann Klinik", "short_name": "CK", "requires_full_time": True},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["requires_full_time"] is True

    r2 = client.get(f"/api/departments/{data['id']}")
    assert r2.status_code == 200
    assert r2.json()["requires_full_time"] is True


def test_department_requires_full_time_default_false(client: TestClient) -> None:
    r = client.post("/api/departments", json={"name": "Beliebige Station"})
    assert r.status_code == 201
    assert r.json()["requires_full_time"] is False
