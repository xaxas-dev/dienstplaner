# Springer-Zuweisung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ärzte können tageweise als Springer auf eine andere Station zugewiesen werden — als eigene Entität (`springer_assignments`), mit Drag-Chip in der PlanModeBar, Department-Auswahlpopover und geteilter Zelldarstellung wenn gleichzeitig ein regulärer Dienst existiert.

**Architecture:** Eigene Tabelle `springer_assignments(plan_id, shift_date, doctor_id, target_department_id)` mit UNIQUE(plan_id, shift_date, doctor_id). Backend: ORM-Model + Repository (upsert) + REST-API. Frontend: Hook, spezieller Drag-Chip `"springer"`, `SpringerPopover`, Split-Rendering in `UnifiedShiftCell`.

**Tech Stack:** Python/FastAPI/SQLAlchemy/Alembic (Backend), React 18/TypeScript/TanStack Query/dnd-kit (Frontend)

---

## Dateiübersicht

| Datei | Aktion |
|---|---|
| `backend/alembic/versions/0019_add_springer_assignments.py` | Neu — Migration |
| `backend/app/models/springer_assignment.py` | Neu — ORM-Model |
| `backend/app/models/__init__.py` | Modify — Import registrieren |
| `backend/app/schemas/springer_assignment.py` | Neu — Pydantic-Schemas |
| `backend/app/repositories/springer_repository.py` | Neu — get_by_plan, upsert, delete |
| `backend/app/api/springer_assignments.py` | Neu — API-Router |
| `backend/app/main.py` | Modify — Router einbinden |
| `backend/tests/api/test_springer_assignments.py` | Neu — API-Tests |
| `frontend/src/lib/types.ts` | Modify — `SpringerAssignment`-Interface |
| `frontend/src/features/plans/useSpringerAssignments.ts` | Neu — TanStack-Query-Hooks |
| `frontend/src/features/plans/components/PlanModeBar.tsx` | Modify — `SpringerDraggableChip` + `SPRINGER_DRAG_ID` |
| `frontend/src/features/plans/components/SpringerPopover.tsx` | Neu — Department-Auswahl-Popover |
| `frontend/src/features/plans/components/UnifiedShiftCell.tsx` | Modify — Split-Cell-Rendering |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | Modify — springer props durchreichen |
| `frontend/src/features/plans/PlanPage.tsx` | Modify — Daten laden, Drag-Handler, Popover-State |

---

## Task 1: Alembic-Migration

**Files:**
- Create: `backend/alembic/versions/0019_add_springer_assignments.py`

- [ ] **Schreibe die Migration:**

```python
"""add springer_assignments

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'springer_assignments',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('plan_id', sa.Integer, sa.ForeignKey('plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shift_date', sa.Date, nullable=False),
        sa.Column('doctor_id', sa.Integer, sa.ForeignKey('doctors.id'), nullable=False),
        sa.Column('target_department_id', sa.Integer, sa.ForeignKey('departments.id'), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.UniqueConstraint('plan_id', 'shift_date', 'doctor_id', name='uq_springer_plan_date_doctor'),
    )


def downgrade() -> None:
    op.drop_table('springer_assignments')
```

- [ ] **Migration ausführen:**

```bash
cd backend && uv run alembic upgrade head
```

Expected: `Running upgrade 0018 -> 0019, add springer_assignments`

- [ ] **Commit:**

```bash
git add backend/alembic/versions/0019_add_springer_assignments.py
git commit -m "feat: add springer_assignments migration (0019)"
```

---

## Task 2: ORM-Model

**Files:**
- Create: `backend/app/models/springer_assignment.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Schreibe das Model:**

```python
# backend/app/models/springer_assignment.py
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SpringerAssignment(Base):
    __tablename__ = "springer_assignments"
    __table_args__ = (
        UniqueConstraint("plan_id", "shift_date", "doctor_id", name="uq_springer_plan_date_doctor"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False
    )
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id"), nullable=False
    )
    target_department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    target_department: Mapped["Department"] = relationship("Department", lazy="joined")  # noqa: F821
```

- [ ] **Registriere in `__init__.py`** — füge hinzu (analog zu anderen Models):

Suche in `backend/app/models/__init__.py` die Zeile die `from app.models.absence import Absence` oder ähnliches enthält. Füge darunter ein:

```python
from app.models.springer_assignment import SpringerAssignment  # noqa: F401
```

- [ ] **Commit:**

```bash
git add backend/app/models/springer_assignment.py backend/app/models/__init__.py
git commit -m "feat: add SpringerAssignment ORM model"
```

---

## Task 3: Pydantic-Schemas

**Files:**
- Create: `backend/app/schemas/springer_assignment.py`

- [ ] **Schreibe die Schemas:**

```python
# backend/app/schemas/springer_assignment.py
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.department import DepartmentResponse


