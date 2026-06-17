from fastapi.testclient import TestClient


def _seed_shift_types(client: TestClient) -> dict[str, int]:
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


def _create_doctor(client: TestClient, name: str = "Dr. Test") -> dict:
    r = client.post("/api/doctors", json={"last_name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _create_department(client: TestClient, name: str = "SU") -> dict:
    r = client.post("/api/departments", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _create_plan(client: TestClient, **kwargs) -> dict:
    payload = {
        "name": "Quell-Plan",
        "valid_from": "2026-04-01",
        "valid_to": "2026-04-30",
        **kwargs,
    }
    r = client.post("/api/plans", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _add_rotation(client: TestClient, plan_id: int, doctor_id: int, dept_id: int, **kwargs) -> dict:
    payload = {
        "plan_id": plan_id,
        "doctor_id": doctor_id,
        "department_id": dept_id,
        "valid_from": "2026-04-01",
        "valid_to": "2026-04-30",
        **kwargs,
    }
    r = client.post(f"/api/plans/{plan_id}/rotations", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _clone(client: TestClient, plan_id: int, **kwargs) -> dict:
    payload = {
        "name": "Geklonter Plan",
        "valid_from": "2026-06-01",
        "valid_to": "2026-06-30",
        **kwargs,
    }
    r = client.post(f"/api/plans/{plan_id}/clone", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_clone_plan_same_length(client: TestClient) -> None:
    """April → Juni (beide 30 Tage): Rotationen werden verschoben, Schichten neu."""
    _seed_shift_types(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)
    source = _create_plan(client)
    _add_rotation(client, source["id"], doctor["id"], dept["id"])

    result = _clone(client, source["id"])
    new_plan = result["plan"]

    # 60 neue, leere Schichten (keine T1 per Default)
    assert len(new_plan["shifts"]) == 60
    assert all(s["doctor_id"] is None for s in new_plan["shifts"])
    # 1 Rotation kopiert
    assert result["rotations_copied"] == 1
    assert result["rotations_skipped"] == 0

    # Rotation-Datum wurde verschoben (April → Juni)
    r_rot = client.get(f"/api/plans/{new_plan['id']}/rotations")
    rotations = r_rot.json()
    assert len(rotations) == 1
    assert rotations[0]["valid_from"] == "2026-06-01"
    assert rotations[0]["valid_to"] == "2026-06-30"


def test_clone_plan_different_length(client: TestClient) -> None:
    """April (30 Tage) → Mai (31 Tage): Rotation über Ende geclippt."""
    _seed_shift_types(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)
    source = _create_plan(client)
    # Rotation von 20.-30. April
    _add_rotation(
        client,
        source["id"],
        doctor["id"],
        dept["id"],
        valid_from="2026-04-20",
        valid_to="2026-04-30",
    )

    # Klonen nach Mai (30-Tage-Offset)
    result = _clone(
        client,
        source["id"],
        name="Mai-Plan",
        valid_from="2026-05-01",
        valid_to="2026-05-31",
    )
    assert result["rotations_copied"] == 1
    assert result["rotations_skipped"] == 0

    r_rot = client.get(f"/api/plans/{result['plan']['id']}/rotations")
    rot = r_rot.json()[0]
    # 20.4 + 30 Tage = 20.5, 30.4 + 30 Tage = 30.5 (innerhalb Mai)
    assert rot["valid_from"] == "2026-05-20"
    assert rot["valid_to"] == "2026-05-30"


def test_clone_plan_rotation_outside_skipped(client: TestClient) -> None:
    """Rotation nach Offset komplett außerhalb neuen Plans → skipped."""
    _seed_shift_types(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)
    source = _create_plan(client)
    # Rotation 1.-10. April
    _add_rotation(
        client,
        source["id"],
        doctor["id"],
        dept["id"],
        valid_from="2026-04-01",
        valid_to="2026-04-10",
    )

    # Klonen nach Juni: Offset ist 61 Tage
    # 1.4 + 61 = 1.6, 10.4 + 61 = 10.6 → innerhalb Juni!
    # Um wirklich zu skippen: Quell-Plan April, Ziel-Plan im selben Monat
    # mit negativem Offset. Einfacher: Quell-Rotation sehr früh, Ziel weit nach vorne.
    # Lass uns Quell-Plan in Juni legen, Rotation 1.-5. Juni,
    # und Ziel-Plan September – Rotation liegt vor September.
    # Besser: Quell-Plan April, Rotation 28.-30. April, Ziel-Plan im Mai
    # aber nur 1.-3. Mai (3 Tage). Offset = 30 Tage.
    # 28.4 + 30 = 28.5 > 3.5 → skip.

    # Erstelle einen extra Quell-Plan
    source2 = _create_plan(
        client, name="Quell-Plan 2", valid_from="2026-04-01", valid_to="2026-04-30"
    )
    doctor2 = _create_doctor(client, "Dr. Außerhalb")
    dept2 = _create_department(client, "Bereich2")
    _add_rotation(
        client,
        source2["id"],
        doctor2["id"],
        dept2["id"],
        valid_from="2026-04-28",
        valid_to="2026-04-30",
    )

    # Ziel-Plan: nur 1.-3. Mai → Rotation (28.5-30.5) wäre nach 3.5 → skip
    result = _clone(
        client,
        source2["id"],
        name="Mini-Mai",
        valid_from="2026-05-01",
        valid_to="2026-05-03",
    )
    assert result["rotations_skipped"] == 1
    assert result["rotations_copied"] == 0


def test_clone_plan_with_t1_default_off(client: TestClient) -> None:
    """Quell-Plan hatte T1-Schichten; Klon bekommt per Default keine T1."""
    st_ids = _seed_shift_types(client)
    all_ids = list(st_ids.values())
    # Quell-Plan mit T1
    source = _create_plan(client, name="Mit T1", shift_type_ids=all_ids)
    assert len(source["shifts"]) == 82

    # Klon ohne explizite shift_type_ids → Default (kein T1)
    result = _clone(client, source["id"])
    # Juni 2026: 30 Tage, 22 Werktage, 8 Wochenende → 60 Schichten
    assert len(result["plan"]["shifts"]) == 60
