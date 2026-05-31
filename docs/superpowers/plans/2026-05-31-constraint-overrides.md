# Constraint-Override-Mechanismus A/B/C — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a three-level override mechanism for regulatorisch-harte solver constraints (MAX_BD_PER_MONTH, MAX_WEEKENDS_PER_MONTH, MIN_REST_TIME, MAX_WEEKLY_HOURS), allowing disable per plan (A), per doctor+period (B), or per single shift (C), with effect on both Timefold solver score and Phase-A tarif warnings.

**Architecture:** Single `constraint_overrides` table. Before solving, `get_override_snapshot(db, plan_id)` loads all overrides into an `OverrideSnapshot` dataclass. The snapshot populates `SolverDoctor.overridden_constraints` (B) and `SolverShift.overridden_constraints` (C). Ebene A constraints are excluded from the returned constraint list via `build_constraint_provider(disabled)` factory — `solver_service` reads `schedule.disabled_constraints` and passes it. Tarif warnings are filtered by the same snapshot. Frontend: Ebene A = Plan-Settings Modal, Ebene B = Doctor Detail tab, Ebene C = §-Dot → ContextPanel.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic v2, Timefold 1.24.0b0, pytest; React 18, TypeScript, TanStack Query, shadcn/ui, Zod

---

## File Map

**Backend — new:**
- `backend/app/models/constraint_override.py`
- `backend/app/schemas/constraint_override.py`
- `backend/app/repositories/constraint_override_repository.py`
- `backend/app/services/constraint_override_service.py`
- `backend/app/api/constraint_overrides.py`
- `backend/alembic/versions/0011_constraint_overrides.py`
- `backend/tests/services/test_constraint_override_service.py`
- `backend/tests/api/test_constraint_overrides.py`

**Backend — modified:**
- `backend/app/services/exceptions.py` — add 2 exception classes
- `backend/app/api/error_handlers.py` — register 2 handlers
- `backend/app/main.py` — register router
- `backend/app/solver/domain.py` — add snapshot fields to SolverDoctor, SolverShift, ShiftSchedule
- `backend/app/solver/mapping.py` — load override snapshot, populate snapshot fields
- `backend/app/solver/constraints.py` — override checks + `build_constraint_provider` factory
- `backend/app/solver/solver_service.py` — use `build_constraint_provider`
- `backend/app/services/tarif_validation_service.py` — filter warnings by overrides

**Frontend — new:**
- `frontend/src/features/plans/useConstraintOverrides.ts`
- `frontend/src/features/doctors/useDoctorConstraintOverrides.ts`
- `frontend/src/features/doctors/ConstraintOverrideList.tsx`
- `frontend/src/features/doctors/ConstraintOverrideFormDialog.tsx`
- `frontend/src/features/plans/components/PlanSettingsModal.tsx`

**Frontend — modified:**
- `frontend/src/lib/types.ts` — add `ConstraintOverride` type
- `frontend/src/features/plans/components/ContextPanel.tsx` — Ebene C UI
- `frontend/src/features/plans/PlanPage.tsx` — wire overrides + Plan-Einstellungen button
- `frontend/src/features/doctors/[DoctorDetailPage]` — add Overrides tab (grep for `INAExclusionList` to find exact file)

---

## Task A: ORM-Modell + Migration

