# Besetzungsmodus-Erweiterungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue AbsenceTypes EA/INA-EA/UNBESETZT, Farbkonfiguration in Plan-Einstellungen, Import-Mapping und unmatched-Codes → DIV-Notiz, sowie Zell-Klick zeigt Shift/Absence-Details im Sidebar.

**Architecture:** Drei neue `AbsenceType`-Werte erweitern das bestehende Abwesenheits-System ohne Datenbankschema-Änderung (VARCHAR-Spalte). Import-Service leitet unbekannte Codes zu SONSTIGES mit Rohwert als Notiz. PlanPage erhält `contextAbsence`-State parallel zu `contextShift`.

**Tech Stack:** Python/SQLAlchemy/Alembic, FastAPI, React 18/TypeScript, TanStack Query, dnd-kit, Tailwind CSS

---

## File Map

| Datei | Änderung |
|---|---|
| `backend/app/models/absence.py` | +3 AbsenceType-Werte |
| `backend/alembic/versions/0020_add_absence_types.py` | Marker-Migration (kein DDL) |
| `backend/app/schemas/excel_import.py` | CodeEntry.default_note Feld |
| `backend/app/services/import_match_service.py` | DEFAULT_CODE_MAP EA/INA-EA + unmatched→SONSTIGES |
| `backend/app/services/import_commit_service.py` | notes=raw bei SONSTIGES-Abwesenheiten |
| `frontend/src/lib/api-types.ts` | AbsenceType-Union Zeile 740 |
| `frontend/src/lib/importTypes.ts` | CodeEntry.default_note |
| `frontend/src/features/plans/unifiedGridUtils.ts` | ABSENCE_CODES für EA/INA-EA/UNBESETZT |
| `frontend/src/features/plans/components/PlanModeBar.tsx` | BESETZUNG_ONLY_TYPES + alle 9 Labels |
| `frontend/src/features/plans/components/UnifiedShiftCell.tsx` | UNBESETZT X-SVG-Overlay |
| `frontend/src/features/plans/components/AbsenceAssignPopover.tsx` | 3 neue Labels |
| `frontend/src/features/plans/components/PlanSettingsModal.tsx` | 9 Farbfelder |
| `frontend/src/features/plans/components/ImportDialog.tsx` | CodeRow default_note Hinweis |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | absenceId in onCellClick |
| `frontend/src/features/plans/PlanPage.tsx` | contextAbsence State + handleCellClick |
| `frontend/src/features/plans/components/PlanSidebar.tsx` | absence Prop + Karte |
| `frontend/src/features/doctors/AbsenceFormDialog.tsx` | 3 neue Typen + Labels |
| `frontend/src/features/doctors/AbsenceList.tsx` | 3 neue Labels + badge-Varianten |

---

## Task 1: Backend — AbsenceType enum + Alembic-Migration

**Files:**
- Modify: `backend/app/models/absence.py`
- Create: `backend/alembic/versions/0020_add_absence_types.py`

- [ ] **Step 1: AbsenceType enum erweitern**

In `backend/app/models/absence.py` die Klasse `AbsenceType` ändern:

```python
class AbsenceType(enum.StrEnum):
    URLAUB = "URLAUB"
    KRANKHEIT = "KRANKHEIT"
    FORTBILDUNG = "FORTBILDUNG"
    ELTERNZEIT = "ELTERNZEIT"
    MUTTERSCHUTZ = "MUTTERSCHUTZ"
    SONSTIGES = "SONSTIGES"
    EINARBEITUNG = "EINARBEITUNG"
    EINARBEITUNG_INA = "EINARBEITUNG_INA"
    UNBESETZT = "UNBESETZT"
```

- [ ] **Step 2: Alembic Marker-Migration erstellen**

Datei `backend/alembic/versions/0020_add_absence_types.py` anlegen:

```python
"""add einarbeitung and unbesetzt absence types

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-16
"""

from alembic import op

revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # AbsenceType stored as VARCHAR (native_enum=False, length=50).
    # New values: EINARBEITUNG, EINARBEITUNG_INA, UNBESETZT — no DDL change needed.
    pass


def downgrade() -> None:
    pass
```

