# Import-Fixes + Weekend-Spalten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sechs unabhängige Fixes: Bereich-Matching-Präfix, EP-Bug bei bestehendem Plan, Import-Button in PlanListPage, Import-Button-Reihenfolge in PlanModeBar, manuelle Bereichszuordnung (Show All) im ImportDialog, Sa/So-Spalten dezent dunkler.

**Architecture:** Backend-Fixes in Services + bestehende Tests erweitern. Frontend-Fixes chirurgisch in bestehenden Komponenten. Keine neuen Dateien außer Tests.

**Tech Stack:** Python 3.12, FastAPI, pytest. React 18, TypeScript, Tailwind CSS, shadcn/ui, vitest.

---

## File Map

| Datei | Aktion | Inhalt |
|---|---|---|
| `backend/app/services/import_match_service.py` | Modify | `_strip_dept_prefix` + Aufruf in `analyze_import` |
| `backend/tests/services/test_import_match.py` | Modify | Test für Präfix-Stripping |
| `backend/app/services/import_commit_service.py` | Modify | Plan früh laden für EP `plan_start` |
| `backend/tests/services/test_import_commit.py` | Modify | Test EP bei existing-Plan |
| `frontend/src/features/plans/components/PlanModeBar.tsx` | Modify | Import-Button vor Plan-generieren verschieben |
| `frontend/src/features/plans/PlanListPage.tsx` | Modify | Import-Button + ImportDialog |
| `frontend/src/features/plans/components/ImportDialog.tsx` | Modify | DeptRow: alle Bereiche als Fallback |
| `frontend/src/features/plans/components/UnifiedShiftCell.tsx` | Modify | Weekend-Overlay |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | Modify | Placeholder-Zellen weekend-bg |

---

## Task 1: Backend — Numerisches Präfix aus Bereichsnamen stripppen

**Warum:** "511/LBEST" erreicht Fuzzy-Threshold 85 gegen "LBEST" nicht. `_strip_dept_prefix` entfernt `^\d+/` vor dem Matching; `raw` bleibt für UI/Resolutions erhalten.

**Files:**
- Modify: `backend/app/services/import_match_service.py`
- Modify: `backend/tests/services/test_import_match.py`

- [ ] **Schritt 1: Failing-Test schreiben**

Ans Ende von `backend/tests/services/test_import_match.py` anfügen:

```python
def test_department_numeric_prefix_stripped(db: Session) -> None:
    """'511/LBEST' soll 'LBEST' in der DB exact matchen."""
    db.add(Department(name="LBEST"))
    db.commit()

    sheet = _sheet([ParsedRow(raw_department="511/LBEST", raw_name="Mustermann, Max", cells={})])
    analysis = analyze_import(db, sheet)

    dept = next(d for d in analysis.departments if d.raw == "511/LBEST")
    assert dept.match_status == MatchStatus.EXACT
    assert dept.matched_id is not None
```

- [ ] **Schritt 2: Test ausführen — muss FEHLSCHLAGEN**

```
cd backend
uv run pytest tests/services/test_import_match.py::test_department_numeric_prefix_stripped -v
```

Erwartet: `FAILED` — `AssertionError: assert 'new' == 'exact'`

- [ ] **Schritt 3: Implementierung in `import_match_service.py`**

Nach den bestehenden Konstanten (nach `_PERCENTAGE_RE`, vor `_parse_name`) einfügen:

```python
# Regex: numerisches Stations-Präfix wie "511/" entfernen.
_DEPT_PREFIX_RE = re.compile(r'^\d+/')


def _strip_dept_prefix(raw: str) -> str:
    """Entfernt numerisches Präfix '\\d+/' aus Bereichsnamen vor dem Matching."""
    return _DEPT_PREFIX_RE.sub('', raw).strip()
```

In `analyze_import`, den Block `for raw in distinct_departments:` ändern:

```python
    department_matches: list[DepartmentMatch] = []
    for raw in distinct_departments:
        cleaned = _strip_dept_prefix(raw)
        status, matched_id, candidates, default_action = _match_against(cleaned, dept_names)
        department_matches.append(
            DepartmentMatch(
                raw=raw,
                match_status=status,
                matched_id=matched_id,
                candidates=candidates,
                default_action=default_action,
            )
        )
```

- [ ] **Schritt 4: Test ausführen — muss GRÜN sein**

```
uv run pytest tests/services/test_import_match.py -v
```

Erwartet: alle Tests PASS (vorher 11+, jetzt 12+).

- [ ] **Schritt 5: Commit**

```bash
git add backend/app/services/import_match_service.py backend/tests/services/test_import_match.py
git commit -m "fix(import): strip numeric dept prefix before fuzzy matching"
```

---

## Task 2: Backend — EP-Bug-Fix für neue Ärzte in bestehendem Plan

**Warum:** `plan_start = None` wenn `target_plan.mode == "existing"` (Zeile 71) → `EmploymentPeriod` wird nie erstellt. Fix: Plan für "existing"-Mode vor Schritt 4 (Doctor-Erstellung) laden.

**Files:**
- Modify: `backend/app/services/import_commit_service.py`
- Modify: `backend/tests/services/test_import_commit.py`

- [ ] **Schritt 1: Failing-Test schreiben**

`test_import_commit.py` lesen und ans Ende anfügen. Fixture-Datei und vorhandene Imports bereits vorhanden.

```python
def test_ep_created_for_new_doctor_in_existing_plan(db: Session, file_bytes: bytes) -> None:
    """Neue Ärzte bekommen EmploymentPeriod auch bei Ziel-Plan mode='existing'."""
    from app.repositories import plan_repository as _plan_repo

    # Parse um einen echten Raw-Namen zu bekommen
    parsed_sheet = parse_besetzungsplan(file_bytes)
    raw_name = parsed_sheet.rows[0].raw_name
    raw_dept = parsed_sheet.rows[0].raw_department

    dept = Department(name=raw_dept)
    db.add(dept)
    db.flush()

    plan = _plan_repo.create_plan(
        db,
        {"name": "Test", "valid_from": date(2026, 7, 1), "valid_to": date(2026, 7, 31)},
    )
    db.commit()

    resolutions = CommitResolutions.model_validate({
        "target_plan": {"mode": "existing", "plan_id": plan.id},
        "department_resolutions": {raw_dept: {"action": "map", "id": dept.id}},
        "doctor_resolutions": {raw_name: {"action": "create", "percentage": 75}},
        "code_resolutions": {},
    })

    import_commit_service.commit_import(db, file_bytes, resolutions)

    eps = db.query(EmploymentPeriod).all()
    assert len(eps) == 1
    assert eps[0].employment_percentage == 75
    assert eps[0].valid_from == date(2026, 7, 1)
```

- [ ] **Schritt 2: Test ausführen — muss FEHLSCHLAGEN**

```
uv run pytest tests/services/test_import_commit.py::test_ep_created_for_new_doctor_in_existing_plan -v
```

Erwartet: `FAILED` — `AssertionError: assert 0 == 1` (keine EPs erstellt).

- [ ] **Schritt 3: Implementierung in `import_commit_service.py`**

Zeilen 70–72 (aktuell):
```python
    target_plan = resolutions.target_plan
    plan_start = target_plan.valid_from if target_plan.mode == "new" else None
```

Ersetzen durch:

```python
    target_plan = resolutions.target_plan

    # plan_start wird für EmploymentPeriod-Erstellung benötigt — VOR Doctor-Loop.
    # Bei "existing"-Mode Plan früh laden um valid_from zu ermitteln.
    _preloaded_plan = None
    if target_plan.mode == "new":
        plan_start = target_plan.valid_from
    else:
        _preloaded_plan = plan_repo.get_plan(db, target_plan.plan_id)
        if _preloaded_plan is None:
            raise PlanNotFoundError(target_plan.plan_id)
        plan_start = _preloaded_plan.valid_from
```