**Files:**
- Create: `backend/app/models/constraint_override.py`
- Create: `backend/alembic/versions/0011_constraint_overrides.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **A1: ORM-Modell anlegen**

```python
# backend/app/models/constraint_override.py
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ConstraintOverride(Base):
    __tablename__ = "constraint_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[str] = mapped_column(String(1), nullable=False)           # 'A' | 'B' | 'C'
    constraint_id: Mapped[str] = mapped_column(String(64), nullable=False)  # ConstraintId-Wert
    plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("plans.id", ondelete="CASCADE"), nullable=True
    )
    doctor_id: Mapped[int | None] = mapped_column(
        ForeignKey("doctors.id", ondelete="CASCADE"), nullable=True
    )
    shift_id: Mapped[int | None] = mapped_column(
        ForeignKey("shifts.id", ondelete="CASCADE"), nullable=True
    )
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
```

- [ ] **A2: Modell in `__init__.py` registrieren**

In `backend/app/models/__init__.py` den Import für `ConstraintOverride` eintragen (konsistent mit bestehenden Importen dort).

- [ ] **A3: Alembic-Migration anlegen**

```python
# backend/alembic/versions/0011_constraint_overrides.py
"""Add constraint_overrides table

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "constraint_overrides",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("level", sa.String(length=1), nullable=False),
        sa.Column("constraint_id", sa.String(length=64), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=True),
        sa.Column("doctor_id", sa.Integer(), nullable=True),
        sa.Column("shift_id", sa.Integer(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shift_id"], ["shifts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("constraint_overrides")
```

- [ ] **A4: Migration ausführen**

```bash
cd backend
uv run alembic upgrade head
```

Erwartete Ausgabe: `Running upgrade 0010 -> 0011, Add constraint_overrides table`

- [ ] **A5: Tabelle prüfen**

```bash
uv run python -c "
from app.database import engine
from sqlalchemy import inspect
cols = [c['name'] for c in inspect(engine).get_columns('constraint_overrides')]
print(cols)
"
```

Erwartete Ausgabe: `['id', 'level', 'constraint_id', 'plan_id', 'doctor_id', 'shift_id', 'valid_from', 'valid_to', 'reason', 'created_at']`

- [ ] **A6: Commit**

```bash
git add backend/app/models/constraint_override.py backend/app/models/__init__.py backend/alembic/versions/0011_constraint_overrides.py
git commit -m "feat(db): ORM-Modell und Migration 0011 für constraint_overrides"
```

---

## Task B: Exceptions + Repository + Pydantic-Schemas

**Files:**
- Modify: `backend/app/services/exceptions.py`
- Create: `backend/app/schemas/constraint_override.py`
- Create: `backend/app/repositories/constraint_override_repository.py`

- [ ] **B1: Exceptions hinzufügen**

In `backend/app/services/exceptions.py` am Ende anhängen:

```python
class ConstraintOverrideNotFoundError(Exception):
    def __init__(self, override_id: int) -> None:
        super().__init__(f"Constraint-Override mit ID {override_id} nicht gefunden")
        self.override_id = override_id


class ConstraintOverrideValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail
```

- [ ] **B2: Pydantic-Schemas anlegen**

```python
# backend/app/schemas/constraint_override.py
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ConstraintOverrideCreateA(BaseModel):
    level: Literal["A"]
    constraint_id: str
    plan_id: int
    reason: str | None = None


class ConstraintOverrideCreateB(BaseModel):
    level: Literal["B"]
    constraint_id: str
    doctor_id: int
    valid_from: date
    valid_to: date | None = None
    reason: str | None = None


class ConstraintOverrideCreateC(BaseModel):
    level: Literal["C"]
    constraint_id: str
    shift_id: int
    reason: str | None = None


ConstraintOverrideCreate = Annotated[
    ConstraintOverrideCreateA | ConstraintOverrideCreateB | ConstraintOverrideCreateC,
    Field(discriminator="level"),
]


class ConstraintOverrideResponse(BaseModel):
    id: int
    level: str
    constraint_id: str
    plan_id: int | None
    doctor_id: int | None
    shift_id: int | None
    valid_from: date | None
    valid_to: date | None
    reason: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **B3: Repository anlegen**

```python
# backend/app/repositories/constraint_override_repository.py
from datetime import date

from sqlalchemy.orm import Session

from app.models.constraint_override import ConstraintOverride


def get_override(db: Session, override_id: int) -> ConstraintOverride | None:
    return db.get(ConstraintOverride, override_id)


def create_override(db: Session, data: dict) -> ConstraintOverride:
    override = ConstraintOverride(**data)
    db.add(override)
    db.flush()
    db.refresh(override)
    return override


def delete_override(db: Session, override_id: int) -> bool:
    override = db.get(ConstraintOverride, override_id)
    if override is None:
        return False
    db.delete(override)
    db.flush()
    return True


def list_for_plan(
    db: Session,
    plan_id: int,
    plan_start: date,
    plan_end: date,
    shift_ids: set[int],
) -> list[ConstraintOverride]:
    """Alle Overrides relevant für einen Plan: A direkt, B zeitlich aktiv, C per Shift-ID."""
    result: list[ConstraintOverride] = []

    # Ebene A: direkt an plan_id gebunden
    result.extend(
        db.query(ConstraintOverride)
        .filter(ConstraintOverride.level == "A", ConstraintOverride.plan_id == plan_id)
        .all()
    )

    # Ebene B: plan-unabhängig, gültig wenn Zeitraum den Plan überlappt
    result.extend(
        db.query(ConstraintOverride)
        .filter(
            ConstraintOverride.level == "B",
            (ConstraintOverride.valid_from == None)  # noqa: E711
            | (ConstraintOverride.valid_from <= plan_end),
            (ConstraintOverride.valid_to == None)  # noqa: E711
            | (ConstraintOverride.valid_to >= plan_start),
        )
        .all()
    )

    # Ebene C: Shifts die zu diesem Plan gehören
    if shift_ids:
        result.extend(
            db.query(ConstraintOverride)
            .filter(
                ConstraintOverride.level == "C",
                ConstraintOverride.shift_id.in_(shift_ids),
            )
            .all()
        )

    return result


def list_for_doctor(db: Session, doctor_id: int) -> list[ConstraintOverride]:
    return (
        db.query(ConstraintOverride)
        .filter(ConstraintOverride.level == "B", ConstraintOverride.doctor_id == doctor_id)
        .order_by(ConstraintOverride.created_at.desc())
        .all()
    )
```

- [ ] **B4: Commit**

```bash
git add backend/app/services/exceptions.py backend/app/schemas/constraint_override.py backend/app/repositories/constraint_override_repository.py
git commit -m "feat(backend): Schemas, Exceptions und Repository für constraint_overrides"
```

---

## Task C: Service + API + Tests

**Files:**
- Create: `backend/app/services/constraint_override_service.py`
- Create: `backend/app/api/constraint_overrides.py`
- Modify: `backend/app/api/error_handlers.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/services/test_constraint_override_service.py`
- Create: `backend/tests/api/test_constraint_overrides.py`

- [ ] **C1: Failing tests schreiben**

```python
# backend/tests/services/test_constraint_override_service.py
import pytest
from datetime import date

from app.services import constraint_override_service as svc
from app.services.exceptions import ConstraintOverrideValidationError


def test_create_a_override_rejects_logisch_hart(db_session, plan, doctor):
    """Logisch-harte Constraints können nicht overridet werden."""
    with pytest.raises(ConstraintOverrideValidationError, match="nicht overridebar"):
        svc.create_override(
            db_session,
            {"level": "A", "constraint_id": "double-booked", "plan_id": plan.id},
        )


def test_create_a_override_success(db_session, plan):
    override = svc.create_override(
        db_session,
        {"level": "A", "constraint_id": "max-bd-per-month", "plan_id": plan.id},
    )
    assert override.id is not None
    assert override.level == "A"
    assert override.constraint_id == "max-bd-per-month"


def test_create_b_override_success(db_session, doctor):
    override = svc.create_override(
        db_session,
        {
            "level": "B",
            "constraint_id": "max-weekly-hours",
            "doctor_id": doctor.id,
            "valid_from": date(2026, 1, 1),
        },
    )
    assert override.level == "B"
    assert override.doctor_id == doctor.id


def test_create_c_override_success(db_session, shift):
    override = svc.create_override(
        db_session,
        {"level": "C", "constraint_id": "min-rest-time", "shift_id": shift.id},
    )
    assert override.level == "C"
    assert override.shift_id == shift.id


def test_get_override_snapshot_a_level(db_session, plan, shift):
    """A-Override landet in disabled_constraints des Snapshots."""
    svc.create_override(
        db_session,
        {"level": "A", "constraint_id": "max-bd-per-month", "plan_id": plan.id},
    )
    db_session.commit()
    snapshot = svc.get_override_snapshot(db_session, plan.id)
    assert "max-bd-per-month" in snapshot.disabled_constraints


def test_get_override_snapshot_b_level_active(db_session, plan, doctor, shift):
    """B-Override mit gültigem Zeitraum → in doctor_overrides."""
    svc.create_override(
        db_session,
        {
            "level": "B",
            "constraint_id": "max-bd-per-month",
            "doctor_id": doctor.id,
            "valid_from": date(2026, 1, 1),
            "valid_to": date(2026, 12, 31),
        },
    )
    db_session.commit()
    snapshot = svc.get_override_snapshot(db_session, plan.id)
    assert "max-bd-per-month" in snapshot.doctor_overrides.get(doctor.id, frozenset())


def test_get_override_snapshot_b_level_inactive(db_session, plan, doctor, shift):
    """B-Override außerhalb Plan-Zeitraum → nicht im Snapshot."""
    svc.create_override(
        db_session,
        {
            "level": "B",
            "constraint_id": "max-bd-per-month",
            "doctor_id": doctor.id,
            "valid_from": date(2020, 1, 1),
            "valid_to": date(2020, 12, 31),
        },
    )
    db_session.commit()
    snapshot = svc.get_override_snapshot(db_session, plan.id)
    assert doctor.id not in snapshot.doctor_overrides


def test_get_override_snapshot_c_level(db_session, plan, shift):
    """C-Override für Shift im Plan → in shift_overrides."""
    svc.create_override(
        db_session,
        {"level": "C", "constraint_id": "min-rest-time", "shift_id": shift.id},
    )
    db_session.commit()
    snapshot = svc.get_override_snapshot(db_session, plan.id)
    assert "min-rest-time" in snapshot.shift_overrides.get(shift.id, frozenset())
```

- [ ] **C2: Tests ausführen — müssen FAIL sein**

```bash
cd backend
uv run pytest tests/services/test_constraint_override_service.py -v 2>&1 | head -30
```

Erwartete Ausgabe: Import-Fehler oder `ModuleNotFoundError` für `constraint_override_service`.

- [ ] **C3: Service implementieren**

```python
# backend/app/services/constraint_override_service.py
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.models.constraint_override import ConstraintOverride
from app.repositories import constraint_override_repository as repo
from app.repositories.shift_repository import list_shifts_for_plan
from app.services.exceptions import ConstraintOverrideNotFoundError, ConstraintOverrideValidationError
from app.solver.tarif_rules import REGULATORISCH_HART


@dataclass
class OverrideSnapshot:
    """Immutable Snapshot aller aktiven Overrides für einen Plan-Zeitraum."""

    disabled_constraints: frozenset[str] = field(default_factory=frozenset)
    doctor_overrides: dict[int, frozenset[str]] = field(default_factory=dict)
    shift_overrides: dict[int, frozenset[str]] = field(default_factory=dict)


def create_override(db: Session, data: dict) -> ConstraintOverride:
    constraint_id = data.get("constraint_id", "")
    if constraint_id not in REGULATORISCH_HART:
        raise ConstraintOverrideValidationError(
            f"Constraint '{constraint_id}' ist nicht overridebar — "
            "nur regulatorisch-harte Constraints können overridet werden."
        )
    override = repo.create_override(db, data)
    db.commit()
    db.refresh(override)
    return override


def delete_override(db: Session, override_id: int) -> None:
    if not repo.delete_override(db, override_id):
        raise ConstraintOverrideNotFoundError(override_id)
    db.commit()


def get_override_snapshot(db: Session, plan_id: int) -> OverrideSnapshot:
    """Lädt alle aktiven Overrides für einen Plan und gibt einen OverrideSnapshot zurück.

    Leitet den Plan-Zeitraum aus den Shifts ab (konsistent mit to_solver() in mapping.py).
    """
    shifts = list_shifts_for_plan(db, plan_id)
    if not shifts:
        return OverrideSnapshot()

    plan_start: date = min(s.shift_date for s in shifts)
    plan_end: date = max(s.shift_date for s in shifts)
    shift_ids: set[int] = {s.id for s in shifts}

    overrides = repo.list_for_plan(db, plan_id, plan_start, plan_end, shift_ids)

    disabled: set[str] = set()
    doctor_ovr: dict[int, set[str]] = {}
    shift_ovr: dict[int, set[str]] = {}

    for o in overrides:
        if o.level == "A":
            disabled.add(o.constraint_id)
        elif o.level == "B" and o.doctor_id is not None:
            doctor_ovr.setdefault(o.doctor_id, set()).add(o.constraint_id)
        elif o.level == "C" and o.shift_id is not None:
            shift_ovr.setdefault(o.shift_id, set()).add(o.constraint_id)

    return OverrideSnapshot(
        disabled_constraints=frozenset(disabled),
        doctor_overrides={k: frozenset(v) for k, v in doctor_ovr.items()},
        shift_overrides={k: frozenset(v) for k, v in shift_ovr.items()},
    )
```

- [ ] **C4: Tests ausführen — müssen PASS sein**

```bash
uv run pytest tests/services/test_constraint_override_service.py -v
```

Erwartete Ausgabe: Alle 7 Tests PASS.

- [ ] **C5: API-Router anlegen**

```python
# backend/app/api/constraint_overrides.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import constraint_override_repository as repo
from app.schemas.constraint_override import ConstraintOverrideCreate, ConstraintOverrideResponse
from app.services import constraint_override_service as svc
from app.services.exceptions import ConstraintOverrideNotFoundError

router = APIRouter(prefix="/constraint-overrides", tags=["constraint-overrides"])


@router.post("", response_model=ConstraintOverrideResponse, status_code=status.HTTP_201_CREATED)
def create_constraint_override(body: ConstraintOverrideCreate, db: Session = Depends(get_db)):
    return svc.create_override(db, body.model_dump())


@router.get("", response_model=list[ConstraintOverrideResponse])
def list_constraint_overrides(plan_id: int | None = None, db: Session = Depends(get_db)):
    if plan_id is not None:
        from app.services.constraint_override_service import get_override_snapshot
        from app.repositories.shift_repository import list_shifts_for_plan

        shifts = list_shifts_for_plan(db, plan_id)
        if not shifts:
            return []
        plan_start = min(s.shift_date for s in shifts)
        plan_end = max(s.shift_date for s in shifts)
        shift_ids = {s.id for s in shifts}
        return repo.list_for_plan(db, plan_id, plan_start, plan_end, shift_ids)
    return []


@router.delete("/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_constraint_override(override_id: int, db: Session = Depends(get_db)) -> None:
    if repo.get_override(db, override_id) is None:
        raise ConstraintOverrideNotFoundError(override_id)
    svc.delete_override(db, override_id)


# Doctors sub-route (plan-unabhängige B-Overrides)
doctor_overrides_router = APIRouter(
    prefix="/doctors/{doctor_id}/constraint-overrides",
    tags=["constraint-overrides"],
)


@doctor_overrides_router.get("", response_model=list[ConstraintOverrideResponse])
def list_doctor_constraint_overrides(doctor_id: int, db: Session = Depends(get_db)):
    return repo.list_for_doctor(db, doctor_id)
```

- [ ] **C6: Error-Handler registrieren**

In `backend/app/api/error_handlers.py` die zwei neuen Exceptions importieren und Handler hinzufügen.

Import-Zeile erweitern:
```python
from app.services.exceptions import (
    # ... bestehende Importe ...
    ConstraintOverrideNotFoundError,
    ConstraintOverrideValidationError,
)
```

Zwei Handler in `register_error_handlers` am Ende anfügen:
```python
    @app.exception_handler(ConstraintOverrideNotFoundError)
    async def constraint_override_not_found(
        _: Request, exc: ConstraintOverrideNotFoundError
    ) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ConstraintOverrideValidationError)
    async def constraint_override_validation(
        _: Request, exc: ConstraintOverrideValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})
```

- [ ] **C7: Router in main.py registrieren**

In `backend/app/main.py` hinzufügen:
```python
from app.api.constraint_overrides import doctor_overrides_router, router as constraint_overrides_router
```

Und nach dem letzten `app.include_router`:
```python
app.include_router(constraint_overrides_router, prefix="/api")
app.include_router(doctor_overrides_router, prefix="/api")
```

- [ ] **C8: API-Tests schreiben**

```python
# backend/tests/api/test_constraint_overrides.py
import pytest
from fastapi.testclient import TestClient


def test_create_a_override(client: TestClient, plan):
    resp = client.post("/api/constraint-overrides", json={
        "level": "A",
        "constraint_id": "max-bd-per-month",
        "plan_id": plan.id,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["level"] == "A"
    assert data["constraint_id"] == "max-bd-per-month"
    assert data["id"] is not None


def test_create_override_rejects_logisch_hart(client: TestClient, plan):
    resp = client.post("/api/constraint-overrides", json={
        "level": "A",
        "constraint_id": "double-booked",
        "plan_id": plan.id,
    })
    assert resp.status_code == 422
    assert "nicht overridebar" in resp.json()["detail"]


def test_create_b_override(client: TestClient, doctor):
    resp = client.post("/api/constraint-overrides", json={
        "level": "B",
        "constraint_id": "max-bd-per-month",
        "doctor_id": doctor.id,
        "valid_from": "2026-01-01",
    })
    assert resp.status_code == 201
    assert resp.json()["level"] == "B"


def test_create_c_override(client: TestClient, shift):
    resp = client.post("/api/constraint-overrides", json={
        "level": "C",
        "constraint_id": "min-rest-time",
        "shift_id": shift.id,
    })
    assert resp.status_code == 201
    assert resp.json()["level"] == "C"


def test_delete_override(client: TestClient, plan):
    create_resp = client.post("/api/constraint-overrides", json={
        "level": "A",
        "constraint_id": "max-bd-per-month",
        "plan_id": plan.id,
    })
    override_id = create_resp.json()["id"]
    del_resp = client.delete(f"/api/constraint-overrides/{override_id}")
    assert del_resp.status_code == 204


def test_delete_override_not_found(client: TestClient):
    resp = client.delete("/api/constraint-overrides/99999")
    assert resp.status_code == 404


def test_list_plan_overrides(client: TestClient, plan, shift):
    client.post("/api/constraint-overrides", json={
        "level": "A",
        "constraint_id": "max-bd-per-month",
        "plan_id": plan.id,
    })
    resp = client.get(f"/api/constraint-overrides?plan_id={plan.id}")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_list_doctor_overrides(client: TestClient, doctor):
    client.post("/api/constraint-overrides", json={
        "level": "B",
        "constraint_id": "max-weekly-hours",
        "doctor_id": doctor.id,
        "valid_from": "2026-01-01",
    })
    resp = client.get(f"/api/doctors/{doctor.id}/constraint-overrides")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
```

- [ ] **C9: API-Tests ausführen**

```bash
uv run pytest tests/api/test_constraint_overrides.py -v
```

Erwartete Ausgabe: Alle Tests PASS.

- [ ] **C10: Commit**

```bash
git add backend/app/services/constraint_override_service.py backend/app/api/constraint_overrides.py backend/app/api/error_handlers.py backend/app/main.py backend/tests/services/test_constraint_override_service.py backend/tests/api/test_constraint_overrides.py
git commit -m "feat(backend): constraint_override Service, API und Tests"
```

---

## Task D: Solver-Snapshot-Integration

**Files:**
- Modify: `backend/app/solver/domain.py`
- Modify: `backend/app/solver/mapping.py`
- Modify: `backend/app/solver/constraints.py`
- Modify: `backend/app/solver/solver_service.py`

**Hinweis:** Solver-Tests benötigen JVM (Java 17+, `JAVA_HOME` gesetzt). Bestehende Tests in `tests/solver/` laufen nur mit JVM.

- [ ] **D1: domain.py — Snapshot-Felder hinzufügen**

In `backend/app/solver/domain.py`:

`SolverDoctor.__init__` — neuen Parameter `overridden_constraints` hinzufügen:

```python
def __init__(
    self,
    doctor_id: int,
    name: str,
    *,
    unavailable_dates: frozenset[date] = frozenset(),
    fte_percentage: int = 100,
    fair_targets: dict[int, int] | None = None,
    max_weekly_hours_minutes: int = MAX_WEEKLY_HOURS_MINUTES,
    overridden_constraints: frozenset[str] = frozenset(),  # Ebene B
) -> None:
    self.doctor_id = doctor_id
    self.name = name
    self.unavailable_dates = unavailable_dates
    self.fte_percentage = fte_percentage
    self.fair_targets = fair_targets if fair_targets is not None else {}
    self.max_weekly_hours_minutes = max_weekly_hours_minutes
    self.overridden_constraints = overridden_constraints
```

`SolverShift` — Klassen-Annotation und `__init__`-Parameter:

```python
@planning_entity
class SolverShift:
    id: Annotated[int, PlanningId]
    is_pinned: Annotated[bool, PlanningPin]
    doctor: Annotated[SolverDoctor | None, PlanningVariable(allows_unassigned=True)]

    plan_id: int
    shift_date: date
    shift_type_id: int
    shift_date_ordinal: int
    is_bereitschaftsdienst: bool
    shift_start_minutes: int | None
    shift_end_minutes: int | None
    overridden_constraints: frozenset[str]  # Ebene C — NEU

    def __init__(
        self,
        shift_id: int,
        plan_id: int,
        shift_date: date,
        shift_type_id: int,
        doctor: SolverDoctor | None = None,
        *,
        is_pinned: bool = False,
        is_bereitschaftsdienst: bool = False,
        shift_start_minutes: int | None = None,
        shift_end_minutes: int | None = None,
        overridden_constraints: frozenset[str] = frozenset(),  # NEU
    ) -> None:
        self.id = shift_id
        self.plan_id = plan_id
        self.shift_date = shift_date
        self.shift_type_id = shift_type_id
        self.shift_date_ordinal = shift_date.toordinal()
        self.doctor = doctor
        self.is_pinned = is_pinned and doctor is not None
        self.is_bereitschaftsdienst = is_bereitschaftsdienst
        self.shift_start_minutes = shift_start_minutes
        self.shift_end_minutes = shift_end_minutes
        self.overridden_constraints = overridden_constraints
```

`ShiftSchedule.__init__` — `disabled_constraints` Parameter:

```python
def __init__(self, doctors: list[SolverDoctor], shifts: list[SolverShift], disabled_constraints: frozenset[str] = frozenset()) -> None:
    self.doctors = doctors
    self.shifts = shifts
    self.score = None  # type: ignore[assignment]
    self.disabled_constraints = disabled_constraints  # Ebene A, non-Timefold-Feld
```

- [ ] **D2: mapping.py — Override-Snapshot laden**

In `backend/app/solver/mapping.py` den Import hinzufügen:

```python
from app.services.constraint_override_service import get_override_snapshot
```

In `to_solver()` vor der Ärzte-Schleife den Snapshot laden:

```python
    # --- Override-Snapshot (Ebene A/B/C) ---
    override_snapshot = get_override_snapshot(db, plan_id)
```

In der Ärzte-Schleife `overridden_constraints` übergeben:

```python
        solver_doctors[d.id] = SolverDoctor(
            doctor_id=d.id,
            name=d.name,
            unavailable_dates=unavailable_dates,
            fte_percentage=fte_per_doctor[d.id],
            fair_targets=_targets(d.id),
            max_weekly_hours_minutes=get_weekly_hours_limit(d.opt_out_bd_level),
            overridden_constraints=override_snapshot.doctor_overrides.get(d.id, frozenset()),  # NEU
        )
```

In der Schichten-Schleife `overridden_constraints` übergeben:

```python
        solver_shifts.append(
            SolverShift(
                shift_id=shift.id,
                plan_id=shift.plan_id,
                shift_date=shift.shift_date,
                shift_type_id=shift.shift_type_id,
                doctor=assigned_doctor,
                is_pinned=shift.is_pinned,
                is_bereitschaftsdienst=shift_type_bd_map.get(shift.shift_type_id, False),
                shift_start_minutes=_shift_start_minutes(shift.shift_date, start_t),
                shift_end_minutes=_shift_end_minutes(shift.shift_date, start_t, end_t),
                overridden_constraints=override_snapshot.shift_overrides.get(shift.id, frozenset()),  # NEU
            )
        )
```

`return`-Zeile ändern:

```python
    return ShiftSchedule(
        doctors=list(solver_doctors.values()),
        shifts=solver_shifts,
        disabled_constraints=override_snapshot.disabled_constraints,  # NEU
    )
```

- [ ] **D3: constraints.py — `build_constraint_provider` + Override-Filter**

`backend/app/solver/constraints.py` komplett ersetzen:

```python
"""ConstraintProvider für ShiftSchedule.

