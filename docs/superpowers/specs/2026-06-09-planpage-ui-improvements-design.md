# Design: PlanPage UI-Verbesserungen

**Datum:** 2026-06-09  
**Status:** Approved  
**Milestone:** M13-003 (Vorschlag)

---

## Überblick

9 UI-Verbesserungen für die PlanPage. Keine Backend-Änderungen. Alle Änderungen betreffen `frontend/src/features/plans/`.

---

## Betroffene Dateien

| Datei | Änderungstyp |
|---|---|
| `PlanModeBar.tsx` | Props ergänzen, Buttons umstrukturieren |
| `PlanCommandBar.tsx` | Settings-Button + Nachtwoche-Button entfernen |
| `PlanSidebar.tsx` | Props + Dept-Details + Fairness-Namen + Wish-Button |
| `PlanPage.tsx` | States + Handler + Sidebar-Collapse-Logik |
| `UnifiedPlanGrid.tsx` | `onDepartmentClick` Prop durchreichen |
| `BereichHeaderRow.tsx` | Klick-Handler für Department-Selection |

---

## Änderung 1: Redundante Navigations-Buttons entfernen

**Datei:** `PlanModeBar.tsx` (Zeilen 165–196)

Die CTA-Buttons am rechten Ende der ModeBar werden entfernt:
- `Weiter zu INA planen` (Besetzungs-Modus)
- `< Besetzung` (INA-Modus)

Der Segmented Switch (links in der ModeBar) übernimmt die Navigation vollständig. Der rechte Bereich enthält nur noch „Plan generieren" + ⚙-Icon (siehe Änderung 4+5).

**Props entfernen:** keine Props ändern — die Buttons sind inline in der Komponente.

---

## Änderung 2: Einklappbare Sidebars

**Datei:** `PlanPage.tsx`

### Neue States
```tsx
const [leftOpen, setLeftOpen] = useState(true)
const [rightOpen, setRightOpen] = useState(true)
```

### Layout-Änderung
Jede Sidebar bekommt einen Wrapper mit Transition:

**Linke Sidebar (DoctorDragSource, nur Besetzung):**
```tsx
{mode === 'besetzung' && (
  <div className="flex shrink-0">
    {leftOpen ? (
      <>
        <DoctorDragSource … />
        <button onClick={() => setLeftOpen(false)}
          className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-r border-line cursor-pointer"
        >
          <ChevronLeft className="size-3 text-ink-3" />
        </button>
      </>
    ) : (
      <button onClick={() => setLeftOpen(true)}
        className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-r border-line cursor-pointer"
        aria-label="Arzt-Sidebar öffnen"
      >
        <ChevronRight className="size-3 text-ink-3" />
      </button>
    )}
  </div>
)}
```

**Rechte Sidebar (PlanSidebar):**
```tsx
{plan && (
  <div className="flex shrink-0">
    {rightOpen ? (
      <>
        <button onClick={() => setRightOpen(false)}
          className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-l border-line cursor-pointer"
        >
          <ChevronRight className="size-3 text-ink-3" />
        </button>
        <PlanSidebar … />
      </>
    ) : (
      <button onClick={() => setRightOpen(true)}
        className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-l border-line cursor-pointer"
        aria-label="Detail-Sidebar öffnen"
      >
        <ChevronLeft className="size-3 text-ink-3" />
      </button>
    )}
  </div>
)}
```

Der Toggle-Strip ist **volle Höhe** des Grid-Bereichs, 20px breit, mit zentriertem Chevron. Kein CSS-Overflow-Trick — der Strip ist ein eigenes `<button>`-Element.

`leftOpen` wird bei Moduswechsel besetzung→INA nicht zurückgesetzt; die linke Sidebar ist im INA-Modus ohnehin nicht sichtbar.

---

## Änderung 3: Nachtwoche-Button in ModeBar

**Entfernen aus:** `PlanCommandBar.tsx` (Zeilen 106–115) — den `{mode === 'besetzung' && ...}`-Block entfernen. Prop `onNachtwocheClick` aus Interface + Aufruf entfernen.

**Hinzufügen in:** `PlanModeBar.tsx`

Neuer Prop:
```tsx
onNachtwocheClick: () => void
```

Position: nach den Abwesenheits-Chips, vor den Filter-Gruppen, mit `|`-Trenner. Nur im Besetzungs-Modus:
```tsx
{mode === 'besetzung' && (
  <>
    <span className="text-line-2 mx-0.5">|</span>
    <button onClick={onNachtwocheClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-card border border-line text-ink-2 hover:bg-line/20"
    >
      <MoonStar className="size-3" />
      Nachtwoche
    </button>
  </>
)}
```

---

## Änderung 4: Plan-Einstellungen neben „Plan generieren"