Schritt 5 (Plan anlegen/laden, aktuell Zeilen ~97–113) anpassen:

```python
    # 5. Plan anlegen oder laden.
    if target_plan.mode == "new":
        plan = plan_repo.create_plan(
            db,
            {
                "name": target_plan.name,
                "valid_from": target_plan.valid_from,
                "valid_to": target_plan.valid_to,
            },
        )
    else:
        # Bereits in Schritt 2 geladen — kein zweiter Query.
        plan = _preloaded_plan
```

- [ ] **Schritt 4: Test ausführen — muss GRÜN sein**

```
uv run pytest tests/services/test_import_commit.py -v
```

Erwartet: alle Tests PASS.

- [ ] **Schritt 5: Volltest**

```
uv run pytest tests/services/ -v
```

Erwartet: alle Tests PASS.

- [ ] **Schritt 6: Commit**

```bash
git add backend/app/services/import_commit_service.py backend/tests/services/test_import_commit.py
git commit -m "fix(import): EP für neue Ärzte auch bei bestehendem Ziel-Plan anlegen"
```

---

## Task 3: Frontend — Import-Button vor „Plan generieren" in PlanModeBar

**Warum:** Aktuell: `[Plan generieren] [Importieren] [Settings]`. Gewünscht: `[Importieren] [Plan generieren] [Settings]`.

**Files:**
- Modify: `frontend/src/features/plans/components/PlanModeBar.tsx:185-215`

- [ ] **Schritt 1: Block verschieben**

Im `<div className="flex items-center gap-px">` Block (ab Zeile 185) den Importieren-Block vor den solverEnabled-Block setzen:

```tsx
      {/* Rechts: Importieren + Plan generieren + Settings */}
      <div className="flex items-center gap-px">
        {mode === 'besetzung' && onImportClick && (
          <button
            type="button"
            onClick={onImportClick}
            className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-[10px] bg-paper border border-line text-ink-2 text-[12.5px] font-medium hover:bg-line/20 transition-colors"
          >
            <Upload className="size-3.5" />
            Importieren
          </button>
        )}
        {solverEnabled && (
          <button
            type="button"
            onClick={onSolve}
            disabled={isSolving}
            className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-[10px] bg-dp-accent text-[#FFF8EF] text-[12.5px] font-semibold hover:bg-dp-accent-hover disabled:opacity-60 transition-colors"
          >
            <Zap className="size-3.5" />
            {isSolving ? 'Berechne…' : 'Plan generieren'}
          </button>
        )}
        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Plan-Einstellungen"
          className="inline-flex items-center justify-center w-8 h-8 rounded-[10px] bg-dp-accent text-[#FFF8EF] hover:bg-dp-accent-hover transition-colors"
        >
          <Settings className="size-3.5" />
        </button>
      </div>
```

- [ ] **Schritt 2: TypeScript-Check**

```
cd frontend
pnpm tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/features/plans/components/PlanModeBar.tsx
git commit -m "fix(ui): Import-Button vor Plan-generieren in PlanModeBar"
```

---

## Task 4: Frontend — Import-Button in PlanListPage

**Warum:** ImportDialog bisher nur im Plan-Editor erreichbar (PlanModeBar). Soll auch in der Planübersicht verfügbar sein.

**Files:**
- Modify: `frontend/src/features/plans/PlanListPage.tsx`

- [ ] **Schritt 1: State + Imports ergänzen**

In `PlanListPage.tsx` oben:
- `Upload` zu lucide-react-Import hinzufügen
- `ImportDialog` importieren: `import { ImportDialog } from './components/ImportDialog'`
- `Button` importieren: `import { Button } from '@/components/ui/button'`

