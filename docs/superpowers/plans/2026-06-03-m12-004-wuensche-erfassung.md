# M12-004 Wünsche-Erfassung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollständige Wunsch-CRUD (drei Sub-Typen: Datumswunsch, Wochentag-Präferenz, Allgemeine Präferenz) mit arzt-seitiger Verwaltung in DoctorDetailPage und Grid-Hint-Layer im PlanPage.

**Architecture:** Schema-Erweiterung (`wish_date` nullable + `day_of_week: int | None`) für wiederkehrende Wünsche; REST-API unter `/api/doctors/{id}/wishes` und `/api/plans/{id}/wishes`; Frontend split zwischen DoctorDetailPage (dauerhafte Wünsche) und PlanPage (Grid-Hint-Layer + Schnellerfassung via Zell-Hover). Hint-Layer zeigt Amber-Ring (AVOID) oder Grün-Ring (REQUIRE) in UnifiedShiftCell, über Toggle-Button ein-/ausblendbar.

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy / Alembic; React 18 / TypeScript / TanStack Query / Zod / react-hook-form / shadcn/ui; pytest / vitest

---

## File Map

### Neue Backend-Dateien
- `backend/alembic/versions/0015_wish_date_nullable_day_of_week.py`
- `backend/app/repositories/wish_repository.py`
- `backend/app/services/wish_service.py`
- `backend/app/api/wishes.py`
- `backend/tests/api/test_wishes_api.py`
- `backend/tests/services/test_wish_repository.py`
- `backend/tests/services/test_wish_service.py`

### Modifizierte Backend-Dateien
- `backend/app/models/wish.py` — wish_date nullable, day_of_week, CheckConstraints
- `backend/app/schemas/wish.py` — WishCreateBody, aktualisierte Validatoren
- `backend/app/services/exceptions.py` — WishNotFoundError
- `backend/app/api/error_handlers.py` — Handler für WishNotFoundError
- `backend/app/main.py` — Router registrieren

### Neue Frontend-Dateien
- `frontend/src/features/doctors/useWishes.ts`
- `frontend/src/features/doctors/WishFormDialog.tsx`
- `frontend/src/features/doctors/WishList.tsx`
- `frontend/src/features/doctors/tests/WishFormDialog.test.tsx`
- `frontend/src/features/doctors/tests/WishList.test.tsx`
- `frontend/src/features/plans/useWishes.ts`
- `frontend/src/features/plans/wishGridUtils.ts`
- `frontend/src/features/plans/tests/wishGridUtils.test.ts`

### Modifizierte Frontend-Dateien
- `frontend/src/lib/types.ts` — Wish, WishCreateBody, WishUpdate, WishType
- `frontend/src/features/doctors/DoctorDetailPage.tsx` — Tab 'wuensche'
- `frontend/src/features/plans/components/UnifiedShiftCell.tsx` — wishHint, hover-Icon
- `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` — wishes-Props
- `frontend/src/features/plans/PlanPage.tsx` — usePlanWishes, showWishes, Toggle

---

## Task A: Schema-Erweiterung + Migration

**Files:**
- Modify: `backend/app/models/wish.py`
- Modify: `backend/app/schemas/wish.py`
- Create: `backend/alembic/versions/0015_wish_date_nullable_day_of_week.py`

- [ ] **A1: models/wish.py ersetzen**

```python
import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WishType(enum.StrEnum):
    AVOID_DAY = "AVOID_DAY"
    AVOID_SHIFT = "AVOID_SHIFT"
    REQUIRE_SHIFT = "REQUIRE_SHIFT"


class Wish(Base):
    __tablename__ = "wishes"

    __table_args__ = (
        CheckConstraint("priority >= 1 AND priority <= 3", name="ck_wishes_priority_range"),
        CheckConstraint(
            "NOT (wish_date IS NOT NULL AND day_of_week IS NOT NULL)",
            name="ck_wishes_not_both_date_and_weekday",
        ),
        CheckConstraint(
            "day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)",
            name="ck_wishes_day_of_week_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    wish_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    wish_type: Mapped[WishType] = mapped_column(
        Enum(WishType, native_enum=False, length=50), nullable=False
    )
    shift_type_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("shift_types.id", ondelete="SET NULL"), nullable=True
    )
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    doctor: Mapped["Doctor"] = relationship("Doctor")  # noqa: F821
    shift_type: Mapped["ShiftType | None"] = relationship("ShiftType")  # noqa: F821
```

- [ ] **A2: schemas/wish.py ersetzen**