- [ ] **Step 3: Migration ausführen und Backend-Tests grün halten**

```bash
cd backend
uv run alembic upgrade head
uv run pytest tests/ -x -q
```

Erwartete Ausgabe: alle Tests grün, `Running migrations... 0020`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/absence.py backend/alembic/versions/0020_add_absence_types.py
git commit -m "feat: add EINARBEITUNG, EINARBEITUNG_INA, UNBESETZT absence types"
```

---

## Task 2: Backend — Import: EA/INA-EA Mapping + unmatched→SONSTIGES

**Files:**
- Modify: `backend/app/schemas/excel_import.py`
- Modify: `backend/app/services/import_match_service.py`
- Test: `backend/tests/services/test_import_match_service.py` (falls vorhanden, sonst Smoke-Test)

- [ ] **Step 1: CodeEntry um default_note erweitern**

In `backend/app/schemas/excel_import.py` die `CodeEntry`-Klasse (Zeile 57–64):

```python
class CodeEntry(BaseModel):
    raw: str
    default_action: CodeDefaultAction
    absence_type: str | None
    shift_type_id: int | None
    shift_type_short_name: str | None
    department_id: int | None = None
    department_short_name: str | None = None
    default_note: str | None = None
```

- [ ] **Step 2: DEFAULT_CODE_MAP erweitern**

In `backend/app/services/import_match_service.py` den `DEFAULT_CODE_MAP` (Zeile 31–35):

```python
DEFAULT_CODE_MAP: dict[str, dict] = {
    "U":      {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.URLAUB},
    "EZ":     {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.ELTERNZEIT},
    "EA":     {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.EINARBEITUNG},
    "INA-EA": {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.EINARBEITUNG_INA},
    "N*":     {"action": CodeDefaultAction.SHIFT,   "shift_short_name": "N"},
}
```

- [ ] **Step 3: Unmatched-Codes → SONSTIGES mit default_note**

In `import_match_service.py` den `else`-Zweig des Dept-Kürzels-Checks (nach Zeile ~200, der Block der aktuell `CodeDefaultAction.UNMATCHED` setzt):

```python
            else:
                code_entries.append(
                    CodeEntry(
                        raw=raw,
                        default_action=CodeDefaultAction.ABSENCE,
                        absence_type=AbsenceType.SONSTIGES,
                        shift_type_id=None,
                        shift_type_short_name=None,
                        default_note=raw,
                    )
                )
```

Der `else`-Zweig am Ende der `elif action == CodeDefaultAction.SHIFT`-Kette (Zeile ~240–244) bleibt unverändert — er behandelt unbekannte `action`-Werte in der Code-Map selbst (defensiv).

- [ ] **Step 4: Tests ausführen**

```bash
cd backend
uv run pytest tests/ -x -q -k "import"
```

Falls keine spezifischen Import-Tests existieren:
```bash
uv run pytest tests/ -x -q
```

Erwartete Ausgabe: alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/excel_import.py backend/app/services/import_match_service.py
git commit -m "feat: add EA/INA-EA import mapping; route unmatched codes to SONSTIGES with note"
```

---

## Task 3: Backend — Import Commit: SONSTIGES bekommt Notiz

**Files:**
- Modify: `backend/app/services/import_commit_service.py`

- [ ] **Step 1: absence_days Dict-Key um notes erweitern**

In `import_commit_service.py` Zeile 190 (`absence_days` Deklaration) ändern:

```python
    absence_days: dict[tuple[int, str, str | None], list[date]] = defaultdict(list)
```

- [ ] **Step 2: Beim Sammeln der Abwesenheits-Tage notes_key berechnen**

In Zeile 209–210 (der `if res_code.action == "absence":` Block):

```python
            if res_code.action == "absence":
                notes_key = code if res_code.absence_type == "SONSTIGES" else None
                absence_days[(doctor_id, res_code.absence_type, notes_key)].append(shift_date)
```

`code` ist der Rohwert aus `row.cells.items()` und bereits in diesem Scope verfügbar.

