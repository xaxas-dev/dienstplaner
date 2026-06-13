# Design: Import-Fixes + Weekend-Spalten

Datum: 2026-06-13  
Status: Approved

## Scope

Sechs unabhängige Änderungen in zwei Dateibereichen (Backend Import, Frontend UI).

---

## 1 — Import-Button in PlanListPage

**Datei:** `frontend/src/features/plans/PlanListPage.tsx`

- Neuer State: `const [importOpen, setImportOpen] = useState(false)`
- `CommandBar` bekommt `extras` Prop:
  ```tsx
  extras={
    <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
      <Upload className="size-4" />
      Importieren
    </Button>
  }
  ```
- `<ImportDialog open={importOpen} onOpenChange={setImportOpen} />` am Ende rendern
- Import: `Upload` von lucide-react, `ImportDialog` aus `./components/ImportDialog`, `Button` aus `@/components/ui/button`

---

## 2 — Import-Button vor „Plan generieren" in PlanModeBar

**Datei:** `frontend/src/features/plans/components/PlanModeBar.tsx`

Aktuell: `[Plan generieren] [Importieren] [Settings]`  
Neu: `[Importieren] [Plan generieren] [Settings]`

Im `<div className="flex items-center gap-px">` Block (Zeile 185): den Importieren-Block (Zeilen 197–206) **vor** den solverEnabled-Block (Zeilen 186–196) verschieben. Sonst kein Change.

---

## 3 — Backend: Numerisches Präfix vor Department-Matching stripppen

**Datei:** `backend/app/services/import_match_service.py`

In `analyze_import`, beim Erstellen der `distinct_departments` Liste: Raw-Namen vor dem Matching vorverarbeiten.

Neue Hilfsfunktion:
```python
_DEPT_PREFIX_RE = re.compile(r'^\d+/')

def _strip_dept_prefix(raw: str) -> str:
    """Entfernt numerische Präfixe wie '511/' aus Bereichsnamen."""
    return _DEPT_PREFIX_RE.sub('', raw).strip()
```

In `analyze_import`:
```python
for raw in distinct_departments:
    cleaned = _strip_dept_prefix(raw)
    status, matched_id, candidates, default_action = _match_against(cleaned, dept_names)
    department_matches.append(DepartmentMatch(raw=raw, ...))  # raw bleibt unverändert
```

`raw` bleibt der Original-String (für Commit-Resolutions und UI-Anzeige). Nur das Matching nutzt `cleaned`.

---

## 4 — ImportDialog: Alle Bereiche in DeptRow (Show All)

**Dateien:** `frontend/src/features/plans/components/ImportDialog.tsx`

### `ImportDialog` Komponente
- `useDepartments()` aus `@/features/departments/useDepartments` importieren
- `const { data: allDepts = [] } = useDepartments()`
- `allDepts` als Prop an `DeptRow` weitergeben

### `DeptRow` Props erweitern
```typescript
interface DeptRowProps {
  item: DepartmentMatch
  resolution: EntityResolution
  allDepts: { id: number; name: string }[]
  onChange: (res: EntityResolution) => void
}
```

### SelectContent erweitern
Nach den fuzzy-Kandidaten und vor „Neu anlegen":
```tsx
{/* Trennlinie + alle Bereiche */}
{allDepts.length > 0 && (
  <>
    <SelectSeparator />
    <SelectItem value="__divider__" disabled>— Alle Bereiche —</SelectItem>
    {allDepts
      .filter((d) => !item.candidates.some((c) => c.id === d.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((d) => (
        <SelectItem key={`all-${d.id}`} value={String(d.id)}>
          {d.name}
        </SelectItem>
      ))}
    <SelectSeparator />
  </>
)}
```

`SelectSeparator` aus `@/components/ui/select` importieren.

`Department`-Typ aus `@/lib/types` für `allDepts: Department[]` verwenden (hat `id` und `name`).

---

## 5 — Backend: EP-Bug-Fix (Teilzeit für neue Ärzte bei bestehendem Plan)

**Datei:** `backend/app/services/import_commit_service.py`

**Problem:** Zeile 71: `plan_start = target_plan.valid_from if target_plan.mode == "new" else None`  
`TargetPlanExisting` hat kein `valid_from` → `plan_start = None` → keine `EmploymentPeriod` für neue Ärzte.

**Fix:** Plan für "existing"-Mode früh laden (vor Schritt 4):

```python
# Früh nach Schritt 2: plan_valid_from + ggf. Plan-Objekt vorauflösen
if target_plan.mode == "new":
    plan_start = target_plan.valid_from
    _preloaded_plan: object = None
else:
    _preloaded_plan = plan_repo.get_plan(db, target_plan.plan_id)
    if _preloaded_plan is None:
        raise PlanNotFoundError(target_plan.plan_id)
    plan_start = _preloaded_plan.valid_from
```

In Schritt 5 (Plan anlegen/laden):
```python
if target_plan.mode == "new":
    plan = plan_repo.create_plan(db, {"name": ..., "valid_from": ..., "valid_to": ...})
else:
    plan = _preloaded_plan  # bereits geladen, kein zweiter Query
```

Der bestehende EP-Erstellungs-Code (Zeilen 83–93) bleibt unverändert — `plan_start` ist nun immer gesetzt.

---

## 6 — Weekend-Spalten dezent dunkler

`bg-weekend = #F3ECD8` (Tailwind-Token). Spalten-Header haben bereits `bg-weekend`. Datenzellen noch nicht.

### UnifiedShiftCell
**Datei:** `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

`isWeekend`-Prop bereits vorhanden. Base-Background-Klasse ergänzen:
- Für leere Zellen (`!inRotation`) und befüllte gleichermaßen: `isWeekend && 'bg-weekend/40'` als zusätzliche Hintergrundklasse im Root-Element

### Placeholder-Zeilen in UnifiedPlanGrid
**Datei:** `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`

Zeile 370–375 (placeholder day cells):
```tsx
{dayKeys.map((dk, i) => (
  <div
    key={dk}
    className={cn(
      'border-b border-r border-line',
      isWeekend(days[i]) && 'bg-weekend/30',
    )}
    style={{ backgroundColor: `${color}10` }}
  />
))}
```

Hinweis: `style.backgroundColor` überschreibt Tailwind-Klasse — daher für Wochenende `style` anpassen statt Tailwind-Klasse:
```tsx
style={{
  backgroundColor: isWeekend(days[i])
    ? `color-mix(in srgb, #F3ECD8 40%, ${color}10)`
    : `${color}10`,
}}
```

Alternativ simpler: Wochenende-Overlay als zweite `div` mit `absolute inset-0 bg-weekend/30 pointer-events-none`. Aber das erfordert `relative` auf dem Container.

**Empfehlung:** Für Placeholder-Zellen einfach `style` direkt anpassen:
```tsx
style={{
  backgroundColor: isWeekend(days[i]) ? '#F3ECD8' : `${color}10`,
}}
```
Dezent genug — und konsistent mit dem Header-Verhalten (Header zeigt reines `bg-weekend` ohne Bereichsfarbe-Overlay).

---

## Nicht im Scope

- Arzt-Dropdown "Alle Ärzte" (analog zu Bereichen) — nicht angefragt
- Match-Verbesserung für "NM-TK" durch Backend-Logik — DB-Namen unbekannt; manuelle Override-UI (Punkt 4) löst den Fall
- Animationen oder visuelle Übergänge für das Weekend-Darkening