```tsx
import { MoreHorizontal, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportDialog } from './components/ImportDialog'
```

- [ ] **Schritt 2: State hinzufügen**

In `PlanListPage()` nach dem bestehenden `const [dialogOpen, setDialogOpen] = useState(false)`:

```tsx
const [importOpen, setImportOpen] = useState(false)
```

- [ ] **Schritt 3: CommandBar + Dialog aktualisieren**

`CommandBar`-Aufruf um `extras` erweitern:

```tsx
      <CommandBar
        titleAccent="Pläne"
        title={count > 0 ? `· ${count} ${count === 1 ? 'Plan' : 'Pläne'}` : ''}
        filters={filterChips}
        extras={
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importieren
          </Button>
        }
        primaryAction={{ label: '+ Neuer Plan', onClick: () => setDialogOpen(true) }}
      />
```

Am Ende der JSX (nach `<PlanCreateDialog ...>`):

```tsx
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
```

- [ ] **Schritt 4: TypeScript-Check**

```
pnpm tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 5: Commit**

```bash
git add frontend/src/features/plans/PlanListPage.tsx
git commit -m "feat(ui): Import-Button in Planübersicht"
```

---

## Task 5: Frontend — ImportDialog DeptRow: Alle Bereiche (Show All)

**Warum:** Bereiche wie "NM-TK" werden nicht automatisch gematcht. User soll manuell aus allen DB-Bereichen wählen können, nicht nur aus Fuzzy-Kandidaten.

**Files:**
- Modify: `frontend/src/features/plans/components/ImportDialog.tsx`

- [ ] **Schritt 1: `SelectSeparator` + `useDepartments` importieren**

Bestehende shadcn-Import-Zeile erweitern:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDepartments } from '@/features/departments/useDepartments'
import type { Department } from '@/lib/types'
```

- [ ] **Schritt 2: `DeptRowProps` erweitern**

```typescript
interface DeptRowProps {
  item: DepartmentMatch
  resolution: EntityResolution
  allDepts: Department[]
  onChange: (res: EntityResolution) => void
}
```

- [ ] **Schritt 3: `DeptRow` Signatur + SelectContent anpassen**

```tsx
function DeptRow({ item, resolution, allDepts, onChange }: DeptRowProps) {
  const isExact = item.match_status === 'exact'

  function handleChange(val: string) {
    if (val === '__create__') { onChange({ action: 'create' }); return }
    if (val === '__skip__') { onChange({ action: 'skip' }); return }
    const id = parseInt(val, 10)
    if (!isNaN(id)) onChange({ action: 'map', id })
  }

  const currentValue = (() => {
    if (resolution.action === 'create') return '__create__'
    if (resolution.action === 'skip') return '__skip__'
    if (resolution.action === 'map') return String(resolution.id)
    return '__skip__'
  })()

  const candidateIds = new Set(item.candidates.map((c) => c.id))
  const remainingDepts = allDepts
    .filter((d) => !candidateIds.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-0">
      <div className="w-20 shrink-0">{statusBadge(item.match_status)}</div>
      <div className="flex-1 text-sm text-ink font-medium truncate" title={item.raw}>{item.raw}</div>
      {isExact ? (
        <div className="text-xs text-ink-3 italic">Übernommen (exakt)</div>
      ) : (
        <Select value={currentValue} onValueChange={handleChange}>
          <SelectTrigger className="w-52 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {item.candidates.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                → {c.name} ({Math.round(c.score)}%)
              </SelectItem>
            ))}
            {remainingDepts.length > 0 && (
              <>
                <SelectSeparator />
                {remainingDepts.map((d) => (
                  <SelectItem key={`all-${d.id}`} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
              </>
            )}
            <SelectItem value="__create__">Neu anlegen</SelectItem>
            <SelectItem value="__skip__">Ignorieren</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
```

- [ ] **Schritt 4: `useDepartments` in `ImportDialog` aufrufen + weitergeben**

