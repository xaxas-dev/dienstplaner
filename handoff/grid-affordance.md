# Plan-Grid · Drag-and-Drop-Affordance

> **Aufgabe für Claude Code:** im Plan-Grid drei Affordance-Ebenen
> implementieren, die das leere Raster sichtbar machen und Drag-and-Drop
> ein eindeutiges Ziel geben. Vorlage: `Grid Affordance.html` im Design-Projekt
> (Optionen A · D · E), Demo des Endzustands wird in
> `variants/grid-affordance.jsx` als React-Komponente vorgehalten.

---

## 0 · Setup-Kontext für Claude Code

Diese Datei beschreibt die **Empfehlung** aus der Design-Exploration und
soll in den bestehenden Code übernommen werden.

* **Zielkomponente:** `frontend/src/components/dp/PlanGrid.tsx`
  (Header + Body, Cell = `<ShiftCell />` aus
  `frontend/src/components/dp/primitives.tsx`)
* **Stand heute:** leere Zelle ist `<div class="border border-line" />` ohne
  Inhalt → für den Nutzer unsichtbar. Drop-Targets nicht erkennbar.
* **Bestehende Tokens:** `lib/design/tokens.ts` → `radii.cell = 7`,
  `colors.accent`, `colors.line`, `colors.weekend`. Bitte nutzen statt
  Hex-Werte neu zu erfinden. Wo unten Hex-Werte stehen, sind sie die
  bisherigen Tokens — wenn ein Token existiert: Token nehmen.
* **Reduced-motion:** alle Hover-/Drag-Übergänge müssen
  `@media (prefers-reduced-motion: reduce)` respektieren (Dauer auf 0
  setzen, keine Lottie, keine Auto-Pulse).

Die Lösung kommt in drei Ebenen, die sich nicht widersprechen:

| Ebene | Trigger | Sichtbar | Zweck |
|---|---|---|---|
| **A · Dot-Grid** | immer | Ja | leere Zelle bekommt einen Anker |
| **D · Crosshair** | Maus-Hover | Ja | Reihe + Spalte + Zielzelle markiert |
| **E · Drag-Modus** | aktives Drag | Ja | Gültigkeit pro Zelle visualisiert |

---

## 1 · Ebene A · Dot-Grid (Ruhezustand)

### Aufgabe

Jede **leere** Zelle (`code == null || code === 'FR'`) zeigt einen
kleinen Mittelpunkt. Gefüllte Zellen bleiben unverändert.

### Spec

* Punkt: `5px × 5px`, `border-radius: 999px`, zentriert
* Farbe Werktag: `#D6CCB6` (entspricht `colors.line2`)
* Farbe Wochenende: `#CBC2AC` (etwas dunkler, dass er auf dem Wochenend-Tint sichtbar bleibt)
* Bei `prefers-reduced-data` (sofern verfügbar): trotzdem rendern — keine Performance-Kosten
* Nicht in der Header-Zeile (Tageszahl-Spalte) rendern

### Diff im Code

```tsx
// ShiftCell.tsx — empty branch
return (
  <div
    role="gridcell"
    aria-label={`${areaName} · ${dayLabel} · leer`}
    className={cn(
      "relative flex h-full items-center justify-center border-l border-line",
      isWeekend && "bg-weekend",
    )}
  >
    {/* NEW: dot-grid anchor for empty cells */}
    <span
      aria-hidden
      className={cn(
        "size-[5px] rounded-full",
        isWeekend ? "bg-line2/90" : "bg-line2",
      )}
    />
  </div>
);
```

### Akzeptanz A

- [ ] Jede leere Werktag-Zelle zeigt einen 5×5-Punkt in `line2`.
- [ ] Jede leere Wochenend-Zelle zeigt einen 5×5-Punkt etwas dunkler.
- [ ] Punkt ist `aria-hidden` und kein eigener Tab-Stop.
- [ ] Auf Zoom 200 % bleibt der Punkt zentriert, keine Sprünge.

---

## 2 · Ebene D · Crosshair-Hover

### Aufgabe

Wenn der Cursor über einer **leeren** Zelle steht:

1. Zugehörige **Reihe** bekommt Hintergrund-Tint.
2. Zugehörige **Spalten-Header**-Zelle wird hervorgehoben.
3. Die **Zielzelle** zeigt einen gestrichelten Akzent-Rahmen + ein
   `+`-Glyph in der Mitte.

### Spec

* Reihen-Hover-BG: `#FAF0DC` (existierender `selected`-Look)
* Header-Hover-BG: `#FBE5D6` mit `color: #7A3414`
* Zielzelle:
  * Rahmen `1.5px dashed colors.accent` (`#C66A3D`)
  * Hintergrund `rgba(198, 106, 61, 0.08)`
  * Border-Radius `radii.cell` (7px)
  * Innenpadding `calc(100% - 4px) × calc(100% - 6px)` damit Linien nicht touchen
* `+`-Glyph: `font-size: 14px`, `color: accent`, `font-weight: 500`
* Übergang: `transition: background 80ms ease-out, border-color 80ms ease-out`
* **Punkt aus Ebene A wird in der Hover-Zelle ausgeblendet** (sonst Doppelmarkierung)

### State-Modell

Pull-up auf `PlanGrid`-Level (nicht pro Zelle), zwei Zahlen:

```tsx
const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

// onMouseLeave des Grids:
onMouseLeave={() => setHover(null)}

// onMouseMove pro Zelle (nur leere):
onMouseEnter={() => setHover({ row, col })}
```

Reihe/Spalte berechnet sich aus `hover` — kein per-Zellen-Zustand nötig.

### Akzeptanz D

- [ ] Cursor über leerer Zelle: Reihe + Spalten-Header + Zelle markiert.
- [ ] Verlässt der Cursor das Grid, geht alles zurück in den Ruhezustand.
- [ ] Cursor über **gefüllter** Zelle: nur Reihe + Header werden markiert,
      kein `+`-Glyph (die Zelle ist ja besetzt).
- [ ] `prefers-reduced-motion`: Übergangsdauer auf `0` setzen.
- [ ] Keyboard-Fokus auf einer Zelle löst denselben Crosshair aus
      (gleicher `hover`-State).

---

## 3 · Ebene E · Drag-Modus (Live-Validierung)

### Aufgabe

Sobald ein Drag startet — Quelle ist entweder ein Arzt-Chip aus der
Sidebar oder eine bestehende Zellen-Zuweisung — wechselt das Grid in
einen Validierungs-Modus:

* **Gültige Zellen** → grünlich getöntes Pad mit gestricheltem Rahmen
* **Ungültige Zellen** → schraffiertes Pad (45°-Pattern, sehr leise)
* **Hover-Ziel** während Drag → kräftiger Akzent-Rahmen + Avatar/Initialen-Vorschau

Validität bestimmt sich aus drei Regeln (Reihenfolge: erste verbotene gewinnt):

1. **Bereich-Qualifikation:** Arzt hat die nötige Qualifikation für den Bereich?
   (`doctor.qualifications.includes(area.requiredQual)`)
2. **Wochenend-Sperre:** manche Bereiche dürfen Sa/So nicht besetzt werden
   (`area.workdayOnly === true`)
3. **Zeit-Konflikt:** Arzt hat am selben Tag bereits eine kollidierende Schicht?

### Spec

| Zustand | Hintergrund | Rahmen |
|---|---|---|
| valid | `rgba(122, 158, 85, 0.12)` (sage 12 %) | `1px dashed rgba(122, 158, 85, 0.55)` |
| invalid | `rgba(0, 0, 0, 0.04)` + 45°-Schraffur `rgba(0,0,0,0.06)` 4 px/5 px | keiner |
| hover-target | `rgba(198, 106, 61, 0.16)` | `1.5px solid accent` |

Schraffur als reines CSS, keine Bilder:

```css
background-image: repeating-linear-gradient(
  45deg,
  transparent 0 4px,
  rgba(0, 0, 0, 0.06) 4px 5px
);
```

Avatar-Vorschau in der Hover-Zielzelle: `<Avatar size={18}>` aus
`primitives.tsx`, ohne Border, mit `opacity: 0.95`.

