# Task M13-001: PlanPage Header — Umbau nach A2-Spec

## Ziel

Die Kopfzeile des Reiters „Pläne" (`PlanPage`) besteht aktuell aus
**fünf gestapelten Zeilen** und entspricht nicht der genehmigten
Design-Spec **„A2 · Besetzungsplanung + INA · neues Grid (April 2026)"**
(→ `design-reference/variant-ab-plan.jsx`, Artboard `stage-a2`).

Dieses Milestone-Briefing baut die Kopfzeile auf **exakt zwei saubere Zeilen**
um, ohne Grid, Daten-Layer oder Backend zu verändern.

---

## Ist-Zustand — 5 gestapelte Zeilen

| Zeile | Quelle | Inhalt |
|---|---|---|
| 1 | `PlanCommandBar` | Titel · Nav ‹/› · Chips (2 Wochen / Alle Stationen / Alle Schichten / Konflikte) · Such-Pill · CTA |
| 2 | `PlanPage` inline | Einstellungen · Nachtwoche · Solver · Status-Dropdown · Löschen |
| 3 | `PlanKpiBar` | Abdeckung % · Sparkline · offen · Konflikte · heute |
| 4 | `PlanPage` inline | `ShiftTypeDragBar` + `AbsenceTypeDragBar` |
| 5 | `PlanPage` inline | Wünsche-Toggle · Fairness-Toggle |

**Problem:** Hoher kognitiver Aufwand, unklare Prioritäten, visueller Lärm.

---

## Soll-Zustand — 2 Zeilen nach A2-Spec

| Zeile | Komponente | Inhalt |
|---|---|---|
| 1 | `PlanCommandBar` (refactored) | `[April] 2026` · Nav · `· KW {range}` · [⚙︎] · [Nachtwoche \| –] · [StatusBadge] · Exportieren |
| 2 | `PlanModeBar` (neu) | Segmented-Switch [1·Besetzung ↔ 2·INA] · Context-Filter · CTA |

Darunter: `PlanKpiBar` bleibt erhalten, aber auf eine Zeile reduziert (Sub-Schritt D).

---

## Bindende Entscheidungen

1. **Mode-State in `PlanPage` (ADR-096):** Neuer `mode: 'besetzung' | 'ina'`-State
   (Default `'besetzung'`). Session-only, kein URL-Param, kein localStorage.
   Gleiches Muster wie `activeFilterGroups` und `showWishes`.

2. **`PlanModeBar` als eigene Komponente (ADR-097):** Nicht inline in `PlanPage`
   einbetten. Co-located in `features/plans/components/PlanModeBar.tsx`.
   Props-Interface vollständig typisiert, keine `any`.

3. **Sekundär-Toolbar entfernen, Aktionen verteilen (ADR-098):**
   - `Einstellungen` → Zahnrad-Icon-Button ganz rechts in `PlanCommandBar`
   - `Nachtwoche` → ghost-Button in `PlanCommandBar` rechts (nur `mode === 'besetzung'`)
   - `Solver` / `Plan generieren` → in `PlanModeBar` als primärer CTA-Slot
     (INA-Modus, wenn `solverEnabled`)
   - Status-Dropdown → kompaktes Status-Badge (Dot + Label) in `PlanCommandBar`,
     weiterhin klickbar mit DropdownMenu
   - `Plan löschen` → **vorübergehend entfernen** aus dem sichtbaren Header;
     bleibt über `PlanSettingsModal` zugänglich (außer Scope dieses Milestones —
     Button in Modal ergänzen ist M13-002)

4. **Filter-Chips `2 Wochen / Alle Stationen / Alle Schichten` entfernen (ADR-099):**
   Diese Chips waren dekorativ (kein aktiver State). Ersatzlos entfernen.
   Der `conflictCount`-Chip wandert als kleines Badge in die Mode Bar.

5. **Such-Pill bleibt im CommandBar (ADR-100):** Die Such-Pill (`Suchen oder Befehl … ⌘K`)
   bleibt erhalten — sie ist der primäre Einstiegspunkt in die Command Palette.
   Position: rechts, vor dem Export-Button, unverändert.