class SpringerAssignmentCreate(BaseModel):
    shift_date: date
    doctor_id: int
    target_department_id: int
    notes: str | None = None


class SpringerAssignmentResponse(BaseModel):
    id: int
    plan_id: int
    shift_date: date
    doctor_id: int
    target_department_id: int
    target_department: DepartmentResponse
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Commit:**

```bash
git add backend/app/schemas/springer_assignment.py
git commit -m "feat: add SpringerAssignment pydantic schemas"
```

---

## Task 4: Repository (TDD)

**Files:**
- Create: `backend/app/repositories/springer_repository.py`
- Test: `backend/tests/api/test_springer_assignments.py` (Teil 1 — Repository-Tests)

- [ ] **Schreibe die Repository-Tests (failing zuerst):**

```python
# backend/tests/api/test_springer_assignments.py
from datetime import date, datetime

import pytest
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.doctor import Doctor
from app.models.plan import Plan
from app.repositories import springer_repository as repo
from app.schemas.springer_assignment import SpringerAssignmentCreate


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def plan(db: Session) -> Plan:
    p = Plan(
        name="Testplan",
        valid_from=date(2026, 1, 1),
        valid_to=date(2026, 1, 31),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def doctor(db: Session) -> Doctor:
    d = Doctor(
        name="Test Arzt",
        short_name="TA",
        active=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def dept_a(db: Session) -> Department:
    d = Department(
        name="Station A",
        short_name="STA",
        active=True,
        display_order=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def dept_b(db: Session) -> Department:
    d = Department(
        name="Station B",
        short_name="STB",
        active=True,
        display_order=2,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


# ── Repository-Tests ──────────────────────────────────────────────────────────

def test_get_by_plan_empty(db: Session, plan: Plan) -> None:
    result = repo.get_by_plan(db, plan.id)
    assert result == []


def test_get_by_plan_nonexistent(db: Session) -> None:
    result = repo.get_by_plan(db, 9999)
    assert result == []


def test_upsert_creates_new(db: Session, plan: Plan, doctor: Doctor, dept_a: Department) -> None:
    data = SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    )
    result = repo.upsert(db, plan.id, data)
    db.commit()

    assert result.id is not None
    assert result.plan_id == plan.id
    assert result.shift_date == date(2026, 1, 15)
    assert result.doctor_id == doctor.id
    assert result.target_department_id == dept_a.id


def test_upsert_updates_existing(
    db: Session, plan: Plan, doctor: Doctor, dept_a: Department, dept_b: Department
) -> None:
    first = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    ))
    db.commit()

    second = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_b.id,
    ))
    db.commit()

    assert second.id == first.id
    assert second.target_department_id == dept_b.id


def test_upsert_two_doctors_same_day(
    db: Session, plan: Plan, dept_a: Department, dept_b: Department
) -> None:
    doctor2 = Doctor(
        name="Arzt B", short_name="AB", active=True,
        created_at=datetime.now(), updated_at=datetime.now(),
    )
    db.add(doctor2)
    db.flush()
    doctor3 = Doctor(
        name="Arzt C", short_name="AC", active=True,
        created_at=datetime.now(), updated_at=datetime.now(),
    )
    db.add(doctor3)
    db.flush()

    repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15), doctor_id=doctor2.id, target_department_id=dept_a.id,
    ))
    repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15), doctor_id=doctor3.id, target_department_id=dept_b.id,
    ))
    db.commit()

    results = repo.get_by_plan(db, plan.id)
    assert len(results) == 2


def test_delete_existing(db: Session, plan: Plan, doctor: Doctor, dept_a: Department) -> None:
    sa = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    ))
    db.commit()

    ok = repo.delete(db, sa.id)
    db.commit()

    assert ok is True
    assert repo.get_by_plan(db, plan.id) == []


def test_delete_nonexistent(db: Session) -> None:
    assert repo.delete(db, 9999) is False
```

- [ ] **Führe Tests aus — müssen FAIL:**

```bash
cd backend && uv run pytest tests/api/test_springer_assignments.py -v 2>&1 | head -30
```

Expected: `ImportError` oder `ModuleNotFoundError` (Repository existiert noch nicht)

- [ ] **Schreibe das Repository:**

