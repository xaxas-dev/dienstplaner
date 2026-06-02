from datetime import date


def test_list_holidays_empty(client):
    resp = client.get("/api/holidays?year=2026")
    assert resp.status_code == 200
    assert resp.json() == []


def test_seed_and_list_holidays(client):
    resp = client.post("/api/holidays/seed", json={"year": 2026})
    assert resp.status_code == 200
    data = resp.json()
    assert data["added"] == 12
    assert data["year"] == 2026

    resp = client.get("/api/holidays?year=2026")
    assert resp.status_code == 200
    holidays = resp.json()
    assert len(holidays) == 12
    assert any(h["name"] == "Neujahr" for h in holidays)
    assert all(h["source"] == "AUTO" for h in holidays)


def test_create_manual_holiday(client):
    payload = {"date": "2026-06-19", "name": "Brückentag"}
    resp = client.post("/api/holidays", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["date"] == "2026-06-19"
    assert data["name"] == "Brückentag"
    assert data["source"] == "MANUAL"


def test_create_duplicate_holiday_returns_409(client):
    client.post("/api/holidays", json={"date": "2026-06-19", "name": "Erstellt"})
    resp = client.post("/api/holidays", json={"date": "2026-06-19", "name": "Duplikat"})
    assert resp.status_code == 409


def test_delete_manual_holiday(client):
    client.post("/api/holidays", json={"date": "2026-06-19", "name": "Brückentag"})
    resp = client.delete("/api/holidays/2026-06-19")
    assert resp.status_code == 204

    resp = client.get("/api/holidays?year=2026")
    assert resp.json() == []


def test_delete_auto_holiday(client):
    client.post("/api/holidays/seed", json={"year": 2026})
    resp = client.delete("/api/holidays/2026-01-01")
    assert resp.status_code == 204  # AUTO kann auch gelöscht werden (Phase-A)

    resp = client.get("/api/holidays?year=2026")
    assert len(resp.json()) == 11


def test_delete_nonexistent_holiday_returns_404(client):
    resp = client.delete("/api/holidays/2026-06-19")
    assert resp.status_code == 404


def test_seed_idempotent(client):
    client.post("/api/holidays/seed", json={"year": 2026})
    resp = client.post("/api/holidays/seed", json={"year": 2026})
    assert resp.json()["added"] == 0