6. **DnD-Bars aus Header-Band raus, unter Mode Bar (ADR-101):**
   `ShiftTypeDragBar` und `AbsenceTypeDragBar` wandern aus dem Header-Bereich
   hinter `PlanKpiBar`, direkt über dem Grid. Layout: volle Breite, `px-6 pb-2`,
   kein 50/50-Split mehr — `ShiftTypeDragBar` nimmt die volle Breite, da sie
   die Filter-Chips enthält; `AbsenceTypeDragBar` direkt darunter. Alternativ
   beide nebeneinander mit `flex-1 min-w-0` (Implementierung wählt das
   kompaktere Ergebnis).

7. **Wünsche- und Fairness-Toggle in Mode Bar (ADR-102):**
   Die `<Star>`- und `<BarChart2>`-Buttons wandern in die Context-Filter-Zone
   der Mode Bar (INA-Modus). Kein separater Row mehr.

8. **`planName`-Feld (ADR-103):** Der Plan-Typ „Peripherer Dienstplan" steht
   noch nicht im DB-Schema. Bis M13-002 (Plan-Stammdaten) zeigt der Subtitle
   nur `· KW {kwRange}`. Wenn `Plan` ein `name`-Feld hat → `· {name} · KW {kwRange}`.
   Prop `planName?: string` in `PlanCommandBar`, optional, kein Default-Text.

---

## Sub-Schritt A — `PlanCommandBar.tsx` bereinigen

### Props-Interface — Änderungen

**Entfernen:**
```ts
conflictCount: number          // → Mode Bar
onScrollToConflict: () => void // → Mode Bar
solverEnabled: boolean         // → Mode Bar
isSolving: boolean             // → Mode Bar
onSolve: () => void            // → Mode Bar
```

**Hinzufügen:**
```ts
planName?: string              // optionaler Plan-Bezeichner (ADR-103)
mode: 'besetzung' | 'ina'     // aktueller Workflow-Modus
onNachtwocheClick: () => void  // öffnet LockedWeekDialog
onSettingsClick: () => void    // öffnet PlanSettingsModal
plan: PlanRead | undefined     // für Status-Badge + -Dropdown
onStatusChange: (s: 'DRAFT' | 'RELEASED' | 'ARCHIVED') => void
isUpdatingStatus: boolean      // updatePlan.isPending
```

### Layout

```
[April 2026]  [‹ ›]  · KW 18–19      ────spacer────  [⚙]  [Nachtwoche*]  [● Entwurf ▾]  [Suchen … ⌘K]  [Exportieren]
```
`*` nur wenn `mode === 'besetzung'`

**Klassen (Tailwind, analog bestehendem Stil):**
```tsx
// Wrapper — unverändert
<div className="flex items-center gap-3 px-6 py-3 border-b border-line bg-paper flex-wrap shrink-0">

// Titel — unverändert
<span className="font-serif text-2xl tracking-tight leading-none">
  <span className="italic text-dp-accent">{planMonth}</span> {planYear}
</span>

// Nav — unverändert
{/* ChevronLeft / ChevronRight Buttons — unverändert */}

// Subtitle
<span className="text-[13px] text-ink-3">
  · KW {kwRange}{planName ? ` · ${planName}` : ''}
</span>

<div className="flex-1" />

// Settings-Icon (immer)
<button onClick={onSettingsClick} className="w-7 h-7 rounded-[8px] bg-card border border-line text-ink-2 flex items-center justify-center hover:bg-paper transition-colors" aria-label="Einstellungen">
  <Settings className="size-3.5" />
</button>

// Nachtwoche (nur besetzung-Modus)
{mode === 'besetzung' && (
  <button onClick={onNachtwocheClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-line-2 bg-card text-[12.5px] text-ink-2 hover:bg-paper transition-colors">
    <MoonStar className="size-3.5" /> Nachtwoche
  </button>
)}

// Status-Badge mit Dropdown
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-line-2 bg-card text-[12.5px] text-ink-2 hover:bg-paper transition-colors">
      <span className={cn('size-1.5 rounded-full', statusDotClass)} />
      {statusLabel}
      <ChevronDown className="size-3 ml-0.5" />
    </button>
  </DropdownMenuTrigger>
  {/* DropdownMenuContent — analog bisheriger sekundärer Toolbar */}
</DropdownMenu>

// Export (immer)
<button onClick={onExport} className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover transition-colors">
  Exportieren
</button>
```

