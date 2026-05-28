# Abwesenheits-DnD im Planungsmodus

**Datum:** 2026-05-28  
**Status:** Approved

## Ziel

Abwesenheiten (Urlaub, Krankheit etc.) per Drag & Drop direkt in den Schichtplan eintragen. Daten landen in den Arzt-Eigenschaften (Absence-API). Löschen direkt aus der Grid-Zelle per Doppelklick.

## Scope

- Neue Abwesenheits-DnD-Zone rechts neben der Dienste-Zone
- "Alle Dienste"-Toggle-Button wandert in die Dienste-Zone
- 6 Abwesenheitstypen als draggbare Chips
- Popover für Zeitraum-Eingabe nach Drop
- Doppelklick auf Abwesenheits-Zelle → Löschen

**Nicht im Scope:** Bearbeiten (Zeitraum ändern) aus dem Grid — nur über Arzt-Eigenschaften.

---

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Interaktionsmodell | B — Drop öffnet Popover, User gibt `valid_to` ein |
| Abwesenheitstypen | Alle 6 als Chips |
| Fortbildung-Kürzel | **FB** (nicht "Fo") — überall konsistent |
| Löschen | Doppelklick → Confirmation → Komplett-Löschen (kein Kürzen) |
| Drag-Konflikt-Highlighting | Nicht für Absence-Chips (nur für ShiftType-Chips) |

---

## Neue Dateien

### `AbsenceTypeDragBar.tsx`

```
frontend/src/features/plans/components/AbsenceTypeDragBar.tsx
```

- `makeAbsenceDragId(type: AbsenceType): string` → `"absence-URLAUB"` etc.
- `parseAbsenceDragId(id: string): AbsenceType | null`
- Renders 6 `AbsenceTypeChip`s via `useDraggable`
- Chip-Styling: warmer Ton (`#FFF8F0`, `#d4c8b4`-Border, `#7a5c3a`-Text) — visuell unterscheidbar von Dienste-Chips
- Labels: U, K, FB, EZ, MuSchu, EA (mit `title` für Vollname)
- Kein focusMode-Dimming

### `AbsenceAssignPopover.tsx`

```
frontend/src/features/plans/components/AbsenceAssignPopover.tsx
```

Props:
```typescript
interface AbsenceAssignPopoverProps {
  doctorId: number
  doctorName: string
  absenceType: AbsenceType
  defaultFrom: string  // ISO date, aus Drop-Zelle
  planId: number
  onClose: () => void
}
```

Felder:
- **Arztname** — read-only Header-Zeile
- **Typ-Badge** — read-only (`U — Urlaub` etc.), aus `absenceType` Prop
- **Von** — DatePicker, vorausgefüllt mit `defaultFrom`, editierbar
- **Bis** — DatePicker, leer, Pflichtfeld (Terrakotta-Border wenn leer)
- **Notizen** — Textarea, optional

Mutation:
```
POST /api/doctors/{doctorId}/absences
Body: { absence_type, valid_from, valid_to, notes? }
```

Cache-Invalidierung nach onSuccess:
- `planAbsenceKeys.byPlan(planId)`
- `availabilityKeys` (alle — Absence ist INA-Quelle)

---

## Geänderte Dateien

### `ShiftTypeDragBar.tsx`

Neue Props:
```typescript
interface ShiftTypeDragBarProps {
  shiftTypes: ShiftType[]
  focusMode: 'alle' | 'vn'
  onFocusToggle: () => void  // NEU
}
```

- "Alle Dienste"-Button wandert aus `PlanPage` in diese Komponente
- Position: rechts in der Dienste-Zone (`margin-left: auto`)

### `unifiedGridUtils.ts`

```typescript
const ABSENCE_CODES: Record<AbsenceType, string> = {
  FORTBILDUNG: 'FB',  // war 'Fo'
  // ... rest unverändert
}
```

### `UnifiedShiftCell.tsx`

Neue Props:
```typescript
absenceId?: number
onDoubleClickRemoveAbsence?: (absenceId: number) => void
```

- `handleDoubleClick`: wenn `absenceId` vorhanden UND kein `shiftAssigned` → `onDoubleClickRemoveAbsence(absenceId)` aufrufen
- `isAbsenceCode` Liste: `'FB'` statt `'Fo'`

### `UnifiedPlanGrid.tsx`

Neue Prop:
```typescript
onDoubleClickRemoveAbsence?: (absenceId: number) => void
```

