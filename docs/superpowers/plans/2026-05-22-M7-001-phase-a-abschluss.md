# M7-001 — Phase-A-Abschluss & Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase A formal abschließen: neues Logo, Plan-Grid-Affordance (3 Ebenen), Arzt-Titel in Übersicht, Backend-Smoke-Test, vollständiger Doku-Sweep.

**Architecture:** 6 unabhängige Sub-Schritte mit je eigenem Commit. A–C sind Frontend-UI-Änderungen, D ist ein Backend-Integrationstest, E ist Dokumentation, F schließt den Milestone. Kein Sub-Schritt hängt vom vorherigen ab — jeder kann einzeln reviewt werden.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, vitest, pytest, FastAPI, openpyxl

---

## Datei-Übersicht

| Aktion | Datei |
|--------|-------|
| Ersetzen | `frontend/src/components/dp/LogoMark.tsx` |
| Ergänzen | `frontend/src/index.css` |
| Ändern | `frontend/src/components/layout/MiniRail.tsx` |
| Ändern | `handoff/ACCEPTANCE.md` |
| Ändern | `frontend/src/features/plans/components/PlanGrid.tsx` |
| Ändern | `frontend/src/components/dp/ShiftCell.tsx` |
| Ändern | `frontend/src/features/doctors/DoctorCard.tsx` |
| Erweitern | `frontend/src/features/doctors/tests/DoctorCard.test.tsx` |
| Neu | `backend/tests/integration/test_plan_lifecycle_smoke.py` |
| Aktualisieren | `README.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/constraints.md`, `docs/design-implementation.md` |
| Ändern | `backend/app/services/department_service.py` |
| Neu/Verschieben | `tasks/done/M7-001-phase-a-abschluss.md` |
| Ergänzen | `docs/decisions.md`, `docs/open-questions.md`, `CLAUDE.md`, `docs/roadmap.md` |

---

## Task 1: Logo — LogoMark.tsx ersetzen + CSS-Keyframes

**Sub-Schritt A | Commit: `feat(ui): M7-001/A Sortier-D Logo`**

**Files:**
- Replace: `frontend/src/components/dp/LogoMark.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/layout/MiniRail.tsx`
- Modify: `handoff/ACCEPTANCE.md`

- [ ] **Schritt 1.1: LogoMark.tsx ersetzen**

Lese `handoff/logo-mark.tsx` und überschreibe `frontend/src/components/dp/LogoMark.tsx` mit dem identischen Inhalt (1:1-Kopie). Die Datei exportiert drei Symbole:
- `LogoMarkSvg({ size?, fg? })` — pures SVG
- `LogoMark({ size?, bg?, fg?, radius?, pulse?, ariaLabel? })` — Tile mit terrakotta-BG
- `LogoWordmark({ tone?, size?, pulse? })` — SVG + Schriftzug

- [ ] **Schritt 1.2: CSS-Keyframes in index.css ergänzen**

Füge am Ende von `frontend/src/index.css` ein (nach der letzten bestehenden Zeile):

```css
/* ── Logo-Pulse-Animation (Plan-Generator-Status) ────────────────── */
@keyframes dp-logo-bar-pulse {
  0%, 70%, 100% { opacity: 1; }
  35%           { opacity: 0.35; }
}

[data-pulse] .dp-logo-bars [data-bar] {
  animation: dp-logo-bar-pulse 1.6s ease-in-out infinite;
}
[data-pulse] .dp-logo-bars [data-bar="1"] { animation-delay: 0s;    }
[data-pulse] .dp-logo-bars [data-bar="2"] { animation-delay: 0.12s; }
[data-pulse] .dp-logo-bars [data-bar="3"] { animation-delay: 0.24s; }
[data-pulse] .dp-logo-bars [data-bar="4"] { animation-delay: 0.36s; }
[data-pulse] .dp-logo-bars [data-bar="5"] { animation-delay: 0.48s; }

@media (prefers-reduced-motion: reduce) {
  [data-pulse] .dp-logo-bars [data-bar] { animation: none; }
}
```

- [ ] **Schritt 1.3: MiniRail.tsx — Logo-Tile ersetzen**

In `frontend/src/components/layout/MiniRail.tsx`:

1. Import hinzufügen (nach den bestehenden Imports):
```tsx
import { LogoMark } from '@/components/dp/LogoMark'
```

2. Logo-Tile-Block ersetzen. Vorher:
```tsx
      {/* Logo-Tile */}
      <div className="w-[38px] h-[38px] rounded-xl bg-dp-accent flex items-center justify-center mb-1 shrink-0">
        <span className="font-serif italic text-paper text-xl leading-none select-none">D</span>
      </div>
```
Nachher:
```tsx
      {/* Logo-Tile */}
      <div className="mb-1 shrink-0">
        <LogoMark size={38} radius={12} />
      </div>
```

