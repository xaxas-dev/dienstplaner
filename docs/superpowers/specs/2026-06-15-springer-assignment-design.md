# Springer-Zuweisung — Design Spec

**Datum:** 2026-06-15  
**Status:** Approved

## Kontext

Ärzte können tageweise auf einer anderen Station als ihrer Monats-Rotation eingesetzt werden (Springer). Mehrere Ärzte können am selben Tag als Springer fungieren. Ärzte auf der Rotation „Springer" haben jeden Tag Springer-Dienst, die Ziel-Station wird manuell per DnD zugewiesen.

## Datenmodell

### Neue Tabelle `springer_assignments`

```sql
id                    INTEGER PRIMARY KEY AUTOINCREMENT
plan_id               INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE
shift_date            DATE NOT NULL
doctor_id             INTEGER NOT NULL REFERENCES doctors(id)
target_department_id  INTEGER NOT NULL REFERENCES departments(id)
notes                 TEXT
created_at            DATETIME NOT NULL
updated_at            DATETIME NOT NULL
UNIQUE (plan_id, shift_date, doctor_id)
```

Ein Arzt kann pro Tag pro Plan maximal eine Springer-Zuweisung haben. Mehrere Ärzte können am selben Tag Springer-Zuweisungen haben.

### Alembic-Migration

Migration `0019_add_springer_assignments.py`.

## Backend

### ORM-Model

`backend/app/models/springer_assignment.py` — `SpringerAssignment` mit Relationships zu `Plan`, `Doctor`, `Department`.

### Schemas

`backend/app/schemas/springer_assignment.py`:

```python
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
    target_department: DepartmentResponse   # eingebettet
    notes: str | None
    created_at: datetime
    updated_at: datetime
```

### Repository

`backend/app/repositories/springer_repository.py`:

- `get_by_plan(db, plan_id)` → `list[SpringerAssignment]`
- `upsert(db, plan_id, data: SpringerAssignmentCreate)` → `SpringerAssignment`  
  (update wenn `(plan_id, shift_date, doctor_id)` bereits existiert, sonst create)
- `delete(db, assignment_id)` → bool (False wenn nicht gefunden)

### API-Endpunkte

Router `backend/app/api/springer_assignments.py`, eingehängt in `main.py`:

```
GET    /api/plans/{plan_id}/springer-assignments
       → list[SpringerAssignmentResponse]
       → 404 wenn Plan nicht existiert

POST   /api/plans/{plan_id}/springer-assignments
       Body: SpringerAssignmentCreate
       → SpringerAssignmentResponse (upsert-Semantik)
       → 404 wenn Plan/Arzt/Department nicht existiert

DELETE /api/springer-assignments/{assignment_id}
       → 204 on success
       → 404 wenn nicht gefunden
```

## Frontend

### Typen (`lib/types.ts`)

```ts
interface SpringerAssignment {
  id: number
  plan_id: number
  shift_date: string        // ISO 8601
  doctor_id: number
  target_department: Department
  notes?: string | null
  created_at: string
  updated_at: string
}
```

### Hooks (`features/plans/useSpringerAssignments.ts`)

```ts
export const springerKeys = {
  byPlan: (planId: number) => ['springer-assignments', planId] as const,
}

usePlanSpringerAssignments(planId: number | null)
useCreateSpringerAssignment()    // invalidiert springerKeys.byPlan(planId) on success
useDeleteSpringerAssignment()    // invalidiert springerKeys.byPlan(planId) on success
```

### PlanPage

- Fetcht `usePlanSpringerAssignments(planId)`
- Baut `springerByKey: Map<string, SpringerAssignment>` mit Key `"${doctorId}-${dayKey}"`
- Gibt Map an `UnifiedPlanGrid` weiter
- Verwaltet State `springerPopover: { doctorId: number; dayKey: string; currentDepartmentId: number } | null`
- Behandelt Springer-Drop in `handleDragEnd` (siehe DnD-Abschnitt)

### DnD — Chip in `PlanModeBar`

Neue Konstante und Komponente:

```ts
export const SPRINGER_DRAG_ID = 'springer'
```

`SpringerDraggableChip`: Festes `id: SPRINGER_DRAG_ID`, `data: { springer: true }`.  
Visuell: Chip in Emerald-Grün (`bg-emerald-100 text-emerald-800 border-emerald-300`), Label `"Sp"`.  
Platzierung: im Chip-Bereich von `PlanModeBar`, nach den regulären Dienst-Chips, vor Abwesenheiten (getrennt durch `|`-Separator).

### DnD — Drop-Handling in `PlanPage.handleDragEnd`

```
active.id === 'springer'
AND over.id matcht /^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/
→ rotationId → doctor + currentDepartmentId aus rotations-Daten auflösen
→ setSpringerPopover({ doctorId, dayKey, currentDepartmentId })
```

Kein Alert bei bereits vorhandener Springer-Zuweisung — upsert überschreibt.

### `SpringerPopover`-Komponente (neu)

`features/plans/components/SpringerPopover.tsx`

- Props: `doctorId`, `dayKey`, `currentDepartmentId`, `onClose`, Departments-Liste
- Zeigt alle aktiven Departments **exklusiv** `currentDepartmentId`
- Auswahl → `useCreateSpringerAssignment` → `onClose()`
- Abbrechen/Escape → `onClose()` ohne Write
- Positionierung: analog `DoctorAssignPopover` (Portal, keine feste Verankerung notwendig, da Popover nach Drop immer zentriert/modal erscheinen kann)

### Zell-Rendering — `UnifiedShiftCell`

Neue Props:

```ts
springerDeptShortName?: string    // Kürzel der Ziel-Station (z.B. "IMC")
springerAssignmentId?: number     // für Delete via Double-Click
```

Rendering-Logik (ergänzt bestehende Priorität):

| Zustand | Darstellung |
|---|---|
| Nur Springer | Volle Zelle, `bg-emerald-100`, `text-emerald-800`, Dept-Kürzel zentriert, Schrift `font-semibold text-[11px]` |
| Nur Shift | Unverändert |
| Springer + Shift | Split vertikal: obere Hälfte `bg-emerald-100 text-emerald-800` + Dept-Kürzel; untere Hälfte Shift-Farbe + Shift-Code |
| Keins | Unverändert leer |

**Double-Click auf Zelle mit Springer:**
- Springer vorhanden + kein Shift → `useDeleteSpringerAssignment(springerAssignmentId)`
- Springer + Shift vorhanden → nur Springer entfernen (Shift bleibt), d.h. Double-Click löscht Springer-Assignment
- Bestehende Double-Click-Logik für reinen Shift/Absence unverändert

### `UnifiedPlanGrid`

Neues Prop `springerByKey: Map<string, SpringerAssignment>`, wird per Key `"${doctorId}-${dayKey}"` aufgelöst und als `springerDeptShortName` / `springerAssignmentId` an `UnifiedShiftCell` übergeben.

## Out of Scope

- Fairness-Zähler für Springer-Assignments
- Conflict-Engine für Springer (kein semantischer Konflikt modelliert)
- Excel-Import von Springer-Zuweisungen
- Tarif-Warnings für Springer

## Tests

**Backend:**
- `tests/test_springer_repository.py`: upsert (create / update), delete, get-by-plan
- `tests/test_api_springer.py`: GET 200/404, POST upsert, DELETE 204/404

**Frontend:**
- Hook-Tests optional; Split-Cell-Rendering via Storybook oder manueller Test
