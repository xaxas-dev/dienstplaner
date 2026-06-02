# M12-001 — Besetzungs-Layer read-only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Plan kann seinen Besetzungs-Layer (Rotation/Springer-Zuweisungen) sperren; gesperrt ist die Rotation-Erfassung per Drag & Drop deaktiviert und visuell als read-only Kontext erkennbar.

**Architecture:** Neues Feld `Plan.besetzung_locked: bool` (Default `false`), persistiert per Migration und durchgereicht über das bestehende `PATCH /api/plans/{id}`. Im Frontend setzt ein Toggle im `PlanSettingsModal` das Flag; bei `besetzung_locked=true` wird der Doctor→Bereich-DnD-Pfad gesperrt (DragSource nicht ziehbar + Drop-Handler-Guard) und ein „gesperrt"-Hinweis angezeigt. Keine harte Schreibpfad-Validierung — reine UI-Sperre (Phase-A-Prinzip „weiche Validierung", CLAUDE.md).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, alembic, pydantic v2, pytest (Backend); React 18, TypeScript, dnd-kit, TanStack Query, vitest (Frontend).

---

## File Structure

**Backend:**
- `backend/alembic/versions/0012_plan_besetzung_locked.py` — Create: Migration, fügt Spalte `plans.besetzung_locked` hinzu.
- `backend/app/models/plan.py` — Modify: ORM-Feld `besetzung_locked`.
- `backend/app/schemas/plan.py` — Modify: Feld in `PlanBase` + `PlanUpdate`.
- `backend/tests/integration/test_plans_api.py` — Modify: Test für PATCH/GET des Flags.

**Frontend:**
- `frontend/src/lib/api-types.ts` — Modify: Feld in `PlanResponse` + `PlanUpdate` (manuell, da OpenAPI-Generator nicht auf Feature-Branches läuft — CLAUDE.md-Konvention).
- `frontend/src/features/plans/components/PlanSettingsModal.tsx` — Modify: Toggle „Besetzung gesperrt".
- `frontend/src/features/plans/components/DoctorDragSource.tsx` — Modify: `locked`-Prop → Tokens nicht ziehbar + Hinweis.
- `frontend/src/features/plans/PlanPage.tsx` — Modify: `locked` an `DoctorDragSource` durchreichen; Guard in `handleDragStart`/`handleDragEnd` (Doctor-Branch).
- `frontend/src/features/plans/tests/PlanSettingsModal.test.tsx` — Create: Toggle-Test.
- `frontend/src/features/plans/components/DoctorDragSource.test.tsx` — Create: Locked-Prop-Test.

**Docs (Milestone-Abschluss):**
- `docs/roadmap.md`, `docs/decisions.md`, `CLAUDE.md` — Modify.

---

## Task 1: Migration — Spalte `plans.besetzung_locked`

**Files:**
- Create: `backend/alembic/versions/0012_plan_besetzung_locked.py`

- [ ] **Step 1: Migration-Datei schreiben**

```python
"""add besetzung_locked to plans

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-02
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("plans") as batch_op:
        batch_op.add_column(
            sa.Column(
                "besetzung_locked",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("plans") as batch_op:
        batch_op.drop_column("besetzung_locked")
```

- [ ] **Step 2: Migration anwenden (Smoke)**

Run: `cd backend && uv run alembic upgrade head`
Expected: Läuft ohne Fehler durch, Revision `0012` ist head.

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/0012_plan_besetzung_locked.py
git commit -m "feat(plan): Migration 0012 — plans.besetzung_locked (M12-001)"
```

---

## Task 2: Backend — ORM + Schema + API-Test

**Files:**
- Modify: `backend/app/models/plan.py`
- Modify: `backend/app/schemas/plan.py`
- Test: `backend/tests/integration/test_plans_api.py`

- [ ] **Step 1: Failing Test schreiben**

Am Ende von `backend/tests/integration/test_plans_api.py` anhängen (nutzt vorhandene Helfer `_create_plan`, `_seed_shift_types` und die `client`-Fixture):

```python
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag verifizieren**

Run: `cd backend && uv run pytest tests/integration/test_plans_api.py::test_patch_besetzung_locked_true -v`
Expected: FAIL — `KeyError: 'besetzung_locked'` (Feld existiert noch nicht in Response).

- [ ] **Step 3: ORM-Feld ergänzen**

In `backend/app/models/plan.py`: Import `Boolean` ergänzen (bestehende Import-Zeile aus `sqlalchemy`):

