# Design-Spec: PlanPage Redesign (A2 · Besetzungsplanung + INA · neues Grid)

**Datum:** 2026-06-05  
**Quelle:** `design-reference/variant-ab-plan.jsx`  
**Scope:** Nur PlanPage — kein anderes Feature berührt.

---

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| DragBars (ShiftTypeDragBar, AbsenceTypeDragBar) | Behalten — Layout-Struktur unverändert |
| DoctorDragSource (linke Spalte) | Behalten |
| CommandBar | Neue `PlanCommandBar` (generic CommandBar unverändert) |
| ContextPanel Sichtbarkeit | Immer sichtbar (290px), Leer-Zustand wenn kein Arzt gewählt |

---

## Farbpalette (aus Design-Spec)

```
paper:   #F6F1E6   (Hintergrund)
card:    #FFFCF5   (Karten, Grid-Body)
ink:     #26221C   (Haupttext)
ink2:    #5C544A   (Sekundärtext)
ink3:    #8A8275   (Tertiärtext / Labels)
line:    #E8E0CF   (Borders)
line2:   #D6CCB6   (Sekundäre Borders)
accent:  #C66A3D   (Terrakotta)
accent2: #E69E66   (Heller Akzent / Sparkline)
ok:      #5A7A3A   (Grün / Progress OK)
warn:    #B85B22   (Orange-Rot / Konflikte)
```

Bereits in Tailwind-Config als Design-Tokens vorhanden — keine neuen Tokens einführen. Newsreader-Font via `font-newsreader` Tailwind-Klasse (muss in `tailwind.config` unter `fontFamily.newsreader` eingetragen sein; Import bereits in `index.css`).

---

## Komponente 1: `PlanCommandBar`

**Datei:** `frontend/src/features/plans/components/PlanCommandBar.tsx`

**Verwendung in PlanPage:** Ersetzt `<CommandBar .../>` + bisherige Prev/Next-Buttons.

### Layout (flex, `px-6 py-3.5`, border-bottom `border-line`, `bg-paper`)

**Links — Titel-Cluster:**
- Monatstitel: `font-newsreader text-2xl` — Monatsname kursiv + Terrakotta (`italic text-accent`), Jahr normal + `text-ink`
- Untertitel: `text-[13px] text-ink3` → `· KW {from}–{to} · {rotationCount} Ärzte`
- Prev/Next-Buttons: `w-7 h-7 rounded-[8px] bg-card border border-line text-ink2`

**Divider:** `w-px h-[22px] bg-line mx-1`

**Filter-Chips:**
- `2 Wochen` → aktiv (dunkle Pille: `bg-ink text-[#FBF6E8]`) — dekorativ
- `Alle Stationen`, `Alle Schichten` → inaktiv (`bg-card text-ink2 border border-line2`) — dekorativ
- `{conflictCount} Konflikte` → nur wenn `conflictCount > 0`; Terrakotta-Pille (`bg-[#FBE5D6] text-[#7A3414] border border-[#F0C3A2]`); klickbar → `onScrollToConflict()`

**Rechts:**
- Pill-Suchbar: `min-w-[260px] border border-line2 rounded-full bg-card text-[13px] text-ink3 px-3 py-1.5 flex items-center gap-2` → Klick öffnet Command-Palette (`useCommandPalette().open()`)
- Button `Plan generieren` (nur wenn `solverEnabled`): `bg-accent text-[#FFF8EF] rounded-full px-4 py-2 text-[13px] font-medium`; disabled+Spinner wenn `isSolving`
- Button `Exportieren` (wenn `!solverEnabled`): gleicher Style

**Extra-Zeile** (unterhalb PlanCommandBar, in PlanPage): Status-Dropdown + Einstellungen + Nachtwoche + Löschen — bleibt unverändert, nur als `<div className="px-6 py-1.5 flex items-center gap-2 border-b border-line bg-paper">`.

### Props

```typescript
interface PlanCommandBarProps {
  planTitle: string          // "Mai 2026" (bereits formatiert)
  planMonth: string          // "Mai" (für Italic-Teil)
  planYear: string           // "2026"
  kwRange: string            // "19–20"
  rotationCount: number
  conflictCount: number
  openCount: number
  prevPlan: { id: number; valid_from: string } | null
  nextPlan: { id: number; valid_from: string } | null
  solverEnabled: boolean
  isSolving: boolean
  onNavigatePrev: () => void
  onNavigateNext: () => void
  onSolve: () => void
  onExport: () => void
  onScrollToConflict: () => void
}
```