- [ ] **Schritt 1.4: Frontend-Build prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```
Erwartung: 0 Fehler.

- [ ] **Schritt 1.5: ACCEPTANCE.md — Schritt 6a anhängen**

Füge am Ende von `handoff/ACCEPTANCE.md` an:

```markdown
## ✅ Schritt 6a — Logo (Sortier-D · Schicht)

- [ ] Rail zeigt neues LogoMark-SVG (kein Newsreader-Italic-„D" mehr).
- [ ] Terrakotta-Hintergrund (`#C66A3D`), Creme-Mark (`#FFF8EF`), `border-radius: 12px`.
- [ ] Fünf sortierte Balken mit Schicht-Segmenten erkennbar.
- [ ] Statisch ohne `pulse`-Prop — kein Flackern, keine CPU-Last.
- [ ] `prefers-reduced-motion`: Animation deaktiviert (Keyframe mit `animation: none`).
- [ ] TypeScript-Kompilierung sauber (0 Fehler).
```

- [ ] **Schritt 1.6: Commit**

```bash
git add frontend/src/components/dp/LogoMark.tsx \
        frontend/src/index.css \
        frontend/src/components/layout/MiniRail.tsx \
        handoff/ACCEPTANCE.md
git commit -m "feat(ui): M7-001/A Sortier-D Logo"
```

---

## Task 2: Plan-Grid-Affordance — Ebenen A, D, E

**Sub-Schritt B | Commit: `feat(ui): M7-001/B Grid-Affordance A+D+E`**

**Files:**
- Modify: `frontend/src/components/dp/ShiftCell.tsx`
- Modify: `frontend/src/features/plans/components/PlanGrid.tsx`
- Modify: `handoff/ACCEPTANCE.md`

### Hintergrund

Aktuell ist eine leere Zelle ein unsichtbares `<button>` ohne visuellen Anker. Die Affordance-Spec fügt drei Ebenen hinzu:
- **A (Dot-Grid):** Kleiner Punkt in leerer Zelle als Anker
- **D (Crosshair-Hover):** Row + Header + Zielzelle markiert bei Hover
- **E (Drag-Modus):** Visuelle valid/invalid/hover-target States (visuelles Layer bereit, DnD-Verdrahtung folgt in Folge-Milestone per ADR-053)

Layer-Priorität (höchste zuerst): `filled → dragging → hover-target → idle-dot`

- [ ] **Schritt 2.1: ShiftCell.tsx — neue Props ergänzen**

In `frontend/src/components/dp/ShiftCell.tsx` die Props-Schnittstelle erweitern:

```tsx
import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'
import { Avatar } from '@/components/dp/Avatar'

type DragState = 'valid' | 'invalid' | 'hover-target' | null

export function ShiftCell({
  code,
  shiftTypeId,
  conflict,
  tarifWarning,
  weekend,
  today,
  onClick,
  onConflictDotClick,
  onTarifDotClick,
  // Affordance-Props:
  showDot = false,
  isHoverTarget = false,
  dragState = null,
  dragPreviewDoctor = null,
  onMouseEnter,
  onFocus,
}: {
  code?: string
  shiftTypeId?: number
  conflict?: boolean
  tarifWarning?: boolean
  weekend?: boolean
  today?: boolean
  onClick?: () => void
  onConflictDotClick?: () => void
  onTarifDotClick?: () => void
  showDot?: boolean
  isHoverTarget?: boolean
  dragState?: DragState
  dragPreviewDoctor?: { name: string; short_name?: string | null; id: number } | null
  onMouseEnter?: () => void
  onFocus?: () => void
}) {
```

- [ ] **Schritt 2.2: ShiftCell.tsx — Rendering leerer Zellen (Ebenen A, D, E)**

Ersetze den gesamten `if (!code)` Block:

```tsx
  if (!code) {
    // Layer-Priorität: drag > hover-target > idle-dot
    let cellContent: React.ReactNode = null
    let extraClasses = ''
    let extraStyle: React.CSSProperties = {}

    if (dragState === 'valid') {
      extraClasses = 'border border-dashed'
      extraStyle = {
        background: 'rgba(122, 158, 85, 0.12)',
        borderColor: 'rgba(122, 158, 85, 0.55)',
      }
    } else if (dragState === 'invalid') {
      extraClasses = 'border-0'
      extraStyle = {
        background: 'rgba(0, 0, 0, 0.04)',
        backgroundImage:
          'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.06) 4px 5px)',
      }
    } else if (dragState === 'hover-target') {
      extraClasses = 'border border-solid'
      extraStyle = {
        background: 'rgba(198, 106, 61, 0.16)',
        borderColor: '#C66A3D',
        borderWidth: '1.5px',
      }
      if (dragPreviewDoctor) {
        cellContent = (
          <span className="opacity-95 pointer-events-none">
            <Avatar
              name={dragPreviewDoctor.name}
              shortName={dragPreviewDoctor.short_name}
              id={dragPreviewDoctor.id}
              size={18}
            />
          </span>
        )
      }
    } else if (isHoverTarget) {
      extraClasses = 'border border-dashed'
      extraStyle = {
        background: 'rgba(198, 106, 61, 0.08)',
        borderColor: '#C66A3D',
        borderWidth: '1.5px',
        borderRadius: '7px',
        transition: 'background 80ms ease-out, border-color 80ms ease-out',
      }
      cellContent = (
        <span
          className="text-[14px] font-medium pointer-events-none select-none"
          style={{ color: '#C66A3D' }}
          aria-hidden
        >
          +
        </span>
      )
    } else if (showDot) {
      cellContent = (
        <span
          className="pointer-events-none"
          style={{
            display: 'block',
            width: 5,
            height: 5,
            borderRadius: 999,
            background: weekend ? '#CBC2AC' : '#D6CCB6',
          }}
          aria-hidden
        />
      )
    }

    return (
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        className={cn(
          'aspect-square w-full rounded-cell border border-line bg-paper/50 transition',
          'flex items-center justify-center',
          'hover:bg-card hover:border-line-2',
          weekend && 'bg-weekend/40',
          today && 'ring-2 ring-warn-line',
          (isHoverTarget || dragState) && 'border-transparent hover:bg-transparent',
          extraClasses,
        )}
        style={extraStyle}
      >
        {cellContent}
      </button>
    )
  }
```

- [ ] **Schritt 2.3: ShiftCell.tsx — `onMouseEnter`/`onFocus` bei gefüllter Zelle**

Im `return` der gefüllten Zelle (nach dem `if (!code)` Block) `onMouseEnter` und `onFocus` ergänzen:

```tsx
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className={cn(
        'relative aspect-square w-full rounded-cell text-[11px] font-bold leading-none transition',
        'hover:brightness-95',
        conflict && 'ring-[1.5px] ring-warn',
        today && 'ring-2 ring-warn-line',
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {code}
      {conflict && (
        <span
          onClick={(e) => { e.stopPropagation(); onConflictDotClick?.() }}
          className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-warn text-[8px] font-bold text-paper"
        >
          !
        </span>
      )}
      {tarifWarning && (
        <span
          onClick={(e) => { e.stopPropagation(); onTarifDotClick?.() }}
          className="absolute -left-1 -top-1 grid size-3 place-items-center rounded-full bg-sand border border-warn-line text-[8px] font-bold text-ink"
        >
          §
        </span>
      )}
    </button>
  )
```

- [ ] **Schritt 2.4: PlanGrid.tsx — hover-State + Crosshair-Logik**

In `frontend/src/features/plans/components/PlanGrid.tsx`:

1. Import `useState` ergänzen:
```tsx
import { Fragment, useState } from 'react'
```

2. Hover-State am Anfang der Komponente (nach `buildGridData`):
```tsx
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)
```

3. Grid-Container bekommt `onMouseLeave`:
```tsx
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns: `210px repeat(${days.length}, 36px)` }}
        onMouseLeave={() => setHover(null)}
      >