**Was entfernt wird:**
- Die drei dekorativen Chips (`2 Wochen`, `Alle Stationen`, `Alle Schichten`)
- Der `{conflictCount} Konflikte`-Chip (wandert in Mode Bar)
- Der `Plan generieren`-Zweig des CTA (bleibt nur `Exportieren`)

**Was bleibt:**
- Such-Pill (`Suchen oder Befehl … ⌘K`) — bleibt erhalten, Position: rechts vor Exportieren

---

## Sub-Schritt B — Neue `PlanModeBar.tsx`

**Datei:** `frontend/src/features/plans/components/PlanModeBar.tsx`

### Props-Interface

```ts
export interface PlanModeBarProps {
  mode: 'besetzung' | 'ina'
  onModeChange: (mode: 'besetzung' | 'ina') => void

  // Konflikte (beide Modi)
  conflictCount: number
  onScrollToConflict: () => void

  // Besetzungs-Modus: Dienste-/Abwesenheits-Legende
  shiftTypes: ShiftType[]
  activeFilterGroups: Set<string>
  onFilterGroupToggle: (group: string) => void
  onFilterGroupClear: () => void

  // INA-Modus: Wünsche
  showWishes: boolean
  onToggleWishes: () => void
  wishCount: number

  // INA-Modus: Fairness
  showFairness: boolean
  onToggleFairness: () => void

  // INA-Modus: Solver-CTA
  solverEnabled: boolean
  isSolving: boolean
  onSolve: () => void
}
```

### Layout — Besetzungs-Modus

```
[❶ Besetzung planen  ▶  ❷ INA planen]   Dienste [V][T][T1][N] | Abw. [U][K][FB]  [?Konflikte]  ──spacer──  [Weiter zu INA planen →]
```

### Layout — INA-Modus

```
[❶ Besetzung planen  ▶  ❷ INA planen]   [★ Wünsche N]  [▦ Fairness]  [? Konflikte]  ──spacer──  [← Besetzung]  [Solver|Exportieren]
```

### Segmented Switch

```tsx
<div className="inline-flex items-center bg-paper border border-line-2 rounded-[14px] p-[3px] gap-[3px] shrink-0">
  {SEGMENTS.map((seg, i) => {
    const active = mode === seg.id
    return (
      <React.Fragment key={seg.id}>
        <button
          onClick={() => onModeChange(seg.id)}
          className={cn(
            'flex items-center gap-2.5 px-3 py-1.5 rounded-[11px] border-none transition-colors',
            active ? 'bg-ink' : 'bg-transparent hover:bg-line/40',
          )}
        >
          <span className={cn(
            'w-[22px] h-[22px] rounded-full inline-flex items-center justify-center font-serif text-[13px] shrink-0',
            active ? 'bg-dp-accent text-[#FFF8EF]' : 'bg-line text-ink-3',
          )}>{seg.step}</span>
          <span className="text-left">
            <span className={cn('block text-[12.5px] font-semibold leading-[1.2]', active ? 'text-[#FBF6E8]' : 'text-ink-2')}>
              {seg.label}
            </span>
            <span className={cn('block text-[9.5px] leading-[1.3]', active ? 'text-[rgba(251,246,232,0.52)]' : 'text-ink-3')}>
              {seg.sub}
            </span>
          </span>
        </button>
        {i === 0 && <ChevronRight className="size-3 text-ink-3 shrink-0" />}
      </React.Fragment>
    )
  })}
</div>
```

Segment-Daten:
```ts
const SEGMENTS = [
  { id: 'besetzung', step: '1', label: 'Besetzung planen',  sub: 'Stationen · Urlaub · Nachtwochen' },
  { id: 'ina',       step: '2', label: 'INA planen',        sub: 'V · T · N-Dienste setzen' },
]
```