```python
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, Integer, String, Text
```

Im `Plan`-Modell nach dem `notes`-Feld (nach Zeile 38) einfügen:

```python
    besetzung_locked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
```

- [ ] **Step 4: Schema-Felder ergänzen**

In `backend/app/schemas/plan.py`:

In `PlanBase` (nach `notes: str | None = None`, Zeile 17) ergänzen:

```python
    besetzung_locked: bool = False
```

In `PlanUpdate` (nach `notes: str | None = None`, Zeile 29) ergänzen:

```python
    besetzung_locked: bool | None = None
```

- [ ] **Step 5: Tests laufen lassen, Erfolg verifizieren**

Run: `cd backend && uv run pytest tests/integration/test_plans_api.py -v`
Expected: PASS (inkl. `test_besetzung_locked_defaults_false`, `test_patch_besetzung_locked_true`).

- [ ] **Step 6: Lint**

Run: `cd backend && uv run ruff check app/models/plan.py app/schemas/plan.py`
Expected: All checks passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/plan.py backend/app/schemas/plan.py backend/tests/integration/test_plans_api.py
git commit -m "feat(plan): besetzung_locked ORM+Schema+API-Test (M12-001)"
```

---

## Task 3: Frontend-Typen ergänzen

**Files:**
- Modify: `frontend/src/lib/api-types.ts`

Kontext: `Plan = components['schemas']['PlanResponse']` und `PlanUpdate = components['schemas']['PlanUpdate']` ([types.ts:64-66](../../../frontend/src/lib/types.ts#L64)). Generator läuft nicht auf Feature-Branches → manuell ergänzen (CLAUDE.md Dashboard-Pattern).

- [ ] **Step 1: `PlanResponse`-Schema ergänzen**

In `frontend/src/lib/api-types.ts` im Objekt `PlanResponse` (ab Zeile ~1409) das Feld ergänzen (zu den übrigen Properties wie `notes`):

```ts
            besetzung_locked: boolean;
```

- [ ] **Step 2: `PlanUpdate`-Schema ergänzen**

Im Objekt `PlanUpdate` (gleiche Datei) ergänzen:

```ts
            besetzung_locked?: boolean | null;
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: Keine Fehler (Feld ist additiv).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api-types.ts
git commit -m "feat(plan): besetzung_locked in Frontend-Typen (M12-001)"
```

---

## Task 4: Frontend — Toggle im PlanSettingsModal

**Files:**
- Modify: `frontend/src/features/plans/components/PlanSettingsModal.tsx`
- Test: `frontend/src/features/plans/tests/PlanSettingsModal.test.tsx`

- [ ] **Step 1: Failing Test schreiben**

Create `frontend/src/features/plans/tests/PlanSettingsModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanSettingsModal } from '../components/PlanSettingsModal'

const mutate = vi.fn()

vi.mock('../useConstraintOverrides', () => ({
  useConstraintOverrides: () => ({ data: [] }),
  useCreateConstraintOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteConstraintOverride: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../usePlans', () => ({
  usePlan: () => ({ data: { id: 1, besetzung_locked: false } }),
}))

vi.mock('../useUpdatePlan', () => ({
  useUpdatePlan: () => ({ mutate, isPending: false }),
}))

