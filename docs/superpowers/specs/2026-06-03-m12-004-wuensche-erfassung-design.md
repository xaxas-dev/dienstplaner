# Design: M12-004 — Wünsche-Erfassung UI

Stand: 2026-06-03. Phase A (manueller Planungsassistent).

## Kontext

Schritt 1 im realen INA-Planungs-Workflow (docs/superpowers/specs/2026-06-02-ina-dienstplanung-workflow-design.md):
Ärzte äußern Wünsche (kein Dienst, kein bestimmter Dienst, Wunschdienst).
Das `Wish`-Modell existiert bereits (models/wish.py, schemas/wish.py, Migration 0004),
aber Repository, Service, API-Routes und Frontend fehlen vollständig.

Erweiterung gegenüber ursprünglichem Scope: Schema-Extension für dauerhafte
Wünsche (arztbezogen, ohne Datumsbindung) und Wochentag-Präferenzen.

## Drei Wunsch-Sub-Typen (ein Modell)

| Sub-Typ | wish_date | day_of_week | Beispiel |
|---|---|---|---|
| Datumswunsch | gesetzt | null | „15.3. kein Dienst" |
| Wochentag-Präferenz | null | gesetzt (0–6) | „Freitags N-Dienst" |
| Allgemeine Präferenz | null | null | „Nie N-Dienst" |

**Invariante:** `wish_date` und `day_of_week` dürfen nie gleichzeitig gesetzt sein.

## Schema-Erweiterung (Migration 0015)

```python
# models/wish.py — Änderungen
wish_date: Mapped[date | None]   # war NOT NULL → nullable
day_of_week: Mapped[int | None]  # NEU: 0=Mo…6=So (Python weekday()-Konvention)
```

`WishCreate`-Validator prüft:
- AVOID_DAY → keine shift_type_id
- AVOID_SHIFT / REQUIRE_SHIFT → shift_type_id required
- nicht (wish_date != null AND day_of_week != null)

Bestehende Wishes (alle mit wish_date) bleiben unverändert.

## Backend

### Neue Dateien

**`backend/app/repositories/wish_repository.py`**
- `get_wishes_by_doctor(db, doctor_id) -> list[Wish]`
- `get_wishes_for_plan_period(db, plan_id) -> list[Wish]`
  — alle Ärzte mit aktiver Rotation im Plan-Zeitraum;
  Datumswünsche werden gefiltert (wish_date im Zeitraum),
  Wochentag- und allgemeine Wünsche immer eingeschlossen
- `create_wish(db, data: WishCreate) -> Wish`
- `update_wish(db, wish_id, data: WishUpdate) -> Wish | None`
- `delete_wish(db, wish_id) -> bool`

**`backend/app/services/wish_service.py`**
- Thin wrapper; `WishNotFoundError` für 404; Validierung delegiert an Schema

**`backend/app/api/wishes.py`**

| Method | Path | Response |
|---|---|---|
| GET | `/api/doctors/{id}/wishes` | `list[WishResponse]` |
| POST | `/api/doctors/{id}/wishes` | `WishResponse` 201 |
| PATCH | `/api/wishes/{id}` | `WishResponse` |
| DELETE | `/api/wishes/{id}` | 204 |
| GET | `/api/plans/{id}/wishes` | `list[WishResponse]` |

`GET /api/plans/{id}/wishes` → für Grid-Hints; 404 wenn Plan unbekannt.

### Schema-Ergänzungen (schemas/wish.py)

`WishResponse` erhält `day_of_week: int | None`.
`WishUpdate` erhält `day_of_week: int | None`.

## Frontend

### DoctorDetailPage — neuer Abschnitt „Wünsche"

Analog `INAExclusionList` + `INAExclusionFormDialog`:

**`frontend/src/features/doctors/WishList.tsx`**
- Tabelle: Sub-Typ, Datum/Wochentag, WishType, ShiftType, Priority, Notes, Delete
- Create-Button → `WishFormDialog`