- [ ] **Step 3: Beim Anlegen der Abwesenheiten notes mitgeben**

Zeile 242 (die `for`-Schleife über `absence_days`) und den `create_absence`-Aufruf anpassen:

```python
    for (doctor_id, absence_type_str, notes_val), days in absence_days.items():
        sorted_days = sorted(set(days))
        ranges: list[tuple[date, date]] = []
        start = prev = sorted_days[0]
        for d in sorted_days[1:]:
            if (d - prev).days == 1:
                prev = d
            else:
                ranges.append((start, prev))
                start = prev = d
        ranges.append((start, prev))
        for valid_from, valid_to in ranges:
            absence_data: dict = {
                "absence_type": absence_type_str,
                "valid_from": valid_from,
                "valid_to": valid_to,
            }
            if notes_val:
                absence_data["notes"] = notes_val
            absence_repo.create_absence(db, doctor_id, absence_data)
            created_absences += 1
```

- [ ] **Step 4: Tests ausführen**

```bash
cd backend
uv run pytest tests/ -x -q
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/import_commit_service.py
git commit -m "feat: store raw code as notes on SONSTIGES absences during import"
```

---

## Task 4: Frontend — api-types.ts AbsenceType erweitern

**Files:**
- Modify: `frontend/src/lib/api-types.ts` (Zeile 740)

- [ ] **Step 1: AbsenceType-Union aktualisieren**

In `frontend/src/lib/api-types.ts` Zeile 740 (Schema-Definition der `AbsenceType`):

```ts
        AbsenceType: "URLAUB" | "KRANKHEIT" | "FORTBILDUNG" | "ELTERNZEIT" | "MUTTERSCHUTZ" | "SONSTIGES" | "EINARBEITUNG" | "EINARBEITUNG_INA" | "UNBESETZT";
```

- [ ] **Step 2: TypeScript-Kompilierung prüfen**

```bash
cd frontend
pnpm tsc --noEmit 2>&1 | head -30
```

Erwartete Ausgabe: TypeScript meldet Fehler wegen unvollständiger `Record<AbsenceType, ...>` in mehreren Dateien. Das ist erwartet — wird in Task 5 behoben.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api-types.ts
git commit -m "feat: extend AbsenceType with EINARBEITUNG, EINARBEITUNG_INA, UNBESETZT"
```

---

## Task 5: Frontend — Labels + Codes in allen betroffenen Dateien

**Files:**
- Modify: `frontend/src/features/plans/unifiedGridUtils.ts`
- Modify: `frontend/src/features/plans/components/AbsenceAssignPopover.tsx`
- Modify: `frontend/src/features/plans/components/PlanSettingsModal.tsx`
- Modify: `frontend/src/features/doctors/AbsenceFormDialog.tsx`
- Modify: `frontend/src/features/doctors/AbsenceList.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: unifiedGridUtils.ts — ABSENCE_CODES erweitern**

In `frontend/src/features/plans/unifiedGridUtils.ts` das `ABSENCE_CODES`-Objekt (Zeile 71–78):

```ts
const ABSENCE_CODES: Record<AbsenceType, string> = {
  URLAUB:           'U',
  KRANKHEIT:        'K',
  FORTBILDUNG:      'Fo',
  ELTERNZEIT:       'EZ',
  MUTTERSCHUTZ:     'MuSchu',
  SONSTIGES:        'DIV',
  EINARBEITUNG:     'EA',
  EINARBEITUNG_INA: 'INA-EA',
  UNBESETZT:        '',
}
```

`UNBESETZT` hat leeren String — der X-Overlay wird in `UnifiedShiftCell` gerendert (Task 6).

- [ ] **Step 2: AbsenceAssignPopover.tsx — ABSENCE_LABELS erweitern**

In `frontend/src/features/plans/components/AbsenceAssignPopover.tsx` das `ABSENCE_LABELS`-Objekt (Zeile 9–16):

