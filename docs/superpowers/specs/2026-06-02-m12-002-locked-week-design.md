# Design: M12-002 — INA-Nachtdienstwochen als Input (`Shift.is_locked`)

Stand: 2026-06-02. Phase A (manueller Planungsassistent).

## Kontext

INA-Nachtdienstwochen (5 aufeinanderfolgende Tage So–Do, ein Arzt) kommen als
Input aus dem Besetzungsplan und sind für die Planerin **nicht editierbar** —
sie füllt nur die verbleibenden Fr+Sa-Lücken mit normalen N-Shifts.

M12-001 hat `Plan.besetzung_locked` eingeführt (Rotation-DnD-Sperre). M12-002
führt `Shift.is_locked` ein: ein Shift-Level-Flag, das einzelne Schichten als
Input markiert und im Editor read-only macht.

Basisspec: [2026-06-02-ina-dienstplanung-workflow-design.md](2026-06-02-ina-dienstplanung-workflow-design.md)

## Entscheidungen

- **Setzwerkzeug: Dialog aus CommandBar (Ansatz A).** Arzt + Startdatum (So) +
  Schichttyp → System erzeugt 5 gesperrte N-Shifts atomar via
  `POST /api/plans/{id}/locked-week`. Kein Frontend-Batching, kein
  Partial-State.
- **Löschen: Einzeln** über normales `DELETE /api/shifts/{id}`. Kein
  Block-Delete für die ganze Woche in M12-002.
- **Visual: Grau + Schloss-Icon.** `bg-zinc-200`, Kürzel `text-zinc-500`,
  Lucide `Lock`-Icon (10px) oben links. Kein Klick-Popover, kein Drag.
- **`is_locked` nicht in ShiftCreate/ShiftUpdate.** Nur über den dedizierten
  Endpoint setzbar — kein direkter Client-Zugriff auf das Flag.
- **Weiche Validierung:** Backend-Delete ist nicht geblockt. `is_locked`
  verhindert nur UI-Editing (Phase-A-Prinzip).

## Datenmodell

### Migration 0013

```python
op.add_column(
    "shifts",
    sa.Column("is_locked", sa.Boolean(), nullable=False, server_default="0")
)
```

### ORM (`backend/app/models/shift.py`)

```python
is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
```

### Abgrenzung `is_pinned` vs. `is_locked`

| Feld | Konsument | Bedeutung |
|---|---|---|
| `is_pinned` | Solver | Solver überschreibt diesen Shift nicht |
| `is_locked` | Editor (Frontend) | Planerin kann diesen Shift nicht editieren |

Gesperrte Nachtdienstwochen setzen **beide** Flags: `is_locked=True, is_pinned=True`.
Die Felder bleiben getrennt, weil sie unterschiedliche Konsumenten haben.

## Backend

### Schemas (`backend/app/schemas/shift.py`)

- `ShiftRead`: `is_locked: bool` ergänzen
- `ShiftCreate` / `ShiftUpdate`: **nicht** ergänzen

Neue Typen in `backend/app/schemas/locked_week.py`:

```python
class LockedWeekCreate(BaseModel):
    doctor_id: int
    start_date: date        # muss Sonntag sein (weekday() == 6)
    shift_type_id: int

class LockedWeekResult(BaseModel):
    created: list[ShiftRead]
    skipped: list[int]      # shift_ids bereits existierender Shifts
```

### Service (`backend/app/services/locked_week_service.py`)

Funktion `create_locked_week(db, plan_id, data: LockedWeekCreate) -> LockedWeekResult`:

1. Plan laden → `PlanNotFoundError` bei unbekannter `plan_id`
2. Arzt laden → `404` bei unbekannter / inaktiver `doctor_id`
3. `start_date.weekday() != 6` → `ValueError("start_date muss ein Sonntag sein")`
4. Schleife So–Do (5 Tage):
   - Shift mit `(plan_id, date, shift_type_id)` existiert? → `skipped.append(shift.id)`
   - Sonst: neuen Shift anlegen mit `is_locked=True, is_pinned=True, doctor_id=doctor_id`
5. Alles in einer Transaktion. Gibt `LockedWeekResult` zurück.

### API (`backend/app/api/plans.py`)

```
POST /api/plans/{plan_id}/locked-week
Body: LockedWeekCreate
Response 201: LockedWeekResult
Response 404: Plan nicht gefunden
Response 422: start_date kein Sonntag oder Validierungsfehler
```

### Löschen