---

## Komponente 2: `PlanKpiBar`

**Datei:** `frontend/src/features/plans/components/PlanKpiBar.tsx`

**Verwendung in PlanPage:** Ersetzt `<div className="px-6 py-3"><KpiBar tiles={kpiTiles} /></div>`.

### Layout (flex, `px-6 py-2.5`, border-bottom `border-line`, `bg-card`, `text-[12px] text-ink2`)

**Abdeckungs-Cluster:**
- Newsreader `text-[22px] text-ink tabular-nums leading-none` → `{coverage}%`
- Label `Abdeckung` 12px
- Sparkline: 14 Balken (je `w-[5px]`, max `h-[22px]`), `rounded-sm`; Farbe `bg-accent2` wenn ≥80%, `bg-warn` wenn <80%

**Divider** `w-px h-[18px] bg-line mx-2`

**KPI-Gruppe:**
```
{openCount} offen
{conflictCount} Konflikte   ← text-warn wenn > 0
{shiftsToday} heute im Dienst
{weeklyShiftCount} Std diese Woche   ← Schichtanzahl diese Woche als Näherung
```
Je: Newsreader `text-[18px]` Zahl + `text-[12px] text-ink2` Label.

**Rechts — View-Tabs:**
- `Plan | Wunsch | Konflikte | Bilanz`
- `Plan` = aktiv: `bg-[#FBE5D6] text-[#7A3414] border border-[#F0C3A2] rounded-full px-3 py-1 text-[12px] font-medium`
- Andere 3: `text-ink3 text-[12px] px-3 py-1` — dekorativ (keine Route-Änderung in dieser Iteration)

### Berechnungen

```typescript
// Coverage: Anteil besetzter Shifts
const coverage = shifts.length > 0
  ? Math.round(shifts.filter(s => s.doctor_id != null).length / shifts.length * 100)
  : 0

// Sparkline: coverage pro Tag über erste 14 Tage des Plans
// Gruppiere shifts nach shift_date, berechne je Tag Anteil besetzt

// shiftsToday: shifts mit shift_date === today && doctor_id != null
// weeklyShiftCount: shifts in aktueller KW mit doctor_id != null
```

### Props

```typescript
interface PlanKpiBarProps {
  shifts: ShiftWithDetails[]
  planFrom: string   // ISO
  planTo: string     // ISO
  openCount: number
  conflictCount: number
}
```

---

## Komponente 3: UnifiedPlanGrid — Styling-Änderungen

**Dateien:** `UnifiedPlanGrid.tsx` + ggf. `UnifiedShiftCell.tsx`, `BereichHeaderRow.tsx`

Nur Tailwind-Klassen — keine Logik-Änderungen.

### Header-Zeile

```
bg-[#FAF5E9]
"Arzt"-Spalte: text-[11px] text-ink3 uppercase tracking-[0.06em] font-medium px-3.5 py-2.5
Tag-Zellen:
  - DOW-Label: text-[10px] text-ink3
  - Datum: font-newsreader text-[16px] text-ink tabular-nums leading-[1.1]
  - Heute: bg-[#FBE5D6], Datum text-[#7A3414]
  - Wochenende: bg-[#F3ECD8]
  - Feiertag: bestehende FT-Badge bleibt
```

### Daten-Zeilen

```
Zeilenhöhe: h-[42px]   (aktuell prüfen — ggf. bereits korrekt)
Ausgewählte/Highlighted-Zeile: bg-[#FAF0DC]
Wochenend-Leerzelle: bg-[#F3ECD8]
Heute-Spalte: bg-[rgba(251,229,214,0.4)]
```

### Shift-Chip

```
rounded-[7px]   (statt aktueller rounded-md oder rounded-sm)
Konflikt-Border: border-[1.5px] border-warn
```

### Legende (unterhalb Grid, falls noch nicht vorhanden)

```
bg-[#FAF5E9] border-t border-line px-4 py-2.5
flex items-center gap-3.5 text-[11px] text-ink3
"LEGENDE" uppercase tracking-[0.06em]
Je ShiftType: 17×17 chip (rounded-[5px], bg/fg aus ShiftType-Farbe) + name text-ink2
```