### Context-Filter — Besetzungs-Modus

Die Schichttyp-Chips in der Mode Bar sind **nicht draggable** — nur visuelle
Legende + optionaler Filter-Toggle. Der DnD-Anteil bleibt in `ShiftTypeDragBar`
unterhalb des Headers.

```tsx
// Dienste-Chips (gefärbt, aus shiftTypes)
{shiftTypes.slice().sort((a,b) => a.display_order - b.display_order).map(st => {
  const pal = SHIFT_PALETTE[st.color]  // aus handoff/shift-palette.ts
  const active = activeFilterGroups.has(st.filter_group ?? '')
  return (
    <span key={st.id} style={{ background: pal.bg, color: pal.fg }}
      className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-bold cursor-pointer select-none">
      {st.short_name}
    </span>
  )
})}

<span className="text-line-2">|</span>
<span className="text-[10px] text-ink-3 uppercase tracking-[0.07em]">Abwesenheiten</span>
{/* Abw-Chips: U K FB EZ MuSchu DIV — statisch, gleiche Pill-Klassen */}
```

### Context-Filter — INA-Modus

```tsx
// Wünsche-Toggle
<button onClick={onToggleWishes}
  className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
    showWishes ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-paper border-line text-ink-3 hover:bg-line/40'
  )}>
  <Star className="size-3" /> Wünsche
  <span className="text-[10px] font-bold px-[5px] rounded-full bg-amber-100 text-amber-700">{wishCount}</span>
</button>

// Fairness-Toggle
<button onClick={onToggleFairness}
  className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
    showFairness ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-paper border-line text-ink-3 hover:bg-line/40'
  )}>
  <BarChart2 className="size-3" /> Fairness
</button>

// Fokus-Filter (analog bisheriger ShiftTypeDragBar-Gruppen-Chips)
<span className="text-line-2">|</span>
<span className="text-[10px] text-ink-3 uppercase tracking-[0.07em]">Fokus</span>
{/* Fokus-Chips aus activeFilterGroups — direkt aus ShiftType.filter_group */}
```

### Konflikt-Badge (beide Modi, nur wenn `conflictCount > 0`)

```tsx
{conflictCount > 0 && (
  <button onClick={onScrollToConflict}
    className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11.5px] font-medium bg-warn-bg text-warn-ink border border-warn-line hover:opacity-80 transition-opacity">
    {conflictCount} Konflikte
  </button>
)}
```

### CTA rechts

```tsx
// Besetzungs-Modus → Primär
<button onClick={() => onModeChange('ina')}
  className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-ink text-[#FBF6E8] text-[12.5px] font-semibold hover:opacity-90 transition-opacity">
  Weiter zu INA planen
  <ChevronRight className="size-3.5" />
</button>

// INA-Modus: Zurück-Link + optionaler Solver
<button onClick={() => onModeChange('besetzung')}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] border border-line-2 bg-paper text-ink-2 text-[12px] hover:bg-line/30 transition-colors">
  <ChevronLeft className="size-3.5" /> Besetzung
</button>
{solverEnabled && (
  <button onClick={onSolve} disabled={isSolving}
    className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-dp-accent text-[#FFF8EF] text-[12.5px] font-semibold hover:bg-dp-accent-hover disabled:opacity-60 transition-colors">
    <Zap className="size-3.5" />
    {isSolving ? 'Berechne…' : 'Plan generieren'}
  </button>
)}
```

### Wrapper der Mode Bar

```tsx
<div className="flex items-center gap-3 px-5 py-2 border-b border-line bg-card flex-wrap shrink-0">
  {/* Segmented Switch */}
  {/* Divider: <div className="w-px h-[22px] bg-line mx-1 shrink-0" /> */}
  {/* Context-Filter (mode-abhängig) */}
  <div className="flex-1" />
  {/* CTA */}
</div>
```

---

## Sub-Schritt C — `PlanPage.tsx` Verdrahtung

### 1. Mode-State

```tsx
const [mode, setMode] = useState<'besetzung' | 'ina'>('besetzung')
```

### 2. `<PlanCommandBar>` — Props anpassen

