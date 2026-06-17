# Doctor Name Split + Anrede + PD Dr. Titel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `Doctor.name` into `first_name` + `last_name`, add optional `salutation` (Herr/Frau), add `PD Dr.` to title dropdown, and update the Excel import to handle comma-separated names.

**Architecture:** DB migration adds the three columns and migrates existing `name` data to `last_name`. A `@computed_field name` in `DoctorResponse` keeps backwards compatibility in JSON responses. The import matching normalises `"Berger, Anna"` → `"Berger Anna"` before fuzzy-matching.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Alembic, SQLite, Pydantic v2, React 18, TypeScript, Zod, shadcn/ui

## Global Constraints

- Python: `ruff` for lint+format; `StrEnum` never `(str, Enum)` (ruff UP042)
- No FastAPI imports in `services/`; no business logic in `api/`
- All new Pydantic fields use `Field(...)` with `max_length` where applicable
- SQLite migrations use `op.batch_alter_table` for DROP COLUMN
- `server_default` required for `NOT NULL` column additions on existing table
- Frontend: strict TypeScript, no `any`, `shadcn/ui` SelectItem values never empty string — use `"__none__"` sentinel
- Test commands: `pytest backend/ -x -q` (backend), `pnpm -C frontend tsc --noEmit` (frontend typecheck)

---

### Task 1: Alembic Migration 0022 — name → first_name + last_name + salutation

**Files:**
- Create: `backend/alembic/versions/0022_doctor_name_split.py`

**Interfaces:**
- Produces: DB columns `first_name VARCHAR(100) NOT NULL`, `last_name VARCHAR(100) NOT NULL`, `salutation VARCHAR(10) NULL`; `name` column dropped

- [ ] **Step 1: Create migration file**

```python
# backend/alembic/versions/0022_doctor_name_split.py
"""split Doctor.name into first_name + last_name, add salutation

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-17
"""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns — server_default needed for NOT NULL on existing rows
    op.add_column("doctors", sa.Column("first_name", sa.String(100), nullable=False, server_default=""))
    op.add_column("doctors", sa.Column("last_name", sa.String(100), nullable=False, server_default=""))
    op.add_column("doctors", sa.Column("salutation", sa.String(10), nullable=True))
    # Migrate: existing name goes to last_name; first_name stays empty (user corrects manually)
    op.execute("UPDATE doctors SET last_name = name")
    # Drop old column (batch required for SQLite)
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("name")


def downgrade() -> None:
    op.add_column("doctors", sa.Column("name", sa.String(200), nullable=False, server_default=""))
    op.execute(
        "UPDATE doctors SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))"
    )
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("first_name")
        batch_op.drop_column("last_name")
        batch_op.drop_column("salutation")
```

- [ ] **Step 2: Run migration**

```bash
cd backend
uv run alembic upgrade head
```

Expected output: `Running upgrade 0021 -> 0022, split Doctor.name...`

- [ ] **Step 3: Verify + test round-trip**

```bash
uv run alembic downgrade -1
uv run alembic upgrade head
```

Both commands must exit 0 without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/0022_doctor_name_split.py
git commit -m "feat: migration 0022 — split Doctor.name into first_name/last_name/salutation"
```

---

### Task 2: ORM Model + Pydantic Schemas + Backend Tests

**Files:**
- Modify: `backend/app/models/doctor.py`
- Modify: `backend/app/schemas/doctor.py`
- Modify: `backend/tests/integration/test_doctors_api.py`

**Interfaces:**
- Consumes: migration 0022 (Task 1) — columns `first_name`, `last_name`, `salutation` exist in DB
- Produces:
  - `Doctor.first_name: str`, `Doctor.last_name: str`, `Doctor.salutation: str | None`
  - `Doctor.name` Python `@property` → `f"{first_name} {last_name}".strip()`
  - `DoctorBase.first_name`, `DoctorBase.last_name`, `DoctorBase.salutation`
  - `DoctorResponse.name` → `@computed_field` → `f"{first_name} {last_name}".strip()`

- [ ] **Step 1: Update ORM model**

Replace in `backend/app/models/doctor.py`:

```python
# Remove:
name: Mapped[str] = mapped_column(String(200), nullable=False)