### Tailwind-Config

Eintrag `newsreader: ['Newsreader', 'serif']` unter `theme.fontFamily`. Font-Import in `index.css` bereits vorhanden (lt. Design-HTML); falls nicht → `@import url('https://fonts.googleapis.com/css2?family=Newsreader:...')` ergänzen.

---

## Komponente 4: ContextPanel — Redesign + immer sichtbar

**Datei:** `frontend/src/features/plans/components/ContextPanel.tsx`

**Änderung in PlanPage:**
- `ContextPanel` immer rendern (kein `{contextShift && ...}`)
- Neuer State `selectedDoctorId: number | null` — aus `activeCell.doctorId` gesetzt bei Zellklick
- `contextShift` bleibt für Konflikt/Tarif-Details

### Layout (290px, border-left `border-line`, `bg-paper`, `p-[18px_20px]`, flex col, gap-4)

**Sektion 1 — „Ausgewählt"**
- Label: `text-[10px] text-ink3 uppercase tracking-[0.08em] font-medium`
- Leer-Zustand: `text-[12px] text-ink3 mt-2` → „Zelle klicken zum Auswählen"
- Mit Arzt: Avatar 40px (`bg-oklch` mit Arzt-Hue-Farbe falls verfügbar, sonst Initialen + Bereich-Farbe) + Newsreader `text-[19px]` Name + `text-[12px] text-ink3` Role/Pct

**Sektion 2 — Konflikt-Card** (nur wenn `contextShift` + Konflikte/Tarif-Warnungen vorhanden)
- `bg-[#FBE5D6] border border-[#F0C3A2] rounded-[14px] p-[12px_14px]`
- Warn-Bullet + Regeltext + 2 Buttons: `Vorschlag` (ink bg, cream text) + `Ignorieren` (card bg)
- `Vorschlag` → bestehende `onCreateOverride`-Logik

**Sektion 3 — „Stunden {Monat}"**
- Newsreader `text-[30px]` Ist + `/ {soll} Soll` text-ink3
- Progress-Bar: `h-1 rounded-full bg-line` + Füllbalken `bg-ok` (oder `bg-warn` wenn überschritten)
- Ist = `shifts.filter(s => s.doctor_id === selectedDoctorId).reduce((sum, s) => sum + shiftDuration(s), 0)` in Stunden
- Soll = aus `doctor.employment_periods` (FTE × Soll-Std/Monat) — falls nicht verfügbar: nur Ist anzeigen

**Sektion 4 — „Schichten {Monat}"**
- Pro ShiftType (nur wenn count > 0): 22×22 Chip (rounded-[6px]) + Name + Newsreader `text-[16px]` Zahl rechts
- Daten: shifts für diesen Arzt im Plan gruppiert nach ShiftType

**Sektion 5 — „Wünsche"**
- Aus `wishes`-Array für `selectedDoctorId`
- Card: `bg-card border border-line rounded-[10px] p-[10px_12px] text-[12px] text-ink2`
- Je Wunsch: Datum / Wochentag + Typ (AVOID/REQUIRE)
- Leer-Zustand: nichts anzeigen (Section ausblenden)

### Neue Props

```typescript
// Neue Props (zusätzlich zu bestehenden):
selectedDoctorId: number | null
doctors: Doctor[]
shifts: ShiftWithDetails[]
shiftTypes: ShiftType[]
wishes: Wish[]
// planMonth: string  für Label "Stunden Mai"
planMonth: string
```

---

## Nicht in dieser Iteration

- View-Tabs (Wunsch / Konflikte / Bilanz) — nur visuell dekorativ, keine Routen
- "Alle Stationen" / "Alle Schichten" Chips — dekorativ
- Avatar-Farbe via `oklch` (Arzt-Hue aus DB nicht vorhanden) → Fallback: Initialen + `bg-line`
- Stunden-Soll-Berechnung (FTE × Monats-Soll) — nur Ist-Zähler wenn Soll-Daten fehlen

---

## Test-Strategie

- Bestehende vitest-Tests für `UnifiedPlanGrid`, `ContextPanel` müssen grün bleiben
- Neue Komponenten: je 1 Render-Test (smoke test)
- Keine Backend-Änderungen → keine pytest-Tests nötig