**`frontend/src/features/doctors/WishFormDialog.tsx`**
- WishType-Select (AVOID_DAY / AVOID_SHIFT / REQUIRE_SHIFT)
- Sub-Typ-Radio: „Konkretes Datum" / „Wochentag" / „Allgemein"
- Conditional: `<input type="date">` | Wochentag-Select (Mo–So) | nichts
- ShiftType-Select (nur bei AVOID_SHIFT / REQUIRE_SHIFT)
- Priority 1–3, Notes (optional)

**`frontend/src/features/doctors/useWishes.ts`**
- `useWishesByDoctor(doctorId)` → `GET /api/doctors/{id}/wishes`
- `useCreateWish`, `useUpdateWish`, `useDeleteWish`
- Query-Key-Objekt `wishKeys` exportieren

### PlanPage — Schnellerfassung

- Hover auf `UnifiedShiftCell` zeigt Lucide `Star`-Icon (klein, top-right)
- Klick → `WishFormDialog` mit vorausgefülltem `wish_date` (aus Spalte) + `doctor_id` (aus Zeile)
- Sub-Typ fixiert auf „Konkretes Datum" (kein Wochentag-Erfassen im Plan-Kontext)

### Grid-Hint-Layer

**`frontend/src/features/plans/useWishes.ts`** (separater Hook für Plan-Kontext)
- `useWishes(planId: number | null)` → `GET /api/plans/{id}/wishes`
- `enabled`-Guard wie `useHolidays`

**`frontend/src/features/plans/wishGridUtils.ts`** (pure Funktion)

```ts
// Gibt true wenn ein Wunsch auf diesen Arzt+Datum passt
function wishMatchesCell(wish: WishResponse, doctorId: number, cellDate: Date): boolean
```

Matching-Logik:
- Datumswunsch: `wish.wish_date === cellDate (ISO-String)`
- Wochentag: `wish.day_of_week === (cellDate.getDay() + 6) % 7`
  (JS `getDay()`: So=0…Sa=6 → Umrechnung auf Python weekday: Mo=0…So=6)
- Allgemein: beide null → immer true für diesen Arzt

**Visuelle Darstellung in `UnifiedShiftCell`:**
- Shift belegt + Wunsch → Ring/Kreis um Dienstkürzel (`ring-2`)
- Leere Zelle + Wunsch → farbiger Hintergrund-Tint
- AVOID_* → Amber (`ring-amber-400`, `bg-amber-50`)
- REQUIRE_* → Grün (`ring-green-500`, `bg-green-50`)
- Mehrere Wünsche: AVOID dominiert über REQUIRE

**Toggle:**
- `showWishes: boolean` Session-State in `PlanPage` (Default: `true`)
- Button in Toolbar neben Fokus-Filter-Buttons, Lucide `Star`-Icon
- `showWishes={showWishes}` als Prop in `UnifiedPlanGrid` → `UnifiedShiftCell`

## Tests

### Backend (pytest)

- `test_wish_repository.py`:
  - `get_wishes_by_doctor` liefert nur Wünsche des angegebenen Arztes
  - `get_wishes_for_plan_period`: Datumswunsch außerhalb Zeitraum → nicht enthalten; Wochentag-Wunsch → immer enthalten; allgemeiner Wunsch → immer enthalten
- `test_wish_service.py`:
  - AVOID_DAY mit shift_type_id → ValidationError
  - AVOID_SHIFT ohne shift_type_id → ValidationError
  - wish_date + day_of_week beide gesetzt → ValidationError
- `test_api_wishes.py`:
  - CRUD-Roundtrip alle Sub-Typen
  - 404 bei unbekannter wish_id
  - `GET /api/plans/{id}/wishes` nur Ärzte mit aktiver Rotation

### Frontend (vitest)

- `WishFormDialog`: Sub-Typ-Wechsel zeigt/versteckt Felder korrekt
- `wishGridUtils.ts`: matching alle drei Sub-Typen, positiv + negativ
- `WishList`: Delete-Mutation wird aufgerufen
- PlanPage: `showWishes=false` → kein Wish-Prop an Grid übergeben

## Out-of-Scope

- Wünsche als Solver-Soft-Constraint (Phase B)
- Bulk-Erfassung mehrerer Wünsche auf einmal
- Wunsch-Verletzungs-Dot (separater Konflikt-Dot) im Grid
- Wünsche im Excel-Export