# Add (after the id/created_at/updated_at block):
first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
last_name: Mapped[str] = mapped_column(String(100), nullable=False)
salutation: Mapped[str | None] = mapped_column(String(10), nullable=True)

@property
def name(self) -> str:
    return f"{self.first_name} {self.last_name}".strip()
```

Full updated `doctor.py` model section (replace lines 32–34):
```python
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    salutation: Mapped[str | None] = mapped_column(String(10), nullable=True)

    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
```

- [ ] **Step 2: Update Pydantic schemas**

Replace `backend/app/schemas/doctor.py` content:

```python
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.doctor import DoctorRank, DoctorType
from app.schemas.employment_period import EmploymentPeriodResponse
from app.schemas.qualification import QualificationResponse


class DoctorBase(BaseModel):
    first_name: str = Field(default="", max_length=100)
    last_name: str = Field(max_length=100)
    salutation: str | None = None
    title: str | None = Field(default=None, max_length=50)
    short_name: str | None = Field(default=None, max_length=50)
    doctor_type: DoctorType = DoctorType.INTERNAL
    rank: DoctorRank | None = None
    active: bool = True
    entry_date: date | None = None
    virtual_entry_date: date | None = None
    notes: str | None = None
    opt_out_bd_level: int | None = None


class DoctorCreate(DoctorBase): ...


class DoctorUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    salutation: str | None = None
    title: str | None = Field(default=None, max_length=50)
    short_name: str | None = Field(default=None, max_length=50)
    doctor_type: DoctorType | None = None
    rank: DoctorRank | None = None
    active: bool | None = None
    entry_date: date | None = None
    virtual_entry_date: date | None = None
    notes: str | None = None
    opt_out_bd_level: int | None = None