Öffentliche Einstiegspunkte:
  build_constraint_provider(disabled) → constraint_provider-Funktion (Ebene A)
  constraint_definitions → Alias mit leerer disabled-Menge (Rückwärtskompatibilität)
"""
from __future__ import annotations

from datetime import date as _date

from timefold.solver.score import (
    Constraint,
    ConstraintCollectors,
    ConstraintFactory,
    HardSoftScore,
    Joiners,
    constraint_provider,
)

from app.solver.domain import SolverShift
from app.solver.tarif_rules import (
    MAX_BD_PER_MONAT,
    MAX_CONSECUTIVE_DAYS,
    MAX_WEEKEND_SHIFTS_PER_MONTH,
    MIN_REST_HOURS,
    ConstraintId,
)


def _iso_week_key(start_minutes: int) -> tuple[int, int]:
    d = _date.fromordinal(start_minutes // 1440)
    iso = d.isocalendar()
    return (iso[0], iso[1])


def build_constraint_provider(disabled: frozenset[str] = frozenset()):
    """Gibt eine constraint_provider-Funktion zurück.

    Regulatorisch-harte Constraints in `disabled` werden komplett weggelassen (Ebene A).
    Ebene B und C werden per Override-Felder in den Lambdas geprüft.
    """

    @constraint_provider
    def _provider(cf: ConstraintFactory) -> list[Constraint]:
        result: list[Constraint] = [
            double_booked(cf),
            absent_doctor(cf),
            fair_distribution(cf),
            max_consecutive_days(cf),
        ]
        if ConstraintId.MAX_BD_PER_MONTH not in disabled:
            result.append(max_bd_per_month(cf))
        if ConstraintId.MAX_WEEKENDS_PER_MONTH not in disabled:
            result.append(max_weekends_per_month(cf))
        if ConstraintId.MIN_REST_TIME not in disabled:
            result.append(min_rest_time(cf))
        if ConstraintId.MAX_WEEKLY_HOURS not in disabled:
            result.append(max_weekly_hours(cf))
        return result

    return _provider


# Rückwärtskompatibles Alias für bestehende Tests und solver_service-Import
constraint_definitions = build_constraint_provider()


def double_booked(cf: ConstraintFactory) -> Constraint:
    return (
        cf.for_each_unique_pair(
            SolverShift,
            Joiners.equal(lambda s: s.shift_date),
            Joiners.equal(lambda s: s.doctor),
        )
        .filter(lambda s1, s2: s1.doctor is not None)
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.DOUBLE_BOOKED)
    )


def fair_distribution(cf: ConstraintFactory) -> Constraint:
    return (
        cf.for_each(SolverShift)
        .filter(lambda s: s.doctor is not None)
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_type_id,
            ConstraintCollectors.count(),
        )
        .filter(lambda doc, st, count: count > doc.fair_targets.get(st, 0))
        .penalize(
            HardSoftScore.ONE_SOFT,
            lambda doc, st, count: count - doc.fair_targets.get(st, 0),
        )
        .as_constraint(ConstraintId.FAIR_DISTRIBUTION)
    )


def max_consecutive_days(cf: ConstraintFactory) -> Constraint:
    return (
        cf.for_each_unique_pair(
            SolverShift,
            Joiners.equal(lambda s: s.doctor),
        )
        .filter(
            lambda s1, s2: s1.doctor is not None
            and (
                s2.shift_date_ordinal - s1.shift_date_ordinal == MAX_CONSECUTIVE_DAYS
                or s1.shift_date_ordinal - s2.shift_date_ordinal == MAX_CONSECUTIVE_DAYS
            )
        )
        .penalize(HardSoftScore.ONE_SOFT)
        .as_constraint(ConstraintId.MAX_CONSECUTIVE_DAYS)
    )


def max_bd_per_month(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: Shift ausgenommen. Ebene B: Doctor ausgenommen."""
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None
            and s.is_bereitschaftsdienst
            and ConstraintId.MAX_BD_PER_MONTH not in s.overridden_constraints  # Ebene C
        )
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_date.month,
            ConstraintCollectors.count(),
        )
        .filter(
            lambda doc, month, count: count > MAX_BD_PER_MONAT
            and ConstraintId.MAX_BD_PER_MONTH not in doc.overridden_constraints  # Ebene B
        )
        .penalize(HardSoftScore.ONE_HARD, lambda doc, month, count: count - MAX_BD_PER_MONAT)
        .as_constraint(ConstraintId.MAX_BD_PER_MONTH)
    )