```python
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.wish import WishType


def _validate_wish_fields(
    wish_date: date | None,
    day_of_week: int | None,
    wish_type: WishType,
    shift_type_id: int | None,
) -> None:
    if wish_date is not None and day_of_week is not None:
        raise ValueError("wish_date und day_of_week dürfen nicht gleichzeitig gesetzt sein")
    if wish_type == WishType.AVOID_DAY and shift_type_id is not None:
        raise ValueError("AVOID_DAY darf keine shift_type_id haben")
    if wish_type in (WishType.AVOID_SHIFT, WishType.REQUIRE_SHIFT) and shift_type_id is None:
        raise ValueError("AVOID_SHIFT und REQUIRE_SHIFT erfordern eine shift_type_id")


class WishBase(BaseModel):
    doctor_id: int
    wish_date: date | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    wish_type: WishType
    shift_type_id: int | None = None
    priority: int = Field(default=1, ge=1, le=3)
    notes: str | None = None


class WishCreate(WishBase):
    @model_validator(mode="after")
    def check_consistency(self) -> WishCreate:
        _validate_wish_fields(self.wish_date, self.day_of_week, self.wish_type, self.shift_type_id)
        return self


class WishCreateBody(BaseModel):
    """Request body — doctor_id wird aus URL-Pfad injiziert."""
    wish_date: date | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    wish_type: WishType
    shift_type_id: int | None = None
    priority: int = Field(default=1, ge=1, le=3)
    notes: str | None = None

    @model_validator(mode="after")
    def check_consistency(self) -> WishCreateBody:
        _validate_wish_fields(self.wish_date, self.day_of_week, self.wish_type, self.shift_type_id)
        return self


class WishUpdate(BaseModel):
    wish_date: date | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    wish_type: WishType | None = None
    shift_type_id: int | None = None
    priority: int | None = Field(default=None, ge=1, le=3)
    notes: str | None = None


class WishResponse(WishBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **A3: Migration 0015 erstellen**

```python
"""wish_date nullable, day_of_week hinzugefügt

Revision ID: 0015
Revises: 0014
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("wishes") as batch_op:
        batch_op.alter_column("wish_date", existing_type=sa.Date(), nullable=True)
        batch_op.add_column(sa.Column("day_of_week", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("wishes") as batch_op:
        batch_op.drop_column("day_of_week")
        batch_op.alter_column("wish_date", existing_type=sa.Date(), nullable=False)
```

- [ ] **A4: Migration ausführen**

```bash
cd backend && uv run alembic upgrade head
```

Expected: `Running upgrade 0014 -> 0015`

- [ ] **A5: Schema-Validierung manuell prüfen**

```bash
cd backend && uv run python -c "
from app.schemas.wish import WishCreateBody
from app.models.wish import WishType
try:
    WishCreateBody(wish_date='2026-03-15', day_of_week=4, wish_type='AVOID_DAY')
    print('FAIL')
except Exception as e:
    print('OK: both set rejected:', e)
WishCreateBody(wish_date='2026-03-15', wish_type='AVOID_DAY')
print('OK: date-specific AVOID_DAY')
WishCreateBody(day_of_week=4, wish_type='AVOID_SHIFT', shift_type_id=1)
print('OK: weekday AVOID_SHIFT')
WishCreateBody(wish_type='REQUIRE_SHIFT', shift_type_id=1)
print('OK: general REQUIRE_SHIFT')
"
```

Expected: alle vier Zeilen `OK:`

- [ ] **A6: Commit**

```bash
git add backend/app/models/wish.py backend/app/schemas/wish.py backend/alembic/versions/0015_wish_date_nullable_day_of_week.py
git commit -m "feat(M12-004): Wish-Schema — wish_date nullable, day_of_week, WishCreateBody"
```

---

## Task B: Repository

**Files:**
- Create: `backend/app/repositories/wish_repository.py`
- Create: `backend/tests/services/test_wish_repository.py`

- [ ] **B1: Failing Tests schreiben**

Erstelle `backend/tests/services/test_wish_repository.py`:

```python
from datetime import date
import pytest
from app.repositories import wish_repository as repo
from app.models.wish import Wish, WishType


def _make_doctor(db):
    from app.models.doctor import Doctor, DoctorType
    d = Doctor(name="Test Arzt", short_name="TA", doctor_type=DoctorType.OBERARZT, active=True)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def _make_plan(db, valid_from=date(2026, 3, 1), valid_to=date(2026, 3, 31)):
    from app.models.plan import Plan, PlanStatus
    p = Plan(name="TestPlan", valid_from=valid_from, valid_to=valid_to, status=PlanStatus.DRAFT)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_rotation(db, plan_id, doctor_id):
    from app.models.rotation_assignment import RotationAssignment
    from app.models.department import Department
    dept = Department(name="INA", display_order=99)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    r = RotationAssignment(
        plan_id=plan_id, doctor_id=doctor_id, department_id=dept.id,
        valid_from=date(2026, 3, 1), valid_to=date(2026, 3, 31),
    )
    db.add(r)
    db.commit()


def _make_wish(db, doctor_id, wish_date=None, day_of_week=None,
               wish_type=WishType.AVOID_DAY, shift_type_id=None):
    w = Wish(
        doctor_id=doctor_id, wish_date=wish_date, day_of_week=day_of_week,
        wish_type=wish_type, shift_type_id=shift_type_id, priority=1,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


def test_get_by_doctor_returns_only_that_doctor(db):
    d1 = _make_doctor(db)
    d2 = _make_doctor(db)
    _make_wish(db, d1.id, wish_date=date(2026, 3, 15))
    _make_wish(db, d2.id, wish_date=date(2026, 3, 16))
    result = repo.get_wishes_by_doctor(db, d1.id)
    assert len(result) == 1
    assert result[0].doctor_id == d1.id


def test_get_for_plan_period_date_in_range(db):
    d = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d.id)
    _make_wish(db, d.id, wish_date=date(2026, 3, 15))   # in range
    _make_wish(db, d.id, wish_date=date(2026, 4, 1))    # out of range
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 1
    assert result[0].wish_date == date(2026, 3, 15)


def test_get_for_plan_period_weekday_always_included(db):
    d = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d.id)
    _make_wish(db, d.id, day_of_week=4)
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 1


def test_get_for_plan_period_general_always_included(db):
    d = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d.id)
    _make_wish(db, d.id)  # wish_date=None, day_of_week=None
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 1


def test_get_for_plan_period_doctor_without_rotation_excluded(db):
    d_in = _make_doctor(db)
    d_out = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d_in.id)
    _make_wish(db, d_out.id, wish_date=date(2026, 3, 10))
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 0


def test_delete_returns_true_when_found(db):
    d = _make_doctor(db)
    w = _make_wish(db, d.id, wish_date=date(2026, 3, 15))
    ok = repo.delete_wish(db, w.id)
    assert ok is True
    db.commit()
    assert db.get(Wish, w.id) is None


def test_delete_returns_false_when_not_found(db):
    assert repo.delete_wish(db, 99999) is False
```

- [ ] **B2: Tests ausführen — Fehler bestätigen**

```bash
cd backend && uv run pytest tests/services/test_wish_repository.py -v 2>&1 | head -20
```

Expected: `ERROR` (Modul existiert noch nicht)

- [ ] **B3: wish_repository.py erstellen**

```python
# backend/app/repositories/wish_repository.py
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.models.wish import Wish


def get_wish(db: Session, wish_id: int) -> Wish | None:
    return db.get(Wish, wish_id)


def get_wishes_by_doctor(db: Session, doctor_id: int) -> list[Wish]:
    return (
        db.query(Wish)
        .filter(Wish.doctor_id == doctor_id)
        .order_by(Wish.wish_date.asc().nullslast(), Wish.id.asc())
        .all()
    )


def get_wishes_for_plan_period(db: Session, plan_id: int) -> list[Wish]:
    from app.repositories import plan_repository as plan_repo
    from app.models.rotation_assignment import RotationAssignment

    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        return []

    doctor_ids = [
        row[0]
        for row in db.query(RotationAssignment.doctor_id)
        .filter(RotationAssignment.plan_id == plan_id)
        .distinct()
        .all()
    ]
    if not doctor_ids:
        return []

    return (
        db.query(Wish)
        .filter(
            Wish.doctor_id.in_(doctor_ids),
            or_(
                and_(
                    Wish.wish_date.isnot(None),
                    Wish.wish_date >= plan.valid_from,
                    Wish.wish_date <= plan.valid_to,
                ),
                Wish.day_of_week.isnot(None),
                and_(Wish.wish_date.is_(None), Wish.day_of_week.is_(None)),
            ),
        )
        .all()
    )


def create_wish(db: Session, doctor_id: int, data: dict) -> Wish:
    w = Wish(doctor_id=doctor_id, **data)
    db.add(w)
    return w


def update_wish(db: Session, wish_id: int, data: dict) -> Wish | None:
    w = db.get(Wish, wish_id)
    if w is None:
        return None
    for k, v in data.items():
        setattr(w, k, v)
    return w


def delete_wish(db: Session, wish_id: int) -> bool:
    w = db.get(Wish, wish_id)
    if w is None:
        return False
    db.delete(w)
    return True
```

- [ ] **B4: Tests grün**

```bash
cd backend && uv run pytest tests/services/test_wish_repository.py -v
```

Expected: `7 passed`

- [ ] **B5: Commit**

```bash
git add backend/app/repositories/wish_repository.py backend/tests/services/test_wish_repository.py
git commit -m "feat(M12-004): wish_repository — CRUD + plan-period query"
```

---

## Task C: Service + Exceptions

**Files:**
- Modify: `backend/app/services/exceptions.py`
- Create: `backend/app/services/wish_service.py`
- Create: `backend/tests/services/test_wish_service.py`

- [ ] **C1: Exceptions anhängen**

Füge ans Ende von `backend/app/services/exceptions.py` an:

```python
class WishNotFoundError(Exception):
    def __init__(self, wish_id: int) -> None:
        super().__init__(f"Wunsch mit ID {wish_id} nicht gefunden")
        self.wish_id = wish_id
```

- [ ] **C2: Schema-Validierungstests schreiben**

Erstelle `backend/tests/services/test_wish_service.py`:

```python
import pytest
from datetime import date
from pydantic import ValidationError
from app.schemas.wish import WishCreateBody
from app.models.wish import WishType


def test_avoid_day_with_shift_type_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(wish_date=date(2026, 3, 15), wish_type=WishType.AVOID_DAY, shift_type_id=1)


def test_avoid_shift_without_shift_type_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(wish_date=date(2026, 3, 15), wish_type=WishType.AVOID_SHIFT)


def test_require_shift_without_shift_type_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(day_of_week=4, wish_type=WishType.REQUIRE_SHIFT)


def test_both_date_and_day_of_week_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(wish_date=date(2026, 3, 15), day_of_week=4, wish_type=WishType.AVOID_DAY)


def test_valid_date_avoid_day():
    w = WishCreateBody(wish_date=date(2026, 3, 15), wish_type=WishType.AVOID_DAY)
    assert w.wish_date == date(2026, 3, 15)
    assert w.day_of_week is None


def test_valid_weekday_avoid_shift():
    w = WishCreateBody(day_of_week=4, wish_type=WishType.AVOID_SHIFT, shift_type_id=1)
    assert w.day_of_week == 4
    assert w.wish_date is None


def test_valid_general_require_shift():
    w = WishCreateBody(wish_type=WishType.REQUIRE_SHIFT, shift_type_id=2)
    assert w.wish_date is None
    assert w.day_of_week is None
```

- [ ] **C3: Tests ausführen — Fehler bestätigen**

```bash
cd backend && uv run pytest tests/services/test_wish_service.py -v 2>&1 | head -20
```

- [ ] **C4: wish_service.py erstellen**

```python
# backend/app/services/wish_service.py
from sqlalchemy.orm import Session

from app.models.wish import Wish
from app.repositories import wish_repository as repo
from app.services.exceptions import WishNotFoundError


def get_wishes_by_doctor(db: Session, doctor_id: int) -> list[Wish]:
    return repo.get_wishes_by_doctor(db, doctor_id)


def get_wishes_for_plan_period(db: Session, plan_id: int) -> list[Wish]:
    return repo.get_wishes_for_plan_period(db, plan_id)


def create_wish(db: Session, doctor_id: int, data: dict) -> Wish:
    w = repo.create_wish(db, doctor_id, data)
    db.commit()
    db.refresh(w)
    return w


def update_wish(db: Session, wish_id: int, data: dict) -> Wish:
    w = repo.update_wish(db, wish_id, data)
    if w is None:
        raise WishNotFoundError(wish_id)
    db.commit()
    db.refresh(w)
    return w


def delete_wish(db: Session, wish_id: int) -> None:
    ok = repo.delete_wish(db, wish_id)
    if not ok:
        raise WishNotFoundError(wish_id)
    db.commit()
```

- [ ] **C5: Tests grün**

```bash
cd backend && uv run pytest tests/services/test_wish_service.py -v
```

Expected: `7 passed`

- [ ] **C6: Commit**

```bash
git add backend/app/services/exceptions.py backend/app/services/wish_service.py backend/tests/services/test_wish_service.py
git commit -m "feat(M12-004): wish_service + WishNotFoundError"
```

---

## Task D: API + Routing

**Files:**
- Create: `backend/app/api/wishes.py`
- Modify: `backend/app/api/error_handlers.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_wishes_api.py`

- [ ] **D1: Failing API-Tests schreiben**

Erstelle `backend/tests/api/test_wishes_api.py`:

```python
import pytest


def _make_doctor(client):
    resp = client.post("/api/doctors", json={
        "name": "Dr. Test", "short_name": "DT",
        "doctor_type": "OBERARZT", "active": True,
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


def test_plan_wishes_returns_only_in_period(client):
    from datetime import date
    doc_id = _make_doctor(client)
    plan = client.post("/api/plans", json={
        "name": "März 2026", "valid_from": "2026-03-01", "valid_to": "2026-03-31",
    }).json()
    plan_id = plan["id"]

    depts = client.get("/api/departments").json()
    if not depts:
        pytest.skip("keine Departments vorhanden")
    client.post(f"/api/plans/{plan_id}/rotations", json={
        "doctor_id": doc_id, "department_id": depts[0]["id"],
        "valid_from": "2026-03-01", "valid_to": "2026-03-31",
    })
    client.post(f"/api/doctors/{doc_id}/wishes",
                json={"wish_date": "2026-03-15", "wish_type": "AVOID_DAY"})
    client.post(f"/api/doctors/{doc_id}/wishes",
                json={"wish_date": "2026-04-01", "wish_type": "AVOID_DAY"})

    resp = client.get(f"/api/plans/{plan_id}/wishes")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["wish_date"] == "2026-03-15"


def test_plan_wishes_404_unknown_plan(client):
    resp = client.get("/api/plans/99999/wishes")
    assert resp.status_code == 404
```

- [ ] **D2: Tests ausführen — Fehler bestätigen**

```bash
cd backend && uv run pytest tests/api/test_wishes_api.py -v 2>&1 | head -20
```

Expected: `ERRORS` (Route existiert noch nicht)

- [ ] **D3: api/wishes.py erstellen**

```python
# backend/app/api/wishes.py
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import doctor_repository as doctor_repo
from app.repositories import plan_repository as plan_repo
from app.schemas.wish import WishCreateBody, WishResponse, WishUpdate
from app.services import wish_service
from app.services.exceptions import DoctorNotFoundError, PlanNotFoundError, WishNotFoundError

doctor_wishes_router = APIRouter(tags=["wishes"])
wishes_router = APIRouter(tags=["wishes"])
plan_wishes_router = APIRouter(tags=["wishes"])


@doctor_wishes_router.get("/doctors/{doctor_id}/wishes", response_model=list[WishResponse])
def list_wishes(doctor_id: int, db: Session = Depends(get_db)) -> list:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    return wish_service.get_wishes_by_doctor(db, doctor_id)


@doctor_wishes_router.post(
    "/doctors/{doctor_id}/wishes",
    response_model=WishResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wish(doctor_id: int, body: WishCreateBody, db: Session = Depends(get_db)) -> WishResponse:
    if doctor_repo.get_doctor(db, doctor_id) is None:
        raise DoctorNotFoundError(doctor_id)
    return wish_service.create_wish(db, doctor_id, body.model_dump())


@wishes_router.patch("/wishes/{wish_id}", response_model=WishResponse)
def update_wish(wish_id: int, body: WishUpdate, db: Session = Depends(get_db)) -> WishResponse:
    return wish_service.update_wish(db, wish_id, body.model_dump(exclude_unset=True))


@wishes_router.delete("/wishes/{wish_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wish(wish_id: int, db: Session = Depends(get_db)) -> Response:
    wish_service.delete_wish(db, wish_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@plan_wishes_router.get("/plans/{plan_id}/wishes", response_model=list[WishResponse])
def list_plan_wishes(plan_id: int, db: Session = Depends(get_db)) -> list:
    if plan_repo.get_plan(db, plan_id) is None:
        raise PlanNotFoundError(plan_id)
    return wish_service.get_wishes_for_plan_period(db, plan_id)
```

- [ ] **D4: Error-Handler registrieren**

In `backend/app/api/error_handlers.py`:

1. Import ergänzen — `WishNotFoundError` zur Import-Liste am Dateianfang hinzufügen.

2. Innerhalb `register_error_handlers` anfügen:

```python
    @app.exception_handler(WishNotFoundError)
    async def wish_not_found(_: Request, exc: WishNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})
```

- [ ] **D5: Router in main.py registrieren**

In `backend/app/main.py`:

1. Import hinzufügen:
```python
from app.api.wishes import doctor_wishes_router, wishes_router, plan_wishes_router
```

2. Drei `include_router`-Zeilen nach `holidays_router`:
```python
app.include_router(doctor_wishes_router, prefix="/api")
app.include_router(wishes_router, prefix="/api")
app.include_router(plan_wishes_router, prefix="/api")
```

- [ ] **D6: Tests grün**

```bash
cd backend && uv run pytest tests/api/test_wishes_api.py -v
```

Expected: `≥11 passed`

- [ ] **D7: Vollständige Backend-Suite**

```bash
cd backend && uv run pytest -q 2>&1 | tail -5
```

Expected: keine neuen Fehler

- [ ] **D8: Commit**

```bash
git add backend/app/api/wishes.py backend/app/api/error_handlers.py backend/app/main.py backend/tests/api/test_wishes_api.py
git commit -m "feat(M12-004): wishes REST-API — CRUD + plan-period endpoint"
```

---

## Task E: Frontend Types

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **E1: Wish-Typen anhängen**

Am Ende von `frontend/src/lib/types.ts` anfügen:

```typescript
// Wish (M12-004) — manuell, OpenAPI-Generator läuft nicht auf Feature-Branches
export type WishType = 'AVOID_DAY' | 'AVOID_SHIFT' | 'REQUIRE_SHIFT'

export interface Wish {
  id: number
  doctor_id: number
  wish_date: string | null   // ISO "YYYY-MM-DD" oder null
  day_of_week: number | null // 0=Mo…6=So (Python weekday())
  wish_type: WishType
  shift_type_id: number | null
  priority: number           // 1–3
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WishCreateBody {
  wish_date?: string | null
  day_of_week?: number | null
  wish_type: WishType
  shift_type_id?: number | null
  priority?: number
  notes?: string | null
}

export interface WishUpdate {
  wish_date?: string | null
  day_of_week?: number | null
  wish_type?: WishType
  shift_type_id?: number | null
  priority?: number | null
  notes?: string | null
}
```

- [ ] **E2: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: keine Fehler

- [ ] **E3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat(M12-004): Wish TypeScript-Typen"
```

---

## Task F: Doctor-scoped Hooks

**Files:**
- Create: `frontend/src/features/doctors/useWishes.ts`

- [ ] **F1: useWishes.ts erstellen**

```typescript
// frontend/src/features/doctors/useWishes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { Wish, WishCreateBody, WishUpdate } from '@/lib/types'

export const wishKeys = {
  byDoctor: (doctorId: number) => ['wishes', 'doctor', doctorId] as const,
}

export function useWishesByDoctor(doctorId: number) {
  return useQuery({
    queryKey: wishKeys.byDoctor(doctorId),
    queryFn: () => apiGet<Wish[]>(`/api/doctors/${doctorId}/wishes`),
  })
}

export function useCreateWish(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WishCreateBody) =>
      apiPost<Wish>(`/api/doctors/${doctorId}/wishes`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wishKeys.byDoctor(doctorId) })
    },
  })
}

export function useUpdateWish(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: WishUpdate }) =>
      apiPatch<Wish>(`/api/wishes/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wishKeys.byDoctor(doctorId) })
    },
  })
}

export function useDeleteWish(doctorId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/wishes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wishKeys.byDoctor(doctorId) })
    },
  })
}
```

- [ ] **F2: TypeScript-Check + Commit**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
git add frontend/src/features/doctors/useWishes.ts
git commit -m "feat(M12-004): useWishes doctor-scoped hooks"
```

---

## Task G: WishFormDialog

**Files:**
- Create: `frontend/src/features/doctors/WishFormDialog.tsx`
- Create: `frontend/src/features/doctors/tests/WishFormDialog.test.tsx`

- [ ] **G1: Failing Tests schreiben**

Erstelle `frontend/src/features/doctors/tests/WishFormDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WishFormDialog } from '../WishFormDialog'

vi.mock('../useWishes', () => ({
  useCreateWish: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateWish: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/shift-types/useShiftTypes', () => ({
  useShiftTypes: () => ({ data: [{ id: 1, name: 'Nachtdienst', short_name: 'N' }] }),
}))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

const defaultProps = { open: true, onOpenChange: vi.fn(), doctorId: 1 }

describe('WishFormDialog', () => {
  it('shows date input by default (Konkretes Datum)', () => {
    render(<WishFormDialog {...defaultProps} />)
    expect(screen.getByLabelText(/datum/i)).toBeInTheDocument()
  })

  it('switches to weekday select when Wochentag selected', async () => {
    render(<WishFormDialog {...defaultProps} />)
    await userEvent.click(screen.getByLabelText(/wochentag/i))
    expect(screen.queryByLabelText(/^datum/i)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /wochentag/i })).toBeInTheDocument()
  })

  it('hides date and weekday when Allgemein selected', async () => {
    render(<WishFormDialog {...defaultProps} />)
    await userEvent.click(screen.getByLabelText(/allgemein/i))
    expect(screen.queryByLabelText(/^datum/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /wochentag/i })).not.toBeInTheDocument()
  })

  it('shows shift type select for AVOID_SHIFT', async () => {
    render(<WishFormDialog {...defaultProps} />)
    // WishType-Select ist erster combobox; Wert auf AVOID_SHIFT setzen
    const selects = screen.getAllByRole('combobox')
    await userEvent.click(selects[0])
    await userEvent.click(screen.getByText('Dienst vermeiden'))
    expect(screen.getByLabelText(/schichttyp/i)).toBeInTheDocument()
  })

  it('hides shift type select for AVOID_DAY', () => {
    render(<WishFormDialog {...defaultProps} />)
    expect(screen.queryByLabelText(/schichttyp/i)).not.toBeInTheDocument()
  })

  it('prefills date and hides sub-type radio when prefilledDate provided', () => {
    render(<WishFormDialog {...defaultProps} prefilledDate="2026-03-15" />)
    const dateInput = screen.getByLabelText(/datum/i) as HTMLInputElement
    expect(dateInput.value).toBe('2026-03-15')
    // Sub-type-Radios nicht sichtbar
    expect(screen.queryByLabelText(/wochentag/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/allgemein/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **G2: Tests ausführen — Fehler bestätigen**

```bash
cd frontend && pnpm test features/doctors/tests/WishFormDialog.test.tsx --run 2>&1 | tail -10
```

- [ ] **G3: WishFormDialog.tsx erstellen**

```typescript
// frontend/src/features/doctors/WishFormDialog.tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { useCreateWish, useUpdateWish } from './useWishes'
import { useShiftTypes } from '@/features/shift-types/useShiftTypes'
import type { Wish, WishType } from '@/lib/types'

type SubType = 'date' | 'weekday' | 'general'

const WISH_TYPE_LABELS: Record<WishType, string> = {
  AVOID_DAY: 'Tag vermeiden',
  AVOID_SHIFT: 'Dienst vermeiden',
  REQUIRE_SHIFT: 'Dienst wünschen',
}

const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

const schema = z.object({
  subType: z.enum(['date', 'weekday', 'general']),
  wish_date: z.string().nullable().optional(),
  day_of_week: z.number().min(0).max(6).nullable().optional(),
  wish_type: z.enum(['AVOID_DAY', 'AVOID_SHIFT', 'REQUIRE_SHIFT']),
  shift_type_id: z.number().nullable().optional(),
  priority: z.number().min(1).max(3),
  notes: z.string().nullable().optional(),
}).refine(
  (d) => d.subType !== 'date' || !!d.wish_date,
  { message: 'Datum ist erforderlich', path: ['wish_date'] },
).refine(
  (d) => d.subType !== 'weekday' || d.day_of_week != null,
  { message: 'Wochentag ist erforderlich', path: ['day_of_week'] },
).refine(
  (d) => (d.wish_type !== 'AVOID_SHIFT' && d.wish_type !== 'REQUIRE_SHIFT') || !!d.shift_type_id,
  { message: 'Schichttyp ist erforderlich', path: ['shift_type_id'] },
)

type FormValues = z.infer<typeof schema>

interface WishFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctorId: number
  wish?: Wish
  prefilledDate?: string
}

export function WishFormDialog({ open, onOpenChange, doctorId, wish, prefilledDate }: WishFormDialogProps) {
  const createMutation = useCreateWish(doctorId)
  const updateMutation = useUpdateWish(doctorId)
  const { data: shiftTypes = [] } = useShiftTypes()

  const defaultSubType = (): SubType => {
    if (prefilledDate) return 'date'
    if (wish?.wish_date) return 'date'
    if (wish?.day_of_week != null) return 'weekday'
    if (wish) return 'general'
    return 'date'
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subType: defaultSubType(),
      wish_date: wish?.wish_date ?? prefilledDate ?? '',
      day_of_week: wish?.day_of_week ?? null,
      wish_type: wish?.wish_type ?? 'AVOID_DAY',
      shift_type_id: wish?.shift_type_id ?? null,
      priority: wish?.priority ?? 1,
      notes: wish?.notes ?? null,
    },
  })

  const subType = form.watch('subType')
  const wishType = form.watch('wish_type')
  const needsShiftType = wishType === 'AVOID_SHIFT' || wishType === 'REQUIRE_SHIFT'

  useEffect(() => {
    if (open) {
      form.reset({
        subType: defaultSubType(),
        wish_date: wish?.wish_date ?? prefilledDate ?? '',
        day_of_week: wish?.day_of_week ?? null,
        wish_type: wish?.wish_type ?? 'AVOID_DAY',
        shift_type_id: wish?.shift_type_id ?? null,
        priority: wish?.priority ?? 1,
        notes: wish?.notes ?? null,
      })
    }
  }, [open, wish, prefilledDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (values: FormValues) => {
    const payload = {
      wish_date: values.subType === 'date' ? (values.wish_date || null) : null,
      day_of_week: values.subType === 'weekday' ? values.day_of_week : null,
      wish_type: values.wish_type,
      shift_type_id: needsShiftType ? values.shift_type_id : null,
      priority: values.priority,
      notes: values.notes || null,
    }
    const handleError = (err: unknown) => {
      if (err instanceof ApiError) toast.error(err.detail)
      else toast.error('Speichern fehlgeschlagen')
    }
    if (wish) {
      updateMutation.mutate({ id: wish.id, data: payload }, {
        onSuccess: () => { toast.success('Wunsch aktualisiert'); onOpenChange(false) },
        onError: handleError,
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast.success('Wunsch gespeichert'); onOpenChange(false) },
        onError: handleError,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{wish ? 'Wunsch bearbeiten' : 'Neuer Wunsch'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>

            {!prefilledDate && (
              <FormField
                control={form.control}
                name="subType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Art</FormLabel>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="date" id="sub-date" />
                        <Label htmlFor="sub-date">Konkretes Datum</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="weekday" id="sub-weekday" />
                        <Label htmlFor="sub-weekday">Wochentag</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="general" id="sub-general" />
                        <Label htmlFor="sub-general">Allgemein</Label>
                      </div>
                    </RadioGroup>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {subType === 'date' && (
              <FormField
                control={form.control}
                name="wish_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ''}
                        readOnly={!!prefilledDate}
                        aria-label="Datum"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {subType === 'weekday' && (
              <FormField
                control={form.control}
                name="day_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wochentag *</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Wochentag">
                          <SelectValue placeholder="Wochentag wählen…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEKDAY_LABELS.map((label, idx) => (
                          <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="wish_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(WISH_TYPE_LABELS).map(([v, label]) => (
                        <SelectItem key={v} value={v}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsShiftType && (
              <FormField
                control={form.control}
                name="shift_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schichttyp *</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Schichttyp"><SelectValue placeholder="Schichttyp wählen…" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {shiftTypes.map((st) => (
                          <SelectItem key={st.id} value={String(st.id)}>
                            {st.short_name} — {st.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorität</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1 — Normal</SelectItem>
                      <SelectItem value="2">2 — Wichtig</SelectItem>
                      <SelectItem value="3">3 — Dringend</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Optional…"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Speichern…' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **G4: Tests grün**

```bash
cd frontend && pnpm test features/doctors/tests/WishFormDialog.test.tsx --run 2>&1 | tail -10
```

Expected: `6 passed`

- [ ] **G5: Commit**

```bash
git add frontend/src/features/doctors/WishFormDialog.tsx frontend/src/features/doctors/tests/WishFormDialog.test.tsx
git commit -m "feat(M12-004): WishFormDialog — Sub-Typen, Zod-Validierung"
```

---

## Task H: WishList + DoctorDetailPage

**Files:**
- Create: `frontend/src/features/doctors/WishList.tsx`
- Create: `frontend/src/features/doctors/tests/WishList.test.tsx`
- Modify: `frontend/src/features/doctors/DoctorDetailPage.tsx`

- [ ] **H1: Failing WishList-Tests**

Erstelle `frontend/src/features/doctors/tests/WishList.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WishList } from '../WishList'

const mockWish = {
  id: 1, doctor_id: 1, wish_date: '2026-03-15', day_of_week: null,
  wish_type: 'AVOID_DAY' as const, shift_type_id: null,
  priority: 1, notes: null, created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
}

vi.mock('../useWishes', () => ({
  useWishesByDoctor: () => ({ data: [mockWish], isLoading: false }),
  useDeleteWish: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../WishFormDialog', () => ({ WishFormDialog: () => null }))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

describe('WishList', () => {
  it('zeigt bestehenden Wunsch', () => {
    render(<WishList doctorId={1} />)
    expect(screen.getByText(/15\.03\.2026/i)).toBeInTheDocument()
    expect(screen.getByText(/Tag vermeiden/i)).toBeInTheDocument()
  })

  it('hat Neuer-Wunsch-Button', () => {
    render(<WishList doctorId={1} />)
    expect(screen.getByRole('button', { name: /neuer wunsch/i })).toBeInTheDocument()
  })

  it('hat Löschen-Button', () => {
    render(<WishList doctorId={1} />)
    expect(screen.getByRole('button', { name: /löschen/i })).toBeInTheDocument()
  })
})
```

- [ ] **H2: Tests ausführen — Fehler bestätigen**

```bash
cd frontend && pnpm test features/doctors/tests/WishList.test.tsx --run 2>&1 | tail -10
```

- [ ] **H3: WishList.tsx erstellen**

```typescript
// frontend/src/features/doctors/WishList.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useWishesByDoctor, useDeleteWish } from './useWishes'
import { WishFormDialog } from './WishFormDialog'
import type { Wish, WishType } from '@/lib/types'

const WISH_TYPE_LABELS: Record<WishType, string> = {
  AVOID_DAY: 'Tag vermeiden',
  AVOID_SHIFT: 'Dienst vermeiden',
  REQUIRE_SHIFT: 'Dienst wünschen',
}
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function formatScope(wish: Wish): string {
  if (wish.wish_date) return new Date(wish.wish_date).toLocaleDateString('de-DE')
  if (wish.day_of_week != null) return `Jeden ${WEEKDAY_SHORT[wish.day_of_week]}`
  return 'Allgemein'
}

export function WishList({ doctorId }: { doctorId: number }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editWish, setEditWish] = useState<Wish | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Wish | null>(null)

  const { data: wishes = [], isLoading } = useWishesByDoctor(doctorId)
  const deleteMutation = useDeleteWish(doctorId)

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { toast.success('Wunsch gelöscht'); setDeleteTarget(null) },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Wünsche</h3>
        <Button size="sm" variant="outline" onClick={() => { setEditWish(undefined); setFormOpen(true) }}>
          <PlusCircle className="h-4 w-4 mr-1.5" />Neuer Wunsch
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>}
      {!isLoading && wishes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">Keine Wünsche hinterlegt.</p>
      )}

      <div className="space-y-2">
        {wishes.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {formatScope(w)} — {WISH_TYPE_LABELS[w.wish_type]}
                {w.priority > 1 && <span className="ml-2 text-xs text-muted-foreground">P{w.priority}</span>}
              </p>
              {w.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{w.notes}</p>}
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <Button size="sm" variant="ghost" onClick={() => { setEditWish(w); setFormOpen(true) }} aria-label="Bearbeiten">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(w)} aria-label="Löschen">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <WishFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditWish(undefined) }}
        doctorId={doctorId}
        wish={editWish}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wunsch löschen?</AlertDialogTitle>
            <AlertDialogDescription>Dieser Wunsch wird dauerhaft entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **H4: Tests grün**

```bash
cd frontend && pnpm test features/doctors/tests/WishList.test.tsx --run 2>&1 | tail -10
```

Expected: `3 passed`

- [ ] **H5: DoctorDetailPage — Tab 'wuensche' hinzufügen**

In `frontend/src/features/doctors/DoctorDetailPage.tsx`:

1. Import ergänzen: `import { WishList } from './WishList'`

2. `type Tab` um `| 'wuensche'` erweitern.

3. Tab-Button nach dem letzten existierenden Tab-Button hinzufügen (exaktes Muster der bestehenden Buttons kopieren, nur `activeTab === 'wuensche'` und Label `Wünsche`):

```tsx
<button
  onClick={() => setActiveTab('wuensche')}
  className={cn('px-3 py-2 text-sm font-medium border-b-2 transition-colors',
    activeTab === 'wuensche'
      ? 'border-accent text-ink'
      : 'border-transparent text-muted-foreground hover:text-ink'
  )}
>
  Wünsche
</button>
```

4. Tab-Content nach dem letzten `{activeTab === 'overrides' && ...}` Block:

```tsx
{activeTab === 'wuensche' && (
  <WishList doctorId={id} />
)}
```

- [ ] **H6: TypeScript-Check + Commit**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
git add frontend/src/features/doctors/WishList.tsx frontend/src/features/doctors/tests/WishList.test.tsx frontend/src/features/doctors/DoctorDetailPage.tsx
git commit -m "feat(M12-004): WishList + DoctorDetailPage Wünsche-Tab"
```

---

## Task I: Plan-Hook + Grid Utils

**Files:**
- Create: `frontend/src/features/plans/useWishes.ts`
- Create: `frontend/src/features/plans/wishGridUtils.ts`
- Create: `frontend/src/features/plans/tests/wishGridUtils.test.ts`

- [ ] **I1: Failing Tests für wishGridUtils**

Erstelle `frontend/src/features/plans/tests/wishGridUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { wishMatchesCell, getWishHint } from '../wishGridUtils'
import type { Wish } from '@/lib/types'

function w(overrides: Partial<Wish>): Wish {
  return {
    id: 1, doctor_id: 1, wish_date: null, day_of_week: null,
    wish_type: 'AVOID_DAY', shift_type_id: null, priority: 1,
    notes: null, created_at: '', updated_at: '',
    ...overrides,
  }
}

describe('wishMatchesCell', () => {
  it('matches exact date', () => {
    expect(wishMatchesCell(w({ wish_date: '2026-03-15' }), 1, '2026-03-15')).toBe(true)
  })
  it('rejects different date', () => {
    expect(wishMatchesCell(w({ wish_date: '2026-03-15' }), 1, '2026-03-16')).toBe(false)
  })
  it('matches weekday (Freitag = day_of_week 4, 2026-03-20 is Fri)', () => {
    // 2026-03-20 is Friday: JS getDay()=5 → Python weekday=(5+6)%7=4
    expect(wishMatchesCell(w({ day_of_week: 4 }), 1, '2026-03-20')).toBe(true)
  })
  it('rejects wrong weekday', () => {
    // 2026-03-19 is Thursday: Python weekday=3, not 4
    expect(wishMatchesCell(w({ day_of_week: 4 }), 1, '2026-03-19')).toBe(false)
  })
  it('matches general wish on any date', () => {
    expect(wishMatchesCell(w({}), 1, '2026-03-15')).toBe(true)
    expect(wishMatchesCell(w({}), 1, '2026-12-31')).toBe(true)
  })
  it('rejects different doctor', () => {
    expect(wishMatchesCell(w({ wish_date: '2026-03-15', doctor_id: 2 }), 1, '2026-03-15')).toBe(false)
  })
})

describe('getWishHint', () => {
  it('returns avoid for AVOID_DAY', () => {
    expect(getWishHint([w({ wish_date: '2026-03-15', wish_type: 'AVOID_DAY' })], 1, '2026-03-15')).toBe('avoid')
  })
  it('returns avoid for AVOID_SHIFT', () => {
    expect(getWishHint([w({ wish_date: '2026-03-15', wish_type: 'AVOID_SHIFT', shift_type_id: 1 })], 1, '2026-03-15')).toBe('avoid')
  })
  it('returns require for REQUIRE_SHIFT', () => {
    expect(getWishHint([w({ wish_date: '2026-03-15', wish_type: 'REQUIRE_SHIFT', shift_type_id: 1 })], 1, '2026-03-15')).toBe('require')
  })
  it('avoid dominates over require', () => {
    const wishes = [
      w({ wish_date: '2026-03-15', wish_type: 'AVOID_DAY' }),
      w({ id: 2, wish_date: '2026-03-15', wish_type: 'REQUIRE_SHIFT', shift_type_id: 1 }),
    ]
    expect(getWishHint(wishes, 1, '2026-03-15')).toBe('avoid')
  })
  it('returns null when no match', () => {
    expect(getWishHint([w({ wish_date: '2026-03-16' })], 1, '2026-03-15')).toBeNull()
  })
})
```

- [ ] **I2: Tests ausführen — Fehler bestätigen**

```bash
cd frontend && pnpm test features/plans/tests/wishGridUtils.test.ts --run 2>&1 | tail -10
```

- [ ] **I3: wishGridUtils.ts erstellen**

```typescript
// frontend/src/features/plans/wishGridUtils.ts
import type { Wish } from '@/lib/types'

/** JS getDay() 0=So…6=Sa → Python weekday() 0=Mo…6=So: (getDay()+6)%7 */
function toPythonWeekday(jsDay: number): number {
  return (jsDay + 6) % 7
}

export function wishMatchesCell(wish: Wish, doctorId: number, dayKey: string): boolean {
  if (wish.doctor_id !== doctorId) return false
  if (wish.wish_date !== null) return wish.wish_date === dayKey
  if (wish.day_of_week !== null) {
    return wish.day_of_week === toPythonWeekday(new Date(dayKey + 'T00:00:00').getDay())
  }
  return true // general wish
}

export function getWishHint(
  wishes: Wish[],
  doctorId: number,
  dayKey: string,
): 'avoid' | 'require' | null {
  const matching = wishes.filter((w) => wishMatchesCell(w, doctorId, dayKey))
  if (matching.some((w) => w.wish_type === 'AVOID_DAY' || w.wish_type === 'AVOID_SHIFT')) return 'avoid'
  if (matching.some((w) => w.wish_type === 'REQUIRE_SHIFT')) return 'require'
  return null
}
```

- [ ] **I4: Tests grün**

```bash
cd frontend && pnpm test features/plans/tests/wishGridUtils.test.ts --run 2>&1 | tail -10
```

Expected: `11 passed`

- [ ] **I5: Plan-scoped useWishes.ts erstellen**

```typescript
// frontend/src/features/plans/useWishes.ts
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { Wish } from '@/lib/types'

export const planWishKeys = {
  byPlan: (planId: number) => ['plan-wishes', planId] as const,
}

export function usePlanWishes(planId: number | null) {
  return useQuery({
    queryKey: planWishKeys.byPlan(planId ?? 0),
    queryFn: () => apiGet<Wish[]>(`/api/plans/${planId}/wishes`),
    enabled: planId !== null,
  })
}
```

- [ ] **I6: TypeScript-Check + Commit**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -20
git add frontend/src/features/plans/useWishes.ts frontend/src/features/plans/wishGridUtils.ts frontend/src/features/plans/tests/wishGridUtils.test.ts
git commit -m "feat(M12-004): plan useWishes + wishGridUtils matching"
```

---

## Task J: Grid-Integration

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **J1: UnifiedShiftCell — wish-Props + Rendering**

In `frontend/src/features/plans/components/UnifiedShiftCell.tsx`:

1. Import ergänzen: `import { Star } from 'lucide-react'` (zu bestehenden Lucide-Importen hinzufügen)

2. `UnifiedShiftCellProps`-Interface erweitern:

```typescript
wishHint?: 'avoid' | 'require' | null
doctorId?: number
onWishCreate?: (doctorId: number, date: string) => void
```

3. Die drei neuen Props in der Funktion destrukturieren.

4. Dem äußersten `<div>` die Klasse `group` hinzufügen (an den `cn(...)` Aufruf anfügen).

5. Innerhalb des `<div>`, nach dem `{/* Konflikt-Dot */}`-Block, hinzufügen:

```tsx
{/* Wish-Hint: Ring bei belegter Zelle, Tint bei leerer */}
{wishHint && !isLocked && (
  <span
    className={cn(
      'absolute inset-0 pointer-events-none',
      text ? 'ring-2 ring-inset' : '',
      wishHint === 'avoid'
        ? (text ? 'ring-amber-400' : 'bg-amber-50/60')
        : (text ? 'ring-green-500' : 'bg-green-50/60'),
    )}
  />
)}

{/* Wish-Schnellerfassung via Hover-Icon */}
{onWishCreate && doctorId !== undefined && !isLocked && (
  <button
    className="absolute bottom-0.5 right-0.5 w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-50 hover:!opacity-100 z-[3]"
    onClick={(e) => { e.stopPropagation(); onWishCreate(doctorId, dayKey) }}
    aria-label="Wunsch erfassen"
    tabIndex={-1}
  >
    <Star className="w-2.5 h-2.5 text-muted-foreground" />
  </button>
)}
```

- [ ] **J2: UnifiedPlanGrid — wishes-Props übergeben**

In `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`:

1. Imports ergänzen:

```typescript
import { getWishHint } from '../wishGridUtils'
import type { Wish } from '@/lib/types'
```

2. `UnifiedPlanGridProps` um folgende Props erweitern:

```typescript
wishes?: Wish[]
showWishes?: boolean
onWishCreate?: (doctorId: number, date: string) => void
```

3. Props in der Funktion destrukturieren.

4. Bei der Stelle, wo `<UnifiedShiftCell>` gerendert wird (suche nach `<UnifiedShiftCell`), folgende Props ergänzen. Hinweis: Zunächst prüfen ob `row.type === 'rotation'` und ob `row` einen `doctorId`-Wert hat. In `unifiedGridUtils.ts` nachschauen, wie der RotationRow-Typ aussieht — dort ist `doctorId` oder `doctor_id` zu finden. Den korrekten Feldnamen verwenden.

```tsx
wishHint={showWishes && row.type === 'rotation'
  ? getWishHint(wishes ?? [], row.doctorId, dayKey)
  : null}
doctorId={row.type === 'rotation' ? row.doctorId : undefined}
onWishCreate={onWishCreate}
```

**Wichtig:** Den genauen Feldnamen (`row.doctorId` vs. `row.doctor_id`) in `unifiedGridUtils.ts` prüfen bevor dieser Code eingefügt wird. `buildUnifiedRows` und der `RotationRow`-Typ dort zeigen die korrekte Benennung.

- [ ] **J3: PlanPage — Hook, Toggle, WishFormDialog**

In `frontend/src/features/plans/PlanPage.tsx`:

1. Imports ergänzen:

```typescript
import { usePlanWishes } from './useWishes'
import { Star } from 'lucide-react'  // zu bestehenden lucide-Imports
import { WishFormDialog } from '@/features/doctors/WishFormDialog'
```

2. Nach den bestehenden `useState`-Deklarationen hinzufügen:

```typescript
const [showWishes, setShowWishes] = useState(true)
const [wishCreateTarget, setWishCreateTarget] = useState<{ doctorId: number; date: string } | null>(null)
```

3. Nach den bestehenden Hook-Aufrufen hinzufügen:

```typescript
const { data: planWishes = [] } = usePlanWishes(plan?.id ?? null)
```

4. Toggle-Button zur Toolbar hinzufügen (neben den Fokus-Filter-Buttons; nach dem Muster der anderen Toolbar-Buttons):

```tsx
<Button
  size="sm"
  variant={showWishes ? 'secondary' : 'ghost'}
  onClick={() => setShowWishes((v) => !v)}
  title={showWishes ? 'Wünsche ausblenden' : 'Wünsche anzeigen'}
>
  <Star className="h-4 w-4" />
</Button>
```

5. `<UnifiedPlanGrid>` um Props erweitern:

```tsx
wishes={planWishes}
showWishes={showWishes}
onWishCreate={(doctorId, date) => setWishCreateTarget({ doctorId, date })}
```

6. Vor dem schließenden JSX-Tag (neben anderen Dialogen) hinzufügen:

```tsx
{wishCreateTarget !== null && (
  <WishFormDialog
    open={true}
    onOpenChange={(open) => { if (!open) setWishCreateTarget(null) }}
    doctorId={wishCreateTarget.doctorId}
    prefilledDate={wishCreateTarget.date}
  />
)}
```

- [ ] **J4: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: keine Fehler. Falls TypeScript-Fehler wegen `row.doctorId` — Feldname in `unifiedGridUtils.ts` nachschlagen und korrigieren.

- [ ] **J5: Vollständige Frontend-Suite**

```bash
cd frontend && pnpm test --run 2>&1 | tail -10
```

Expected: keine neuen Fehler

- [ ] **J6: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx frontend/src/features/plans/components/UnifiedPlanGrid.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(M12-004): Grid Wish-Hint-Layer — Ring/Tint + Toggle + Schnellerfassung"
```

---

## Task K: Milestone-Abschluss

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/decisions.md`

- [ ] **K1: CLAUDE.md — Domänen-Konzept eintragen**

Im Abschnitt `## Domänen-Konzepte`, nach dem `Feiertagskalender (M12-003)`-Eintrag, einfügen:

```markdown
- **Wünsche (M12-004):** `Wish`-Tabelle (`doctor_id`, `wish_date: Date | None`,
  `day_of_week: int | None` 0=Mo…6=So, `wish_type` AVOID_DAY/AVOID_SHIFT/REQUIRE_SHIFT,
  `shift_type_id`, `priority` 1–3). Drei Sub-Typen: Datumswunsch (`wish_date` gesetzt),
  Wochentag-Präferenz (`day_of_week` gesetzt), Allgemeine Präferenz (beide null).
  DB-CheckConstraint + Pydantic verhindern gleichzeitiges Setzen beider Felder.
  API: `GET/POST /api/doctors/{id}/wishes`, `PATCH/DELETE /api/wishes/{id}`,
  `GET /api/plans/{id}/wishes`. Frontend: `WishList`+`WishFormDialog` in DoctorDetailPage
  (Tab „Wünsche"); Grid-Hint-Layer in PlanPage (Amber-Ring AVOID, Grün-Ring REQUIRE, Toggle);
  Schnellerfassung via Hover-Icon → `WishFormDialog(prefilledDate=...)`. ADR-092.
```

- [ ] **K2: roadmap.md aktualisieren**

```
| M12-004 | Wünsche-Erfassung UI (`Wish`-CRUD) | ✅ Abgeschlossen (2026-06-03) |
```

- [ ] **K3: ADR-092 in decisions.md eintragen**

```markdown
## ADR-092: Wish — drei Sub-Typen in einer Tabelle (M12-004)

**Status:** Entschieden (2026-06-03)

**Kontext:** Wünsche können datumsspezifisch, wochentag-bezogen oder allgemein sein.

**Entscheidung:** Einzelne `wishes`-Tabelle mit `wish_date: Date | NULL` und
`day_of_week: INT | NULL`. DB-CheckConstraint verhindert gleichzeitiges Setzen.
Sub-Typ ergibt sich implizit. Kein neues Entitätsmodell.

**Konsequenz:** Pydantic `WishCreateBody` validiert Konsistenz. Frontend unterscheidet
Sub-Typen per Radio-Gruppe in `WishFormDialog`. `wishMatchesCell()` in `wishGridUtils.ts`
übersetzt JS `getDay()` → Python `weekday()` via `(getDay()+6)%7`.
```

- [ ] **K4: Finale Test-Läufe**

```bash
cd backend && uv run pytest -q 2>&1 | tail -5
cd frontend && pnpm test --run 2>&1 | tail -5
```

Expected: alle grün

- [ ] **K5: Abschluss-Commit**

```bash
git add CLAUDE.md docs/roadmap.md docs/decisions.md
git commit -m "docs: M12-004 Abschluss — ADR-092, Roadmap, CLAUDE.md"
```