class DoctorResponse(DoctorBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @computed_field
    @property
    def weiterbildungsjahr(self) -> int | None:
        if (self.rank is not None and self.rank != DoctorRank.ASSISTENT) or self.entry_date is None:
            return None
        delta_days = (date.today() - self.entry_date).days
        if delta_days < 0:
            return None
        return int(delta_days / 365.25) + 1


class DoctorWithRelations(DoctorResponse):
    employment_periods: list[EmploymentPeriodResponse] = []
    qualifications: list[QualificationResponse] = []
```

- [ ] **Step 3: Update API tests**

Replace the helper and affected tests in `backend/tests/integration/test_doctors_api.py`:

```python
def _create_doctor(client: TestClient, **kwargs) -> dict:
    payload = {"last_name": "Test Arzt", **kwargs}
    r = client.post("/api/doctors", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_doctor_minimal(client: TestClient) -> None:
    r = client.post("/api/doctors", json={"last_name": "Minimal"})
    assert r.status_code == 201
    data = r.json()
    assert data["last_name"] == "Minimal"
    assert data["first_name"] == ""
    assert data["name"] == "Minimal"          # computed field
    assert data["active"] is True
    assert data["rank"] is None
    assert data["doctor_type"] == "INTERNAL"


def test_create_doctor_full(client: TestClient) -> None:
    payload = {
        "first_name": "Anna",
        "last_name": "Vollständig",
        "salutation": "Frau",
        "title": "Dr.",
        "short_name": "VV",
        "doctor_type": "INTERNAL",
        "rank": None,
        "active": True,
        "notes": "Test-Notiz",
    }
    r = client.post("/api/doctors", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["first_name"] == "Anna"
    assert data["last_name"] == "Vollständig"
    assert data["salutation"] == "Frau"
    assert data["name"] == "Anna Vollständig"  # computed field
    assert data["title"] == "Dr."
    assert data["short_name"] == "VV"
    assert data["weiterbildungsjahr"] is None


def test_create_doctor_facharzt(client: TestClient) -> None:
    r = client.post(
        "/api/doctors",
        json={"last_name": "Facharzt", "rank": "FACHARZT"},
    )
    assert r.status_code == 201
    assert r.json()["rank"] == "FACHARZT"
    assert r.json()["weiterbildungsjahr"] is None


def test_update_doctor_partial(client: TestClient) -> None:
    doctor = _create_doctor(client, last_name="Update", short_name="DU")
    did = doctor["id"]

    r = client.patch(f"/api/doctors/{did}", json={"notes": "Neue Notiz", "title": "PD"})
    assert r.status_code == 200
    data = r.json()
    assert data["notes"] == "Neue Notiz"
    assert data["title"] == "PD"
    assert data["short_name"] == "DU"  # unverändert


def test_update_doctor_allows_clearing_title(client: TestClient) -> None:
    doctor = _create_doctor(client, last_name="Titel", title="Prof.")
    did = doctor["id"]

    r = client.patch(f"/api/doctors/{did}", json={"title": None})
    assert r.status_code == 200
    assert r.json()["title"] is None


def test_create_doctor_salutation(client: TestClient) -> None:
    r = client.post("/api/doctors", json={"first_name": "Max", "last_name": "Berger", "salutation": "Herr"})
    assert r.status_code == 201
    data = r.json()
    assert data["salutation"] == "Herr"
    assert data["name"] == "Max Berger"


def test_delete_doctor_cascades(client: TestClient) -> None:
    doctor = _create_doctor(client, last_name="Lösch")
    # ... rest of test unchanged, uses doctor["id"]
```

Also update any remaining `"name": "..."` occurrences in the test file — replace all `"name": "<value>"` with `"last_name": "<value>"` in `_create_doctor` kwargs and direct `client.post` calls.

- [ ] **Step 4: Run all doctor tests**

```bash
cd backend
uv run pytest tests/integration/test_doctors_api.py tests/unit/test_doctor_service.py -v
```

Expected: all pass.

- [ ] **Step 5: Run full backend test suite**

```bash
uv run pytest -x -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/doctor.py backend/app/schemas/doctor.py \
        backend/tests/integration/test_doctors_api.py
git commit -m "feat: split Doctor.name → first_name/last_name/salutation in ORM and schemas"
```

---

### Task 3: Import Services — name normalisation + doctor creation

**Files:**
- Modify: `backend/app/services/import_match_service.py`
- Modify: `backend/app/services/import_commit_service.py`
- Modify: `backend/tests/services/test_import_commit_phase_d.py`

**Interfaces:**
- Consumes: `Doctor.first_name`, `Doctor.last_name` from Task 2
- Produces:
  - `_normalize_raw_name("Berger, Anna") → "Berger Anna"`
  - `_normalize_raw_name("Berger Anna") → "Berger Anna"` (unchanged)
  - `doctor_names = [(d.id, f"{d.last_name} {d.first_name}".strip()) for d in doctors]`
  - New doctors created with `{"first_name": first_name, "last_name": last_name}`

- [ ] **Step 1: Write failing tests for _normalize_raw_name and import doctor creation**

Add to `backend/tests/services/test_import_commit_phase_d.py`:

```python
def test_normalize_raw_name_comma_separated():
    from app.services.import_match_service import _normalize_raw_name
    assert _normalize_raw_name("Berger, Anna") == "Berger Anna"
    assert _normalize_raw_name("Berger, Anna (70%)") == "Berger, Anna (70%)"  # percentage not stripped here


def test_normalize_raw_name_no_comma():
    from app.services.import_match_service import _normalize_raw_name
    assert _normalize_raw_name("Berger Anna") == "Berger Anna"
    assert _normalize_raw_name("  Berger  Anna  ") == "Berger  Anna"  # strip outer only


def test_split_name_parts_comma():
    from app.services.import_commit_service import _split_name_parts
    assert _split_name_parts("Berger, Anna") == ("Berger", "Anna")
    assert _split_name_parts("Berger, Anna (70%)") == ("Berger", "Anna")


def test_split_name_parts_no_comma():
    from app.services.import_commit_service import _split_name_parts
    assert _split_name_parts("Berger Anna") == ("Berger", "Anna")
    assert _split_name_parts("Berger") == ("Berger", "")
    assert _split_name_parts("Berger Anna Maria") == ("Berger", "Anna Maria")
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend
uv run pytest tests/services/test_import_commit_phase_d.py::test_normalize_raw_name_comma_separated \
    tests/services/test_import_commit_phase_d.py::test_split_name_parts_comma -v
```

Expected: `ImportError` or `AttributeError` (functions not yet defined).

- [ ] **Step 3: Update import_match_service.py**

In `backend/app/services/import_match_service.py`, add after the `_DEPT_PREFIX_RE` definition (around line 46):

```python
def _normalize_raw_name(raw: str) -> str:
    """Normalises 'Berger, Anna' → 'Berger Anna'. No-op when no comma."""
    if "," in raw:
        parts = [p.strip() for p in raw.split(",", 1)]
        return " ".join(p for p in parts if p)
    return raw.strip()
```

Replace line 123 (doctor_names):
```python
# Before:
doctor_names = [(d.id, d.name) for d in doctors]

# After:
doctor_names = [(d.id, f"{d.last_name} {d.first_name}".strip()) for d in doctors]
```

Replace the doctor matching loop (around line 157–173) — add normalisation step:
```python
    doctor_matches: list[DoctorMatch] = []
    for raw in distinct_doctors:
        normalized_raw = _normalize_raw_name(raw)
        parsed_name, percentage = _parse_name(normalized_raw)
        status, matched_id, candidates, default_action = _match_against(parsed_name, doctor_names)
        doctor_matches.append(
            DoctorMatch(
                raw=raw,
                match_status=status,
                matched_id=matched_id,
                candidates=candidates,
                default_action=default_action,
                parsed_name=parsed_name,
                percentage=percentage,
            )
        )
```

- [ ] **Step 4: Update import_commit_service.py**

Replace the `_parse_name` function and add `_split_name_parts` in `backend/app/services/import_commit_service.py`:

```python
_PERCENT_RE = re.compile(r"^(.*?)\s*\(\d+%\)\s*$")


def _strip_percentage(raw: str) -> str:
    """Removes the '(NN%)' suffix from a raw doctor name."""
    stripped = raw.strip()
    m = _PERCENT_RE.match(stripped)
    return m.group(1).strip() if m else stripped


def _split_name_parts(raw: str) -> tuple[str, str]:
    """Returns (last_name, first_name). Strips percentage suffix first.

    'Berger, Anna (70%)' → ('Berger', 'Anna')
    'Berger Anna'        → ('Berger', 'Anna')
    'Berger Anna Maria'  → ('Berger', 'Anna Maria')
    'Berger'             → ('Berger', '')
    """
    clean = _strip_percentage(raw)
    if "," in clean:
        parts = [p.strip() for p in clean.split(",", 1)]
        return parts[0], parts[1] if len(parts) > 1 else ""
    parts = clean.split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""
```

Remove the old `_parse_name` function entirely.

Update the `raw_to_parsed_name` dict (line ~78) to use `_strip_percentage`:
```python
    raw_to_parsed_name: dict[str, str] = {
        row.raw_name: _strip_percentage(row.raw_name) for row in parsed.rows
    }
```

Update the doctor creation block (line ~121–126):
```python
        elif res.action == "create":
            last_name, first_name = _split_name_parts(raw)
            doctor = doctor_repo.create_doctor(db, {"first_name": first_name, "last_name": last_name})
            created_doctors += 1
            if res.percentage is not None and plan_start is not None:
                _upsert_employment_period(db, doctor.id, plan_start, res.percentage, _ep_counter)
            doctor_id_map[raw] = doctor.id
```

- [ ] **Step 5: Update existing import tests that create doctors**

In `backend/tests/services/test_import_commit_phase_d.py`, find any test that creates a `Doctor` fixture with `name=` and update to `last_name=`:

```python
# Before:
db.add(Doctor(name="Berger Johann"))
# After:
db.add(Doctor(first_name="Johann", last_name="Berger"))
```

Also find any assertions on `doctor["name"]` in responses and update if needed (the `name` computed field still works, so those assertions remain valid).

- [ ] **Step 6: Run new tests**

```bash
cd backend
uv run pytest tests/services/test_import_commit_phase_d.py -v
```

Expected: all pass including the four new tests.

- [ ] **Step 7: Run full suite**

```bash
uv run pytest -x -q
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/import_match_service.py \
        backend/app/services/import_commit_service.py \
        backend/tests/services/test_import_commit_phase_d.py
git commit -m "feat: update import services for first_name/last_name and comma-separated names"
```

---

### Task 4: Frontend — API types + DoctorForm + PD Dr. title

**Files:**
- Modify: `frontend/src/lib/api-types.ts`
- Modify: `frontend/src/features/doctors/DoctorForm.tsx`

**Interfaces:**
- Consumes: `DoctorWithRelations.first_name`, `.last_name`, `.salutation`, `.name` (computed) from backend Task 2
- Produces: updated form with Anrede / Vorname / Nachname fields; `PD Dr.` in title dropdown

- [ ] **Step 1: Update api-types.ts — DoctorCreate**

In `frontend/src/lib/api-types.ts`, find `/** DoctorCreate */` (line ~995). Replace the block:

```ts
        /** DoctorCreate */
        DoctorCreate: {
            /** First Name */
            first_name?: string;
            /** Last Name */
            last_name: string;
            /** Salutation */
            salutation?: string | null;
            /** Title */
            title?: string | null;
            /** Short Name */
            short_name?: string | null;
            /** @default INTERNAL */
            doctor_type: components["schemas"]["DoctorType"];
            /** Rank */
            rank?: string | null;
            /**
             * Active
             * @default true
             */
            active: boolean;
            /** Entry Date */
            entry_date?: string | null;
            /** Virtual Entry Date */
            virtual_entry_date?: string | null;
            /** Notes */
            notes?: string | null;
            /** Opt Out Bd Level */
            opt_out_bd_level?: number | null;
        };
```

- [ ] **Step 2: Update api-types.ts — DoctorUpdate**

Find `/** DoctorUpdate */` (line ~1106). Replace:

```ts
        /** DoctorUpdate */
        DoctorUpdate: {
            /** First Name */
            first_name?: string | null;
            /** Last Name */
            last_name?: string | null;
            /** Salutation */
            salutation?: string | null;
            /** Title */
            title?: string | null;
            /** Short Name */
            short_name?: string | null;
            doctor_type?: components["schemas"]["DoctorType"] | null;
            /** Rank */
            rank?: string | null;
            /** Active */
            active?: boolean | null;
            /** Entry Date */
            entry_date?: string | null;
            /** Virtual Entry Date */
            virtual_entry_date?: string | null;
            /** Notes */
            notes?: string | null;
            /** Opt Out Bd Level */
            opt_out_bd_level?: number | null;
        };
```

- [ ] **Step 3: Update api-types.ts — DoctorWithRelations**

Find `/** DoctorWithRelations */` (line ~1128). Replace the name/title block at the start:

```ts
        /** DoctorWithRelations */
        DoctorWithRelations: {
            /** First Name */
            first_name: string;
            /** Last Name */
            last_name: string;
            /** Salutation */
            salutation?: string | null;
            /** Name (computed: first_name + last_name) */
            name: string;
            /** Title */
            title?: string | null;
            /** Short Name */
            short_name?: string | null;
            // ... rest unchanged
```

- [ ] **Step 4: Run TypeScript check — expect no errors from api-types changes**

```bash
cd frontend
pnpm tsc --noEmit
```

Any errors about `name` being used in a write context (e.g. in form payloads) will appear here. Fix in next step.

- [ ] **Step 5: Update DoctorForm.tsx**

Replace full `DoctorForm.tsx` content:

```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useCreateDoctor, useUpdateDoctor } from './useDoctors'
import type { Doctor } from '@/lib/types'

const schema = z.object({
  salutation: z.string().nullable().optional(),
  first_name: z.string().max(100, 'Maximal 100 Zeichen').optional().default(''),
  last_name: z.string().min(1, 'Nachname ist erforderlich').max(100, 'Maximal 100 Zeichen'),
  title: z.string().max(50, 'Maximal 50 Zeichen').nullable().optional(),
  short_name: z.string().max(50, 'Maximal 50 Zeichen').nullable().optional(),
  doctor_type: z.enum(['INTERNAL', 'EXTERNAL']),
  rank: z.string().nullable().optional(),
  active: z.boolean(),
  entry_date: z.string().nullable().optional(),
  virtual_entry_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  opt_out_bd_level: z.number().int().min(1).max(2).nullable(),
})

type FormValues = z.infer<typeof schema>

interface DoctorFormProps {
  doctor?: Doctor
  onSuccess?: (id: number) => void
}

export function DoctorForm({ doctor, onSuccess }: DoctorFormProps) {
  const navigate = useNavigate()
  const createMutation = useCreateDoctor()
  const updateMutation = useUpdateDoctor(doctor?.id ?? 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      salutation: doctor?.salutation ?? null,
      first_name: doctor?.first_name ?? '',
      last_name: doctor?.last_name ?? '',
      title: doctor?.title ?? null,
      short_name: doctor?.short_name ?? null,
      doctor_type: doctor?.doctor_type ?? 'INTERNAL',
      rank: doctor?.rank ?? null,
      active: doctor?.active ?? true,
      entry_date: doctor?.entry_date ?? null,
      virtual_entry_date: doctor?.virtual_entry_date ?? null,
      notes: doctor?.notes ?? null,
      opt_out_bd_level: doctor?.opt_out_bd_level ?? null,
    },
  })

  useEffect(() => {
    if (doctor) {
      form.reset({
        salutation: doctor.salutation ?? null,
        first_name: doctor.first_name ?? '',
        last_name: doctor.last_name,
        title: doctor.title ?? null,
        short_name: doctor.short_name ?? null,
        doctor_type: doctor.doctor_type,
        rank: doctor.rank ?? null,
        active: doctor.active,
        entry_date: doctor.entry_date ?? null,
        virtual_entry_date: doctor.virtual_entry_date ?? null,
        notes: doctor.notes ?? null,
        opt_out_bd_level: doctor.opt_out_bd_level ?? null,
      })
    }
  }, [doctor, form])

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      first_name: values.first_name ?? '',
      salutation: values.salutation || null,
      title: values.title || null,
      short_name: values.short_name || null,
      notes: values.notes || null,
      entry_date: values.entry_date || null,
      virtual_entry_date: values.virtual_entry_date || null,
    }

    if (doctor) {
      updateMutation.mutate(payload, {
        onSuccess: (updated) => {
          toast.success('Arzt gespeichert')
          onSuccess?.(updated.id)
        },
        onError: (err) => handleError(err),
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => {
          toast.success('Arzt angelegt')
          onSuccess?.(created.id)
          void navigate(`/doctors/${created.id}`)
        },
        onError: (err) => handleError(err),
      })
    }
  }

  const handleError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status >= 500) {
        toast.error('Speichern fehlgeschlagen, bitte erneut versuchen', { duration: 7000 })
        return
      }
      toast.error(err.detail)
    } else {
      toast.error('Ein unerwarteter Fehler ist aufgetreten')
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5">

        {/* Anrede */}
        <FormField
          control={form.control}
          name="salutation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Anrede</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                value={field.value ?? '__none__'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Keine Anrede" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">Keine Anrede</SelectItem>
                  <SelectItem value="Herr">Herr</SelectItem>
                  <SelectItem value="Frau">Frau</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Vorname */}
        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vorname</FormLabel>
              <FormControl>
                <Input placeholder="Anna" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Nachname */}
        <FormField
          control={form.control}
          name="last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nachname *</FormLabel>
              <FormControl>
                <Input placeholder="Berger" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Titel */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                value={field.value ?? '__none__'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Kein Titel" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">Kein Titel</SelectItem>
                  <SelectItem value="Dr.">Dr.</SelectItem>
                  <SelectItem value="PD Dr.">PD Dr.</SelectItem>
                  <SelectItem value="Prof.">Prof.</SelectItem>
                  <SelectItem value="Prof. Dr.">Prof. Dr.</SelectItem>
                  <SelectItem value="PD">PD</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Kurzname */}
        <FormField
          control={form.control}
          name="short_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kurzname</FormLabel>
              <FormControl>
                <Input
                  placeholder="MM"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Typ */}
        <FormField
          control={form.control}
          name="doctor_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Typ</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="INTERNAL">Intern</SelectItem>
                  <SelectItem value="EXTERNAL">Extern</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Rang */}
        <FormField
          control={form.control}
          name="rank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rang</FormLabel>
              <Select
                value={field.value ?? '__none__'}
                onValueChange={v => field.onChange(v === '__none__' ? null : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  <SelectItem value="ASSISTENT">Assistenzarzt</SelectItem>
                  <SelectItem value="FACHARZT">Facharzt</SelectItem>
                  <SelectItem value="FUNKTIONSOBERARZT">Funktionsoberarzt</SelectItem>
                  <SelectItem value="OBERARZT">Oberarzt</SelectItem>
                  <SelectItem value="CHEFARZT">Chefarzt</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* BD-Opt-out */}
        <FormField
          control={form.control}
          name="opt_out_bd_level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>BD-Opt-out-Stufe</FormLabel>
              <Select
                value={field.value == null ? '__none__' : String(field.value)}
                onValueChange={(v) =>
                  field.onChange(v === '__none__' ? null : parseInt(v, 10))
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Kein Opt-out" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">Kein Opt-out (48 h/Woche)</SelectItem>
                  <SelectItem value="1">BD-Stufe I (58 h/Woche)</SelectItem>
                  <SelectItem value="2">BD-Stufe II (54 h/Woche)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Individuelle Vereinbarung nach TV-Ärzte/TdL §7 Abs. 5
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Eintrittsdatum */}
        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Eintrittsdatum</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Virtuelles Eintrittsdatum */}
        <FormField
          control={form.control}
          name="virtual_entry_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Virtuelles Eintrittsdatum</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Aktiv */}
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0 cursor-pointer">Aktiv</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notizen */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notizen</FormLabel>
              <FormControl>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Optionale Notizen…"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Speichern…' : 'Speichern'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void navigate(-1)}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