Kein neuer Endpoint. Normales `DELETE /api/shifts/{id}` — keine Backend-Sperre
für `is_locked`-Shifts (weiche Validierung, Phase-A-Prinzip, ADR-089 analog).

## Frontend

### Typen (`frontend/src/lib/api-types.ts`)

Manuell ergänzen (OpenAPI-Generator läuft nicht auf Feature-Branches):

```typescript
// ShiftRead: is_locked: boolean hinzufügen

interface LockedWeekCreate {
  doctor_id: number;
  start_date: string;       // ISO 8601
  shift_type_id: number;
}

interface LockedWeekResult {
  created: ShiftRead[];
  skipped: number[];
}
```

### Grid-Rendering (`features/plans/UnifiedShiftCell.tsx`)

Rendering-Priorität erweitert:

```
locked → filled → dragging → hover-target → idle-dot
```

Locked-Zustand:
- Hintergrund: `bg-zinc-200`
- Kürzel: `text-zinc-500` (gedimmt)
- Schloss-Icon: Lucide `Lock`, Größe 10px, oben links
- `onClick`: kein Popover (früh returnen wenn `isLocked`)
- DnD-Source: deaktiviert (analog `besetzung_locked` in `DoctorDragSource`)

Prop: `isLocked: boolean` (aus `shift.is_locked`)

### Nachtdienstwoche-Dialog (`features/plans/LockedWeekDialog.tsx`)

Modal mit drei Feldern:

| Feld | Komponente | Validierung |
|---|---|---|
| Arzt | Select (alle aktiven Ärzte) | Pflichtfeld |
| Startdatum | Date-Picker | nur Sonntage auswählbar |
| Schichttyp | Select (alle aktiven ShiftTypes des Plans — User wählt den N-Typ) | Pflichtfeld |

Trigger: Button in `CommandBar` (neben Export-Button).

Submit → `useCreateLockedWeek`-Mutation → Invalidiert `shifts`-Query.

Toast-Logik:
- Alle 5 erstellt: „Nachtdienstwoche eingetragen."
- `skipped.length > 0`: „{n} Schichten bereits vorhanden, übersprungen."

### Hook (`features/plans/useCreateLockedWeek.ts`)

```typescript
export function useCreateLockedWeek(planId: number) {
  // useMutation → POST /api/plans/{planId}/locked-week
  // onSuccess: invalidate planShiftKeys.byPlan(planId)
}
```

Analog `useAssignShift`.

## Tests

### Backend (pytest)

`tests/services/test_locked_week_service.py`:
- Positiv: 5 Shifts erzeugt, alle `is_locked=True, is_pinned=True`, Datumsfolge So–Do korrekt
- Negativ: Startdatum kein Sonntag → ValueError
- Edge: 2 Shifts existieren bereits → `skipped` korrekt, restliche 3 erzeugt, Transaktion komplett

`tests/api/test_plans.py` (Integration):
- `POST /api/plans/{id}/locked-week` → 201 + korrekte Response-Struktur
- `POST /api/plans/{id}/locked-week` mit Nicht-Sonntag → 422
- `POST /api/plans/{id}/locked-week` mit unbekannter `plan_id` → 404

### Frontend (vitest)

- `UnifiedShiftCell`: `isLocked=true` → Schloss-Icon gerendert, kein Popover bei Klick
- `LockedWeekDialog`: Submit feuert Mutation mit korrekten Parametern; Toast bei `skipped.length > 0`

## Milestone-Deliverables

| # | Deliverable |
|---|---|
| 1 | Migration 0013: `shifts.is_locked` |
| 2 | ORM-Update `Shift.is_locked` |
| 3 | `ShiftRead.is_locked` im Schema |
| 4 | `LockedWeekCreate` / `LockedWeekResult` Schemas |
| 5 | `locked_week_service.create_locked_week()` |
| 6 | `POST /api/plans/{id}/locked-week` Endpoint |
| 7 | Service + API Tests |
| 8 | `api-types.ts` manuell ergänzt |
| 9 | `UnifiedShiftCell` locked-Rendering + Click/DnD-Block |
| 10 | `LockedWeekDialog` + `useCreateLockedWeek` Hook |
| 11 | `CommandBar`-Trigger für Dialog |
| 12 | Frontend-Tests |

## Out-of-Scope

- Bulk-Delete einer ganzen Nachtdienstwoche (Einzellöschung via normalem DELETE)
- Excel-Import von Nachtdienstwochen (M13-001)
- Backend-Schreibpfad-Sperre für `is_locked`-Shifts (weiche Validierung)
- Automatische Erkennung des „richtigen" N-ShiftTypes (User wählt explizit)
