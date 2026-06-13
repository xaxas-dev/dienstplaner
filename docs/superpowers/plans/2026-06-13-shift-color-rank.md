# ShiftType-Farbe, Grid-Färbung, Import-Kurzname, Arzt-Rang — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vier unabhängige Features: ShiftType erhält ein Farbfeld; Grid-Zellen zeigen die Schichttyp-Farbe statt Bereichsfarbe; Import-Matching nutzt auch den Kurznamen von Bereichen; Arzt-Rang ersetzt `is_facharzt`.

**Architecture:** Jedes Feature ist ein eigenständiges Backend+Frontend-Change mit eigenem Commit. Backend folgt SQLAlchemy-Mapped + Pydantic-v2-Mustern. Frontend erweitert bestehende Props und Formularfelder ohne strukturelle Änderungen.

**Tech Stack:** Python 3.12, SQLAlchemy 2, Alembic, Pydantic v2, pytest; React 18, TypeScript, Tailwind, shadcn/ui, vitest, rapidfuzz

---

## File Map

**Create:**
- `backend/alembic/versions/0017_shift_type_color.py`
- `backend/alembic/versions/0018_doctor_rank.py`
- `frontend/src/lib/shiftTypeColors.ts`

**Modify:**
- `backend/app/models/shift_type.py` — color-Feld hinzufügen
- `backend/app/schemas/shift_type.py` — color in ShiftTypeBase + ShiftTypeUpdate
- `backend/app/models/doctor.py` — DoctorRank-Enum, rank statt is_facharzt
- `backend/app/schemas/doctor.py` — rank statt is_facharzt
- `backend/app/services/import_match_service.py:101` — short_name in dept_names
- `backend/tests/services/test_import_match.py` — Tests für short_name-Matching
- `frontend/src/lib/api.ts` — ShiftTypeResponse.color, DoctorResponse.rank
- `frontend/src/features/shift-types/ShiftTypeFormDialog.tsx` — Color-Picker
- `frontend/src/features/plans/components/UnifiedShiftCell.tsx` — shiftTypeColor-Prop
- `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` — shiftTypeColor ableiten + weiterreichen
- `frontend/src/features/doctors/DoctorForm.tsx` — rank-Dropdown statt is_facharzt-Switch

---

## FEATURE A: ShiftType-Farbfeld

### Task 1: Migration 0017 — color zu shift_type

**Files:**
- Create: `backend/alembic/versions/0017_shift_type_color.py`

- [ ] **Step 1: Migration-Datei anlegen**

```python
# backend/alembic/versions/0017_shift_type_color.py
"""add color to shift_type

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shift_type", sa.Column("color", sa.String(9), nullable=True))


def downgrade() -> None:
    op.drop_column("shift_type", "color")
```

- [ ] **Step 2: Migration anwenden**

```bash
cd backend && uv run alembic upgrade head
```

Erwartung: `Running upgrade 0016 -> 0017, add color to shift_type`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/0017_shift_type_color.py
git commit -m "feat: migration 0017 — add color column to shift_type"
```

---

### Task 2: ShiftType-Modell, Schema und Frontend-Typ

**Files:**
- Modify: `backend/app/models/shift_type.py`
- Modify: `backend/app/schemas/shift_type.py`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: color-Feld ins Modell**

In `backend/app/models/shift_type.py` nach der `filter_group`-Zeile (aktuell letzte Zeile im Klassenrumpf) einfügen:

```python
    color: Mapped[str | None] = mapped_column(String(9), nullable=True)
```

`String` ist bereits importiert (für andere Felder).

- [ ] **Step 2: color in ShiftTypeBase**

In `backend/app/schemas/shift_type.py`, Klasse `ShiftTypeBase`, nach `filter_group`:

```python
    color: str | None = None
```

In `ShiftTypeUpdate`, nach dem `filter_group`-Feld:

```python
    color: str | None = None
```

`ShiftTypeResponse` erbt von `ShiftTypeBase` → bekommt `color` automatisch.

- [ ] **Step 3: color in Frontend-Typ**

```bash
grep -n "filter_group" frontend/src/lib/api.ts | head -5
```

Die `ShiftTypeResponse`-Schnittstelle in `frontend/src/lib/api.ts` finden und nach `filter_group` hinzufügen:

```typescript
  color?: string | null;
```

- [ ] **Step 4: Backend-Tests prüfen**

```bash
cd backend && uv run pytest tests/ -x -q
```

Erwartung: alle Tests grün

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/shift_type.py backend/app/schemas/shift_type.py frontend/src/lib/api.ts
git commit -m "feat: add color field to ShiftType model, schema and frontend type"
```

---

### Task 3: shiftTypeColors.ts + ShiftTypeFormDialog Color-Picker