- [ ] **Step 6: Run TypeScript check**

```bash
cd frontend
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/api-types.ts frontend/src/features/doctors/DoctorForm.tsx
git commit -m "feat: update frontend Doctor types and form for first_name/last_name/salutation/PD Dr."
```

---

### Task 5: Regenerate API types from live backend

**Files:**
- Modify: `frontend/src/lib/api-types.ts` (regenerated)

**Note:** This task confirms the manual edits in Task 4 match the real OpenAPI schema. Run after the backend is started.

- [ ] **Step 1: Start backend**

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Leave running in a separate terminal.

- [ ] **Step 2: Regenerate types**

```bash
cd frontend
pnpm run generate-api
```

Expected: `frontend/src/lib/api-types.ts` updated. The new `first_name`, `last_name`, `salutation` fields must be present.

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. If the generated types differ from manual edits, the compiler will show the mismatches — fix them.

- [ ] **Step 4: Commit if types changed**

```bash
git add frontend/src/lib/api-types.ts
git commit -m "chore: regenerate api-types from live backend schema"
```

---

## Self-Review

**Spec coverage:**
- ✅ `name` → `first_name` + `last_name`: Task 1 (migration), Task 2 (model + schema)
- ✅ `salutation` optional: Task 1, 2, 4 (form Select Herr/Frau/none)
- ✅ Import normalisation `"Berger, Anna"` → `"Berger Anna"`: Task 3 (`_normalize_raw_name`)
- ✅ Import commit creates doctor with `first_name`/`last_name`: Task 3 (`_split_name_parts`)
- ✅ `PD Dr.` in title dropdown: Task 4 (DoctorForm)
- ✅ Backwards-compat `name` computed field: Task 2 (`DoctorResponse.@computed_field name`), Task 4 (api-types keeps `name`)
- ✅ Existing data migration strategy (name → last_name): Task 1 migration SQL
- ✅ `first_name` not required (empty string default): Task 2 schema `Field(default="")`

**Placeholder scan:** No TBD or TODO — all steps have concrete code.

**Type consistency:**
- `_split_name_parts` defined Task 3 Step 3, tested Task 3 Step 1 — consistent
- `_normalize_raw_name` defined Task 3 Step 3, tested Task 3 Step 1 — consistent
- `Doctor.first_name`/`.last_name`/`.salutation` defined Task 2 Step 1, consumed in Task 3 Step 4, Task 4 Step 5 — consistent
- `DoctorResponse.name` computed field defined Task 2 Step 2 — no consumers change, backwards-compat maintained