In `ImportDialog`-Komponente nach den bestehenden Hooks:

```tsx
  const { data: allDepts = [] } = useDepartments()
```

Im Bereiche-Tab alle `DeptRow`-Aufrufe `allDepts` weitergeben:

```tsx
                {reconcileTab === 'bereiche' && (
                  analysis.departments.length === 0 ? (
                    <div className="text-sm text-ink-3 py-4 text-center">Keine Bereiche gefunden</div>
                  ) : analysis.departments.map((dept) => (
                    <DeptRow
                      key={dept.raw}
                      item={dept}
                      resolution={deptResolutions[dept.raw] ?? { action: 'skip' }}
                      allDepts={allDepts}
                      onChange={(res) => setDeptResolutions((prev) => ({ ...prev, [dept.raw]: res }))}
                    />
                  ))
                )}
```

- [ ] **Schritt 5: TypeScript-Check**

```
pnpm tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 6: Commit**

```bash
git add frontend/src/features/plans/components/ImportDialog.tsx
git commit -m "feat(import): Bereichs-Reconcile zeigt alle Bereiche als Fallback"
```

---

## Task 6: Frontend — Sa/So-Spalten dezent dunkler

**Warum:** Wochenend-Spalten-Header sind bereits `bg-weekend` (`#F3ECD8`). Datenzellen und Placeholder-Zeilen haben keine Wochenend-Einfärbung → schlechte zeitliche Einordnung.

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx:139-180`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx:364-378`

### 6a — UnifiedShiftCell Weekend-Overlay

- [ ] **Schritt 1: Overlay einfügen**

In `UnifiedShiftCell.tsx`, nach dem `{/* Crosshair-Highlight */}`-Block (nach Zeile ~178) einfügen:

```tsx
      {/* Weekend-Overlay — dezente Einfärbung Sa/So */}
      {isWeekend && !isConflictTarget && !isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(243, 236, 216, 0.45)' }}
        />
      )}
```

`rgba(243, 236, 216, 0.45)` = `#F3ECD8` bei 45% Deckkraft — dezent sichtbar ohne Bereichsfarbe zu dominieren.

### 6b — UnifiedPlanGrid Placeholder-Zellen

- [ ] **Schritt 2: Placeholder-Zellen aktualisieren**

In `UnifiedPlanGrid.tsx` im `row.kind === 'placeholder'` Block, die `dayKeys.map`-Zeile suchen (aktuell Zeilen ~368–376):

```tsx
                {dayKeys.map((dk, i) => (
                  <div
                    key={dk}
                    className="border-b border-r border-line"
                    style={{
                      backgroundColor: isWeekend(days[i]) ? '#F3ECD8' : `${color}10`,
                    }}
                  />
                ))}
```

Hinweis: `days` und `dayKeys` sind Index-synchron (beide aus demselben Date-Range abgeleitet). `isWeekend` ist bereits oben importiert (`from 'date-fns'`). Index `i` aus `map((dk, i) => ...)` verwenden.

- [ ] **Schritt 3: TypeScript-Check**

```
pnpm tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 4: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat(ui): Sa/So-Spalten dezent dunkler im Plan-Grid"
```

---

## Abschluss-Check

- [ ] Backend-Tests vollständig grün:
  ```
  cd backend && uv run pytest tests/services/test_import_match.py tests/services/test_import_commit.py -v
  ```
- [ ] Frontend TypeScript fehlerfrei:
  ```
  cd frontend && pnpm tsc --noEmit
  ```
- [ ] App starten und visuell prüfen:
  - Planübersicht: „Importieren"-Button sichtbar neben „Neuer Plan"
  - Plan-Editor: „Importieren"-Button links von „Plan generieren"
  - ImportDialog Bereiche-Tab: Dropdown zeigt Kandidaten + Separator + alle Bereiche
  - Plan-Grid: Sa/So-Spalten erkennbar heller getönt