**Files:**
- Create: `frontend/src/lib/shiftTypeColors.ts`
- Modify: `frontend/src/features/shift-types/ShiftTypeFormDialog.tsx`

- [ ] **Step 1: shiftTypeColors.ts anlegen**

```typescript
// frontend/src/lib/shiftTypeColors.ts

/** Returns shift type hex color + '80' (50% alpha) as background, or neutral fallback. */
export function shiftTypeColorMuted(hex: string | null | undefined): string {
  if (!hex) return '#f4f4f5'
  return hex + '80'
}
```

- [ ] **Step 2: color zum Zod-Schema in ShiftTypeFormDialog hinzufügen**

In `frontend/src/features/shift-types/ShiftTypeFormDialog.tsx`, das `z.object({...})`-Schema finden (Zeilen 28–68). Nach `filter_group` einfügen:

```typescript
  color: z.string().nullable().optional(),
```

- [ ] **Step 3: color in den Default-Werten setzen**

Dort, wo die `defaultValues` für `useForm` gebaut werden (nach dem Schema), nach dem `filter_group`-Default einfügen:

```typescript
  color: data?.color ?? null,
```

- [ ] **Step 4: Color-Picker in die JSX einfügen**

Nach dem `filter_group`-`FormField`-Block einfügen:

```tsx
<FormField
  control={form.control}
  name="color"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Farbe</FormLabel>
      <FormControl>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={field.value ?? '#8b5cf6'}
            onChange={e => field.onChange(e.target.value)}
            className="h-9 w-16 rounded border border-input p-1 cursor-pointer"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => field.onChange(null)}
          >
            Zurücksetzen
          </Button>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

`Button` ist bereits importiert (wird im Dialog verwendet).

- [ ] **Step 5: TypeScript prüfen**

```bash
pnpm --prefix frontend tsc --noEmit
```

Erwartung: keine Fehler

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/shiftTypeColors.ts frontend/src/features/shift-types/ShiftTypeFormDialog.tsx
git commit -m "feat: ShiftType color picker in form + shiftTypeColors utility"
```

---

## FEATURE B: Grid-Zellen nach Schichttyp gefärbt

### Task 4: UnifiedShiftCell — shiftTypeColor-Prop + neue Hintergrundlogik

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

- [ ] **Step 1: shiftTypeColor zum Props-Interface hinzufügen**

In `UnifiedShiftCellProps` (Zeilen 12–44), nach `shiftAssigned?`:

```typescript
  shiftTypeColor?: string
```

In der destrukturierten Parameterliste der Funktion (Zeilen 46–77) nach `shiftAssigned`:

```typescript
  shiftTypeColor,
```

- [ ] **Step 2: shiftTypeColors.ts importieren**

Am Anfang der Datei nach den bestehenden Imports:

```typescript
import { shiftTypeColorMuted } from '@/lib/shiftTypeColors'
```

- [ ] **Step 3: Hintergrundlogik ersetzen**

Die aktuelle `bg`-Berechnung (circa Zeile 130–137) ersetzen:

**Vorher:**
```typescript
  const bereichColor = getDepartmentColor(department)
  const dimmed =
    activeFilterGroups.size > 0 &&
    shiftFilterGroup != null &&
    !activeFilterGroups.has(shiftFilterGroup)
  const bg = inRotation ? bereichColor : `${bereichColor}28`
```

**Nachher:**
```typescript
  const bereichColor = getDepartmentColor(department)
  const dimmed =
    activeFilterGroups.size > 0 &&
    shiftFilterGroup != null &&
    !activeFilterGroups.has(shiftFilterGroup)

  // Absenz-Zellen: Bereichsfarbe beibehalten.
  // Zugewiesene Schicht: Schichttyp-Farbe (gedämpft). Leer in Rotation: neutralgrau.
  const bg = (() => {
    if (absenceId !== undefined) {
      return inRotation ? bereichColor : `${bereichColor}28`
    }
    if (shiftAssigned) return shiftTypeColorMuted(shiftTypeColor)
    if (inRotation) return '#f4f4f5'
    return `${bereichColor}28`
  })()
```

- [ ] **Step 4: TypeScript prüfen**

```bash
pnpm --prefix frontend tsc --noEmit
```

Erwartung: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "feat: UnifiedShiftCell uses shift type color for assigned cell background"
```

---

### Task 5: UnifiedPlanGrid — shiftTypeColor ableiten + weiterreichen

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`

- [ ] **Step 1: shiftTypeColor pro Zelle ableiten**

Im `dayKeys.map`-Block (Zeilen 407–473), nach der `shiftFilterGroup`-Berechnung (Zeile 419) einfügen:

```typescript
                const shiftTypeColor: string | undefined =
                  shift?.shift_type?.color ??
                  unassignedShiftByDate.get(dk)?.shift_type?.color ??
                  undefined
```