```python
# backend/app/repositories/springer_repository.py
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.springer_assignment import SpringerAssignment
from app.schemas.springer_assignment import SpringerAssignmentCreate


def get_by_plan(db: Session, plan_id: int) -> list[SpringerAssignment]:
    return (
        db.query(SpringerAssignment)
        .filter(SpringerAssignment.plan_id == plan_id)
        .order_by(SpringerAssignment.shift_date, SpringerAssignment.doctor_id)
        .all()
    )


def upsert(db: Session, plan_id: int, data: SpringerAssignmentCreate) -> SpringerAssignment:
    existing = (
        db.query(SpringerAssignment)
        .filter(
            SpringerAssignment.plan_id == plan_id,
            SpringerAssignment.shift_date == data.shift_date,
            SpringerAssignment.doctor_id == data.doctor_id,
        )
        .first()
    )
    if existing is not None:
        existing.target_department_id = data.target_department_id
        if data.notes is not None:
            existing.notes = data.notes
        existing.updated_at = datetime.now()
        db.flush()
        db.refresh(existing)
        return existing

    sa = SpringerAssignment(
        plan_id=plan_id,
        shift_date=data.shift_date,
        doctor_id=data.doctor_id,
        target_department_id=data.target_department_id,
        notes=data.notes,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(sa)
    db.flush()
    db.refresh(sa)
    return sa


def delete(db: Session, assignment_id: int) -> bool:
    sa = db.get(SpringerAssignment, assignment_id)
    if sa is None:
        return False
    db.delete(sa)
    db.flush()
    return True
```

- [ ] **Führe Tests aus — müssen PASS:**

```bash
cd backend && uv run pytest tests/api/test_springer_assignments.py -v 2>&1 | tail -20
```

Expected: alle `test_get_by_plan_*`, `test_upsert_*`, `test_delete_*` grün.

- [ ] **Commit:**

```bash
git add backend/app/repositories/springer_repository.py backend/tests/api/test_springer_assignments.py
git commit -m "feat: add SpringerAssignment repository with TDD tests"
```

---

## Task 5: API-Router

**Files:**
- Create: `backend/app/api/springer_assignments.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/api/test_springer_assignments.py` (Teil 2 — API-Tests)

- [ ] **Schreibe den Router:**

```python
# backend/app/api/springer_assignments.py
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import springer_repository as repo
from app.repositories import plan_repository as plan_repo
from app.schemas.springer_assignment import SpringerAssignmentCreate, SpringerAssignmentResponse

plan_springer_router = APIRouter(tags=["springer"])
springer_router = APIRouter(tags=["springer"])


@plan_springer_router.get(
    "/plans/{plan_id}/springer-assignments",
    response_model=list[SpringerAssignmentResponse],
)
def list_springer_assignments(plan_id: int, db: Session = Depends(get_db)) -> list:
    if plan_repo.get_plan(db, plan_id) is None:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    return repo.get_by_plan(db, plan_id)


@plan_springer_router.post(
    "/plans/{plan_id}/springer-assignments",
    response_model=SpringerAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def upsert_springer_assignment(
    plan_id: int,
    body: SpringerAssignmentCreate,
    db: Session = Depends(get_db),
) -> SpringerAssignmentResponse:
    if plan_repo.get_plan(db, plan_id) is None:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    result = repo.upsert(db, plan_id, body)
    db.commit()
    db.refresh(result)
    return result


@springer_router.delete(
    "/springer-assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_springer_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
) -> Response:
    if not repo.delete(db, assignment_id):
        raise HTTPException(status_code=404, detail="Springer-Zuweisung nicht gefunden")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Registriere in `main.py`** — füge nach den letzten `from app.api.` Imports ein:

```python
from app.api.springer_assignments import plan_springer_router, springer_router as springer_assignments_router
```

Und nach `app.include_router(shifts_router, prefix="/api")`:

```python
app.include_router(plan_springer_router, prefix="/api")
app.include_router(springer_assignments_router, prefix="/api")
```

- [ ] **Schreibe die API-Tests** — füge am Ende von `backend/tests/api/test_springer_assignments.py` ein:

```python
# ── API-Tests ────────────────────────────────────────────────────────────────

def _make_plan(client) -> dict:
    r = client.post("/api/plans", json={
        "name": "ApiTestPlan", "valid_from": "2026-01-01", "valid_to": "2026-01-31"
    })
    assert r.status_code in (200, 201)
    return r.json()


def _make_doctor(client) -> dict:
    r = client.post("/api/doctors", json={
        "name": "API Arzt", "short_name": "AA", "active": True
    })
    assert r.status_code in (200, 201)
    return r.json()


def _make_dept(client, name: str, short_name: str) -> dict:
    r = client.post("/api/departments", json={
        "name": name, "short_name": short_name, "active": True, "display_order": 99
    })
    assert r.status_code in (200, 201)
    return r.json()