Props entfernen: `conflictCount`, `onScrollToConflict`, `solverEnabled`,
`isSolving`, `onSolve`.

Props hinzufügen:
```tsx
mode={mode}
planName={undefined}           // bis M13-002
onNachtwocheClick={() => setLockedWeekDialogOpen(true)}
onSettingsClick={() => setSettingsOpen(true)}
plan={plan}
onStatusChange={handleStatusChange}
isUpdatingStatus={updatePlan.isPending}
```

### 3. Sekundär-Toolbar entfernen

Den gesamten Block:
```tsx
{plan && (
  <div className="flex items-center gap-2 px-6 py-1.5 border-b border-line bg-paper shrink-0">
    …  {/* Einstellungen, Nachtwoche, Solver, Status, Delete */}
  </div>
)}
```
**komplett löschen.** Die Aktionen sind per ADR-098 verteilt.

**Hinweis zum Delete-Button:** Der `Trash2`-Button und `showDeleteDialog`-State
bleiben in `PlanPage` erhalten (AlertDialog ist noch verdrahtet). Der Button
ist nach diesem Milestone nur noch nicht mehr sichtbar in der UI — er wird
in M13-002 in `PlanSettingsModal` ausgelagert. Kein Code löschen, nur den
JSX-Block in der Toolbar entfernen.

### 4. `<PlanModeBar>` einfügen

Direkt nach `<PlanCommandBar>`, vor `<PlanKpiBar>`:
```tsx
{plan && (
  <PlanModeBar
    mode={mode}
    onModeChange={setMode}
    conflictCount={conflictCount}
    onScrollToConflict={() => scrollToFirstMatch('conflict')}
    shiftTypes={shiftTypes}
    activeFilterGroups={activeFilterGroups}
    onFilterGroupToggle={toggleFilterGroup}
    onFilterGroupClear={clearFilterGroups}
    showWishes={showWishes}
    onToggleWishes={() => setShowWishes(v => !v)}
    wishCount={wishes.length}
    showFairness={showFairness}
    onToggleFairness={() => setShowFairness(v => !v)}
    solverEnabled={solverEnabled}
    isSolving={solvePlan.isPending}
    onSolve={handleSolve}
  />
)}
```

### 5. Wunsch/Fairness-Toggle-Block entfernen

```tsx
{/* ENTFERNEN: */}
<div className="px-6 pb-1 flex items-center gap-2">
  <button … Star … Wünsche />
  <button … BarChart2 … Fairness />
</div>
```

### 6. DnD-Bar-Block verschieben

Den aktuellen Block:
```tsx
<div className="px-6 pb-2 flex items-stretch gap-3">
  <div className="flex-1 min-w-0"><ShiftTypeDragBar … /></div>
  <div className="flex-1 min-w-0"><AbsenceTypeDragBar /></div>
</div>
```
**aus dem Header-Band** (vor dem Grid) **hinter `<PlanKpiBar>`** verschieben.
Neues Layout: beide DnD-Bars übereinander, volle Breite:
```tsx
<div className="px-6 pt-2 pb-1 flex flex-col gap-1.5 shrink-0">
  <ShiftTypeDragBar … />
  <AbsenceTypeDragBar />
</div>
```

---

## Sub-Schritt D — `PlanKpiBar` trimmen (optional, low-priority)

Die KPI-Bar ist nicht in der A2-Spec. Sie darf bleiben, soll aber schlanker wirken.

Änderungen (wenn Zeit bleibt, sonst verschieben):
- `py-2.5` → `py-1.5`
- View-Tabs (`Plan / Wunsch / Konflikte / Bilanz`) **entfernen** — sie sind
  dekorativ und redundant (Mode Bar übernimmt diese Funktion)
- `shiftsToday`-KPI entfernen (zu detailliert für Header)
- Ergebnis: nur noch `{coverage}% Abdeckung · Sparkline · {openCount} offen · {conflictCount} Konflikte`

---

## Sub-Schritt E — Tests

### Anpassen