- [ ] **Step 2: shiftTypeColor an UnifiedShiftCell weiterreichen**

Im `<UnifiedShiftCell ...>`-JSX (ab Zeile 428), nach `shiftFilterGroup={shiftFilterGroup}` einfügen:

```tsx
                    shiftTypeColor={shiftTypeColor}
```

- [ ] **Step 3: TypeScript prüfen**

```bash
pnpm --prefix frontend tsc --noEmit
```

Erwartung: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat: derive and pass shiftTypeColor from shift_type.color to grid cells"
```

---

## FEATURE C: Import-Matching mit Kurzname

### Task 6: import_match_service — short_name in dept_names

**Files:**
- Modify: `backend/app/services/import_match_service.py`
- Modify: `backend/tests/services/test_import_match.py`

- [ ] **Step 1: Failing-Tests schreiben**

In `backend/tests/services/test_import_match.py` am Ende der Datei hinzufügen:

```python
from app.services.import_match_service import _match_against
from app.schemas.excel_import import MatchStatus


def test_match_against_short_name_exact():
    """Wenn short_name in db_names enthalten, wird er exakt gematcht."""
    db_names = [(7, "Neurologie Allgemein"), (7, "NEU")]
    status, matched_id, _, _ = _match_against("NEU", db_names)
    assert status == MatchStatus.EXACT
    assert matched_id == 7


def test_match_against_without_short_name_returns_new():
    """Ohne short_name-Eintrag → kein Match für Short-Name-Query."""
    db_names = [(7, "Neurologie Allgemein")]
    status, matched_id, _, _ = _match_against("NEU", db_names)
    assert status == MatchStatus.NEW
    assert matched_id is None
```

- [ ] **Step 2: Tests ausführen — beide müssen grün sein**

```bash
cd backend && uv run pytest tests/services/test_import_match.py::test_match_against_short_name_exact tests/services/test_import_match.py::test_match_against_without_short_name_returns_new -v
```

Erwartung: beide PASS — sie validieren das Verhalten von `_match_against` und zeigen, dass der Fix in `analyze_import` liegt (not in `_match_against`).

- [ ] **Step 3: analyze_import — dept_names um short_name erweitern**

In `backend/app/services/import_match_service.py`, Zeile 101 ersetzen:

**Vorher:**
```python
    dept_names = [(d.id, d.name) for d in departments]
```

**Nachher:**
```python
    dept_names: list[tuple[int, str]] = []
    for d in departments:
        dept_names.append((d.id, d.name))
        if d.short_name:
            dept_names.append((d.id, d.short_name))
```

- [ ] **Step 4: Alle Import-Match-Tests ausführen**

```bash
cd backend && uv run pytest tests/services/test_import_match.py -v
```

Erwartung: alle Tests grün

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/import_match_service.py backend/tests/services/test_import_match.py
git commit -m "feat: include department short_name in import fuzzy matching"
```

---

## FEATURE D: Arzt-Rang

### Task 7: Migration 0018 — doctor rank + is_facharzt entfernen

**Files:**
- Create: `backend/alembic/versions/0018_doctor_rank.py`

- [ ] **Step 1: Migration-Datei anlegen**

```python
# backend/alembic/versions/0018_doctor_rank.py
"""add doctor rank, remove is_facharzt

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("doctors", sa.Column("rank", sa.String(50), nullable=True))
    # Datenmigration: bisherige Facharzt-Markierung erhalten
    op.execute("UPDATE doctors SET rank = 'FACHARZT' WHERE is_facharzt = 1")
    op.drop_column("doctors", "is_facharzt")


def downgrade() -> None:
    op.add_column(
        "doctors",
        sa.Column("is_facharzt", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.execute("UPDATE doctors SET is_facharzt = 1 WHERE rank = 'FACHARZT'")
    op.drop_column("doctors", "rank")
```

- [ ] **Step 2: Migration anwenden**

```bash
cd backend && uv run alembic upgrade head
```

Erwartung: `Running upgrade 0017 -> 0018, add doctor rank, remove is_facharzt`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/0018_doctor_rank.py
git commit -m "feat: migration 0018 — add doctor rank, remove is_facharzt"
```

---

### Task 8: Doctor-Modell + Schema

**Files:**
- Modify: `backend/app/models/doctor.py`
- Modify: `backend/app/schemas/doctor.py`

- [ ] **Step 1: DoctorRank-Enum ins Modell einfügen**

In `backend/app/models/doctor.py` nach der `DoctorType`-Klasse (nach Zeile 13) einfügen:

```python
class DoctorRank(enum.StrEnum):
    ASSISTENT = "ASSISTENT"
    FACHARZT = "FACHARZT"
    FUNKTIONSOBERARZT = "FUNKTIONSOBERARZT"
    OBERARZT = "OBERARZT"
    CHEFARZT = "CHEFARZT"