def max_weekends_per_month(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: Shift ausgenommen. Ebene B: Doctor ausgenommen."""
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None
            and s.shift_date.weekday() in (5, 6)
            and ConstraintId.MAX_WEEKENDS_PER_MONTH not in s.overridden_constraints  # Ebene C
        )
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_date.month,
            ConstraintCollectors.count(),
        )
        .filter(
            lambda doc, month, count: count > MAX_WEEKEND_SHIFTS_PER_MONTH
            and ConstraintId.MAX_WEEKENDS_PER_MONTH not in doc.overridden_constraints  # Ebene B
        )
        .penalize(
            HardSoftScore.ONE_HARD,
            lambda doc, month, count: count - MAX_WEEKEND_SHIFTS_PER_MONTH,
        )
        .as_constraint(ConstraintId.MAX_WEEKENDS_PER_MONTH)
    )


def min_rest_time(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: eine der beiden Schichten ausgenommen → kein Penalty.
    Ebene B: Doctor hat Override → kein Penalty für dieses Paar."""
    return (
        cf.for_each_unique_pair(
            SolverShift,
            Joiners.equal(lambda s: s.doctor),
        )
        .filter(
            lambda s1, s2: (
                s1.doctor is not None
                and ConstraintId.MIN_REST_TIME not in s1.overridden_constraints  # Ebene C
                and ConstraintId.MIN_REST_TIME not in s2.overridden_constraints  # Ebene C
                and ConstraintId.MIN_REST_TIME not in s1.doctor.overridden_constraints  # Ebene B
                and s1.shift_start_minutes is not None
                and s1.shift_end_minutes is not None
                and s2.shift_start_minutes is not None
                and s2.shift_end_minutes is not None
                and (
                    0 < s2.shift_start_minutes - s1.shift_end_minutes < MIN_REST_HOURS * 60
                    or 0 < s1.shift_start_minutes - s2.shift_end_minutes < MIN_REST_HOURS * 60
                )
            )
        )
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.MIN_REST_TIME)
    )


