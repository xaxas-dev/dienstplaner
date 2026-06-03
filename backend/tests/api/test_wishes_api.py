import pytest


def _make_doctor(client):
    resp = client.post("/api/doctors", json={
        "name": "Dr. Test", "short_name": "DT",
        "doctor_type": "INTERNAL", "active": True,
        "employment_periods": [{"valid_from": "2026-01-01", "fte_percentage": 100}],
    })
    assert resp.status_code == 201
    return resp.json()["id"]


def test_list_wishes_empty(client):
    doc_id = _make_doctor(client)
    resp = client.get(f"/api/doctors/{doc_id}/wishes")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_date_wish(client):
    doc_id = _make_doctor(client)
    resp = client.post(f"/api/doctors/{doc_id}/wishes",
                       json={"wish_date": "2026-03-15", "wish_type": "AVOID_DAY"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["wish_date"] == "2026-03-15"
    assert data["doctor_id"] == doc_id
    assert data["day_of_week"] is None


def test_create_weekday_wish(client):
    doc_id = _make_doctor(client)
    resp = client.post(f"/api/doctors/{doc_id}/wishes",
                       json={"day_of_week": 4, "wish_type": "AVOID_DAY"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["day_of_week"] == 4
    assert data["wish_date"] is None


def test_create_general_wish(client):
    doc_id = _make_doctor(client)
    resp = client.post(f"/api/doctors/{doc_id}/wishes",
                       json={"wish_type": "AVOID_DAY"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["wish_date"] is None
    assert data["day_of_week"] is None


def test_create_wish_doctor_not_found(client):
    resp = client.post("/api/doctors/99999/wishes",
                       json={"wish_date": "2026-03-15", "wish_type": "AVOID_DAY"})
    assert resp.status_code == 404


def test_create_wish_validation_error(client):
    doc_id = _make_doctor(client)
    resp = client.post(f"/api/doctors/{doc_id}/wishes",
                       json={"wish_date": "2026-03-15", "wish_type": "AVOID_SHIFT"})
    assert resp.status_code == 422


def test_patch_wish(client):
    doc_id = _make_doctor(client)
    w = client.post(f"/api/doctors/{doc_id}/wishes",
                    json={"wish_date": "2026-03-15", "wish_type": "AVOID_DAY"}).json()
    resp = client.patch(f"/api/wishes/{w['id']}", json={"priority": 3, "notes": "dringend"})
    assert resp.status_code == 200
    assert resp.json()["priority"] == 3
    assert resp.json()["notes"] == "dringend"


def test_patch_wish_not_found(client):
    resp = client.patch("/api/wishes/99999", json={"priority": 2})
    assert resp.status_code == 404


def test_delete_wish(client):
    doc_id = _make_doctor(client)
    w = client.post(f"/api/doctors/{doc_id}/wishes",
                    json={"wish_date": "2026-03-15", "wish_type": "AVOID_DAY"}).json()
    resp = client.delete(f"/api/wishes/{w['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/doctors/{doc_id}/wishes").json() == []


def test_delete_wish_not_found(client):
    resp = client.delete("/api/wishes/99999")
    assert resp.status_code == 404


def test_plan_wishes_404_unknown_plan(client):
    resp = client.get("/api/plans/99999/wishes")
    assert resp.status_code == 404
