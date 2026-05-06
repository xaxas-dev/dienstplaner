from fastapi.testclient import TestClient

_st_counter = 0


def _create_st(client: TestClient, **kwargs) -> dict:
    global _st_counter
    _st_counter += 1
    payload = {
        "name": kwargs.pop("name", f"Test Schicht {_st_counter}"),
        "short_name": kwargs.pop("short_name", f"T{_st_counter}"),
        "applies_on_weekdays": True,
        **kwargs,
    }
    r = client.post("/api/shift-types", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _seed_shift_types(client: TestClient) -> None:
    from app.database import get_db
    from app.models.shift_type import ShiftType

    shift_types = [
        {
            "name": "V-Dienst",
            "short_name": "V",
            "applies_on_weekdays": True,
            "applies_on_weekend": False,
            "display_order": 1,
        },
        {
            "name": "Tagdienst",
            "short_name": "T",
            "applies_on_weekdays": False,
            "applies_on_weekend": True,
            "display_order": 2,
        },
        {
            "name": "Nachtdienst",
            "short_name": "N",
            "applies_on_weekdays": True,
            "applies_on_weekend": True,
            "display_order": 3,
        },
    ]
    override = client.app.dependency_overrides.get(get_db)
    assert override is not None
    session = next(override())
    for st_data in shift_types:
        session.add(ShiftType(**st_data))
    session.commit()


# ── Basis-CRUD ─────────────────────────────────────────────────────────────────


def test_list_empty(client: TestClient) -> None:
    r = client.get("/api/shift-types")
    assert r.status_code == 200
    assert r.json() == []


def test_create_minimal(client: TestClient) -> None:
    r = client.post(
        "/api/shift-types",
        json={"name": "V-Dienst", "short_name": "V", "applies_on_weekdays": True},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "V-Dienst"
    assert data["short_name"] == "V"
    assert data["active"] is True
    assert data["display_order"] == 0


def test_create_full(client: TestClient) -> None:
    payload = {
        "name": "Nachtdienst",
        "short_name": "N",
        "applies_on_weekdays": True,
        "applies_on_weekend": True,
        "start_time": "21:00:00",
        "end_time": "07:00:00",
        "display_order": 3,
        "active": True,
        "notes": "Über Mitternacht",
    }
    r = client.post("/api/shift-types", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["start_time"] == "21:00:00"
    assert data["end_time"] == "07:00:00"
    assert data["applies_on_weekend"] is True


def test_get_404(client: TestClient) -> None:
    r = client.get("/api/shift-types/9999")
    assert r.status_code == 404


def test_update_partial(client: TestClient) -> None:
    st = _create_st(client, name="Alt")
    r = client.patch(f"/api/shift-types/{st['id']}", json={"name": "Neu"})
    assert r.status_code == 200
    assert r.json()["name"] == "Neu"


def test_delete_204(client: TestClient) -> None:
    st = _create_st(client)
    r = client.delete(f"/api/shift-types/{st['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/api/shift-types/{st['id']}")
    assert r2.status_code == 404


def test_include_inactive_filter(client: TestClient) -> None:
    _create_st(client, name="Aktiv", active=True)
    _create_st(client, name="Inaktiv", active=False)
    r = client.get("/api/shift-types")
    names = [d["name"] for d in r.json()]
    assert "Aktiv" in names
    assert "Inaktiv" not in names
    r2 = client.get("/api/shift-types?include_inactive=true")
    assert len(r2.json()) == 2


# ── Validierungen ─────────────────────────────────────────────────────────────


def test_validation_no_day_type(client: TestClient) -> None:
    r = client.post(
        "/api/shift-types",
        json={
            "name": "Ungültig",
            "short_name": "U",
            "applies_on_weekdays": False,
            "applies_on_weekend": False,
        },
    )
    assert r.status_code == 422
    assert "Tag-Typ" in r.json()["detail"]


def test_validation_identical_times(client: TestClient) -> None:
    r = client.post(
        "/api/shift-types",
        json={
            "name": "Gleiche Zeit",
            "short_name": "GZ",
            "applies_on_weekdays": True,
            "start_time": "08:00:00",
            "end_time": "08:00:00",
        },
    )
    assert r.status_code == 422
    assert "identisch" in r.json()["detail"]


def test_night_shift_over_midnight(client: TestClient) -> None:
    r = client.post(
        "/api/shift-types",
        json={
            "name": "Nachtdienst",
            "short_name": "N",
            "applies_on_weekdays": True,
            "applies_on_weekend": True,
            "start_time": "21:00:00",
            "end_time": "07:00:00",
        },
    )
    assert r.status_code == 201


def test_seed_data_present(client: TestClient) -> None:
    _seed_shift_types(client)
    r = client.get("/api/shift-types?include_inactive=true")
    assert r.status_code == 200
    assert len(r.json()) == 3
