# M12-005 Fokus-Filter Dienst-Phasen — Design-Spec

**Datum:** 2026-06-03  
**Milestone:** M12-005  
**Status:** Approved

## Ziel

Die Planerin kann im Plan-Grid Schichttypen nach frei konfigurierbaren Gruppen (z.B. „Nacht", „Tag", „V") filtern. Nicht zur aktiven Gruppe gehörende Zellen werden gedimmt. Mehrere Gruppen gleichzeitig aktivierbar (Multi-Select).

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Gruppen-Quelle | Dynamisch aus ShiftType-Daten (Ansatz 1) |
| Null-Verhalten | `filter_group = null` → ShiftType immer sichtbar |
| Filter-Modus | Multi-Select (Set), leer = Alle |
| Gruppen-Namen | Free-text, kein Backend-Enum |

## Datenmodell — Backend

### Migration (0016)

```sql
ALTER TABLE shift_types ADD COLUMN filter_group VARCHAR(50) NULL;
```

Default: `NULL`.

### ORM-Modell

```python
# backend/app/models/shift_type.py
filter_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
```

### Pydantic-Schemas

`filter_group: str | None = None` in `ShiftTypeBase`, `ShiftTypeRead`, `ShiftTypeUpdate`.

Keine neuen API-Routen — bestehende GET/PATCH ShiftType-Endpoints reichen.

## Frontend — ShiftType-Konfiguration

### ShiftTypeFormDialog.tsx

Neues optionales Textfeld „Filter-Gruppe":

- Zod: `filter_group: z.string().nullable().optional()`
- Input: leer → `null` beim Submit (`values.filter_group || null`)
- Position: nach `notes`-Feld

## Frontend — Filter-UI

### ShiftTypeDragBar.tsx

Gruppen-Ableitung:
```ts
const groups = [...new Set(
  shiftTypes.map(st => st.filter_group).filter(Boolean)
)].sort() as string[]
```

Render: ShiftType-Chips links, Gruppen-Filter rechts:
```
[V-Chip] [T-Chip] [N-Chip] ...  |  [Alle] [V] [Tag] [Nacht]
```

- `[Alle]`-Button: immer sichtbar, setzt `activeFilterGroups` auf leeres Set
- Gruppen-Chips: aktiv = `bg-accent text-white border-accent`, inaktiv = `bg-paper text-ink-3 border-line`
- Keine Gruppen konfiguriert: nur `[Alle]`-Button sichtbar (kein Overhead)

### State in PlanPage.tsx

```ts
// vorher
const [focusMode, setFocusMode] = useState<'alle' | 'vn'>('alle')

// nachher
const [activeFilterGroups, setActiveFilterGroups] = useState<Set<string>>(new Set())
```

Toggle-Handler:
```ts
function toggleFilterGroup(group: string) {
  setActiveFilterGroups(prev => {
    const next = new Set(prev)
    next.has(group) ? next.delete(group) : next.add(group)
    return next
  })
}
```

Props zu `ShiftTypeDragBar`:
- `activeFilterGroups: Set<string>`
- `onFilterGroupToggle: (group: string) => void`
- `onFilterGroupClear: () => void`

Props zu `UnifiedPlanGrid`:
- `activeFilterGroups: Set<string>` (ersetzt `focusMode`)

## Frontend — Dimming-Logik

### UnifiedPlanGrid.tsx

Props-Änderung: `focusMode: 'alle' | 'vn'` → `activeFilterGroups: Set<string>`.

Für jede Zelle das `filter_group` des zugehörigen ShiftTypes auflösen:
- Shifts enthalten `shift_type` (bereits in API-Response)
- Lookup: `shift?.shift_type?.filter_group ?? null`

### UnifiedShiftCell.tsx

Props-Änderung:
```ts
// vorher
focusMode: 'alle' | 'vn'

// nachher
activeFilterGroups: Set<string>
shiftFilterGroup?: string | null
```

Dimming-Regel:
```ts
const dimmed =
  activeFilterGroups.size > 0 &&
  shiftFilterGroup != null &&
  !activeFilterGroups.has(shiftFilterGroup)
```

Semantik:
- `activeFilterGroups.size === 0` → nie dimmen (Alle)
- `shiftFilterGroup == null` → nie dimmen (ShiftType ohne Gruppe = immer sichtbar)
- Gruppe in aktiver Menge → nicht dimmen
- sonst → dimmen

## Tests

### Backend

- Migration: `filter_group` nullable, Default `None`
- `ShiftTypeUpdate` mit `filter_group` serialisiert korrekt
- Bestehende ShiftType-Tests grün (rückwärtskompatibel)

### Frontend

- `ShiftTypeFormDialog.test.tsx`: Feld rendern + submit mit `filter_group`
- `UnifiedShiftCell`-Tests: Dimming mit leerem Set, einer Gruppe aktiv, `shiftFilterGroup = null`
- `ShiftTypeDragBar`-Tests: Gruppen-Chips aus ShiftType-Daten, Toggle-Verhalten, Clear

## Scope-Grenze

- Keine Persistenz des Filter-States (Session-only, kein localStorage)
- Keine Farb-Konfiguration für Gruppen
- Keine Sortierung der Gruppen-Chips konfigurierbar (alphabetisch)
- Kein Backend-Enum — Tippfehler ergeben neue Gruppen (Single-User, akzeptiert)