**Entfernen aus:** `PlanCommandBar.tsx` — Settings-⚙-Button (Zeilen 96–103) + Prop `onSettingsClick` aus Interface.

**Hinzufügen in:** `PlanModeBar.tsx`

Neuer Prop:
```tsx
onSettingsClick: () => void
```

Platzierung: Im rechten Bereich der ModeBar, direkt links neben „Plan generieren" (oder rechts davon, mit `|` getrennt). Icon-Only-Button, passend zum Stil der Leiste:
```tsx
<button onClick={onSettingsClick}
  className="w-[30px] h-[30px] rounded-[8px] border border-line bg-card text-ink-2 flex items-center justify-center hover:bg-paper transition-colors"
  aria-label="Plan-Einstellungen"
>
  <Settings className="size-3.5" />
</button>
```

Anordnung rechts: `[⚙] [Plan generieren]` — Settings links, CTA rechts.

---

## Änderung 5: „Plan generieren" in beiden Modi

**Datei:** `PlanModeBar.tsx`

Aktuell steht der Button im `else`-Zweig (INA-Modus). Die modusspezifische Bedingung entfällt. Neuer rechter Block (nach `flex-1`):

```tsx
<div className="flex items-center gap-2">
  <button onClick={onSettingsClick} … >  {/* Änderung 4 */}
    <Settings className="size-3.5" />
  </button>
  {solverEnabled && (
    <button onClick={onSolve} disabled={isSolving} … >
      <Zap className="size-3.5" />
      {isSolving ? 'Berechne…' : 'Plan generieren'}
    </button>
  )}
</div>
```

Der Button ist nur sichtbar wenn `solverEnabled === true` (unveränderte Logik). Erscheint in **beiden** Modi.

---

## Änderung 6: Details-Tab bei Arzt-Klick

**Datei:** `PlanPage.tsx`, Funktion `handleCellClick`

Nach dem Setzen von `setSelectedDoctorId(doctorId)` (Zeile ~451) auch:
```tsx
setSidebarTab('details')
setSelectedDepartmentId(null)  // Department-Auswahl aufheben
```

---

## Änderung 7: Stationsklick → Department-Details in Sidebar

### PlanPage.tsx

Neuer State:
```tsx
const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null)
```

Neuer Handler (zu UnifiedPlanGrid weiterreichen):
```tsx
function handleDepartmentClick(departmentId: number) {
  setSelectedDepartmentId(departmentId)
  setSelectedDoctorId(null)
  setContextShift(null)
  setSidebarTab('details')
}
```

Neuer PlanSidebar-Props:
```tsx
selectedDepartmentId={selectedDepartmentId}
departments={departments}
rotations={rotations}
onDepartmentDeselect={() => setSelectedDepartmentId(null)}
```

### UnifiedPlanGrid.tsx

Neuer Prop `onDepartmentClick?: (departmentId: number) => void` — wird an `BereichHeaderRow` weitergereicht.

### BereichHeaderRow.tsx

Klick auf den Header ruft `onDepartmentClick?.(departmentId)` auf. Kein Breaking Change (prop optional).

### PlanSidebar.tsx — Details-Tab Erweiterung

Neue Props:
```tsx
selectedDepartmentId?: number | null
departments?: Department[]
rotations?: RotationAssignmentWithDetails[]
onDepartmentDeselect?: () => void
```

Neue Berechnungen im Sidebar:
```tsx
const selectedDepartment = departments?.find(d => d.id === selectedDepartmentId) ?? null

const deptRotations = rotations?.filter(r => r.department_id === selectedDepartmentId) ?? []

const deptDoctors = deptRotations.map(r => doctors.find(d => d.id === r.doctor_id)).filter(Boolean)

const totalFte = deptDoctors.reduce((sum, doc) => {
  const ep = doc?.employment_periods?.find(ep => ep.valid_to == null || ep.valid_to >= today)
  return sum + (ep?.employment_percentage ?? 100)
}, 0)

// "Offene Dienste" = Shifts für Ärzte dieser Rotation die unbesetzt sind
const deptDoctorIds = new Set(deptRotations.map(r => r.doctor_id))
const openDeptShifts = shifts.filter(s =>
  s.doctor_id == null &&
  // Shift gehört zu einer Rotation in dieser Abteilung wenn die shift_date im Rotationszeitraum liegt
  // Einfache Näherung: alle Shifts ohne doctor_id, deren Datum in einer der Rotationen liegt
  deptRotations.some(r => s.shift_date >= r.valid_from && s.shift_date <= r.valid_to)
).length
// Alternativ: Anzahl der Zeilen im Grid für diese Abteilung ohne Arzt-Zuweisung an diesem Tag
```

**Details-Tab — Prioritätsreihenfolge bei der Anzeige:**
1. `contextShift` gesetzt → Shift-Konflikt-Details (wie bisher)
2. `selectedDepartmentId` gesetzt → Department-Details (neu)
3. `selectedDoctorId` gesetzt → Arzt-Details (wie bisher)
4. nichts → "Zelle klicken zum Auswählen" (wie bisher)