def test_api_list_empty(client) -> None:
    plan = _make_plan(client)
    r = client.get(f"/api/plans/{plan['id']}/springer-assignments")
    assert r.status_code == 200
    assert r.json() == []


def test_api_list_unknown_plan(client) -> None:
    r = client.get("/api/plans/9999/springer-assignments")
    assert r.status_code == 404


def test_api_upsert_create(client) -> None:
    plan = _make_plan(client)
    doctor = _make_doctor(client)
    dept = _make_dept(client, "IMC API", "IMCA")

    r = client.post(f"/api/plans/{plan['id']}/springer-assignments", json={
        "shift_date": "2026-01-15",
        "doctor_id": doctor["id"],
        "target_department_id": dept["id"],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["doctor_id"] == doctor["id"]
    assert body["target_department"]["id"] == dept["id"]
    assert body["shift_date"] == "2026-01-15"


def test_api_upsert_updates(client) -> None:
    plan = _make_plan(client)
    doctor = _make_doctor(client)
    dept_a = _make_dept(client, "IMC X", "IMX")
    dept_b = _make_dept(client, "NEU X", "NEX")

    r1 = client.post(f"/api/plans/{plan['id']}/springer-assignments", json={
        "shift_date": "2026-01-15", "doctor_id": doctor["id"], "target_department_id": dept_a["id"],
    })
    assert r1.status_code == 200
    id1 = r1.json()["id"]

    r2 = client.post(f"/api/plans/{plan['id']}/springer-assignments", json={
        "shift_date": "2026-01-15", "doctor_id": doctor["id"], "target_department_id": dept_b["id"],
    })
    assert r2.status_code == 200
    assert r2.json()["id"] == id1
    assert r2.json()["target_department"]["id"] == dept_b["id"]


def test_api_delete(client) -> None:
    plan = _make_plan(client)
    doctor = _make_doctor(client)
    dept = _make_dept(client, "DEL Dept", "DEL")

    r_create = client.post(f"/api/plans/{plan['id']}/springer-assignments", json={
        "shift_date": "2026-01-15", "doctor_id": doctor["id"], "target_department_id": dept["id"],
    })
    assert r_create.status_code == 200
    assignment_id = r_create.json()["id"]

    r_del = client.delete(f"/api/springer-assignments/{assignment_id}")
    assert r_del.status_code == 204

    r_list = client.get(f"/api/plans/{plan['id']}/springer-assignments")
    assert r_list.json() == []


def test_api_delete_not_found(client) -> None:
    r = client.delete("/api/springer-assignments/9999")
    assert r.status_code == 404
```

- [ ] **Führe alle Tests aus — müssen PASS:**

```bash
cd backend && uv run pytest tests/api/test_springer_assignments.py -v 2>&1 | tail -30
```

Expected: alle 14 Tests grün.

- [ ] **Commit:**

```bash
git add backend/app/api/springer_assignments.py backend/app/main.py backend/tests/api/test_springer_assignments.py
git commit -m "feat: add springer-assignments API (GET, POST upsert, DELETE)"
```

---

## Task 6: Frontend-Typ & Hook

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/features/plans/useSpringerAssignments.ts`

- [ ] **Füge den Typ in `lib/types.ts` ein** — suche den Block mit anderen Plan-bezogenen Interfaces (z.B. `ShiftWithDetails`) und füge darunter ein:

```ts
export interface SpringerAssignment {
  id: number
  plan_id: number
  shift_date: string        // ISO 8601, z.B. "2026-01-15"
  doctor_id: number
  target_department_id: number
  target_department: Department
  notes?: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Schreibe den Hook:**

```ts
// frontend/src/features/plans/useSpringerAssignments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import type { SpringerAssignment } from '@/lib/types'

export const springerKeys = {
  byPlan: (planId: number) => ['springer-assignments', planId] as const,
}

export function usePlanSpringerAssignments(planId: number | null) {
  return useQuery({
    queryKey: springerKeys.byPlan(planId ?? 0),
    queryFn: () => apiGet<SpringerAssignment[]>(`/api/plans/${planId}/springer-assignments`),
    enabled: planId != null && planId > 0,
  })
}

interface CreateSpringerParams {
  planId: number
  shiftDate: string
  doctorId: number
  targetDepartmentId: number
}

export function useCreateSpringerAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, shiftDate, doctorId, targetDepartmentId }: CreateSpringerParams) =>
      apiPost<SpringerAssignment>(`/api/plans/${planId}/springer-assignments`, {
        shift_date: shiftDate,
        doctor_id: doctorId,
        target_department_id: targetDepartmentId,
      }),
    onSuccess: (_data, { planId }) => {
      queryClient.invalidateQueries({ queryKey: springerKeys.byPlan(planId) })
    },
  })
}