```

- [ ] **Schritt 2.5: PlanGrid.tsx — Header-Cells mit colIdx + Crosshair-Highlight**

Ersetze den Header-Days-Loop:

```tsx
        {days.map((day, colIdx) => {
          const isWe = isWeekend(day)
          const isTod = isToday(day)
          const abbr = WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]
          const isColHovered = hover?.col === colIdx
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={cn(
                'h-10 flex flex-col items-center justify-center border-b border-line transition-colors',
                isWe ? 'bg-weekend' : '',
                isTod ? 'bg-warn-bg text-warn-ink' : '',
                isColHovered && !isTod ? 'text-[#7A3414]' : '',
              )}
              style={isColHovered && !isTod ? { background: '#FBE5D6' } : undefined}
            >
              <span className="text-[10px] leading-none">{abbr}</span>
              <span className="text-[16px] font-serif leading-tight">
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
```

- [ ] **Schritt 2.6: PlanGrid.tsx — Row-Loop mit rowIdx + Row-Tint + ShiftCell-Props**

Ersetze den Rows-Loop komplett:

```tsx
        {rows.map(({ doctor, cells }, rowIdx) => {
          const isRowHovered = hover?.row === rowIdx
          return (
            <Fragment key={`row-${doctor.id}`}>
              {/* Doctor-Label */}
              <div
                key={`lbl-${doctor.id}`}
                className={cn(
                  'sticky left-0 bg-paper z-10 flex items-center gap-2 px-2 h-[42px] border-b border-line/50 transition-colors',
                  isRowHovered && 'bg-[#FAF0DC]',
                )}
              >
                <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={26} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-tight truncate">
                    {doctor.name}
                  </p>
                  <p className="text-[10px] text-ink-3 leading-none">
                    {doctor.is_facharzt
                      ? 'Facharzt'
                      : `WBJ ${doctor.weiterbildungsjahr ?? '–'}`}
                  </p>
                </div>
              </div>

              {/* Zellen */}
              {days.map((day, colIdx) => {
                const dayKey = format(day, 'yyyy-MM-dd')
                const cell = cells[dayKey]
                const firstShift = cell?.shifts[0]
                const isTarget = isRowHovered && hover?.col === colIdx
                const isFilled = !!firstShift?.shift_type?.short_name
                return (
                  <div
                    key={`cell-${doctor.id}-${dayKey}`}
                    className={cn(
                      'h-[42px] flex items-center justify-center p-0.5 border-b border-line/30 transition-colors',
                      isWeekend(day) ? 'bg-weekend/40' : '',
                      isRowHovered && !isFilled ? 'bg-[#FAF0DC]' : '',
                    )}
                  >
                    <ShiftCell
                      code={firstShift?.shift_type?.short_name ?? undefined}
                      shiftTypeId={firstShift?.shift_type_id}
                      conflict={cell?.hasConflict}
                      tarifWarning={
                        firstShift != null &&
                        (tarifWarnings?.[firstShift.id]?.length ?? 0) > 0
                      }
                      weekend={isWeekend(day)}
                      today={isToday(day)}
                      onClick={() => onCellClick(firstShift?.id ?? null, doctor.id, dayKey)}
                      onConflictDotClick={
                        firstShift && cell?.hasConflict
                          ? () => onConflictDotClick(firstShift)
                          : undefined
                      }
                      onTarifDotClick={
                        firstShift && (tarifWarnings?.[firstShift.id]?.length ?? 0) > 0
                          ? () => onTarifDotClick?.(firstShift)
                          : undefined
                      }
                      showDot={!isFilled}
                      isHoverTarget={isTarget && !isFilled}
                      onMouseEnter={() => setHover({ row: rowIdx, col: colIdx })}
                      onFocus={() => setHover({ row: rowIdx, col: colIdx })}
                    />
                  </div>
                )
              })}
            </Fragment>
          )
        })}
```

- [ ] **Schritt 2.7: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit
```
Erwartung: 0 Fehler.

- [ ] **Schritt 2.8: ACCEPTANCE.md — Schritt 6b anhängen**

Füge am Ende von `handoff/ACCEPTANCE.md` an:

```markdown
## ✅ Schritt 6b — Plan-Grid-Affordance (A · Dot-Grid, D · Crosshair-Hover, E · Drag-Modus)

### Ebene A — Dot-Grid
- [ ] Leere Zelle zeigt 5×5 px Punkt (`border-radius: 999px`).
- [ ] Werktag: `#D6CCB6`; Wochenende: `#CBC2AC`.
- [ ] Kein Punkt in Header-Zellen.
- [ ] Gefüllte Zellen: kein Punkt.

### Ebene D — Crosshair-Hover
- [ ] Cursor über leerer Zelle: Row-Tint `#FAF0DC` + Header-Zelle `#FBE5D6 / #7A3414` + `+`-Glyph in Zielzelle.
- [ ] Cursor über gefüllter Zelle: Row-Tint + Header-Zelle, kein `+`-Glyph.
- [ ] Cursor verlässt Grid: vollständiger Rückfall in Ruhezustand.
- [ ] Keyboard-Fokus auf Zelle löst denselben Crosshair aus.
- [ ] `prefers-reduced-motion`: Transition-Dauer 0 ms.

### Ebene E — Drag-Modus (visuelles Layer)
- [ ] `dragState='valid'`: grüner Dashed-Rahmen + BG vorhanden (visuell testbar via DevTools).
- [ ] `dragState='invalid'`: Schraffur-BG vorhanden.
- [ ] `dragState='hover-target'`: orange Solid-Rahmen + Avatar-Preview vorhanden.
- [ ] Ohne `dragState`-Prop: kein Effekt (Layer inaktiv).

### TypeScript
- [ ] `pnpm tsc --noEmit` sauber.
```

- [ ] **Schritt 2.9: Commit**

```bash
git add frontend/src/components/dp/ShiftCell.tsx \
        frontend/src/features/plans/components/PlanGrid.tsx \
        handoff/ACCEPTANCE.md
git commit -m "feat(ui): M7-001/B Grid-Affordance A+D+E"
```

---

## Task 3: Arzt-Titel in DoctorCard

**Sub-Schritt C | Commit: `feat(ui): M7-001/C Titel in Ärzte-Übersicht`**

**Files:**
- Modify: `frontend/src/features/doctors/DoctorCard.tsx`
- Modify: `frontend/src/features/doctors/tests/DoctorCard.test.tsx`

Das Feld `title?: string | null` ist bereits in `DoctorWithRelations` (api-types.ts). Keine API-Änderung nötig.

- [ ] **Schritt 3.1: DoctorCard.test.tsx — Titel-Tests schreiben (TDD)**

Ergänze am Ende der `describe('DoctorCard', ...)` Suite:

```tsx
  it('zeigt Titel vor dem Namen wenn vorhanden', () => {
    const doctorWithTitle: Doctor = { ...baseDoctor, title: 'Dr. med.' }
    render(<Wrapper><DoctorCard doctor={doctorWithTitle} /></Wrapper>)
    expect(screen.getByText('Dr. med. Lena Hartmann')).toBeInTheDocument()
  })

  it('zeigt nur den Namen wenn kein Titel gesetzt', () => {
    render(<Wrapper><DoctorCard doctor={baseDoctor} /></Wrapper>)
    // Kein Präfix, Name direkt
    expect(screen.getByText('Lena Hartmann')).toBeInTheDocument()
    expect(screen.queryByText(/dr\./i)).not.toBeInTheDocument()
  })
```

Hinweis: `baseDoctor` hat kein `title`-Feld → `doctor.title` ist `undefined` → Test erwartet nur den Namen.

- [ ] **Schritt 3.2: Tests laufen lassen — Fehler verifizieren**

```bash
cd frontend && pnpm vitest run src/features/doctors/tests/DoctorCard.test.tsx
```
Erwartung: die zwei neuen Tests FAIL (Name-Zeile zeigt noch kein Titel-Präfix).

- [ ] **Schritt 3.3: DoctorCard.tsx — Titel-Anzeige implementieren**

In `frontend/src/features/doctors/DoctorCard.tsx` die Name-Zeile ändern:

Vorher:
```tsx
          <p className="font-serif text-[19px] leading-tight text-ink truncate">
            {doctor.name}
          </p>
```
Nachher:
```tsx
          <p className="font-serif text-[19px] leading-tight text-ink truncate">
            {doctor.title ? `${doctor.title} ` : ''}{doctor.name}
          </p>
```

- [ ] **Schritt 3.4: Tests laufen lassen — alle grün**

```bash
cd frontend && pnpm vitest run src/features/doctors/tests/DoctorCard.test.tsx
```
Erwartung: alle Tests PASS (inkl. bestehende 8 + 2 neue = 10 Tests).

- [ ] **Schritt 3.5: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit
```
Erwartung: 0 Fehler.

- [ ] **Schritt 3.6: Commit**

```bash
git add frontend/src/features/doctors/DoctorCard.tsx \
        frontend/src/features/doctors/tests/DoctorCard.test.tsx
git commit -m "feat(ui): M7-001/C Titel in Ärzte-Übersicht"
```

---

## Task 4: Backend-Lifecycle-Smoke-Test

**Sub-Schritt D | Commit: `test: M7-001/D Plan-Lifecycle-Smoke`**

**Files:**
- Create: `backend/tests/integration/test_plan_lifecycle_smoke.py`

Nutzt die bestehenden `conftest.py`-Fixtures: `client` (TestClient mit In-Memory-SQLite) und `engine`. Keine neuen Fixtures nötig. Pattern orientiert sich an bestehenden Tests in `tests/integration/`.

- [ ] **Schritt 4.1: Smoke-Test schreiben**

Erstelle `backend/tests/integration/test_plan_lifecycle_smoke.py`:

```python
"""Smoke-Test: vollständiger Plan-Lifecycle von Anlage bis Export.

Prüft den End-to-End-Flow durch alle wichtigen API-Endpunkte:
Doctor → ShiftType → Plan → Shift anlegen → Shift belegen →
Konflikte abrufen → Excel-Export.
"""
from fastapi.testclient import TestClient


def test_plan_lifecycle_smoke(client: TestClient) -> None:
    # 1. Doctor anlegen
    r = client.post(
        "/api/doctors",
        json={"name": "Smoke Doctor", "short_name": "SD"},
    )
    assert r.status_code == 201, r.text
    doctor_id = r.json()["id"]

    # 2. ShiftType anlegen (eigener, isoliert vom Test)
    r = client.post(
        "/api/shift-types",
        json={
            "name": "Smoke-Dienst",
            "short_name": "SM",
            "applies_on_weekdays": True,
            "applies_on_weekend": False,
            "display_order": 99,
        },
    )
    assert r.status_code == 201, r.text
    shift_type_id = r.json()["id"]

    # 3. Plan anlegen
    r = client.post(
        "/api/plans",
        json={
            "name": "Smoke-Plan Mai 2026",
            "valid_from": "2026-05-01",
            "valid_to": "2026-05-31",
        },
    )
    assert r.status_code == 201, r.text
    plan_id = r.json()["id"]

    # 4. Shift am ersten Wochentag anlegen (2026-05-04 = Montag)
    r = client.post(
        f"/api/plans/{plan_id}/shifts",
        json={
            "shift_date": "2026-05-04",
            "shift_type_id": shift_type_id,
        },
    )
    assert r.status_code == 201, r.text
    shift_id = r.json()["id"]

    # 5. Shift belegen (Doctor zuweisen)
    r = client.patch(
        f"/api/shifts/{shift_id}",
        json={"doctor_id": doctor_id},
    )
    assert r.status_code == 200, r.text
    assert r.json()["doctor_id"] == doctor_id

    # 6. Konflikte abrufen (muss 200 liefern, kein 404)
    r = client.get(f"/api/plans/{plan_id}/conflicts")
    assert r.status_code == 200, r.text
    payload = r.json()
    assert "conflicts" in payload

    # 7. Excel-Export (muss 200 + xlsx MIME liefern)
    r = client.get(f"/api/plans/{plan_id}/export")
    assert r.status_code == 200, r.text
    assert "spreadsheetml" in r.headers.get("content-type", "")
    assert len(r.content) > 0
```

- [ ] **Schritt 4.2: Test laufen lassen**

```bash
cd backend && uv run pytest tests/integration/test_plan_lifecycle_smoke.py -v
```
Erwartung:
```
tests/integration/test_plan_lifecycle_smoke.py::test_plan_lifecycle_smoke PASSED
1 passed in <2s
```

- [ ] **Schritt 4.3: Gesamte Test-Suite laufen lassen**

```bash
cd backend && uv run pytest --tb=short -q
```
Erwartung: alle Tests PASS, 0 Fehler.

- [ ] **Schritt 4.4: Commit**

```bash
git add backend/tests/integration/test_plan_lifecycle_smoke.py
git commit -m "test: M7-001/D Plan-Lifecycle-Smoke"
```

---

## Task 5: Vollständiger Doku-Sweep

**Sub-Schritt E | Commit: `docs: M7-001/E vollständiger Doku-Sweep`**

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/data-model.md`
- Modify: `docs/constraints.md`
- Modify: `docs/design-implementation.md`
- Modify: `backend/app/services/department_service.py`

- [ ] **Schritt 5.1: README.md aktualisieren**

Ändere folgende Abschnitte in `README.md`:

**Status-Zeile** — vorher:
```
Projekt in aktiver Entwicklung. Konzeptphase abgeschlossen, Implementierung läuft.
```
Nachher:
```
Phase A (Manueller Planungsassistent) abgeschlossen. Alle M0–M7-Milestones implementiert.
```

**Shell-Struktur-Abschnitt** — entferne den Eintrag:
```
- `/heute` und `/plans`: Platzhalter-Seiten (werden in M2-003 implementiert)
```
Ersetze durch:
```
- `/heute`: Dashboard (Heute-Ansicht)
- `/plans`: Plan-Editor mit Dienste- und Bereiche-Ansicht (PlanGrid, RotationGrid)
```

Prüfe alle anderen Stellen auf Platzhalter oder veraltete Referenzen und korrigiere sie.

- [ ] **Schritt 5.2: docs/architecture.md — Verzeichnisstruktur prüfen**

Lese `docs/architecture.md` und vergleiche die dokumentierte Verzeichnisstruktur mit dem tatsächlichen Code:
- `frontend/src/features/plans/components/PlanGrid.tsx` (Unterverzeichnis `components/`)
- `frontend/src/components/dp/ShiftCell.tsx` (separate Datei, nicht in `primitives.tsx`)
- Alle neuen Feature-Dirs seit ursprünglicher Doku

Korrigiere alle Abweichungen.

- [ ] **Schritt 5.3: docs/data-model.md — Doctor-Titel-Feld dokumentieren**

Suche den `Doctor`-Modell-Abschnitt und ergänze das Feld:
```
| title          | VARCHAR(50) | nullable | Akademischer Titel (z. B. „Dr. med.") — Migration 0007 |
```

Falls der Abschnitt fehlt oder das Feld komplett fehlt, ergänze es.

- [ ] **Schritt 5.4: docs/constraints.md — M3–M6 Constraints ergänzen**

Füge fehlende Einträge für implementierte Constraints ein:
- **M3-001:** Rotations-Zuweisung via Drag & Drop — Drop öffnet Popover, schreibt nicht direkt (ADR-054)
- **M4-001:** INA-Verfügbarkeit-Visualisierung — Amber-Ring im RotationGrid, Amber-Dot im Popover (read-only)
- **M5-001:** Tarif-Soft-Validierung — Plugin-Pipeline (leere `REGISTERED_RULES`), Sand-Dot in ShiftCell (§), read-only
- **M6-001:** Excel-Export — `GET /api/plans/{id}/export`, openpyxl, Default-Schema (ein Sheet `Dienste`)

- [ ] **Schritt 5.5: docs/design-implementation.md — auf Aktualität prüfen**

Lese die Datei durch. Korrigiere veraltete Abschnitte (z. B. Referenzen auf AppShell, alte Komponentennamen, nicht implementierte Features die als "geplant" markiert sind aber längst implementiert wurden).

- [ ] **Schritt 5.6: department_service.py:54 — TODO auflösen**

In `backend/app/services/department_service.py`, Zeile 54, ersetze:
```python
    # TODO: wenn Plan-Modul existiert, prüfen ob Department in Plänen verwendet wird
```
Durch:
```python
    # Department-Nutzung in Plänen läuft über RotationAssignment (department_id FK).
    # Kein harter Guard hier — Phase A erlaubt Delete; Solver-Phase (B) ergänzt ggf. Constraint.
```

- [ ] **Schritt 5.7: Backend-Tests nach Code-Änderung**

```bash
cd backend && uv run pytest --tb=short -q
```
Erwartung: alle PASS.

- [ ] **Schritt 5.8: Commit**

```bash
git add README.md \
        docs/architecture.md \
        docs/data-model.md \
        docs/constraints.md \
        docs/design-implementation.md \
        backend/app/services/department_service.py
git commit -m "docs: M7-001/E vollständiger Doku-Sweep"
```

---

## Task 6: Milestone-Abschluss

**Sub-Schritt F | Commit: `docs: M7-001/F Abschluss + ADRs`**

**Files:**
- Modify: `tasks/open/M7-001-*.md` → verschieben nach `tasks/done/`
- Modify: `docs/decisions.md`
- Modify: `docs/open-questions.md`
- Modify: `CLAUDE.md`
- Modify: `docs/roadmap.md`

- [ ] **Schritt 6.1: Task-Briefing abschließen**

Lese das Briefing in `tasks/open/` (Dateiname enthält „M7-001"). Setze alle `[ ]` auf `[x]`. Hänge am Ende an:

```markdown
## Abschluss

- **Datum:** 2026-05-22
- **Branch:** task/M7-001-phase-a-abschluss
- **Commits:**
  - feat(ui): M7-001/A Sortier-D Logo
  - feat(ui): M7-001/B Grid-Affordance A+D+E
  - feat(ui): M7-001/C Titel in Ärzte-Übersicht
  - test: M7-001/D Plan-Lifecycle-Smoke
  - docs: M7-001/E vollständiger Doku-Sweep
  - docs: M7-001/F Abschluss + ADRs (dieser Commit)
- **Testergebnis:** Backend pytest ✅, Frontend vitest ✅
- **Offene Voraussetzungen:** keine (Phase-B-Solver erfordert JVM, aber nicht für diesen Milestone)
```

Verschiebe die Datei nach `tasks/done/`.

- [ ] **Schritt 6.2: docs/decisions.md — neue ADRs**

Ergänze am Ende der ADR-Tabelle:

```markdown
| ADR-065 | LogoMark Sortier-D ersetzt Newsreader-Italic-„D" in MiniRail | Markentreue: neues Logo transportiert „Ordnung + Schichten + Initial-D" klarer als der generische Italic-Buchstabe. Pulse-Funktion bereit für Plan-Generator (Phase B). | 2026-05-22 |
| ADR-066 | Plan-Grid-Affordance: 3 Ebenen (A Dot-Grid / D Crosshair / E Drag-Modus visuell) | Leere Zellen waren visuell nicht erkennbar. Layer-System hält Priorität (filled > drag > hover > idle) klar; Ebene E ist visuelles Layer ohne DnD-Verdrahtung — ADR-053 (DnD Dienste) bleibt offen für Phase B. | 2026-05-22 |
| ADR-067 | Doctor-Titel nur in DoctorCard (Ärzte-Übersicht), nicht systemweit | Titel ist primär für menschliche Lesbarkeit in der Übersicht relevant. Kompaktere Kontexte (Grid-Zellen, Popovers, Autocomplete) zeigen Short-Name oder Namen ohne Titel — keine Änderung dort nötig. | 2026-05-22 |
```

- [ ] **Schritt 6.3: docs/open-questions.md — keine Fragen durch M7 beantwortet**

OQ-003, OQ-004, OQ-006, OQ-007 bleiben offen (domänenabhängig). Kein Eintrag zu ändern.

- [ ] **Schritt 6.4: CLAUDE.md — neue Patterns**

Ergänze nach dem Abschnitt `### Frontend — Plan-Excel-Export (M6-001)`:

```markdown
### Frontend — Logo & Branding (M7-001)
- **LogoMark-Komponente:** `frontend/src/components/dp/LogoMark.tsx` exportiert `LogoMarkSvg`, `LogoMark`, `LogoWordmark`. Default: size=38, bg=Terrakotta, fg=Creme, radius=12, pulse=false.
- **Pulse-Animation:** nur aktiv wenn `pulse={true}`. CSS-Keyframes in `frontend/src/index.css` (`[data-pulse] .dp-logo-bars [data-bar]`). `@media (prefers-reduced-motion: reduce)` deaktiviert Animation.
- **Kein Plan-Generator-Store in Phase A:** `pulse` bleibt `false`. Phase B verdrahtet `isGenerating`.

### Frontend — Plan-Grid-Affordance (M7-001)
- **Layer-Priorität in ShiftCell:** filled → dragging → hover-target → idle-dot. Einfacher visueller Switch — keine komplexe State-Maschine.
- **Hover-State auf PlanGrid-Level:** `useState<{row, col}|null>` — kein per-Zellen-State. `onMouseLeave` des Grid-Containers resettet. `onFocus` auf ShiftCell triggert denselben Crosshair für Keyboard-Nutzer.
- **Ebene E (Drag-Modus) visuell bereit:** ShiftCell akzeptiert `dragState` und `dragPreviewDoctor` Props. DnD-Verdrahtung in Dienste-Ansicht folgt in Phase B (ADR-053 bleibt offen).
- **Farben ohne neue Tokens:** `#D6CCB6` (Dot Werktag), `#CBC2AC` (Dot Wochenende), `#FAF0DC` (Row-Tint), `#FBE5D6` (Header-BG), `rgba(198,106,61,0.08)` (Crosshair-Zell-BG) — direkte Hex-Werte, kein neuer Token.
```

- [ ] **Schritt 6.5: docs/roadmap.md — M7 abschließen**

Suche den M7-001-Eintrag und ändere:
```
**Status.** ⏳ Geplant.
```
zu:
```
**Status.** ✅ Abgeschlossen (2026-05-22). Logo, Grid-Affordance, Arzt-Titel, Smoke-Test, Doku-Sweep.
```

Aktualisiere die Status-Tabelle am Anfang der Roadmap (falls vorhanden) entsprechend.

- [ ] **Schritt 6.6: Finale Test-Runs**

```bash
cd backend && uv run pytest --tb=short -q
```
Erwartung: alle PASS.

```bash
cd frontend && pnpm vitest run
```
Erwartung: alle PASS.

- [ ] **Schritt 6.7: Abschluss-Commit**

```bash
git add tasks/done/ \
        docs/decisions.md \
        docs/open-questions.md \
        CLAUDE.md \
        docs/roadmap.md
git commit -m "docs: M7-001/F Abschluss + ADRs 065-067"
```

---

## Self-Review

**Spec Coverage:**
- ✅ A: Logo — Task 1 vollständig
- ✅ B: Grid-Affordance (A, D, E) — Task 2 vollständig
- ✅ C: Arzt-Titel — Task 3 vollständig (TDD)
- ✅ D: Smoke-Test — Task 4 vollständig
- ✅ E: Doku-Sweep (README, architecture, data-model, constraints, design-impl, TODO) — Task 5 vollständig
- ✅ F: Milestone-Abschluss — Task 6 vollständig

**Placeholder-Scan:** keine TBDs, kein „ähnlich wie Task N", alle Code-Blöcke vollständig.

**Typ-Konsistenz:**
- `ShiftCell` Props `showDot`, `isHoverTarget`, `dragState`, `onMouseEnter`, `onFocus` — in Task 2.1 definiert, in Task 2.6 verwendet ✅
- `hover: {row, col}` State — in Task 2.4 definiert, in Tasks 2.5+2.6 verwendet ✅
- `doctor.title` — `title?: string | null` in `DoctorWithRelations` (api-types.ts), in Task 3.3 verwendet ✅
