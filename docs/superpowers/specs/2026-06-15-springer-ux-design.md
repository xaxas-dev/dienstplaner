# Springer UX Extensions — Design Spec

**Datum:** 2026-06-15  
**Branch:** feature/springer-assignment  
**Status:** Approved

## Ziel

Drei UX-Erweiterungen zur bestehenden Springer-Zuweisung-Funktion:

1. **Springer-Farbe in Einstellungen** — konfigurierbarer Farbwert statt hardcodiertem Emerald
2. **Springer im Einzelzell-Popover** — `DoctorAssignPopover` bietet Springer-Zuweisung an
3. **Springer im Mehrfachauswahl-Popover** — `ShiftBlockPopover` bietet Springer-Bulk-Zuweisung an

Kein Backend-Aufwand — die Springer-API (GET/POST/DELETE `/api/springer-assignments`) existiert bereits.

---

## Architektur-Übersicht

```
useAppSettings (Zustand+persist)
  springerColor: string  ← neu

SettingsPage
  └── Farbwähler-Zeile für springerColor  ← neu

UnifiedShiftCell
  └── liest springerColor aus useAppSettings  ← angepasst

DoctorAssignPopover
  └── neuer Abschnitt "Als Springer"  ← neu
  └── Props: departments, currentSpringerAssignment, onAssignSpringer, onRemoveSpringer

ShiftBlockPopover
  └── neuer Abschnitt "Als Springer einteilen"  ← neu
  └── Props: departments, onAssignSpringer

PlanPage
  └── handleMultiSpringerAssign(deptId)  ← neu
  └── Springer-Props an DoctorAssignPopover durchreichen  ← neu
```

---

## Feature 1: Springer-Farbe in Einstellungen

### Datenlayer

**`frontend/src/stores/useAppSettings.ts`**

Ergänze `AppSettings`-Interface und Store:
```ts
springerColor: string
setSpringerColor: (color: string) => void
```
Default: `'#d1fae5'` (bisheriger Emerald-Wert). Persistiert via `zustand/persist` im Key `dp-app-settings`.

### SettingsPage

**`frontend/src/features/settings/SettingsPage.tsx`**