def max_weekly_hours(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: Shift aus Summe ausgenommen. Ebene B: Doctor ausgenommen."""
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: (
                s.doctor is not None
                and s.shift_start_minutes is not None
                and s.shift_end_minutes is not None
                and ConstraintId.MAX_WEEKLY_HOURS not in s.overridden_constraints  # Ebene C
            )
        )
        .group_by(
            lambda s: s.doctor,
            lambda s: _iso_week_key(s.shift_start_minutes),
            ConstraintCollectors.sum(lambda s: s.shift_end_minutes - s.shift_start_minutes),
        )
        .filter(
            lambda doc, week, total_min: total_min > doc.max_weekly_hours_minutes
            and ConstraintId.MAX_WEEKLY_HOURS not in doc.overridden_constraints  # Ebene B
        )
        .penalize(
            HardSoftScore.ONE_HARD,
            lambda doc, week, total_min: total_min - doc.max_weekly_hours_minutes,
        )
        .as_constraint(ConstraintId.MAX_WEEKLY_HOURS)
    )


def absent_doctor(cf: ConstraintFactory) -> Constraint:
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None and s.shift_date in s.doctor.unavailable_dates
        )
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.ABSENT_DOCTOR)
    )
```

- [ ] **D4: solver_service.py — `build_constraint_provider` verwenden**

In `backend/app/solver/solver_service.py` die lazy-Import-Zeile ändern:

```python
    # Alt:
    from app.solver.constraints import constraint_definitions
    # Neu:
    from app.solver.constraints import build_constraint_provider
```

Und die Config-Zeile:

```python
    config = SolverConfig(
        solution_class=ShiftSchedule,
        entity_class_list=[SolverShift],
        score_director_factory_config=ScoreDirectorFactoryConfig(
            constraint_provider_function=build_constraint_provider(schedule.disabled_constraints),
        ),
        termination_config=TerminationConfig(spent_limit=Duration(seconds=TERMINATION_SECONDS)),
    )
```

- [ ] **D5: Bestehende Solver-Tests ausführen (JVM erforderlich)**

```bash
uv run pytest tests/solver/ -v
```

Erwartete Ausgabe: Alle bestehenden Tests PASS. Falls JVM fehlt: Tests überspringen und weiterarbeiten.

- [ ] **D6: Commit**

```bash
git add backend/app/solver/domain.py backend/app/solver/mapping.py backend/app/solver/constraints.py backend/app/solver/solver_service.py
git commit -m "feat(solver): Override-Snapshot-Integration in domain, mapping, constraints"
```

---

## Task E: Tarif-Warnings-Filter

**Files:**
- Modify: `backend/app/services/tarif_validation_service.py`

**Kontext:** `REGISTERED_RULES` ist im Prod-Code leer — der Filter ist für zukünftige Regeln vorbereitet. Tests nutzen `monkeypatch` für eine lokale Test-Regel (analog bestehender Tarif-Validierungs-Tests).

- [ ] **E1: tarif_validation_service.py aktualisieren**

```python
# backend/app/services/tarif_validation_service.py
from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories import plan_repository
from app.schemas.tarif_warning import PlanTarifWarnings, TarifWarning
from app.services.constraint_override_service import OverrideSnapshot, get_override_snapshot
from app.services.exceptions import PlanNotFoundError
from app.solver import tarif_rules as _tarif_rules


def compute_tarif_warnings(db: Session, plan_id: int) -> PlanTarifWarnings:
    plan = plan_repository.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    warnings: list[TarifWarning] = []
    for rule in _tarif_rules.REGISTERED_RULES:
        warnings.extend(rule.evaluate(db, plan_id))

    # Overrides anwenden: gefilterte Warnungen entfernen
    snapshot = get_override_snapshot(db, plan_id)
    filtered = [w for w in warnings if not _is_overridden(w, snapshot)]

    return PlanTarifWarnings(
        plan_id=plan_id,
        warnings=filtered,
        warning_count=len(filtered),
    )


def _is_overridden(warning: TarifWarning, snapshot: OverrideSnapshot) -> bool:
    cid = warning.rule_id
    # Ebene A: global für diesen Plan deaktiviert
    if cid in snapshot.disabled_constraints:
        return True
    # Ebene C: dieser Shift ist für diese Regel überridedt
    if warning.shift_id is not None and cid in snapshot.shift_overrides.get(warning.shift_id, frozenset()):
        return True
    # Ebene B: erfordert doctor_id auf TarifWarning — wird aktiv sobald Regeln doctor_id setzen
    return False
```

- [ ] **E2: Bestehende Tarif-Validierungs-Tests ausführen**

```bash
uv run pytest tests/ -k "tarif" -v
```

Erwartete Ausgabe: Alle bestehenden Tests PASS.

- [ ] **E3: Commit**

```bash
git add backend/app/services/tarif_validation_service.py
git commit -m "feat(backend): Tarif-Warnings nach Override-Snapshot filtern"
```

---

## Task F: Frontend — Types + Hooks

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/features/plans/useConstraintOverrides.ts`
- Create: `frontend/src/features/doctors/useDoctorConstraintOverrides.ts`

- [ ] **F1: Type in `lib/types.ts` hinzufügen**

In `frontend/src/lib/types.ts` eintragen (konsistent mit bestehenden manuellen Typen):

```typescript
export type ConstraintOverride = {
  id: number
  level: 'A' | 'B' | 'C'
  constraint_id: string
  plan_id: number | null
  doctor_id: number | null
  shift_id: number | null
  valid_from: string | null
  valid_to: string | null
  reason: string | null
  created_at: string
}

export type ConstraintOverrideCreateA = {
  level: 'A'
  constraint_id: string
  plan_id: number
  reason?: string | null
}

export type ConstraintOverrideCreateB = {
  level: 'B'
  constraint_id: string
  doctor_id: number
  valid_from: string
  valid_to?: string | null
  reason?: string | null
}

export type ConstraintOverrideCreateC = {
  level: 'C'
  constraint_id: string
  shift_id: number
  reason?: string | null
}

export type ConstraintOverrideCreate =
  | ConstraintOverrideCreateA
  | ConstraintOverrideCreateB
  | ConstraintOverrideCreateC

/** ConstraintIds der regulatorisch-harten Constraints (overridebar). */
export const REGULATORISCH_HART_IDS = [
  'max-bd-per-month',
  'max-weekends-per-month',
  'min-rest-time',
  'max-weekly-hours',
] as const
```

- [ ] **F2: Plan-Overrides-Hook anlegen**

```typescript
// frontend/src/features/plans/useConstraintOverrides.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api'
import type { ConstraintOverride, ConstraintOverrideCreate } from '@/lib/types'
import { tarifWarningKeys } from './useTarifWarnings'

export const overrideKeys = {
  byPlan: (planId: number) => ['constraint-overrides', 'plan', planId] as const,
} as const

export function useConstraintOverrides(planId: number | null) {
  return useQuery({
    queryKey: overrideKeys.byPlan(planId ?? 0),
    queryFn: () =>
      apiGet<ConstraintOverride[]>(`/api/constraint-overrides?plan_id=${planId}`),
    enabled: planId != null,
  })
}

export function useCreateConstraintOverride(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConstraintOverrideCreate) =>
      apiPost<ConstraintOverride>('/api/constraint-overrides', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: overrideKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
    },
  })
}

export function useDeleteConstraintOverride(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrideId: number) =>
      apiDelete(`/api/constraint-overrides/${overrideId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: overrideKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
    },
  })
}
```

- [ ] **F3: Doctor-Overrides-Hook anlegen**

```typescript
// frontend/src/features/doctors/useDoctorConstraintOverrides.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api'
import type { ConstraintOverride, ConstraintOverrideCreateB } from '@/lib/types'

export const doctorOverrideKeys = {
  byDoctor: (doctorId: number) =>
    ['constraint-overrides', 'doctor', doctorId] as const,
} as const

export function useDoctorConstraintOverrides(doctorId: number | null) {
  return useQuery({
    queryKey: doctorOverrideKeys.byDoctor(doctorId ?? 0),
    queryFn: () =>
      apiGet<ConstraintOverride[]>(
        `/api/doctors/${doctorId}/constraint-overrides`,
      ),
    enabled: doctorId != null,
  })
}

export function useCreateDoctorConstraintOverride(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConstraintOverrideCreateB) =>
      apiPost<ConstraintOverride>('/api/constraint-overrides', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorOverrideKeys.byDoctor(doctorId) })
    },
  })
}

export function useDeleteDoctorConstraintOverride(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrideId: number) =>
      apiDelete(`/api/constraint-overrides/${overrideId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doctorOverrideKeys.byDoctor(doctorId) })
    },
  })
}
```

**Hinweis:** `apiDelete` muss in `frontend/src/lib/api.ts` existieren. Falls nicht: prüfen und analog zu `apiPost`/`apiGet` ergänzen.

- [ ] **F4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/features/plans/useConstraintOverrides.ts frontend/src/features/doctors/useDoctorConstraintOverrides.ts
git commit -m "feat(frontend): ConstraintOverride-Typen und TanStack-Query-Hooks"
```

---

## Task G: Frontend — Ebene B (Doctor Detail)

**Files:**
- Create: `frontend/src/features/doctors/ConstraintOverrideFormDialog.tsx`
- Create: `frontend/src/features/doctors/ConstraintOverrideList.tsx`
- Modify: `frontend/src/features/doctors/[DoctorDetailPage]` — Overrides-Tab hinzufügen

**Kontext:** Muster 1:1 aus `INAExclusionList.tsx` + `INAExclusionFormDialog.tsx`. Die DoctorDetailPage (exakter Dateiname via `grep -r "INAExclusionList" frontend/src` ermitteln) erhält einen neuen Tab „Constraint-Overrides".

- [ ] **G1: ConstraintOverrideFormDialog anlegen**

```tsx
// frontend/src/features/doctors/ConstraintOverrideFormDialog.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useCreateDoctorConstraintOverride } from './useDoctorConstraintOverrides'

const CONSTRAINT_OPTIONS = [
  { value: 'max-bd-per-month', label: 'Max. Bereitschaftsdienste/Monat' },
  { value: 'max-weekends-per-month', label: 'Max. Wochenenddienste/Monat' },
  { value: 'min-rest-time', label: 'Mindestruhezeit (11 h)' },
  { value: 'max-weekly-hours', label: 'Max. Wochenstunden' },
] as const

const schema = z
  .object({
    constraint_id: z.string().min(1, 'Constraint wählen'),
    valid_from: z.string().min(1, 'Startdatum erforderlich'),
    valid_to: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
  })
  .refine(
    (d) => !d.valid_from || !d.valid_to || d.valid_from <= d.valid_to,
    { message: 'Enddatum muss nach Startdatum liegen', path: ['valid_to'] },
  )

type FormValues = z.infer<typeof schema>

interface Props {
  doctorId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConstraintOverrideFormDialog({ doctorId, open, onOpenChange }: Props) {
  const createMutation = useCreateDoctorConstraintOverride(doctorId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { constraint_id: '', valid_from: '', valid_to: null, reason: null },
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        level: 'B',
        constraint_id: values.constraint_id,
        doctor_id: doctorId,
        valid_from: values.valid_from,
        valid_to: values.valid_to || null,
        reason: values.reason || null,
      },
      {
        onSuccess: () => {
          toast.success('Override gespeichert')
          form.reset()
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.detail : 'Speichern fehlgeschlagen'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Constraint-Override hinzufügen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="constraint_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Constraint *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Constraint wählen" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONSTRAINT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gültig ab *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gültig bis</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Begründung</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional…"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Speichern…' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **G2: ConstraintOverrideList anlegen**

```tsx
// frontend/src/features/doctors/ConstraintOverrideList.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useDoctorConstraintOverrides,
  useDeleteDoctorConstraintOverride,
} from './useDoctorConstraintOverrides'
import { ConstraintOverrideFormDialog } from './ConstraintOverrideFormDialog'

const CONSTRAINT_LABELS: Record<string, string> = {
  'max-bd-per-month': 'Max. BD/Monat',
  'max-weekends-per-month': 'Max. Wochenende/Monat',
  'min-rest-time': 'Mindestruhezeit',
  'max-weekly-hours': 'Max. Wochenstunden',
}

interface Props {
  doctorId: number
}

export function ConstraintOverrideList({ doctorId }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const { data: overrides = [], isLoading } = useDoctorConstraintOverrides(doctorId)
  const deleteMutation = useDeleteDoctorConstraintOverride(doctorId)

  const handleDelete = () => {
    if (deleteTarget == null) return
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => { toast.success('Override gelöscht'); setDeleteTarget(null) },
      onError: () => { toast.error('Löschen fehlgeschlagen'); setDeleteTarget(null) },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Constraint-Overrides
        </h3>
        <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Neuer Override
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>}
      {!isLoading && overrides.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Keine Constraint-Overrides hinterlegt.
        </p>
      )}

      <div className="space-y-2">
        {overrides.map((o) => {
          const toStr = o.valid_to ? `bis ${o.valid_to}` : 'unbefristet'
          return (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {CONSTRAINT_LABELS[o.constraint_id] ?? o.constraint_id} &mdash; ab{' '}
                  {o.valid_from}, {toStr}
                </p>
                {o.reason && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{o.reason}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteTarget(o.id)}
                aria-label="Löschen"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        })}
      </div>

      <ConstraintOverrideFormDialog
        doctorId={doctorId}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Override wird dauerhaft entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **G3: DoctorDetailPage — Overrides-Tab hinzufügen**

```bash
grep -r "INAExclusionList" frontend/src --include="*.tsx" -l
```

Die gefundene Datei (z.B. `DoctorDetailPage.tsx` oder `DoctorEditPage.tsx`) öffnen.
`ConstraintOverrideList` importieren und als Tab analog zu `INAExclusionList` einbauen:

```tsx
import { ConstraintOverrideList } from './ConstraintOverrideList'

// Im Tab-Bereich (analog zu "INA-Ausschlüsse"-Tab):
<TabsContent value="overrides">
  <ConstraintOverrideList doctorId={doctorId} />
</TabsContent>

// Im TabsList:
<TabsTrigger value="overrides">Constraint-Overrides</TabsTrigger>
```

- [ ] **G4: Im Browser testen**

Frontend und Backend starten (gemäß `dev.ps1` oder `dev.sh`). Einen Arzt öffnen → Tab „Constraint-Overrides" sichtbar → Override für „Max. BD/Monat" anlegen → erscheint in Liste → Löschen funktioniert.

- [ ] **G5: Commit**

```bash
git add frontend/src/features/doctors/ConstraintOverrideFormDialog.tsx frontend/src/features/doctors/ConstraintOverrideList.tsx frontend/src/features/doctors/
git commit -m "feat(ui): Ebene-B Constraint-Override-Verwaltung in Arzt-Detailseite"
```

---

## Task H: Frontend — Ebene A (Plan-Settings Modal)

**Files:**
- Create: `frontend/src/features/plans/components/PlanSettingsModal.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **H1: PlanSettingsModal anlegen**

```tsx
// frontend/src/features/plans/components/PlanSettingsModal.tsx
import { toast } from 'sonner'
import { Settings } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  useConstraintOverrides,
  useCreateConstraintOverride,
  useDeleteConstraintOverride,
} from '../useConstraintOverrides'
import type { ConstraintOverride } from '@/lib/types'

const REGULATORISCH_HART = [
  { id: 'max-bd-per-month', label: 'Max. Bereitschaftsdienste/Monat' },
  { id: 'max-weekends-per-month', label: 'Max. Wochenenddienste/Monat' },
  { id: 'min-rest-time', label: 'Mindestruhezeit (ArbZG § 5)' },
  { id: 'max-weekly-hours', label: 'Max. Wochenstunden (ArbZG § 3)' },
] as const

interface Props {
  planId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlanSettingsModal({ planId, open, onOpenChange }: Props) {
  const { data: overrides = [] } = useConstraintOverrides(open ? planId : null)
  const createMutation = useCreateConstraintOverride(planId)
  const deleteMutation = useDeleteConstraintOverride(planId)

  const disabledSet = new Set(
    overrides.filter((o) => o.level === 'A').map((o) => o.constraint_id),
  )

  const findOverride = (constraintId: string): ConstraintOverride | undefined =>
    overrides.find((o) => o.level === 'A' && o.constraint_id === constraintId)

  const handleToggle = (constraintId: string, currentlyDisabled: boolean) => {
    if (currentlyDisabled) {
      const existing = findOverride(constraintId)
      if (!existing) return
      deleteMutation.mutate(existing.id, {
        onError: () => toast.error('Fehler beim Aktivieren'),
      })
    } else {
      createMutation.mutate(
        { level: 'A', constraint_id: constraintId, plan_id: planId },
        { onError: () => toast.error('Fehler beim Deaktivieren') },
      )
    }
  }

  const isPending = createMutation.isPending || deleteMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={16} />
            Plan-Einstellungen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-[13px] text-muted-foreground">
            Deaktivierte Constraints werden beim Solver und bei Tarif-Warnungen ignoriert.
          </p>
          <div className="space-y-3">
            {REGULATORISCH_HART.map(({ id, label }) => {
              const isDisabled = disabledSet.has(id)
              return (
                <div key={id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <Label className="text-sm cursor-pointer" htmlFor={`toggle-${id}`}>
                    {label}
                  </Label>
                  <Switch
                    id={`toggle-${id}`}
                    checked={!isDisabled}
                    onCheckedChange={() => handleToggle(id, isDisabled)}
                    disabled={isPending}
                    aria-label={`${label} ${isDisabled ? 'aktivieren' : 'deaktivieren'}`}
                  />
                </div>
              )
            })}
          </div>
          {disabledSet.size > 0 && (
            <p className="text-[12px] text-warn-ink bg-warn-bg rounded px-3 py-2">
              {disabledSet.size} Constraint{disabledSet.size > 1 ? 's' : ''} deaktiviert.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **H2: PlanPage — Plan-Einstellungen-Button + Modal verdrahten**

In `frontend/src/features/plans/PlanPage.tsx`:

State hinzufügen:
```tsx
const [settingsOpen, setSettingsOpen] = useState(false)
```

Import:
```tsx
import { PlanSettingsModal } from './components/PlanSettingsModal'
import { Settings } from 'lucide-react'
```

Button in CommandBar-Bereich (konsistent mit bestehenden Buttons):
```tsx
<Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
  <Settings size={14} className="mr-1.5" />
  Einstellungen
</Button>
```

Modal im JSX vor dem schließenden `</div>`:
```tsx
{planId != null && (
  <PlanSettingsModal
    planId={planId}
    open={settingsOpen}
    onOpenChange={setSettingsOpen}
  />
)}
```

- [ ] **H3: Im Browser testen**

Plan öffnen → „Einstellungen"-Button → Modal öffnet mit 4 Toggles → Toggle auf „Max. BD/Monat" → Toggle wird grau (deaktiviert) → Modal schließen → wieder öffnen → Status bleibt.

- [ ] **H4: Commit**

```bash
git add frontend/src/features/plans/components/PlanSettingsModal.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(ui): Ebene-A Plan-Einstellungen-Modal mit Constraint-Toggles"
```

---

## Task I: Frontend — Ebene C (ContextPanel)

**Files:**
- Modify: `frontend/src/features/plans/components/ContextPanel.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **I1: ContextPanel — Override-Props und Freigeben-UI**

`frontend/src/features/plans/components/ContextPanel.tsx` komplett ersetzen:

```tsx
import { useState } from 'react'
import { X, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConflictCard } from './ConflictCard'
import type { components } from '@/lib/api-types'
import type { ConstraintOverride, TarifWarning } from '@/lib/types'
import { REGULATORISCH_HART_IDS } from '@/lib/types'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info',
  warning: 'Warnung',
  critical: 'Kritisch',
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'bg-sand text-ink',
  warning: 'bg-warn-bg text-warn-ink',
  critical: 'bg-warn text-paper',
}

interface Props {
  shift: ShiftWithDetails
  onClose: () => void
  tarifWarnings?: TarifWarning[]
  shiftOverrides?: ConstraintOverride[]   // C-Overrides für diesen Shift
  onCreateOverride?: (constraintId: string, reason: string | null) => void
  onDeleteOverride?: (overrideId: number) => void
}

export function ContextPanel({
  shift,
  onClose,
  tarifWarnings,
  shiftOverrides = [],
  onCreateOverride,
  onDeleteOverride,
}: Props) {
  const [pendingReason, setPendingReason] = useState<Record<string, string>>({})

  const overrideMap = new Map(
    shiftOverrides.map((o) => [o.constraint_id, o]),
  )

  const isOverridable = (ruleId: string) =>
    (REGULATORISCH_HART_IDS as readonly string[]).includes(ruleId)

  return (
    <div className="w-[290px] shrink-0 flex flex-col bg-card border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <p className="text-sm font-medium">
          {shift.shift_type?.short_name} · {shift.shift_date}
        </p>
        <button
          aria-label="Schließen"
          onClick={onClose}
          className="text-ink-3 hover:text-ink transition"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {shift.conflicts.map((conflict, i) => (
          <ConflictCard key={i} conflict={conflict} />
        ))}
        {tarifWarnings && tarifWarnings.length > 0 && (
          <div className="space-y-2">
            {shift.conflicts.length > 0 && <div className="border-t border-line pt-2" />}
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
              Tarif-Warnungen
            </p>
            {tarifWarnings.map((w, i) => {
              const override = overrideMap.get(w.rule_id)
              const canOverride = isOverridable(w.rule_id)
              return (
                <div key={i} className="rounded-lg border border-line bg-paper p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        SEVERITY_CLASS[w.severity] ?? 'bg-sand text-ink',
                      ].join(' ')}
                    >
                      {SEVERITY_LABEL[w.severity] ?? w.severity}
                    </span>
                    <span className="text-[11px] text-ink-3">{w.rule_id}</span>
                  </div>
                  <p className="text-[12px] text-ink leading-snug">{w.message}</p>
                  {canOverride && (
                    <div className="pt-1">
                      {override ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] bg-sand border border-warn-line rounded px-2 py-0.5 flex items-center gap-1">
                            <ShieldCheck size={11} />
                            Override aktiv
                          </span>
                          <button
                            className="text-[11px] text-ink-3 underline hover:text-ink"
                            onClick={() => onDeleteOverride?.(override.id)}
                          >
                            Widerrufen
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Input
                            className="h-6 text-[11px]"
                            placeholder="Begründung (optional)"
                            value={pendingReason[w.rule_id] ?? ''}
                            onChange={(e) =>
                              setPendingReason((prev) => ({
                                ...prev,
                                [w.rule_id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] w-full"
                            onClick={() => {
                              onCreateOverride?.(
                                w.rule_id,
                                pendingReason[w.rule_id] || null,
                              )
                              setPendingReason((prev) => { const n = {...prev}; delete n[w.rule_id]; return n })
                            }}
                          >
                            <ShieldOff size={11} className="mr-1" />
                            Freigeben
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **I2: PlanPage — Overrides an ContextPanel übergeben**

In `frontend/src/features/plans/PlanPage.tsx`:

Hook hinzufügen:
```tsx
const { data: constraintOverrides = [] } = useConstraintOverrides(planId)
```

Import:
```tsx
import { useConstraintOverrides, useCreateConstraintOverride, useDeleteConstraintOverride } from './useConstraintOverrides'
```

Mutations anlegen:
```tsx
const createOverrideMutation = useCreateConstraintOverride(planId ?? 0)
const deleteOverrideMutation = useDeleteConstraintOverride(planId ?? 0)
```

Handler-Funktionen anlegen (neben bestehenden Handlers):
```tsx
const handleCreateCOverride = (shiftId: number, constraintId: string, reason: string | null) => {
  if (!planId) return
  createOverrideMutation.mutate(
    { level: 'C', constraint_id: constraintId, shift_id: shiftId },
    {
      onSuccess: () => toast.success('Override gespeichert'),
      onError: () => toast.error('Override konnte nicht gespeichert werden'),
    },
  )
}

const handleDeleteOverride = (overrideId: number) => {
  deleteOverrideMutation.mutate(overrideId, {
    onSuccess: () => toast.success('Override widerrufen'),
    onError: () => toast.error('Widerrufen fehlgeschlagen'),
  })
}
```

ContextPanel-Aufruf erweitern (bestehende Props beibehalten, neue hinzufügen):
```tsx
<ContextPanel
  shift={contextShift}
  onClose={() => setContextShift(null)}
  tarifWarnings={tarifWarningsByShift[contextShift.id]}
  shiftOverrides={constraintOverrides.filter(
    (o) => o.level === 'C' && o.shift_id === contextShift.id,
  )}
  onCreateOverride={(constraintId, reason) =>
    handleCreateCOverride(contextShift.id, constraintId, reason)
  }
  onDeleteOverride={handleDeleteOverride}
/>
```

- [ ] **I3: Im Browser testen**

1. Plan öffnen mit Shifts die Tarif-Warnungen haben (§-Dot sichtbar)
2. §-Dot klicken → ContextPanel öffnet → Tarif-Warning sichtbar
3. „Freigeben"-Button klicken → „Override aktiv"-Badge erscheint, §-Dot verschwindet
4. „Widerrufen" klicken → §-Dot erscheint wieder

- [ ] **I4: Commit**

```bash
git add frontend/src/features/plans/components/ContextPanel.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(ui): Ebene-C Override-Freigabe im ContextPanel via §-Dot"
```

---

## Task J: Vollständige Test-Suite + Ruff-Check

- [ ] **J1: Alle Backend-Tests ausführen**

```bash
cd backend
uv run pytest tests/ -v --ignore=tests/solver/
```

Erwartete Ausgabe: Alle Tests PASS. Tests in `tests/solver/` nur mit JVM ausführen.

- [ ] **J2: Ruff-Check**

```bash
uv run ruff check app/
uv run ruff format --check app/
```

Erwartete Ausgabe: Keine Violations.

- [ ] **J3: Frontend-Tests**

```bash
cd frontend
pnpm test --run
```

Erwartete Ausgabe: Alle Tests PASS.

- [ ] **J4: Abschluss-Commit**

```bash
git add -A
git commit -m "test: Vollständige Test-Suite für Constraint-Override-Mechanismus A/B/C"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Ebene A (Plan-Settings Modal + Solver-Ebene), B (Doctor Detail Tab + Solver), C (ContextPanel + Solver) — alle implementiert
- [x] **Override-Snapshot:** `OverrideSnapshot` dataclass, `get_override_snapshot()` in Service, konsistent in `tarif_validation_service` und `mapping.py`
- [x] **`build_constraint_provider`:** Rückwärtskompatibles Alias `constraint_definitions = build_constraint_provider()` erhält bestehende Tests
- [x] **Ebene B in min_rest_time:** Zugriff via `s1.doctor.overridden_constraints` (gleicher Doctor dank `Joiners.equal`)
- [x] **`REGULATORISCH_HART_IDS` als TypeScript-Const:** Frontend prüft `isOverridable` ohne Backend-Roundtrip
- [x] **Cache-Invalidierung:** Override-Mutationen invalidieren immer `tarifWarningKeys.byPlan(planId)` und `overrideKeys.byPlan(planId)`
- [x] **Logisch-harte Constraints:** Kein „Freigeben"-Button, Backend wirft 422 — zweifach gesichert
- [x] **Timefold-Verifikation:** `@constraint_provider` im `build_constraint_provider`-Factory-Pattern: Falls JVM-Tests fehlschlagen, bestehendes `constraint_definitions`-Alias als Fallback nutzen
