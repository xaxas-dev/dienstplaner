from fastapi.testclient import TestClient


def _seed_shift_types(client: TestClient) -> None:
    types = [
        {
            "name": "V-Dienst",
            "short_name": "V",
            "applies_on_weekdays": True,
            "applies_on_weekend": False,
            "display_order": 1,
        },
        {
            "name": "Nachtdienst",
            "short_name": "N",
            "applies_on_weekdays": True,
            "applies_on_weekend": True,
            "display_order": 2,
        },
    ]
    for t in types:
        r = client.post("/api/shift-types", json=t)
        assert r.status_code == 201, r.text


def _create_plan(client: TestClient) -> dict:
    _seed_shift_types(client)
    r = client.post(
        "/api/plans",
        json={"name": "Versions-Plan", "valid_from": "2026-04-01", "valid_to": "2026-04-30"},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_create_version_snapshot_basic(client: TestClient) -> None:
    plan = _create_plan(client)
    plan_id = plan["id"]

    r = client.post(f"/api/plans/{plan_id}/versions", json={})
    assert r.status_code == 201
    v = r.json()
    assert v["version_number"] == 1
    assert v["plan_id"] == plan_id
    assert v["snapshot_json"] is not None
    assert "plan" in v["snapshot_json"]
    assert "shifts" in v["snapshot_json"]
    assert "rotation_assignments" in v["snapshot_json"]


def test_create_version_snapshot_with_comment(client: TestClient) -> None:
    plan = _create_plan(client)
    r = client.post(f"/api/plans/{plan['id']}/versions", json={"comment": "Mein Kommentar"})
    assert r.status_code == 201
    assert r.json()["comment"] == "Mein Kommentar"


def test_version_number_auto_increment(client: TestClient) -> None:
    plan = _create_plan(client)
    plan_id = plan["id"]

    for i in range(1, 4):
        r = client.post(f"/api/plans/{plan_id}/versions", json={})
        assert r.json()["version_number"] == i


def test_get_version_returns_snapshot_json(client: TestClient) -> None:
    plan = _create_plan(client)
    plan_id = plan["id"]

    client.post(f"/api/plans/{plan_id}/versions", json={})

    r = client.get(f"/api/plans/{plan_id}/versions/1")
    assert r.status_code == 200
    data = r.json()
    assert data["version_number"] == 1
    assert "snapshot_json" in data
    # Datum als ISO-String (nicht datetime-Objekt)
    plan_data = data["snapshot_json"]["plan"]
    assert isinstance(plan_data["valid_from"], str)
    assert plan_data["valid_from"] == "2026-04-01"


def test_versions_sorted_descending(client: TestClient) -> None:
    plan = _create_plan(client)
    plan_id = plan["id"]

    for _ in range(3):
        client.post(f"/api/plans/{plan_id}/versions", json={})

    r = client.get(f"/api/plans/{plan_id}/versions")
    assert r.status_code == 200
    versions = r.json()
    numbers = [v["version_number"] for v in versions]
    assert numbers == [3, 2, 1]