```ts
const ABSENCE_LABELS: Record<AbsenceType, string> = {
  URLAUB:           'U — Urlaub',
  KRANKHEIT:        'K — Krankheit',
  FORTBILDUNG:      'FB — Fortbildung',
  ELTERNZEIT:       'EZ — Elternzeit',
  MUTTERSCHUTZ:     'MuSchu — Mutterschutz',
  SONSTIGES:        'DIV — Sonstiges',
  EINARBEITUNG:     'EA — Einarbeitung',
  EINARBEITUNG_INA: 'INA-EA — Einarbeitung INA',
  UNBESETZT:        '⊠ — Station unbesetzt',
}
```

- [ ] **Step 3: PlanSettingsModal.tsx — Farbfelder für alle 9 Typen**

In `frontend/src/features/plans/components/PlanSettingsModal.tsx`:

`ABSENCE_TYPE_LABELS` (Zeile 27–33):
```ts
const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  URLAUB:           'Urlaub',
  KRANKHEIT:        'Krankheit',
  FORTBILDUNG:      'Fortbildung',
  ELTERNZEIT:       'Elternzeit',
  MUTTERSCHUTZ:     'Mutterschutz',
  SONSTIGES:        'Sonstiges',
  EINARBEITUNG:     'Einarbeitung (EA)',
  EINARBEITUNG_INA: 'Einarbeitung INA (INA-EA)',
  UNBESETZT:        'Station unbesetzt',
}
```

`ABSENCE_TYPES` (Zeile 35):
```ts
const ABSENCE_TYPES: AbsenceType[] = [
  'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES',
  'EINARBEITUNG', 'EINARBEITUNG_INA', 'UNBESETZT',
]
```

- [ ] **Step 4: AbsenceFormDialog.tsx — 3 neue Typen im Formular**

In `frontend/src/features/doctors/AbsenceFormDialog.tsx`:

`ABSENCE_TYPE_VALUES` (Zeile 38–44):
```ts
const ABSENCE_TYPE_VALUES = [
  'URLAUB',
  'KRANKHEIT',
  'FORTBILDUNG',
  'ELTERNZEIT',
  'MUTTERSCHUTZ',
  'SONSTIGES',
  'EINARBEITUNG',
  'EINARBEITUNG_INA',
  'UNBESETZT',
] as const
```

`ABSENCE_TYPE_LABELS` (Zeile 46–53):
```ts
const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  URLAUB:           'Urlaub',
  KRANKHEIT:        'Krankheit',
  FORTBILDUNG:      'Fortbildung',
  ELTERNZEIT:       'Elternzeit',
  MUTTERSCHUTZ:     'Mutterschutz',
  SONSTIGES:        'Sonstiges',
  EINARBEITUNG:     'Einarbeitung (EA)',
  EINARBEITUNG_INA: 'Einarbeitung INA (INA-EA)',
  UNBESETZT:        'Station unbesetzt',
}
```

- [ ] **Step 5: AbsenceList.tsx — Labels + Badge-Varianten**

In `frontend/src/features/doctors/AbsenceList.tsx`:

`ABSENCE_TYPE_LABELS` (Zeile 22–29):
```ts
const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  URLAUB:           'Urlaub',
  KRANKHEIT:        'Krankheit',
  FORTBILDUNG:      'Fortbildung',
  ELTERNZEIT:       'Elternzeit',
  MUTTERSCHUTZ:     'Mutterschutz',
  SONSTIGES:        'Sonstiges',
  EINARBEITUNG:     'Einarbeitung (EA)',
  EINARBEITUNG_INA: 'Einarbeitung INA (INA-EA)',
  UNBESETZT:        'Station unbesetzt',
}
```

`ABSENCE_TYPE_VARIANTS` (Zeile 31–38):
```ts
const ABSENCE_TYPE_VARIANTS: Record<AbsenceType, 'default' | 'secondary' | 'outline'> = {
  URLAUB:           'default',
  KRANKHEIT:        'secondary',
  FORTBILDUNG:      'outline',
  ELTERNZEIT:       'secondary',
  MUTTERSCHUTZ:     'secondary',
  SONSTIGES:        'outline',
  EINARBEITUNG:     'outline',
  EINARBEITUNG_INA: 'outline',
  UNBESETZT:        'outline',
}
```