### State-Modell

Global per Context (`DragContext`) — eine Zelle muss wissen, ob ein
Drag läuft und mit welchem Arzt:

```tsx
type DragState =
  | { kind: 'idle' }
  | { kind: 'dragging'; doctor: Doctor; from?: { row: number; col: number } };

const DragContext = createContext<DragState>({ kind: 'idle' });
```

Trigger:

* `onDragStart` auf Arzt-Chip oder gefüllte Zelle → `DragContext` auf `dragging`
* `onDragEnd` / `onDrop` → zurück auf `idle`

Während `dragging`:

* Punkt aus Ebene A wird in **allen** Zellen ausgeblendet (zu unruhig sonst)
* Crosshair aus Ebene D wird **nicht** zusätzlich gerendert (Drag-Modus übernimmt)

### Akzeptanz E

- [ ] Drag-Start färbt alle gültigen Zellen sage-grün, alle ungültigen schraffiert.
- [ ] Bei Hover über gültige Zelle erscheint Avatar-Vorschau + Akzent-Rahmen.
- [ ] Bei Drop auf gültige Zelle: Zelle wird zur normalen `ShiftCell` mit
      neuem Code; Drag-Modus endet sofort.
- [ ] Drop auf ungültige Zelle: kein Zustandswechsel, kurze Shake-Animation
      auf der Zelle (`transform: translateX(±2px)` × 3, 240 ms,
      respektiert `prefers-reduced-motion`).
- [ ] `Esc` während Drag bricht ab.
- [ ] Touch-Drag funktioniert (Pointer-Events, nicht nur Mouse-Events).

---

## 4 · Reihenfolge der Layer (wichtig)

In `ShiftCell` muss exakt **eine** der drei Visualisierungen aktiv sein,
nie zwei gleichzeitig:

```
Priorität (höchste zuerst):
1. Filled cell  → ShiftChip rendern, fertig
2. Drag aktiv   → valid / invalid / hover-target rendern, Punkt aus
3. Hover aktiv  → Crosshair-Ziel rendern, Punkt aus
4. Idle         → Punkt aus Ebene A
```

Einfacher Switch ganz oben in `ShiftCell.tsx`:

```tsx
const visualState =
  filled ? 'filled' :
  drag.kind === 'dragging' ? dragValidityFor(row, col, drag.doctor) :
  isHovered ? 'crosshair' :
  'idle';
```

---

## 5 · Tests / Playground

In der `/playground`-Route eine neue Sektion `Plan-Grid · Affordance`:

* 6 × 7 Mini-Grid
* Buttons „Idle", „Hover Zelle (2,4)", „Drag mit Dr. Schmidt"
* Visuell mit dem Status in `Grid Affordance.html` (Optionen A · D · E) abgleichen

---

## 6 · Was unverändert bleibt

* Farbsystem der gefüllten Zellen (Pastellpalette aus `shift-palette.ts`)
* Today-Tint, Wochenend-Tint, Konflikt-Border + Dot
* Linke Spalte (Avatar + Name)
* Header-Geometrie (Wochentag-Kürzel + Tageszahl)
* `radii.cell = 7`

Wenn etwas davon im Implementierungs-Diff angefasst werden müsste:
**vorher rückfragen**, nicht ungefragt mit-refactorn.

---

## 7 · Quick-Prompt für Claude Code

> Lies `handoff/grid-affordance.md` in diesem Projekt. Implementiere die
> drei Ebenen (A · Dot-Grid, D · Crosshair-Hover, E · Drag-Modus) in
> `frontend/src/components/dp/PlanGrid.tsx` und `ShiftCell.tsx`.
> Halte dich exakt an die Spec-Werte (Farben, Radien, Übergänge) und
> die Layer-Priorität aus §4. Pflege die Akzeptanz-Checklisten aus §1–§3
> in `handoff/ACCEPTANCE.md` als neuen Block „Schritt 6a · Plan-Grid-Affordance"
> nach. Dann gegen den Playground aus §5 visuell verifizieren.