describe('PlanSettingsModal — Besetzungssperre', () => {
  beforeEach(() => mutate.mockClear())

  it('toggelt besetzung_locked beim Klick', () => {
    render(<PlanSettingsModal planId={1} open onOpenChange={() => {}} />)
    const toggle = screen.getByLabelText('Besetzung sperren')
    fireEvent.click(toggle)
    expect(mutate).toHaveBeenCalledWith({ besetzung_locked: true })
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag verifizieren**

Run: `cd frontend && pnpm vitest run src/features/plans/tests/PlanSettingsModal.test.tsx`
Expected: FAIL — `Unable to find a label with the text of: Besetzung sperren`.

- [ ] **Step 3: Modal erweitern**

In `frontend/src/features/plans/components/PlanSettingsModal.tsx`:

Imports ergänzen (zu den bestehenden Hook-Imports):

```tsx
import { usePlan } from '../usePlans'
import { useUpdatePlan } from '../useUpdatePlan'
```

Innerhalb `PlanSettingsModal`, nach den vorhandenen Mutation-Hooks (nach Zeile 31), ergänzen:

```tsx
  const { data: plan } = usePlan(planId)
  const updatePlan = useUpdatePlan(planId)
  const besetzungLocked = plan?.besetzung_locked ?? false
```

Im JSX, direkt nach dem öffnenden `<div className="space-y-4 py-2">` (vor dem Hinweis-`<p>`), die Sperr-Sektion einfügen:

```tsx
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <Label className="text-sm cursor-pointer" htmlFor="toggle-besetzung-locked">
                Besetzung gesperrt
              </Label>
              <p className="text-[12px] text-muted-foreground">
                Rotations-Zuweisungen sind dann nur Kontext (read-only).
              </p>
            </div>
            <Switch
              id="toggle-besetzung-locked"
              checked={besetzungLocked}
              onCheckedChange={(checked) =>
                updatePlan.mutate({ besetzung_locked: checked })
              }
              disabled={updatePlan.isPending}
              aria-label={besetzungLocked ? 'Besetzung entsperren' : 'Besetzung sperren'}
            />
          </div>
```

- [ ] **Step 4: Test laufen lassen, Erfolg verifizieren**

Run: `cd frontend && pnpm vitest run src/features/plans/tests/PlanSettingsModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanSettingsModal.tsx frontend/src/features/plans/tests/PlanSettingsModal.test.tsx
git commit -m "feat(plan): Toggle Besetzung gesperrt im PlanSettingsModal (M12-001)"
```

---

## Task 5: Frontend — DnD-Sperre + DragSource-Locked + Hinweis

**Files:**
- Modify: `frontend/src/features/plans/components/DoctorDragSource.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`
- Test: `frontend/src/features/plans/components/DoctorDragSource.test.tsx`

- [ ] **Step 1: Failing Test schreiben**

Create `frontend/src/features/plans/components/DoctorDragSource.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { DoctorDragSource } from './DoctorDragSource'
import type { Doctor } from '@/lib/types'

const doctors = [
  { id: 1, name: 'Dr. Test', short_name: 'TE', active: true } as unknown as Doctor,
]

function renderSource(locked: boolean) {
  return render(
    <DndContext>
      <DoctorDragSource doctors={doctors} locked={locked} />
    </DndContext>,
  )
}

describe('DoctorDragSource — locked', () => {
  it('Tokens sind ziehbar wenn nicht gesperrt', () => {
    renderSource(false)
    expect(screen.getByRole('button', { name: /Dr\. Test/ }))
      .toHaveAttribute('aria-roledescription', 'ziehbarer Arzt')
  })

  it('Tokens sind nicht ziehbar wenn gesperrt', () => {
    renderSource(true)
    expect(screen.getByRole('button', { name: /Dr\. Test/ }))
      .not.toHaveAttribute('aria-roledescription')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag verifizieren**

Run: `cd frontend && pnpm vitest run src/features/plans/components/DoctorDragSource.test.tsx`
Expected: FAIL — `locked` ist noch keine Prop; das gesperrte Token trägt weiterhin `aria-roledescription`.

- [ ] **Step 3: `DoctorDragSource` um `locked` erweitern**

In `frontend/src/features/plans/components/DoctorDragSource.tsx`:

Props-Interface erweitern:

```tsx
interface DoctorDragSourceProps {
  doctors: Doctor[]
  rotationDoctorIds?: Set<number>
  highlightedDoctorId?: number | null
  onHighlightDoctor?: (doctorId: number | null) => void
  locked?: boolean
}
```

Signatur + Default ergänzen:

```tsx
export function DoctorDragSource({
  doctors,
  rotationDoctorIds = new Set(),
  highlightedDoctorId,
  onHighlightDoctor,
  locked = false,
}: DoctorDragSourceProps) {
```

`locked` an die `DoctorToken`-Verwendung im „Verfügbar"-Abschnitt durchreichen:

```tsx
              <li key={doctor.id}>
                <DoctorToken doctor={doctor} locked={locked} />
              </li>
```

Direkt nach dem öffnenden `<aside ...>`-Tag einen Sperr-Hinweis einfügen:

```tsx
      {locked && (
        <p className="text-[11px] text-ink-3 italic px-1">
          Besetzung gesperrt — nur Kontext
        </p>
      )}
```

`DoctorToken` so umbauen, dass es bei `locked` nicht ziehbar ist (kein `useDraggable`-Verhalten, kein `aria-roledescription`):

```tsx
interface DoctorTokenProps {
  doctor: Doctor
  locked?: boolean
}

function DoctorToken({ doctor, locked = false }: DoctorTokenProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeDoctorDragId(doctor.id),
    data: { doctorId: doctor.id, doctorName: doctor.name },
    disabled: locked,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(locked ? {} : attributes)}
      {...(locked ? {} : listeners)}
      {...(locked ? {} : { 'aria-roledescription': 'ziehbarer Arzt' })}
      className={[
        'w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left',
        'transition hover:bg-paper',
        'focus:outline-none focus:ring-2 focus:ring-accent',
        locked ? 'cursor-default opacity-70' : 'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={24} />
      <span className="text-sm text-ink truncate">{doctor.name}</span>
    </button>
  )
}
```

Hinweis: Das bisherige `aria-roledescription="ziehbarer Arzt"`-Attribut wird aus dem JSX entfernt und nur noch im ungesperrten Fall via Spread gesetzt.

- [ ] **Step 4: Test laufen lassen, Erfolg verifizieren**

Run: `cd frontend && pnpm vitest run src/features/plans/components/DoctorDragSource.test.tsx`
Expected: PASS (beide Fälle).

- [ ] **Step 5: PlanPage — `locked` durchreichen + Drop-Guard**

In `frontend/src/features/plans/PlanPage.tsx`:

`locked` an `DoctorDragSource` übergeben (die JSX-Verwendung der Sidebar finden und Prop ergänzen):

```tsx
        <DoctorDragSource
          doctors={doctors}
          rotationDoctorIds={rotationDoctorIds}
          highlightedDoctorId={highlightedDoctorId}
          onHighlightDoctor={setHighlightedDoctorId}
          locked={plan?.besetzung_locked ?? false}
        />
```

(Falls einzelne dieser Props in der vorhandenen Verwendung fehlen, nur `locked={plan?.besetzung_locked ?? false}` additiv ergänzen — die übrigen unverändert lassen.)

Guard in `handleDragStart` ganz am Anfang des Doctor-Branch einfügen (nach `if (doctorId !== null) {`, vor `const doctor = ...`):

```tsx
      if (plan?.besetzung_locked) return
```

Guard in `handleDragEnd` ganz am Anfang des Doctor-Branch einfügen (nach `if (doctorId !== null) {`, vor `if (!plan) return`):

```tsx
      if (plan.besetzung_locked) return
```

(Im `handleDragEnd`-Branch ist `plan` durch das folgende `if (!plan) return` bereits abgesichert; reihenfolge-sicher den Guard direkt danach setzen — siehe Step-6-Verifikation.)

Korrekte Reihenfolge im `handleDragEnd`-Doctor-Branch:

```tsx
    if (doctorId !== null) {
      if (!plan) return
      if (plan.besetzung_locked) return
      const doctor = doctors.find((d) => d.id === doctorId)
      // ... unverändert
```

- [ ] **Step 6: Typecheck + Frontend-Tests**

Run: `cd frontend && pnpm tsc --noEmit && pnpm vitest run`
Expected: Keine Typfehler; alle Tests grün (inkl. bestehender PlanPage-Tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/plans/components/DoctorDragSource.tsx frontend/src/features/plans/components/DoctorDragSource.test.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plan): Rotation-DnD bei gesperrter Besetzung deaktiviert (M12-001)"
```

---

## Task 6: Milestone-Abschluss — Dokumentation

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `docs/decisions.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Roadmap-Abschnitt ergänzen**

In `docs/roadmap.md` nach dem Abschnitt „Phase B — Constraint-Override-System" einen neuen Abschnitt einfügen:

```markdown
## Phase A — Workflow-Konzept (M12, neu)

Basis: docs/superpowers/specs/2026-06-02-ina-dienstplanung-workflow-design.md

| ID | Titel | Status |
|----|-------|--------|
| M12-001 | Besetzungs-Layer read-only (`Plan.besetzung_locked`, Rotation-DnD-Sperre) | ✅ Abgeschlossen (2026-06-02) |
| M12-002 | INA-Nachtdienstwochen als Input (`Shift.is_locked`) | offen |
| M12-003 | Feiertagskalender (`Holiday`, SH-Auto + manuell) | offen |
| M12-004 | Wünsche-Erfassung UI (`Wish`-CRUD) | offen |
| M12-005 | Fokus-Filter Dienst-Phasen (Nacht/Tag/V) | offen |
| M12-006 | Fairness-Zähler-Sidebar | offen |
| M12-007 | Hinweis WE vor/nach Urlaub | offen |
| M13-001 | Excel-Import Besetzung (blockiert durch OQ-012) | offen |
```

- [ ] **Step 2: ADR ergänzen**

In `docs/decisions.md` am Ende einen neuen ADR anhängen (nächste freie Nummer, hier ADR-089 — beim Schreiben gegen die zuletzt vergebene Nummer prüfen und ggf. erhöhen):

```markdown
## ADR-089: Besetzungs-Layer-Sperre als UI-Flag, nicht als Schreibpfad-Constraint

**Status:** Angenommen (2026-06-02, M12-001)

**Kontext:** Die Besetzung (RotationAssignment) ist im realen Workflow ein
Input fremder Planung; die INA-Dienstplanerin soll sie als read-only Kontext
sehen, nicht versehentlich ändern (Spec 2026-06-02-ina-dienstplanung-workflow).

**Entscheidung:** `Plan.besetzung_locked: bool` (Default `false`) steuert
ausschließlich die UI: gesperrt ⇒ Doctor→Bereich-DnD deaktiviert (DragSource
nicht ziehbar + Drop-Handler-Guard). Es gibt **keine** harte Backend-Validierung,
die ein Schreiben gesperrter Rotationen verhindert — konsistent mit dem
Phase-A-Prinzip „weiche Validierung" (CLAUDE.md). Das künftige
Besetzungsplanungs-Modul (Zukunft) bleibt der legitime Schreibweg.

**Abgrenzung:** `besetzung_locked` (Plan-Ebene, Editor-Kontext) ist getrennt von
`Shift.is_pinned` (Solver-Konzept) und dem späteren `Shift.is_locked`
(Input-Shift, M12-002).

**Konsequenzen:** Sperre ist client-seitig umgehbar (akzeptabel, Single-User,
lokal). Kein Migrations-Risiko für Bestandspläne (`server_default false`).
```

- [ ] **Step 3: CLAUDE.md-Konvention ergänzen**

In `CLAUDE.md` unter „Domänen-Konzepte" (nach dem „Pin-Konzept"-Punkt) ergänzen:

```markdown
- **Besetzungs-Layer-Sperre (M12-001):** `Plan.besetzung_locked: bool`
  (Default `false`) sperrt nur die UI-Erfassung von Rotationen (Doctor→Bereich-DnD).
  Keine Backend-Validierung (weiche Validierung). Getrennt von `Shift.is_pinned`
  (Solver) und `Shift.is_locked` (Input-Shift, M12-002). ADR-089.
```

- [ ] **Step 4: Voller Testlauf**

Run: `cd backend && uv run pytest` und `cd frontend && pnpm vitest run`
Expected: Backend grün (alle bestehenden + 2 neue), Frontend grün (alle bestehenden + 2 neue).

- [ ] **Step 5: Commit**

```bash
git add docs/roadmap.md docs/decisions.md CLAUDE.md
git commit -m "docs: M12-001 Abschluss — Roadmap, ADR-089, CLAUDE.md"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Coverage (gegen 2026-06-02-ina-dienstplanung-workflow-design.md, M12-001):**
- `Plan.besetzung_locked` + Migration → Task 1+2 ✓
- Rotation-DnD sperren → Task 5 ✓
- Kontext-Optik (read-only erkennbar) → Task 5 (DragSource-Hinweis + opacity) ✓
- Lock-Schalter → Task 4 (PlanSettingsModal) ✓
- „keine harte DB-Validierung" → Task 2/6 (nur UI, ADR-089) ✓

**Placeholder-Scan:** Kein TBD/TODO; jeder Code-Step enthält vollständigen Code.

**Typ-Konsistenz:** Feldname `besetzung_locked` durchgängig (ORM, Schema, api-types,
Modal, PlanPage, Tests). `locked`-Prop konsistent in `DoctorDragSource`/`DoctorToken`.
`useUpdatePlan().mutate({ besetzung_locked })` passt zu `PlanUpdate`-Typ.

**Scope:** Vertikaler Slice (DB→API→UI) für genau eine Kernfunktion — passt zur
Eng-Schnitt-Milestone-Konvention.

**Bewusst NICHT in M12-001 (Folge-Milestones):** Absence-DnD-Sperre, Rotation-Lösch-Sperre
bei gesperrter Besetzung, Excel-Import. Falls die Lösch-Aktion (`pendingDeleteRotation`)
bei gesperrter Besetzung weiterhin erreichbar ist, in M12-002 nachziehen — für M12-001
ist die Drag-Erfassung der primäre Schreibpfad.
```