- [ ] **Step 6: PlanPage.tsx — ABSENCE_TYPE_LABELS erweitern**

In `frontend/src/features/plans/PlanPage.tsx` das `ABSENCE_TYPE_LABELS`-Objekt (Zeile 217–224):

```ts
  const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
    URLAUB:           'Urlaub',
    KRANKHEIT:        'Krankheit',
    FORTBILDUNG:      'Fortbildung',
    ELTERNZEIT:       'Elternzeit',
    MUTTERSCHUTZ:     'Mutterschutz',
    SONSTIGES:        'Sonstiges',
    EINARBEITUNG:     'Einarbeitung (EA)',
    EINARBEITUNG_INA: 'Einarbeitung INA (INA-EA)',
    UNBESETZT:        'Station unbesetzt',
  }
```

- [ ] **Step 7: TypeScript-Kompilierung prüfen**

```bash
cd frontend
pnpm tsc --noEmit 2>&1 | head -30
```

Erwartete Ausgabe: keine Fehler (oder nur noch Fehler aus Task 7/8/9, die noch nicht implementiert sind).

- [ ] **Step 8: Commit**

```bash
git add \
  frontend/src/features/plans/unifiedGridUtils.ts \
  frontend/src/features/plans/components/AbsenceAssignPopover.tsx \
  frontend/src/features/plans/components/PlanSettingsModal.tsx \
  frontend/src/features/doctors/AbsenceFormDialog.tsx \
  frontend/src/features/doctors/AbsenceList.tsx \
  frontend/src/features/plans/PlanPage.tsx
git commit -m "feat: add labels and codes for EA, INA-EA, UNBESETZT in all UI components"
```

---

## Task 6: Frontend — PlanModeBar Besetzungs-Chips

**Files:**
- Modify: `frontend/src/features/plans/components/PlanModeBar.tsx`

- [ ] **Step 1: VALID_ABSENCE_TYPES und BESETZUNG_ONLY_ABSENCE_TYPES definieren**

In `PlanModeBar.tsx` die `VALID_ABSENCE_TYPES`-Deklaration (Zeile 31–33) ersetzen:

```ts
const VALID_ABSENCE_TYPES: AbsenceType[] = [
  'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES',
  'EINARBEITUNG', 'EINARBEITUNG_INA', 'UNBESETZT',
]

const BESETZUNG_ONLY_ABSENCE_TYPES: AbsenceType[] = [
  'EINARBEITUNG', 'EINARBEITUNG_INA', 'UNBESETZT',
]
```

- [ ] **Step 2: ABSENCE_CHIP_META für alle 9 Typen**

Das `ABSENCE_CHIP_META`-Objekt (Zeile 45–54) ergänzen:

```ts
const ABSENCE_CHIP_META: Record<AbsenceType, { short: string; full: string }> = {
  URLAUB:           { short: 'U',       full: 'Urlaub' },
  KRANKHEIT:        { short: 'K',       full: 'Krankheit' },
  FORTBILDUNG:      { short: 'FB',      full: 'Fortbildung' },
  ELTERNZEIT:       { short: 'EZ',      full: 'Elternzeit' },
  MUTTERSCHUTZ:     { short: 'MuSchu',  full: 'Mutterschutz' },
  SONSTIGES:        { short: 'DIV',     full: 'Sonstiges' },
  EINARBEITUNG:     { short: 'EA',      full: 'Einarbeitung' },
  EINARBEITUNG_INA: { short: 'INA-EA',  full: 'Einarbeitung INA' },
  UNBESETZT:        { short: '⊠',       full: 'Station unbesetzt' },
}
```

- [ ] **Step 3: Chip-Rendering aufteilen**

Im Render-Abschnitt der Chips (Zeile 145–165, der Block zwischen `{/* Chips + Nachtwoche */}` und den Abwesenheits-Chips):

Die aktuelle Zeile `{VALID_ABSENCE_TYPES.map((type) => <AbsenceDraggableChip ... />)}` ersetzen durch:

```tsx
        {/* Standard-Abwesenheitstypen (immer sichtbar) */}
        {(['URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES'] as AbsenceType[]).map((type) => (
          <AbsenceDraggableChip key={type} absenceType={type} color={absenceColors?.[type]} />
        ))}

        {/* Besetzungs-only Typen */}
        {mode === 'besetzung' && BESETZUNG_ONLY_ABSENCE_TYPES.map((type) => (
          <AbsenceDraggableChip key={type} absenceType={type} color={absenceColors?.[type]} />
        ))}
```

- [ ] **Step 4: TypeScript-Kompilierung prüfen**

```bash
cd frontend
pnpm tsc --noEmit 2>&1 | grep PlanModeBar
```

Erwartete Ausgabe: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanModeBar.tsx
git commit -m "feat: add EA, INA-EA, UNBESETZT chips to PlanModeBar (besetzung-only)"
```

---

## Task 7: Frontend — UNBESETZT X-Overlay in UnifiedShiftCell

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

- [ ] **Step 1: Text-Rendering-Block finden**

```bash
grep -n "text\b" frontend/src/features/plans/components/UnifiedShiftCell.tsx | grep -i "span\|{text}" | head -10
```

Ausgabe zeigt die Zeile wo `{text}` gerendert wird — typischerweise in einem `<span>` innerhalb des Zell-Divs.

- [ ] **Step 2: UNBESETZT X-Overlay hinzufügen**

Den vorhandenen Text-Render-Block (`<span ...>{text}</span>`) in einen konditionalen Block umwandeln.

Suche den Block der Form:
```tsx
      {text && (
        <span
          className={cn(
            'text-[11px] font-medium leading-none select-none',
            ...
          )}
        >
          {text}
        </span>
      )}
```

Und ersetze ihn durch:
```tsx
      {absenceType === 'UNBESETZT' ? (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ opacity: inRotation ? 0.65 : 0.3 }}
        >
          <line
            x1="8" y1="8" x2="92" y2="92"
            stroke="currentColor"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="92" y1="8" x2="8" y2="92"
            stroke="currentColor"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : text ? (
        <span
          className={cn(
            'text-[11px] font-medium leading-none select-none',
            inRotation ? 'text-gray-800' : 'text-gray-400',
            !inRotation && 'opacity-50',
          )}
        >
          {text}
        </span>
      ) : null}
```

Hinweis: die genauen CSS-Klassen des `<span>` aus dem Original übernehmen — nur das äußere Conditional ändert sich.

- [ ] **Step 3: TypeScript-Kompilierung prüfen**

```bash
cd frontend
pnpm tsc --noEmit 2>&1 | grep UnifiedShiftCell
```

Erwartete Ausgabe: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "feat: render X-cross overlay for UNBESETZT absence type cells"
```

---

## Task 8: Frontend — Import UI: importTypes.ts + CodeRow Notiz-Hinweis

**Files:**
- Modify: `frontend/src/lib/importTypes.ts`
- Modify: `frontend/src/features/plans/components/ImportDialog.tsx`

- [ ] **Step 1: importTypes.ts — CodeEntry.default_note ergänzen**

In `frontend/src/lib/importTypes.ts` das `CodeEntry`-Interface (Zeile 29–37):

```ts
export interface CodeEntry {
  raw: string
  default_action: CodeDefaultAction
  absence_type: string | null
  shift_type_id: number | null
  shift_type_short_name: string | null
  department_id: number | null
  department_short_name: string | null
  default_note?: string | null
}
```

- [ ] **Step 2: CodeRow — default_note als Hinweis anzeigen**

In `frontend/src/features/plans/components/ImportDialog.tsx` die `CodeRow`-Komponente finden (grep nach `function CodeRow` oder `CodeRow`-Props).

Im Render der `CodeRow`, nach dem `<Select>` für die Resolution, einen konditionalen Hinweis einfügen:

```tsx
{item.default_note && resolution?.action === 'absence' && resolution.absence_type === 'SONSTIGES' && (
  <p className="text-[11px] text-ink-3 italic mt-1">
    Notiz: „{item.default_note}"
  </p>
)}
```