```

- [ ] **Step 2: is_facharzt durch rank ersetzen**

In `backend/app/models/doctor.py`, Zeile 32 ersetzen:

**Vorher:**
```python
    is_facharzt: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
```

**Nachher:**
```python
    rank: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
```

Prüfen ob `Boolean` noch anderweitig verwendet wird:

```bash
grep -n "Boolean" backend/app/models/doctor.py
```

Wenn nur noch in Zeile 4 im Import → `Boolean` aus dem Import-Statement entfernen.

- [ ] **Step 3: DoctorRank in Schema importieren**

In `backend/app/schemas/doctor.py` am Anfang (nach bestehenden Imports) hinzufügen:

```python
from app.models.doctor import DoctorRank
```

- [ ] **Step 4: is_facharzt in DoctorBase ersetzen**

In `backend/app/schemas/doctor.py`, Klasse `DoctorBase`, Zeile 17 ersetzen:

**Vorher:**
```python
    is_facharzt: bool = False
```

**Nachher:**
```python
    rank: DoctorRank | None = None
```

- [ ] **Step 5: is_facharzt in DoctorUpdate ersetzen**

In `backend/app/schemas/doctor.py`, Klasse `DoctorUpdate`, Zeile 33 ersetzen:

**Vorher:**
```python
    is_facharzt: bool | None = None
```

**Nachher:**
```python
    rank: DoctorRank | None = None
```

- [ ] **Step 6: Weitere is_facharzt-Vorkommen im Backend bereinigen**

```bash
grep -rn "is_facharzt" backend/
```

Alle gefundenen Stellen (Tests, Router, Services) anpassen.

- [ ] **Step 7: Backend-Tests ausführen**

```bash
cd backend && uv run pytest tests/ -x -q
```

Erwartung: alle Tests grün. Fehler durch entfernte `is_facharzt` beheben.

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/doctor.py backend/app/schemas/doctor.py
git commit -m "feat: replace is_facharzt with DoctorRank enum in Doctor model and schemas"
```

---

### Task 9: DoctorForm — rank-Dropdown

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/features/doctors/DoctorForm.tsx`

- [ ] **Step 1: Frontend-Typ aktualisieren**

```bash
grep -n "is_facharzt" frontend/src/lib/api.ts frontend/src/lib/types.ts 2>/dev/null
```

In der gefundenen Datei `DoctorResponse`-Interface:

**Vorher:**
```typescript
  is_facharzt: boolean;
```

**Nachher:**
```typescript
  rank?: string | null;
```

- [ ] **Step 2: Alle weiteren is_facharzt-Vorkommen im Frontend bereinigen**

```bash
grep -rn "is_facharzt" frontend/src/
```

Jede gefundene Stelle anpassen (Komponenten, die Arzt-Daten anzeigen).

- [ ] **Step 3: Zod-Schema in DoctorForm aktualisieren**

In `frontend/src/features/doctors/DoctorForm.tsx`, Zeile 35 ersetzen:

**Vorher:**
```typescript
  is_facharzt: z.boolean(),
```

**Nachher:**
```typescript
  rank: z.string().nullable().optional(),
```

- [ ] **Step 4: Default-Werte aktualisieren**

Zeile 62 ersetzen:

**Vorher:**
```typescript
  is_facharzt: doctor?.is_facharzt ?? false,
```

**Nachher:**
```typescript
  rank: doctor?.rank ?? null,
```

- [ ] **Step 5: useEffect-Reset aktualisieren**

Zeile 79 ersetzen:

**Vorher:**
```typescript
  is_facharzt: doctor.is_facharzt,
```

**Nachher:**
```typescript
  rank: doctor.rank ?? null,
```

- [ ] **Step 6: is_facharzt-Switch durch rank-Select ersetzen**

Den `<FormField name="is_facharzt" ...>`-Block (Switch-Komponente) suchen und vollständig ersetzen durch:

```tsx
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
          <SelectItem value="ASSISTENT">Assistent</SelectItem>
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
```

Sicherstellen, dass `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` aus `@/components/ui/select` importiert sind. `Switch` und `FormSwitch`-Imports entfernen falls nicht mehr anderweitig verwendet.

- [ ] **Step 7: TypeScript prüfen**

```bash
pnpm --prefix frontend tsc --noEmit
```

Erwartung: keine Fehler

- [ ] **Step 8: Frontend-Tests ausführen**

```bash
pnpm --prefix frontend run test -- --run
```

Tests die `is_facharzt` referenzieren anpassen.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/features/doctors/DoctorForm.tsx
git commit -m "feat: replace is_facharzt Switch with DoctorRank dropdown in DoctorForm"
```