export function useDeleteSpringerAssignment(planId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/springer-assignments/${assignmentId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete fehlgeschlagen')
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: springerKeys.byPlan(planId) })
    },
  })
}
```

- [ ] **TypeScript prüfen:**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: keine neuen Fehler.

- [ ] **Commit:**

```bash
git add frontend/src/lib/types.ts frontend/src/features/plans/useSpringerAssignments.ts
git commit -m "feat: add SpringerAssignment type and TanStack Query hooks"
```

---

## Task 7: Springer-Chip in PlanModeBar

**Files:**
- Modify: `frontend/src/features/plans/components/PlanModeBar.tsx`

- [ ] **Füge `SPRINGER_DRAG_ID` und `SpringerDraggableChip` hinzu:**

Suche in `PlanModeBar.tsx` die Zeile:
```ts
export const NACHTWOCHE_DRAG_ID = 'nachtwoche'
```

Füge direkt **danach** ein:
```ts
export const SPRINGER_DRAG_ID = 'springer'
```

Suche die Funktion `NachtwocheDraggableChip` und füge **direkt danach** eine neue Komponente ein:

```tsx
function SpringerDraggableChip() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: SPRINGER_DRAG_ID,
    data: { springer: true },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title="Springer — auf andere Station einteilen"
      className={cn(
        'inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-bold cursor-grab select-none active:cursor-grabbing border',
        'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
        isDragging && 'opacity-40 cursor-grabbing',
      )}
    >
      Sp
    </div>
  )
}
```

- [ ] **Integriere den Chip in `PlanModeBar`-Render:**

Suche den Block:
```tsx
{mode === 'besetzung' && (
  <>
    <span className="text-line-2 mx-0.5">|</span>
    <NachtwocheDraggableChip nachtShiftType={nachtShiftType} onClick={onNachtwocheClick} />
  </>
)}
```

Füge **direkt danach** ein (vor dem Abwesenheiten-Separator):
```tsx
<span className="text-line-2 mx-0.5">|</span>
<SpringerDraggableChip />
```

Der Abschnitt sieht dann so aus:
```tsx
{mode === 'besetzung' && (
  <>
    <span className="text-line-2 mx-0.5">|</span>
    <NachtwocheDraggableChip nachtShiftType={nachtShiftType} onClick={onNachtwocheClick} />
  </>
)}

<span className="text-line-2 mx-0.5">|</span>
<SpringerDraggableChip />

<span className="text-line-2 mx-0.5">|</span>
<span className="text-[10px] text-ink-3 uppercase tracking-[0.07em]">Abwesenheiten</span>
```

- [ ] **TypeScript prüfen:**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: keine neuen Fehler.

- [ ] **Commit:**

```bash
git add frontend/src/features/plans/components/PlanModeBar.tsx
git commit -m "feat: add SpringerDraggableChip and SPRINGER_DRAG_ID to PlanModeBar"
```

---

## Task 8: SpringerPopover

**Files:**
- Create: `frontend/src/features/plans/components/SpringerPopover.tsx`

- [ ] **Schreibe den Popover:**

```tsx
// frontend/src/features/plans/components/SpringerPopover.tsx
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCreateSpringerAssignment } from '../useSpringerAssignments'
import type { Department } from '@/lib/types'

interface SpringerPopoverProps {
  planId: number
  doctorId: number
  dayKey: string
  currentDepartmentId: number
  departments: Department[]
  onClose: () => void
}