Dieser Block erscheint unter dem Dropdown einer CodeRow, wenn:
- Der Code ein `default_note` hat (= war unmatched, wird zu SONSTIGES)
- Die aktuelle Resolution `absence + SONSTIGES` ist

- [ ] **Step 3: TypeScript-Kompilierung prüfen**

```bash
cd frontend
pnpm tsc --noEmit 2>&1 | grep -E "importTypes|ImportDialog" | head -10
```

Erwartete Ausgabe: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/importTypes.ts frontend/src/features/plans/components/ImportDialog.tsx
git commit -m "feat: show default_note hint in ImportDialog CodeRow for SONSTIGES codes"
```

---

## Task 9: Frontend — Zell-Klick Details-Tab: UnifiedPlanGrid + PlanPage + PlanSidebar

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`
- Modify: `frontend/src/features/plans/components/PlanSidebar.tsx`

- [ ] **Step 1: UnifiedPlanGrid — absenceId im onCellClick-Callback**

In `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`:

Interface-Definition des Props (Zeile 34):
```ts
  onCellClick?: (rotationId: number, doctorId: number, dayKey: string, shiftId: number | null, shiftKey: boolean, clickPos: { x: number; y: number }, absenceId: number | null) => void
```

Im Cell-Click-Handler (Zeile ~489), den Aufruf ergänzen:
```ts
                      onCellClick?.(row.rotation.id, row.doctor.id, dk, shift?.id ?? null, shiftKey, clickPos, cell.absenceId ?? null)
```

- [ ] **Step 2: PlanPage — contextAbsence State + handleCellClick anpassen**

In `frontend/src/features/plans/PlanPage.tsx`:

**2a) Import Absence type** (falls nicht schon importiert):
```ts
import type { ShiftWithDetails, TarifWarning, RotationAssignmentWithDetails, INAExclusion, SolveResult, Absence } from '@/lib/types'
```

**2b) Neuer State** (nach Zeile 125 `const [contextShift, ...]`):
```ts
  const [contextAbsence, setContextAbsence] = useState<Absence | null>(null)
```

**2c) handleCellClick-Funktion** (Zeile 542–578) komplett ersetzen:
```ts
  function handleCellClick(
    rotationId: number,
    doctorId: number,
    day: string,
    shiftId: number | null,
    shiftKey: boolean,
    clickPos: { x: number; y: number },
    absenceId: number | null,
  ) {
    if (shiftKey) {
      setSelectedCells((prev) => {
        const exists = prev.some((c) => c.rotationId === rotationId && c.dayKey === day)
        if (exists) return prev.filter((c) => !(c.rotationId === rotationId && c.dayKey === day))
        return [...prev, { rotationId, doctorId, dayKey: day }]
      })
      return
    }

    if (selectedCells.length > 0) {
      setMultiPopoverOpen(true)
      return
    }

    if (shiftId != null) {
      const found = shifts.find((s) => s.id === shiftId) ?? null
      setContextShift(found)
      setContextAbsence(null)
    } else if (absenceId != null) {
      const found = absences.find((a) => a.id === absenceId) ?? null
      setContextAbsence(found)
      setContextShift(null)
    } else {
      setContextShift(null)
      setContextAbsence(null)
    }

    setSelectedDepartmentId(null)
    setActiveCell({ rotationId, doctorId, day, shiftId })
    setCellClickPosition(clickPos)
    setSelectedDoctorId(doctorId)
    setSidebarTab('details')
  }
```

**2d) contextAbsence bei handleDepartmentClick clearen** (Zeile ~568):
```ts
  function handleDepartmentClick(departmentId: number) {
    setSelectedDepartmentId(departmentId)
    setSelectedDoctorId(null)
    setContextShift(null)
    setContextAbsence(null)
    setSidebarTab('details')
  }
```

**2e) contextAbsence an PlanSidebar übergeben** (Zeile ~1152 im `<PlanSidebar>`-Aufruf, nach dem `shift`-Prop):
```tsx
                shift={contextShift ?? undefined}
                onCloseShift={contextShift || contextAbsence ? () => { setContextShift(null); setContextAbsence(null) } : undefined}
                absence={contextAbsence ?? undefined}
```

