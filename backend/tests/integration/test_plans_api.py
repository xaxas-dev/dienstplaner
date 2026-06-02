from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Test-Hilfsfunktionen
# ---------------------------------------------------------------------------


def _seed_shift_types(client: TestClient) -> dict[str, int]:
    """Legt Standard-Schichttypen an und gibt short_name→id zurück."""
    types = [
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
        {
            "name": "Tagdienst INA",
            "short_name": "T1",
            "applies_on_weekdays": True,
            "applies_on_weekend": False,
            "display_order": 4,
        },
    ]
    result: dict[str, int] = {}
    for t in types:
        r = client.post("/api/shift-types", json=t)
        assert r.status_code == 201, r.text
        result[t["short_name"]] = r.json()["id"]
    return result


def _create_plan(client: TestClient, **kwargs) -> dict:
    payload = {
        "name": "Testplan",
        "valid_from": "2026-04-01",
        "valid_to": "2026-04-30",
        **kwargs,
    }
    r = client.post("/api/plans", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Schicht-Generierung
# ---------------------------------------------------------------------------


def test_create_plan_april_2026_no_t1(client: TestClient) -> None:
    _seed_shift_types(client)
    data = _create_plan(client, name="April 2026 ohne T1")
    assert data["name"] == "April 2026 ohne T1"
    assert len(data["shifts"]) == 60  # 22*2 + 8*2


def test_create_plan_april_2026_with_t1(client: TestClient) -> None:
    st_ids = _seed_shift_types(client)
    all_ids = list(st_ids.values())
    data = _create_plan(client, name="April 2026 mit T1", shift_type_ids=all_ids)
    assert len(data["shifts"]) == 82  # 22*3 + 8*2


def test_create_plan_invalid_date_range(client: TestClient) -> None:
    _seed_shift_types(client)
    r = client.post(
        "/api/plans",
        json={
            "name": "Ungültig",
            "valid_from": "2026-04-30",
            "valid_to": "2026-04-01",
        },
    )
    assert r.status_code == 422


def test_create_plan_no_active_shift_types(client: TestClient) -> None:
    # Keine Schichttypen angelegt → kein aktiver Typ vorhanden
    r = client.post(
        "/api/plans",
        json={
            "name": "Ohne Schichttypen",
            "valid_from": "2026-04-01",
            "valid_to": "2026-04-30",
        },
    )
    assert r.status_code == 422
    assert "Schichttypen" in r.json()["detail"]


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def test_get_plan_with_relations(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    plan_id = plan["id"]

    r = client.get(f"/api/plans/{plan_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == plan_id
    assert "shifts" in data
    assert "rotation_assignments" in data
    assert len(data["shifts"]) == 60


def test_list_plans(client: TestClient) -> None:
    _seed_shift_types(client)
    _create_plan(client, name="Plan A", valid_from="2026-04-01", valid_to="2026-04-30")
    _create_plan(client, name="Plan B", valid_from="2026-05-01", valid_to="2026-05-31")

    r = client.get("/api/plans")
    assert r.status_code == 200
    plans = r.json()
    assert len(plans) == 2
    # Sortiert nach valid_from absteigend
    assert plans[0]["name"] == "Plan B"
    assert plans[1]["name"] == "Plan A"


def test_get_plan_404(client: TestClient) -> None:
    r = client.get("/api/plans/9999")
    assert r.status_code == 404


def test_update_plan_name(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    plan_id = plan["id"]

    r = client.patch(f"/api/plans/{plan_id}", json={"name": "Geänderter Name"})
    assert r.status_code == 200
    assert r.json()["name"] == "Geänderter Name"


# ---------------------------------------------------------------------------
# Status-Wechsel + Snapshot
# ---------------------------------------------------------------------------


def test_update_plan_status_to_released_creates_snapshot(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    plan_id = plan["id"]

    r = client.patch(f"/api/plans/{plan_id}", json={"status": "RELEASED"})
    assert r.status_code == 200
    assert r.json()["status"] == "RELEASED"

    # Snapshot sollte automatisch erstellt worden sein
    r_versions = client.get(f"/api/plans/{plan_id}/versions")
    assert r_versions.status_code == 200
    versions = r_versions.json()
    assert len(versions) == 1
    assert versions[0]["version_number"] == 1
    assert versions[0]["comment"] == "Statuswechsel zu RELEASED"


def test_update_plan_status_already_released_no_snapshot(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    plan_id = plan["id"]

    client.patch(f"/api/plans/{plan_id}", json={"status": "RELEASED"})
    # Erneut RELEASED setzen → kein neuer Snapshot
    client.patch(f"/api/plans/{plan_id}", json={"status": "RELEASED"})

    r_versions = client.get(f"/api/plans/{plan_id}/versions")
    versions = r_versions.json()
    assert len(versions) == 1


# ---------------------------------------------------------------------------
# Löschen mit Kaskade
# ---------------------------------------------------------------------------


def test_delete_plan_cascade(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    plan_id = plan["id"]
    assert len(plan["shifts"]) > 0

    # Snapshot anlegen
    client.post(f"/api/plans/{plan_id}/versions", json={"comment": "Test"})

    r_del = client.delete(f"/api/plans/{plan_id}")
    assert r_del.status_code == 204

    assert client.get(f"/api/plans/{plan_id}").status_code == 404
    # Seit M2-005: Shifts-Endpunkt prüft Plan-Existenz → 404 (vorher: 200 mit [])
    assert client.get(f"/api/plans/{plan_id}/shifts").status_code == 404


# ---------------------------------------------------------------------------
# GET /api/plans/current
# ---------------------------------------------------------------------------


def test_current_plan_found(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client, valid_from="2026-05-01", valid_to="2026-05-31")
    r = client.get("/api/plans/current?today=2026-05-15")
    assert r.status_code == 200
    assert r.json()["id"] == plan["id"]


def test_current_plan_not_found_returns_204(client: TestClient) -> None:
    _seed_shift_types(client)
    _create_plan(client, valid_from="2026-05-01", valid_to="2026-05-31")
    r = client.get("/api/plans/current?today=2026-06-01")
    assert r.status_code == 204


def test_current_plan_no_plans_returns_204(client: TestClient) -> None:
    r = client.get("/api/plans/current?today=2026-05-15")
    assert r.status_code == 204


# ---------------------------------------------------------------------------
# GET /api/plans/{id}/dashboard
# ---------------------------------------------------------------------------


def test_dashboard_summary_smoke(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client, valid_from="2026-05-01", valid_to="2026-05-31")
    r = client.get(f"/api/plans/{plan['id']}/dashboard?today=2026-05-15")
    assert r.status_code == 200
    data = r.json()
    assert data["plan_id"] == plan["id"]
    assert "kpis" in data
    assert "today_shifts" in data
    assert "coverage_by_department" in data
    assert "attention" in data


def test_dashboard_summary_404_unknown_plan(client: TestClient) -> None:
    r = client.get("/api/plans/9999/dashboard?today=2026-05-15")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# besetzung_locked Feature (M12-001)
# ---------------------------------------------------------------------------


def test_besetzung_locked_defaults_false(client: TestClient) -> None:
    _seed_shift_types(client)
    data = _create_plan(client, name="Lock-Default")
    assert data["besetzung_locked"] is False


def test_patch_besetzung_locked_true(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client, name="Lock-Patch")
    r = client.patch(f"/api/plans/{plan['id']}", json={"besetzung_locked": True})
    assert r.status_code == 200, r.text
    assert r.json()["besetzung_locked"] is True
    # Persistenz prüfen
    g = client.get(f"/api/plans/{plan['id']}")
    assert g.json()["besetzung_locked"] is True


# ---------------------------------------------------------------------------
# POST /api/plans/{plan_id}/locked-week
# ---------------------------------------------------------------------------


def test_create_locked_week_returns_201(client, db):
    """Gültiger Request → 201 + LockedWeekResult."""
    from datetime import date as dt

    from app.models.doctor import Doctor
    from app.models.plan import Plan, PlanStatus
    from app.models.shift_type import ShiftType

    plan = Plan(name="Test", valid_from=dt(2026, 6, 1), valid_to=dt(2026, 6, 30), status=PlanStatus.DRAFT)
    doctor = Doctor(name="Test Arzt", short_name="TA", active=True)
    stype = ShiftType(name="Nacht", short_name="N", display_order=1, applies_on_weekend=True)
    db.add_all([plan, doctor, stype])
    db.commit()

    resp = client.post(
        f"/api/plans/{plan.id}/locked-week",
        json={
            "doctor_id": doctor.id,
            "start_date": "2026-06-07",
            "shift_type_id": stype.id,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["created"]) == 5
    assert body["skipped"] == []
    for s in body["created"]:
        assert s["is_locked"] is True
        assert s["is_pinned"] is True


def test_create_locked_week_422_on_non_sunday(client, db):
    """Kein Sonntag → 422."""
    from datetime import date as dt

    from app.models.doctor import Doctor
    from app.models.plan import Plan, PlanStatus
    from app.models.shift_type import ShiftType

    plan = Plan(name="Test2", valid_from=dt(2026, 6, 1), valid_to=dt(2026, 6, 30), status=PlanStatus.DRAFT)
    doctor = Doctor(name="Test Arzt2", short_name="TA2", active=True)
    stype = ShiftType(name="Nacht2", short_name="N2", display_order=2, applies_on_weekend=True)
    db.add_all([plan, doctor, stype])
    db.commit()

    resp = client.post(
        f"/api/plans/{plan.id}/locked-week",
        json={
            "doctor_id": doctor.id,
            "start_date": "2026-06-08",  # Montag
            "shift_type_id": stype.id,
        },
    )
    assert resp.status_code == 422


def test_create_locked_week_404_on_unknown_plan(client):
    """Unbekannte plan_id → 404."""
    resp = client.post(
        "/api/plans/99999/locked-week",
        json={"doctor_id": 1, "start_date": "2026-06-07", "shift_type_id": 1},
    )
    assert resp.status_code == 404