**Department-Details-Block:**
```
[Farbkreis] Stationsname
             X Ärzte · FTE gesamt: Y%

Ärzte:
  [Avatar] Dr. Name    FTE%
  [Avatar] Dr. Name    FTE%

Offene Dienste: Z
```

---

## Änderung 8: Volle Namen in Fairness-Tab

**Datei:** `PlanSidebar.tsx`, Zeile 550

```tsx
// Alt:
{stat.shortName ?? stat.doctorName}

// Neu:
{stat.doctorName}
```

`title={stat.doctorName}` bleibt als Hover-Tooltip. `truncate`-Klasse ist bereits gesetzt — lange Namen werden abgeschnitten aber im Tooltip vollständig angezeigt.

---

## Änderung 9: Wunsch-Erfassungs-Button in Wünsche-Tab

**Datei:** `PlanSidebar.tsx`

Neuer Prop:
```tsx
onNewWishClick: (doctorId: number) => void
```

Im Wünsche-Tab: Ein Button "Wunsch erfassen +" öffnet ein `Popover` (shadcn/ui) mit einem `<Select>` aller Ärzte:

```tsx
const [wishPickerOpen, setWishPickerOpen] = useState(false)
const [wishDoctorId, setWishDoctorId] = useState<number | null>(null)

<Popover open={wishPickerOpen} onOpenChange={setWishPickerOpen}>
  <PopoverTrigger asChild>
    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-paper border-line text-ink-2 hover:bg-line/40 w-full">
      <Plus className="size-3" /> Wunsch erfassen
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-[240px] p-3 space-y-3">
    <p className="text-[11px] font-medium text-ink-3 uppercase tracking-wide">Für welchen Arzt?</p>
    <Select onValueChange={(v) => setWishDoctorId(Number(v))}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="Arzt auswählen…" />
      </SelectTrigger>
      <SelectContent>
        {doctors.map(d => (
          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <button
      disabled={wishDoctorId === null}
      onClick={() => {
        if (wishDoctorId) {
          onNewWishClick(wishDoctorId)
          setWishPickerOpen(false)
          setWishDoctorId(null)
        }
      }}
      className="w-full px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40"
    >
      Weiter
    </button>
  </PopoverContent>
</Popover>
```

**PlanPage.tsx:** `onNewWishClick` ruft `setWishCreateTarget({ doctorId, date: format(new Date(), 'yyyy-MM-dd') })` auf. `wishCreateTarget.date` wird in `WishFormDialog` als `prefilledDate` übergeben — optionale Vorbelegung mit heute.

Der vorhandene `WishFormDialog` bleibt unverändert.

---

## Prop-Änderungen Zusammenfassung

### PlanCommandBar — Props entfernen
- `onSettingsClick` entfernen
- `onNachtwocheClick` entfernen
- `mode` entfernen — wird nach Entfernen des Nachtwoche-Buttons nicht mehr in CommandBar genutzt

### PlanModeBar — Props hinzufügen
- `onNachtwocheClick: () => void`
- `onSettingsClick: () => void`

### PlanSidebar — Props hinzufügen
- `selectedDepartmentId?: number | null`
- `departments?: Department[]`
- `rotations?: RotationAssignmentWithDetails[]`
- `onDepartmentDeselect?: () => void`
- `onNewWishClick: (doctorId: number) => void`

### UnifiedPlanGrid — Props hinzufügen
- `onDepartmentClick?: (departmentId: number) => void`

### BereichHeaderRow — Props hinzufügen
- `onDepartmentClick?: (departmentId: number) => void`

---

## Tests

Die geänderten Komponenten haben bestehende Tests. Folgende Anpassungen nötig:

| Datei | Anpassung |
|---|---|
| `PlanModeBar.test.tsx` | Neue Props mocken (`onNachtwocheClick`, `onSettingsClick`); Tests für beide Modi prüfen |
| `PlanSidebar.test.tsx` | Neue Props mocken; Dept-Details-Block testen; Full-Name-Test für Fairness; Wish-Button-Test |
| `PlanCommandBar.test.tsx` | Props `onSettingsClick` + `onNachtwocheClick` aus Mocks entfernen |
| Ggf. `UnifiedPlanGrid.test.tsx` / `BereichHeaderRow.test.tsx` | `onDepartmentClick`-Prop testen |

---

## Scope-Abgrenzung

- Kein Backend-Änderungen
- `WishFormDialog` bleibt unverändert
- `PlanSettingsModal` bleibt unverändert
- Keine neuen Design-Tokens
- Keine neuen Routen
- Fairness-Algorithmus (`fairnessUtils.ts`) bleibt unverändert
