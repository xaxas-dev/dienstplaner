"""Tests für GET /api/doctors/{doctor_id}/ina-availability"""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Absence,
    AbsenceType,
    Department,
    Doctor,
    Plan,
    PlanStatus,
    RotationAssignment,
)
from app.models.ina_exclusion import INAExclusion, INAExclusionReason

# Montag 2026-05-04, Samstag 2026-05-09
MONDAY = date(2026, 5, 4)
SATURDAY = date(2026, 5, 9)


# ── Hilfsfunktionen ───────────────────────────────────────────────────────────


def _make_doctor(db: Session, name: str = "INA-Testarzt") -> Doctor:
    doc = Doctor(last_name=name)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def _make_dept(
    db: Session,
    name: str = "Testbereich",
    blocks_wd: bool = False,
    blocks_we: bool = False,
) -> Department:
    dept = Department(name=name, blocks_ina_weekdays=blocks_wd, blocks_ina_weekends=blocks_we)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def _make_plan(db: Session, name: str = "Testplan") -> Plan:
    plan = Plan(
        name=name,
        valid_from=date(2026, 5, 1),
        valid_to=date(2026, 5, 31),
        status=PlanStatus.DRAFT,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _make_rotation(
    db: Session,
    plan: Plan,
    doctor: Doctor,
    dept: Department,
    valid_from: date = date(2026, 5, 1),
    valid_to: date = date(2026, 5, 31),
    is_einarbeitung: bool = False,
) -> RotationAssignment:
    ra = RotationAssignment(
        plan_id=plan.id,
        doctor_id=doctor.id,
        department_id=dept.id,
        valid_from=valid_from,
        valid_to=valid_to,
        is_einarbeitung=is_einarbeitung,
    )
    db.add(ra)
    db.commit()
    db.refresh(ra)
    return ra


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestINAAvailabilityEndpoint:
    def test_no_blockers_all_available(self, client: TestClient, db: Session) -> None:
        """Arzt ohne Einträge → alle Tage available=True, reasons=[]"""
        doc = _make_doctor(db)
        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-04", "to": "2026-05-06"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert set(data.keys()) == {"2026-05-04", "2026-05-05", "2026-05-06"}
        for day_entry in data.values():
            assert day_entry["available"] is True
            assert day_entry["reasons"] == []

    def test_blocking_rotation_weekday_not_weekend(
        self, client: TestClient, db: Session
    ) -> None:
        """Rotation mit blocks_ina_weekdays=True blockiert Werktag, nicht Samstag."""
        doc = _make_doctor(db, "Rotation-Arzt")
        plan = _make_plan(db, "Rotation-Plan")
        dept = _make_dept(db, "Stroke Unit-T1", blocks_wd=True, blocks_we=False)
        _make_rotation(db, plan, doc, dept)

        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-04", "to": "2026-05-09"},
        )
        assert resp.status_code == 200
        data = resp.json()

        monday_entry = data["2026-05-04"]
        assert monday_entry["available"] is False
        assert any("Stroke Unit-T1" in r for r in monday_entry["reasons"])

        saturday_entry = data["2026-05-09"]
        assert saturday_entry["available"] is True
        assert saturday_entry["reasons"] == []

    def test_absence_blocks_day(self, client: TestClient, db: Session) -> None:
        """Arzt mit aktiver Abwesenheit → betroffener Tag blockiert mit 'Abwesenheit: URLAUB'"""
        doc = _make_doctor(db, "Urlaub-Arzt")
        absence = Absence(
            doctor_id=doc.id,
            absence_type=AbsenceType.URLAUB,
            valid_from=date(2026, 5, 4),
            valid_to=date(2026, 5, 6),
        )
        db.add(absence)
        db.commit()

        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-04", "to": "2026-05-07"},
        )
        assert resp.status_code == 200
        data = resp.json()

        for d in ("2026-05-04", "2026-05-05", "2026-05-06"):
            entry = data[d]
            assert entry["available"] is False
            assert any("Abwesenheit" in r and "URLAUB" in r for r in entry["reasons"])

        entry_after = data["2026-05-07"]
        assert entry_after["available"] is True

    def test_ina_exclusion_blocks_day(self, client: TestClient, db: Session) -> None:
        """Arzt mit aktiver INAExclusion → Grund erscheint in reasons"""
        doc = _make_doctor(db, "Exklusion-Arzt")
        excl = INAExclusion(
            doctor_id=doc.id,
            valid_from=date(2026, 5, 1),
            valid_to=None,
            reason=INAExclusionReason.SCHWANGERSCHAFT,
        )
        db.add(excl)
        db.commit()

        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-04", "to": "2026-05-04"},
        )
        assert resp.status_code == 200
        data = resp.json()
        entry = data["2026-05-04"]
        assert entry["available"] is False
        assert "Schwangerschaft" in entry["reasons"]

    def test_from_after_to_returns_422(self, client: TestClient, db: Session) -> None:
        """from > to → 422"""
        doc = _make_doctor(db, "Datumsfehler-Arzt")
        resp = client.get(
            f"/api/doctors/{doc.id}/ina-availability",
            params={"from": "2026-05-10", "to": "2026-05-04"},
        )
        assert resp.status_code == 422

    def test_unknown_doctor_returns_404(self, client: TestClient, db: Session) -> None:
        """Unbekannte doctor_id → 404"""
        resp = client.get(
            "/api/doctors/99999/ina-availability",
            params={"from": "2026-05-04", "to": "2026-05-06"},
        )
        assert resp.status_code == 404


class TestSeedBlocksCorrectValues:
    def test_department_blocks_values(self, db: Session) -> None:
        su = db.query(Department).filter(Department.name == "SU").first()
        if su is not None:
            assert su.blocks_ina_weekdays is True
            assert su.blocks_ina_weekends is True

        ck = db.query(Department).filter(Department.name == "Curschmann Klinik").first()
        if ck is not None:
            assert ck.blocks_ina_weekdays is True
            assert ck.blocks_ina_weekends is False

        emg = db.query(Department).filter(Department.name == "EMG").first()
        if emg is not None:
            assert emg.blocks_ina_weekdays is False
            assert emg.blocks_ina_weekends is False