**`__tests__/PlanCommandBar.test.tsx`**
- Props-Interface geändert: alte Props (`conflictCount`, `solverEnabled`, etc.) entfernen
- Neue Props mocken: `mode`, `onNachtwocheClick`, `onSettingsClick`, `plan`, `onStatusChange`, `isUpdatingStatus`
- Test: Nachtwoche-Button nur im Besetzungs-Modus sichtbar
- Test: Such-Pill nicht mehr vorhanden
- Test: Einstellungen-Icon vorhanden + klickbar

### Neu

**`__tests__/PlanModeBar.test.tsx`** — mind. folgende Tests:
- Segmented Switch rendert beide Segmente
- Klick auf „INA planen" ruft `onModeChange('ina')` auf
- Im Besetzungs-Modus: CTA „Weiter zu INA planen" sichtbar
- Im INA-Modus: „← Besetzung" sichtbar
- Im INA-Modus: Wünsche-Toggle klickbar → `onToggleWishes` aufgerufen
- Im INA-Modus: Fairness-Toggle klickbar → `onToggleFairness` aufgerufen
- `conflictCount > 0` → Konflikte-Badge sichtbar; `= 0` → nicht sichtbar
- Solver-CTA nur wenn `solverEnabled === true` im INA-Modus

---

## Akzeptanzkriterien

- [x] `PlanCommandBar` hat exakt die neuen Props, kein Filter-Chip, Such-Pill bleibt erhalten
- [x] `PlanModeBar` existiert als eigenständige Komponente
- [x] Segmented Switch toggelt `mode`-State in beide Richtungen
- [x] Sekundär-Toolbar (`py-1.5`-Bar) ist aus `PlanPage.tsx` entfernt
- [x] Einstellungen öffnen sich via Zahnrad-Icon im Command Bar
- [x] Nachtwoche-Button im Command Bar (nur Besetzungs-Modus) öffnet Dialog
- [x] Status-Dropdown im Command Bar — Freigeben / Archivieren / Entwurf
- [x] Wünsche- und Fairness-Toggle in Mode Bar (INA-Modus)
- [x] DnD-Bars unterhalb KPI-Bar, nicht im Header-Band
- [x] Konflikte-Badge in Mode Bar (wenn > 0), klickbar → scrollToConflict
- [x] Solver-CTA in Mode Bar (INA, wenn solverEnabled)
- [x] Alle bestehenden Frontend-Tests grün
- [x] Neue `PlanModeBar`-Tests grün
- [x] TypeScript strict mode, kein `any`

---

## Abschluss

- **Datum:** 2026-06-09
- **Branch:** main
- **Commits:**
  - `dbf170f` feat(redesign): M13-001 PlanPage header — 2-Zeilen-Layout nach A2-Spec (7 Dateien, 589 Insertions, 237 Deletions)
- **Testergebnis:** 276 Frontend-Tests grün, TypeScript strict mode fehlerfrei
- **ADRs:** ADR-096 bis ADR-103 bindend entschieden und implementiert

---

## Geänderte Dateien

| Datei | Art |
|---|---|
| `frontend/src/features/plans/components/PlanCommandBar.tsx` | Refactor |
| `frontend/src/features/plans/components/PlanModeBar.tsx` | Neu |
| `frontend/src/features/plans/PlanPage.tsx` | Refactor |
| `frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx` | Anpassen |
| `frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx` | Neu |

---

## Out of Scope

- Keine Änderungen an `UnifiedPlanGrid`, `UnifiedShiftCell`, `BereichHeaderRow`
- Keine Änderungen am Backend oder an API-Types
- `PlanSettingsModal`, `LockedWeekDialog`, `RotationAssignPopover` unverändert
- Grid-Verhalten im Besetzungs- vs. INA-Modus (Dimmen, Fokus-Logik) → M13-003
- `Plan löschen` im `PlanSettingsModal` einbauen → M13-002
- `planName`-Feld im Datenmodell → M13-002
- `PlanListPage` nicht betroffen

---

## Folgemilestones

- **M13-002** — Plan-Stammdaten: `name`-Feld, Delete-Button in Settings, ggf. KpiBar entfernen
- **M13-003** — Grid-Verhalten im Besetzungs-/INA-Modus (Dimm-Layer, Fokus-Filter)