Neue Zeile in der bestehenden Karte (oder eigene Karte „Darstellung"):

```tsx
<div className="flex items-center justify-between py-3 border-t border-line">
  <div>
    <p className="text-sm font-medium text-ink">Springer-Farbe</p>
    <p className="text-xs text-ink-3 mt-0.5">Hintergrundfarbe der Springer-Zuweisung im Grid</p>
  </div>
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={springerColor}
      onChange={(e) => setSpringerColor(e.target.value)}
      className="w-8 h-8 rounded cursor-pointer border border-line"
      aria-label="Springer-Farbe"
    />
    <button
      onClick={() => setSpringerColor('#d1fae5')}
      className="text-xs text-ink-3 hover:text-ink transition"
    >
      Reset
    </button>
  </div>
</div>
```

### UnifiedShiftCell

**`frontend/src/features/plans/components/UnifiedShiftCell.tsx`**

Liest `springerColor` aus `useAppSettings()`. Ersetzt alle hardcodierten Emerald-Werte:

| Stelle | Vorher | Nachher |
|---|---|---|
| Springer-only Hintergrund (`bg` IIFE) | `'#d1fae5'` | `springerColor` |
| Split-Zelle obere Hälfte (inline style) | `'#d1fae5'` o.ä. | `springerColor + '66'` (40% Alpha-Hex) |
| Springer-Badge Text | `text-emerald-800` | `text-ink` |
| Springer-only Text | `text-emerald-800` | `text-ink` |

Kein neuer Design-Token.

---

## Feature 2: Springer im DoctorAssignPopover

### Interface-Erweiterung

**`frontend/src/features/plans/components/DoctorAssignPopover.tsx`**

Neue Props:
```ts
departments: Department[]
currentSpringerAssignment?: SpringerAssignment | null
currentDepartmentId?: number          // Eigene Rotation → wird aus Auswahl gefiltert
onAssignSpringer: (departmentId: number) => void
onRemoveSpringer: (assignmentId: number) => void
```

Import `Department` und `SpringerAssignment` aus `@/lib/types`.

### Farbe im Badge

`DoctorAssignPopover` liest `springerColor` direkt aus `useAppSettings()` (Zustand-Store, kein Prop nötig). Verwendet `springerColor` als `backgroundColor` im inline style des Badges für die aktive Zuweisung.

### Neuer Abschnitt im JSX

Einfügen nach dem „Schicht auswählen"-Block, vor „Anderen Arzt zuweisen":

```tsx
{/* Springer */}
<div className="space-y-1.5">
  <p className="text-xs text-ink-3 font-medium">Als Springer einteilen</p>
  {currentSpringerAssignment ? (
    <div className="flex items-center gap-2">
      <span
        className="px-2.5 py-1 rounded-full text-xs font-bold text-ink border border-line"
        style={{ backgroundColor: springerColor }}
      >
        {currentSpringerAssignment.target_department.short_name}
      </span>
      <button
        onClick={() => onRemoveSpringer(currentSpringerAssignment.id)}
        className="text-xs text-warn-ink hover:underline"
      >
        Entfernen
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {departments
        .filter((d) => d.active && d.id !== currentDepartmentId)
        .map((d) => (
          <button
            key={d.id}
            onClick={() => onAssignSpringer(d.id)}
            className="px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
          >
            {d.short_name}
          </button>
        ))}
    </div>
  )}
</div>
```

### PlanPage-Anbindung

**`frontend/src/features/plans/PlanPage.tsx`**

`activeCell` State enthält bereits `{rotationId, doctorId, day}`. Ergänze beim Rendern von `DoctorAssignPopover`:

```tsx
// Existierende Springer-Zuweisung für diese Zelle
const activeCellSpringer = activeCell
  ? springerByKey.get(`${activeCell.doctorId}-${activeCell.day}`) ?? null
  : null

// Eigene Rotation des Arztes → für Filter
const activeCellDeptId = activeCell
  ? rotations.find((r) => r.id === activeCell.rotationId)?.department_id
  : undefined
```

Neue Props an `<DoctorAssignPopover>`:
```tsx
departments={departments}
currentSpringerAssignment={activeCellSpringer}
currentDepartmentId={activeCellDeptId}
onAssignSpringer={(deptId) => {
  if (!activeCell) return
  createSpringerAssignment.mutate(
    { plan_id: id, shift_date: activeCell.day, doctor_id: activeCell.doctorId, target_department_id: deptId },
    { onSuccess: () => setActiveCell(null) },
  )
}}
onRemoveSpringer={(assignmentId) => {
  deleteSpringerAssignment.mutate(assignmentId, {
    onSuccess: () => setActiveCell(null),
  })
}}
```

`createSpringerAssignment` und `deleteSpringerAssignment` sind bereits in PlanPage via `useCreateSpringerAssignment` / `useDeleteSpringerAssignment` vorhanden.

---

## Feature 3: Springer im ShiftBlockPopover

### Interface-Erweiterung

**`frontend/src/features/plans/components/ShiftBlockPopover.tsx`**

Neue Props:
```ts
departments: Department[]
onAssignSpringer: (departmentId: number) => void
```

Import `Department` aus `@/lib/types`.

### Neuer Abschnitt im JSX

Einfügen nach ShiftType-Block, vor „Alle Zuweisungen entfernen":

```tsx
{/* Springer Bulk */}
{departments.filter((d) => d.active).length > 0 && (
  <div className="space-y-1.5">
    <p className="text-xs text-ink-3 font-medium">Als Springer einteilen</p>
    <div className="flex flex-wrap gap-1.5">
      {departments
        .filter((d) => d.active)
        .map((d) => (
          <button
            key={d.id}
            onClick={() => onAssignSpringer(d.id)}
            className="px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
          >
            {d.short_name}
          </button>
        ))}
    </div>
  </div>
)}
```

### Neuer Handler in PlanPage

```ts
function handleMultiSpringerAssign(departmentId: number) {
  for (const cell of selectedCells) {
    createSpringerAssignment.mutate({
      plan_id: id,
      shift_date: cell.dayKey,
      doctor_id: cell.doctorId,
      target_department_id: departmentId,
    })
  }
  setSelectedCells([])
  setMultiPopoverOpen(false)
}
```

`ShiftBlockPopover` erhält:
```tsx
departments={departments}
onAssignSpringer={handleMultiSpringerAssign}
```

---

## Codex-Routing (Implementierungsplan)

| Task | Empfehlung | Begründung |
|---|---|---|
| `useAppSettings` erweitern | **Codex** | Mechanisches Muster, 1 Datei, kein Kontext nötig |
| `SettingsPage` Farbzeile | **Codex** | Boilerplate nach bestehendem Muster |
| `ShiftBlockPopover` erweitern | **Codex** | 1 Datei, vollständiger Code im Spec |
| `handleMultiSpringerAssign` + Props | **Codex** | Mechanisch, vollständiger Code im Spec |
| `DoctorAssignPopover` Springer-Abschnitt | **Claude Code** | Braucht Kontext über Springer-Types, bestehende Props |
| `UnifiedShiftCell` dynamische Farbe | **Claude Code** | Braucht Kontext über bestehende IIFE-Logik, Split-Cell-Rendering |
| PlanPage Springer-Props für DoctorAssignPopover | **Claude Code** | Multi-File-Koordination, activeCell-Kontext |

---

## Keine Backend-Änderungen

Alle Springer-Endpunkte existieren:
- `GET /api/plans/{id}/springer-assignments`
- `POST /api/plans/{id}/springer-assignments` (Upsert)
- `DELETE /api/springer-assignments/{id}`

React-Query-Hooks `usePlanSpringerAssignments`, `useCreateSpringerAssignment`, `useDeleteSpringerAssignment` existieren in `useSpringerAssignments.ts`.

---

## Dateien

| Datei | Änderung |
|---|---|
| `frontend/src/stores/useAppSettings.ts` | `springerColor` + `setSpringerColor` |
| `frontend/src/features/settings/SettingsPage.tsx` | Farbwähler-Zeile |
| `frontend/src/features/plans/components/UnifiedShiftCell.tsx` | Dynamische Farbe aus Store |
| `frontend/src/features/plans/components/DoctorAssignPopover.tsx` | Springer-Abschnitt + neue Props |
| `frontend/src/features/plans/components/ShiftBlockPopover.tsx` | Springer-Abschnitt + neue Props |
| `frontend/src/features/plans/PlanPage.tsx` | `handleMultiSpringerAssign`, Props-Durchreichung |