- `absenceId` aus `resolveCell()` an `UnifiedShiftCell` weitergeben (bereits in `ResolvedCell` vorhanden, wird bisher nicht genutzt)

### `PlanPage.tsx`

**State:**
```typescript
const [activeAbsenceCell, setActiveAbsenceCell] = useState<{
  type: AbsenceType
  doctorId: number
  doctorName: string
  dayKey: string
} | null>(null)
```

**`handleDragEnd` Erweiterung:**
```
parseAbsenceDragId(activeId) → AbsenceType
cellMatch → rotationId + dayKey
rotation → doctorId, doctorName
setActiveAbsenceCell({type, doctorId, doctorName, dayKey})
```

**`handleDoubleClickRemoveAbsence(absenceId: number)`:**
- Lookup: `absences.find(a => a.id === absenceId)` für Zeitraum + Typ
- Setzt `pendingDeleteAbsence` State (analog `pendingDeleteRotation`)
- `AlertDialog`-Text: `"[Typ] [valid_from]–[valid_to] wird gelöscht."` (ISO-Daten als lesbares Datum formatiert)
- Bestätigen → `DELETE /api/absences/{absenceId}` via neuen `useDeleteAbsence`-Hook
- Invalidiert `planAbsenceKeys.byPlan(planId)` + `availabilityKeys`

**Layout-Änderung:**
```tsx
// Vorher:
<div className="px-6 pb-2 flex items-center gap-3">
  <div className="flex-1">
    <ShiftTypeDragBar shiftTypes={shiftTypes} focusMode={focusMode} />
  </div>
  <button onClick={...}>Alle Dienste</button>
</div>

// Nachher:
<div className="px-6 pb-2 flex items-center gap-3">
  <ShiftTypeDragBar
    shiftTypes={shiftTypes}
    focusMode={focusMode}
    onFocusToggle={() => setFocusMode(m => m === 'alle' ? 'vn' : 'alle')}
  />
  <AbsenceTypeDragBar />
</div>
```

---

## Neuer Hook

### `useDeleteAbsence`

```
frontend/src/features/plans/useDeleteAbsence.ts
```

```typescript
export function useDeleteAbsence(planId: number) {
  return useMutation({
    mutationFn: (absenceId: number) =>
      apiDelete(`/api/absences/${absenceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planAbsenceKeys.byPlan(planId) })
      queryClient.invalidateQueries({ queryKey: availabilityKeys.all })
    },
  })
}
```

---

## DnD-Flow

```
AbsenceTypeDragBar
  AbsenceTypeChip  id="absence-URLAUB"
        ↓ drag (PointerSensor, distance:4)
UnifiedShiftCell   id="cell-{rotId}-{dayKey}"
        ↓ DragEnd in PlanPage.handleDragEnd
parseAbsenceDragId(activeId)  → AbsenceType
cellMatch                     → rotationId + dayKey
rotations.find(rotationId)   → doctorId, doctorName
setActiveAbsenceCell(...)
        ↓
AbsenceAssignPopover
  POST /api/doctors/{doctorId}/absences
  invalidate planAbsences + availability
        ↓
Grid re-renders: Zelle zeigt "U" / "K" / "FB" etc.
```

## Delete-Flow

```
Doppelklick auf Absence-Zelle
  UnifiedShiftCell.onDoubleClickRemoveAbsence(absenceId)
        ↓
UnifiedPlanGrid → PlanPage.handleDoubleClickRemoveAbsence(absenceId)
        ↓
AlertDialog: "Abwesenheit löschen?"
  Bei mehrtägiger Absence: Zeitraum im Text nennen
Bestätigen
        ↓
DELETE /api/absences/{absenceId}
invalidate planAbsences + availability
```

---

## Dateien-Übersicht

| Datei | Typ |
|---|---|
| `components/AbsenceTypeDragBar.tsx` | Neu |
| `components/AbsenceAssignPopover.tsx` | Neu |
| `useDeleteAbsence.ts` | Neu |
| `components/ShiftTypeDragBar.tsx` | Änderung |
| `unifiedGridUtils.ts` | Änderung (1 Zeile) |
| `components/UnifiedShiftCell.tsx` | Änderung |
| `components/UnifiedPlanGrid.tsx` | Änderung |
| `PlanPage.tsx` | Änderung |

**Backend:** Keine Änderungen. Alle API-Endpunkte vorhanden.
