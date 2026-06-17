from fastapi.testclient import TestClient


def _create_doctor(client: TestClient, name: str = "Dr. Test") -> dict:
    r = client.post("/api/doctors", json={"last_name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _create_override(client: TestClient, **kwargs) -> dict:
    payload = {
        "rule_key": "MAX_DIENSTE_PRO_MONAT",
        "override_value": "10",
        "scope": "GLOBAL",
        **kwargs,
    }
    r = client.post("/api/rule-overrides", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ── Basis-CRUD ─────────────────────────────────────────────────────────────────


def test_list_empty(client: TestClient) -> None:
    r = client.get("/api/rule-overrides")
    assert r.status_code == 200
    assert r.json() == []


def test_create_global(client: TestClient) -> None:
    r = client.post(
        "/api/rule-overrides",
        json={
            "rule_key": "MAX_DIENSTE_PRO_MONAT",
            "override_value": "12",
            "scope": "GLOBAL",
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["scope"] == "GLOBAL"
    assert data["doctor_id"] is None
    assert data["rule_key"] == "MAX_DIENSTE_PRO_MONAT"
    assert data["override_value"] == "12"


def test_create_for_doctor(client: TestClient) -> None:
    doctor = _create_doctor(client)
    r = client.post(
        "/api/rule-overrides",
        json={
            "rule_key": "MAX_DIENSTE_PRO_MONAT",
            "override_value": "8",
            "scope": "DOCTOR",
            "doctor_id": doctor["id"],
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["scope"] == "DOCTOR"
    assert data["doctor_id"] == doctor["id"]


def test_get_404(client: TestClient) -> None:
    r = client.get("/api/rule-overrides/9999")
    assert r.status_code == 404


def test_update_partial(client: TestClient) -> None:
    override = _create_override(client)
    r = client.patch(f"/api/rule-overrides/{override['id']}", json={"override_value": "99"})
    assert r.status_code == 200
    assert r.json()["override_value"] == "99"


def test_delete_204(client: TestClient) -> None:
    override = _create_override(client)
    r = client.delete(f"/api/rule-overrides/{override['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/api/rule-overrides/{override['id']}")
    assert r2.status_code == 404


def test_include_inactive_filter(client: TestClient) -> None:
    # Kein active-Flag bei RuleOverride – stattdessen: alle werden immer zurückgegeben
    _create_override(client, rule_key="RULE_A")
    _create_override(client, rule_key="RULE_B")
    r = client.get("/api/rule-overrides")
    assert len(r.json()) == 2


# ── Validierungen ─────────────────────────────────────────────────────────────


def test_validation_global_with_doctor_id(client: TestClient) -> None:
    doctor = _create_doctor(client)
    r = client.post(
        "/api/rule-overrides",
        json={
            "rule_key": "KEY",
            "override_value": "1",
            "scope": "GLOBAL",
            "doctor_id": doctor["id"],
        },
    )
    assert r.status_code == 422


def test_validation_doctor_without_doctor_id(client: TestClient) -> None:
    r = client.post(
        "/api/rule-overrides",
        json={
            "rule_key": "KEY",
            "override_value": "1",
            "scope": "DOCTOR",
        },
    )
    assert r.status_code == 422


# ── Filter ─────────────────────────────────────────────────────────────────────


def test_filter_by_scope(client: TestClient) -> None:
    doctor = _create_doctor(client)
    _create_override(client, scope="GLOBAL", rule_key="GLOBAL_RULE")
    _create_override(client, scope="DOCTOR", doctor_id=doctor["id"], rule_key="DOCTOR_RULE")
    r = client.get("/api/rule-overrides?scope=GLOBAL")
    assert all(o["scope"] == "GLOBAL" for o in r.json())
    assert len(r.json()) == 1


def test_filter_by_doctor(client: TestClient) -> None:
    doctor1 = _create_doctor(client, "Dr. 1")
    doctor2 = _create_doctor(client, "Dr. 2")
    _create_override(client, scope="DOCTOR", doctor_id=doctor1["id"], rule_key="R1")
    _create_override(client, scope="DOCTOR", doctor_id=doctor2["id"], rule_key="R2")
    _create_override(client, scope="GLOBAL", rule_key="R3")
    r = client.get(f"/api/rule-overrides?doctor_id={doctor1['id']}")
    assert len(r.json()) == 1
    assert r.json()[0]["doctor_id"] == doctor1["id"]


def test_filter_by_active_on_date(client: TestClient) -> None:
    # Override der im Februar 2025 gilt
    _create_override(
        client,
        rule_key="BEFRISTETER_OVERRIDE",
        valid_from="2025-02-01",
        valid_to="2025-02-28",
    )
    # Unbegrenzter Override
    _create_override(client, rule_key="UNBEGRENZT")

    # Datum innerhalb: beide sollen erscheinen
    r_in = client.get("/api/rule-overrides?active_on_date=2025-02-15")
    assert len(r_in.json()) == 2

    # Datum außerhalb: nur der unbegrenzte
    r_out = client.get("/api/rule-overrides?active_on_date=2025-03-01")
    keys = [o["rule_key"] for o in r_out.json()]
    assert "UNBEGRENZT" in keys
    assert "BEFRISTETER_OVERRIDE" not in keys