- [ ] **Step 3: PlanSidebar — absence Prop + Details-Karte**

In `frontend/src/features/plans/components/PlanSidebar.tsx`:

**3a) Absence type importieren** (Zeile 10):
```ts
import type { TarifWarning, ConstraintOverride, Doctor, ShiftType, Wish, Department, RotationAssignmentWithDetails, Absence } from '@/lib/types'
```

**3b) `PlanSidebarProps` Interface erweitern** (nach dem `shift?` Prop, ca. Zeile 51):
```ts
  shift?: ShiftWithDetails | null
  onCloseShift?: () => void
  absence?: Absence          // NEU
  tarifWarnings?: TarifWarning[]
```

**3c) `absence` aus Props destructuren** — in der Funktionssignatur von `PlanSidebar` ergänzen.

**3d) ABSENCE_TYPE_LABELS für den Sidebar-Render** (direkt im Funktionskörper vor dem Return, lokal definiert):
```ts
  const ABSENCE_TYPE_LABELS: Record<string, string> = {
    URLAUB:           'Urlaub',
    KRANKHEIT:        'Krankheit',
    FORTBILDUNG:      'Fortbildung',
    ELTERNZEIT:       'Elternzeit',
    MUTTERSCHUTZ:     'Mutterschutz',
    SONSTIGES:        'Sonstiges (DIV)',
    EINARBEITUNG:     'Einarbeitung (EA)',
    EINARBEITUNG_INA: 'Einarbeitung INA (INA-EA)',
    UNBESETZT:        'Station unbesetzt',
  }
```

**3e) Absence-Karte im Details-Tab** — direkt nach dem Shift-Block (`{shift && (...)}`) einfügen:

```tsx
            {/* Abwesenheits-Karte */}
            {absence && (
              <div className="rounded-tile border border-line bg-paper p-[12px_14px] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">
                    Abwesenheit
                  </p>
                  <span className="text-[11px] text-ink-3">
                    {absence.valid_from}{absence.valid_from !== absence.valid_to ? ` – ${absence.valid_to}` : ''}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-ink">
                  {ABSENCE_TYPE_LABELS[absence.absence_type] ?? absence.absence_type}
                </p>
                {absence.notes && (
                  <p className="text-[12px] text-ink-2 italic border-t border-line pt-2 mt-1">
                    {absence.notes}
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 4: TypeScript-Kompilierung prüfen**

```bash
cd frontend
pnpm tsc --noEmit 2>&1 | head -30
```

Erwartete Ausgabe: keine Fehler.

- [ ] **Step 5: Frontend-Tests ausführen**

```bash
cd frontend
pnpm test --run 2>&1 | tail -20
```

Erwartete Ausgabe: alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add \
  frontend/src/features/plans/components/UnifiedPlanGrid.tsx \
  frontend/src/features/plans/PlanPage.tsx \
  frontend/src/features/plans/components/PlanSidebar.tsx
git commit -m "feat: cell click shows shift/absence details in sidebar Details tab"
```

---

## Spec-Abgleich (Self-Review)

| Anforderung | Task |
|---|---|
| EA/INA-EA als neue AbsenceTypes | Task 1, 5, 6 |
| UNBESETZT als neuer AbsenceType | Task 1, 5, 6 |
| EA/INA-EA Chips nur im Besetzungsmodus | Task 6 |
| UNBESETZT X-Kreuz über gesamte Zelle | Task 7 |
| Farbkonfiguration für alle 9 Typen | Task 5 (PlanSettingsModal) |
| EA/INA-EA Import-Mapping | Task 2 |
| Unmatched Codes → SONSTIGES mit Notiz | Task 2+3 |
| CodeRow zeigt Notiz-Hinweis | Task 8 |
| Zell-Klick → Shift im Details-Tab | Task 9 |
| Zell-Klick → Absence im Details-Tab | Task 9 |
| DIV Notizen sichtbar in Sidebar | Task 9 (PlanSidebar Karte) |
| Alembic-Migration | Task 1 |
| Frontend api-types.ts Update | Task 4 |