export function SpringerPopover({
  planId,
  doctorId,
  dayKey,
  currentDepartmentId,
  departments,
  onClose,
}: SpringerPopoverProps) {
  const { mutate, isPending } = useCreateSpringerAssignment()
  const cardRef = useRef<HTMLDivElement>(null)

  const availableDepts = departments.filter(
    (d) => d.active && d.id !== currentDepartmentId,
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function assign(dept: Department) {
    mutate(
      { planId, shiftDate: dayKey, doctorId, targetDepartmentId: dept.id },
      {
        onSuccess: () => {
          toast.success(`Springer → ${dept.short_name ?? dept.name}`)
          onClose()
        },
        onError: () => {
          toast.error('Springer-Zuweisung fehlgeschlagen')
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        ref={cardRef}
        className="bg-card border border-line rounded-2xl shadow-xl p-5 min-w-[240px] max-w-xs"
      >
        <p className="text-[13px] font-semibold text-ink mb-1">Springer-Station wählen</p>
        <p className="text-[11px] text-ink-3 mb-3">{dayKey}</p>

        {availableDepts.length === 0 ? (
          <p className="text-[12px] text-ink-3">Keine weiteren Stationen verfügbar.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {availableDepts.map((dept) => (
              <button
                key={dept.id}
                type="button"
                disabled={isPending}
                onClick={() => assign(dept)}
                className="text-left px-3 py-2 rounded-xl text-[12.5px] font-medium text-ink hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-50"
              >
                <span className="font-bold">{dept.short_name ?? '—'}</span>
                <span className="text-ink-3 ml-2">{dept.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **TypeScript prüfen:**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: keine neuen Fehler.

- [ ] **Commit:**

```bash
git add frontend/src/features/plans/components/SpringerPopover.tsx
git commit -m "feat: add SpringerPopover component for department selection"
```

---

## Task 9: UnifiedShiftCell — Split-Cell-Rendering

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

- [ ] **Füge zwei neue Props zur Interface hinzu:**

Suche in `UnifiedShiftCell.tsx` den Interface-Block `interface UnifiedShiftCellProps` und füge vor der abschließenden `}` ein:

```ts
  springerDeptShortName?: string
  springerAssignmentId?: number
  onDoubleClickRemoveSpringer?: (assignmentId: number) => void
```

- [ ] **Füge die Props zur Destrukturierung der Funktion hinzu:**

Suche `export function UnifiedShiftCell({` und füge in der Destrukturierungsliste (vor der abschließenden `}`) hinzu:

```ts
  springerDeptShortName,
  springerAssignmentId,
  onDoubleClickRemoveSpringer,
```

- [ ] **Passe `handleDoubleClick` an:**

Suche die Funktion `handleDoubleClick` und passe sie an, sodass Springer-Delete Vorrang hat wenn kein Shift vorhanden, sonst Springer-Delete wenn vorhanden:

```ts
  function handleDoubleClick() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    // Absence-Delete hat Vorrang
    if (absenceId !== undefined) {
      onDoubleClickRemoveAbsence?.(absenceId)
      return
    }
    // Springer-Delete — immer Vorrang vor Shift (inkl. Split-Cell)
    if (springerAssignmentId !== undefined) {
      onDoubleClickRemoveSpringer?.(springerAssignmentId)
      return
    }
    // Shift-Delete
    if (!shiftAssigned) return
    if (isPinned) {
      toast.info('Gepinnte Schicht — erst entpinnen')
      return
    }
    onDoubleClickRemove?.()
  }
```

- [ ] **Passe die `bg`-Berechnung an:**

Suche den Block:
```ts
  const bg = (() => {
```

Füge ganz am **Anfang** dieser `(() => { ... })()` Expression ein (vor den anderen Checks):

```ts
    // Split-Mode: beide Hälften übernehmen ihr eigenes Bg
    if (springerDeptShortName && text) return 'transparent'
    // Nur Springer (kein regulärer Shift)
    if (springerDeptShortName && !text) return '#d1fae5'  // emerald-100
```

Der vollständige `bg`-Block sieht dann so aus:
```ts
  const bg = (() => {
    // Split-Mode: beide Hälften übernehmen ihr eigenes Bg
    if (springerDeptShortName && text) return 'transparent'
    // Nur Springer (kein regulärer Shift)
    if (springerDeptShortName && !text) return '#d1fae5'  // emerald-100
    if (absenceId !== undefined) {
      const absColor = absenceType && absenceColors?.[absenceType]
      if (absColor) return inRotation ? absColor + '80' : absColor + '40'
      return inRotation ? '#E5E7EB' : '#E5E7EB40'
    }
    if (shiftAssigned) return shiftTypeColorMuted(shiftTypeColor)
    if (inRotation) return '#f4f4f5'
    return `${bereichColor}28`
  })()
```

- [ ] **Passe den return-JSX an — ersetze den inneren Textbereich:**

Suche das aktuelle Textrendering in der return-Anweisung. Es gibt eine `<span>` für Text (etwa so):
```tsx
        <span className="text-[11px] font-bold leading-none pointer-events-none select-none">
          {text || (absenceId !== undefined ? absenceCode(absenceType!) : '')}
        </span>
```

Ersetze es durch folgendes (behält Absence-Text-Logik, fügt Springer-Split hinzu):

```tsx
        {/* Split-Cell: Springer oben, Shift unten */}
        {springerDeptShortName && text ? (
          <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
            <div className="flex-1 flex items-center justify-center bg-emerald-100 text-emerald-800 text-[10px] font-bold leading-none">
              {springerDeptShortName}
            </div>
            <div
              className="flex-1 flex items-center justify-center text-[11px] font-bold leading-none"
              style={{ background: shiftTypeColorMuted(shiftTypeColor) }}
            >
              {text}
            </div>
          </div>
        ) : springerDeptShortName ? (
          <span className="text-[11px] font-bold leading-none pointer-events-none select-none text-emerald-800">
            {springerDeptShortName}
          </span>
        ) : (
          <span className="text-[11px] font-bold leading-none pointer-events-none select-none">
            {text || (absenceId !== undefined ? absenceCode(absenceType!) : '')}
          </span>
        )}
```

- [ ] **TypeScript prüfen:**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: keine neuen Fehler.

- [ ] **Commit:**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "feat: add split-cell rendering for Springer + Shift in UnifiedShiftCell"
```

---

## Task 10: UnifiedPlanGrid — Springer-Daten durchreichen

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`

- [ ] **Füge `springerByKey` zum Interface hinzu:**

Suche `interface UnifiedPlanGridProps` und füge vor der abschließenden `}` ein:

```ts
  springerByKey?: Map<string, { shortName: string; assignmentId: number }>
  onDoubleClickRemoveSpringer?: (assignmentId: number) => void
```

- [ ] **Füge zur Funktions-Destrukturierung hinzu:**

Suche `export function UnifiedPlanGrid({` und ergänze in der Destrukturierungsliste:

```ts
  springerByKey,
  onDoubleClickRemoveSpringer,
```

- [ ] **Lese Springer-Daten in der Zell-Schleife aus:**

Suche in der Zell-Render-Schleife den Block wo `const cell = resolveCell(...)` aufgerufen wird. Füge **direkt nach** dieser Zeile ein:

```ts
                const springerKey = `${row.doctor.id}-${dk}`
                const springer = springerByKey?.get(springerKey)
```

- [ ] **Übergib die Springer-Props an `UnifiedShiftCell`:**

Suche den `<UnifiedShiftCell` JSX-Block und füge **nach den letzten existierenden Props** (vor dem abschließenden `/>`) ein:

```tsx
                    springerDeptShortName={springer?.shortName}
                    springerAssignmentId={springer?.assignmentId}
                    onDoubleClickRemoveSpringer={onDoubleClickRemoveSpringer}
```

- [ ] **TypeScript prüfen:**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: keine neuen Fehler.

- [ ] **Commit:**

```bash
git add frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat: pass springer data through UnifiedPlanGrid to cells"
```

---

## Task 11: PlanPage — Integration

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Füge Imports hinzu** (suche den Bereich mit den anderen Feature-Imports und ergänze):

```ts
import { SPRINGER_DRAG_ID } from './components/PlanModeBar'
import { SpringerPopover } from './components/SpringerPopover'
import {
  usePlanSpringerAssignments,
  useDeleteSpringerAssignment,
  springerKeys,
} from './useSpringerAssignments'
```

**Achtung:** `SPRINGER_DRAG_ID` ist bereits aus `PlanModeBar` exportiert (Task 7) — nicht nochmal definieren.

- [ ] **Füge den Springer-State hinzu:**

Suche den Block mit anderen State-Deklarationen (z.B. `const [multiPopoverOpen, setMultiPopoverOpen] = useState(false)`) und füge hinzu:

```ts
  const [springerPopover, setSpringerPopover] = useState<{
    doctorId: number
    dayKey: string
    currentDepartmentId: number
  } | null>(null)
```

- [ ] **Füge den Springer-Datenabruf hinzu:**

Suche `const { data: absencesRaw = [] } = usePlanAbsences(id)` (oder ähnlich) und füge **direkt danach** ein:

```ts
  const { data: springerAssignmentsRaw = [] } = usePlanSpringerAssignments(id)
  const deleteSpringerAssignment = useDeleteSpringerAssignment(id)
```

- [ ] **Baue die Springer-Map auf:**

Suche den `useMemo`-Block der `tarifWarningsByShift` oder eine ähnliche Daten-Transformation aufbaut. Füge einen neuen `useMemo` hinzu:

```ts
  const springerByKey = useMemo(() => {
    const map = new Map<string, { shortName: string; assignmentId: number }>()
    for (const sa of springerAssignmentsRaw) {
      const key = `${sa.doctor_id}-${sa.shift_date}`
      map.set(key, {
        shortName: sa.target_department.short_name ?? sa.target_department.name,
        assignmentId: sa.id,
      })
    }
    return map
  }, [springerAssignmentsRaw])
```

- [ ] **Ergänze `handleDragStart` für Springer:**

Suche in `handleDragStart`:
```ts
    if (activeId === NACHTWOCHE_DRAG_ID) {
```

Füge **direkt vor** dieser Zeile ein:

```ts
    if (activeId === SPRINGER_DRAG_ID) {
      activeDragTypeRef.current = 'springer'
      return
    }
```

- [ ] **Ergänze `handleDragEnd` für Springer:**

Suche in `handleDragEnd` den Bereich direkt nach der `activeId`-Deklaration (z.B. `const activeId = String(active.id)`). Füge **vor dem NACHTWOCHE-Block** ein:

```ts
    if (activeId === SPRINGER_DRAG_ID) {
      activeDragTypeRef.current = null
      dropsucceededRef.current = false
      if (!over) return
      const cellMatch = String(over.id).match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
      if (!cellMatch) return
      const rotationId = Number(cellMatch[1])
      const dayKey = cellMatch[2]
      const rotation = rotations.find((r) => r.id === rotationId)
      if (!rotation || rotation.doctor_id == null) return
      dropsucceededRef.current = true
      setSpringerPopover({
        doctorId: rotation.doctor_id,
        dayKey,
        currentDepartmentId: rotation.department_id,
      })
      return
    }
```

- [ ] **Übergib Springer-Props an `UnifiedPlanGrid`:**

Suche `<UnifiedPlanGrid` in PlanPage und füge neue Props hinzu:

```tsx
              springerByKey={springerByKey}
              onDoubleClickRemoveSpringer={(assignmentId) => {
                deleteSpringerAssignment.mutate(assignmentId, {
                  onSuccess: () => toast.success('Springer-Zuweisung entfernt'),
                  onError: () => toast.error('Fehler beim Entfernen'),
                })
              }}
```

- [ ] **Rendere `SpringerPopover` im JSX-Baum:**

Suche den Block wo `<DoctorAssignPopover` und `<AbsenceAssignPopover` gerendert werden (ca. Zeile 1149-1195). Füge **am Ende dieses Blocks** ein:

```tsx
        {springerPopover && (
          <SpringerPopover
            planId={id}
            doctorId={springerPopover.doctorId}
            dayKey={springerPopover.dayKey}
            currentDepartmentId={springerPopover.currentDepartmentId}
            departments={departments}
            onClose={() => setSpringerPopover(null)}
          />
        )}
```

- [ ] **TypeScript prüfen:**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: keine Fehler.

- [ ] **Commit:**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat: integrate Springer drag-drop flow in PlanPage"
```

---

## Task 12: End-to-End-Test im Browser

- [ ] **Backend starten:**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000
```

- [ ] **Frontend starten:**

```bash
cd frontend && pnpm dev
```

- [ ] **Testen — Springer-Chip sichtbar:**
  - Öffne `http://localhost:5173`
  - Navigiere zu einem Plan mit Rotationen
  - Prüfe: In der PlanModeBar erscheint ein grüner `Sp`-Chip zwischen den Dienst-Chips und dem `|`-Abwesenheiten-Separator

- [ ] **Testen — Springer zuweisen:**
  - Ziehe den `Sp`-Chip auf eine Zelle eines Arztes mit Rotation
  - Prüfe: `SpringerPopover` öffnet sich und zeigt alle Stationen **außer** der aktuellen Rotation des Arztes
  - Wähle eine Station
  - Prüfe: Toast „Springer → [Kürzel]" erscheint
  - Prüfe: Zelle zeigt das Stationskürzel in Emerald-Grün

- [ ] **Testen — Split-Cell:**
  - Weise einem Arzt an einem Tag SOWOHL Springer (via `Sp`-Chip) als auch einen regulären Dienst (via N/V/T-Chip) zu
  - Prüfe: Zelle ist vertikal geteilt — oben Stationskürzel grün, unten Dienst-Code in Dienst-Farbe

- [ ] **Testen — Springer entfernen:**
  - Doppelklick auf eine reine Springer-Zelle
  - Prüfe: Springer-Zuweisung wird entfernt, Zelle leert sich

- [ ] **Testen — Mehrere Springer am selben Tag:**
  - Weise zwei verschiedenen Ärzten an demselben Tag Springer zu
  - Prüfe: Beide Zellen zeigen korrekt ihre Ziel-Station
  - Prüfe: Kein Backend-Fehler (UNIQUE greift nur pro Arzt)

- [ ] **Testen — Upsert:**
  - Weise einem Arzt Springer auf Station A zu
  - Ziehe erneut `Sp` auf dieselbe Zelle, wähle Station B
  - Prüfe: Zelle zeigt jetzt Station B (kein Duplikat)

- [ ] **Commit (falls noch offene Änderungen):**

```bash
git add -A
git commit -m "feat: Springer-Zuweisung komplett (Milestone abgeschlossen)"
```

---

## Vollständige Backend-Test-Suite

Führe am Ende alle Backend-Tests aus:

```bash
cd backend && uv run pytest -v 2>&1 | tail -20
```

Expected: alle Tests grün, keine Regressions.
