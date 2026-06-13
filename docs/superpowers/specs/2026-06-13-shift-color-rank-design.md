# Design: ShiftType-Farbe, Grid-Zellenfärbung, Import-Kurzname, Arzt-Rang

Datum: 2026-06-13

## Übersicht

Vier unabhängige Features:

1. ShiftType erhält ein Farbfeld
2. Plan-Grid-Zellen werden in der Farbe des zugeordneten Schichttyps gefärbt
3. Import-Fuzzy-Matching berücksichtigt auch den Kurznamen von Bereichen
4. Arzt-Rang als neues Dropdown-Feld (ersetzt `is_facharzt`)

---

## Feature 1: ShiftType-Farbfeld (Backend)

### Datenbankschema

Migration `0017_shift_type_color`:
- Neue Spalte: `shift_type.color VARCHAR(9) NULL`
- Kein Datenmigrations-SQL nötig (alle Werte initial NULL)

### Pydantic-Schemas

`color: str | None = None` in `ShiftTypeBase`, `ShiftTypeUpdate`, `ShiftTypeResponse`.

---

## Feature 2: ShiftType-Farbe in der UI

### ShiftTypeFormDialog

Farb-Eingabe analog `DepartmentFormDialog`:
- `<input type="color">` + Reset-Button
- Sentinel-Handling: leerer Reset setzt `color = null`

### Utility `frontend/src/lib/shiftTypeColors.ts`

```typescript
export function getShiftTypeColor(shiftType: ShiftTypeResponse): string | undefined
export function getShiftTypeColorMuted(shiftType: ShiftTypeResponse): string
```

`getShiftTypeColorMuted` hängt `'80'` (50% Alpha) an den Hex-Wert.

---

## Feature 3: Grid-Zellenfärbung nach Schichttyp

### Prop-Erweiterung `UnifiedShiftCell`

Neues Prop: `shiftTypeColor?: string`

Ableitungsort: `PlanPage` / Grid-Komponente via `shiftTypeMap[shift.shift_type_id]?.color`.

### Färbungs-Logik

| Zustand | Hintergrund |
|---|---|
| Abwesenheit (U, K, etc.) | unverändert |
| Dienst + ShiftType hat Farbe | `shiftTypeColor` (gedimmt bei `isDragDimmed`) |
| Dienst + kein ShiftType-Farbe | neutraler Fallback-Stil |
| Leer, `inRotation=true` | `bg-zinc-100` |
| Leer, `inRotation=false` | unverändert (paper/transparent) |

### Entfernung der Bereichsfarbe aus Zellen

- `getDepartmentColor`-Import aus `UnifiedShiftCell.tsx` entfernen
- Bereichsfarbe verbleibt ausschließlich in `BereichHeaderRow`

---

## Feature 4: Import-Fuzzy-Matching mit Kurzname

### Änderung in `import_match_service.py`

**Choices-Aufbau:** Pro Bereich zwei Einträge — `stripped_name` + `short_name` (falls gesetzt), beide zeigen auf dieselbe `dept_id`.

```python
choices: dict[str, int] = {}
for dept in departments:
    choices[_strip_dept_prefix(dept.name)] = dept.id
    if dept.short_name:
        choices[dept.short_name.lower()] = dept.id
```

**Exact-Match-Schleife:** Zusätzlich `query == dept.short_name.lower()` prüfen.

Kein neues Schema, kein neues Endpoint. Reine Service-Änderung.

---

## Feature 5: Arzt-Rang

### Backend

**Neues StrEnum `DoctorRank`** (in `backend/app/models/doctor.py` oder eigenem Modul):
```
ASSISTENT | FACHARZT | FUNKTIONSOBERARZT | OBERARZT | CHEFARZT
```

**Migration `0018_doctor_rank`:**
1. `rank VARCHAR NULL` zu `doctor`-Tabelle hinzufügen
2. Datenmigration: `UPDATE doctor SET rank = 'FACHARZT' WHERE is_facharzt = TRUE`
3. `is_facharzt`-Spalte droppen

**Schemas:** `rank: DoctorRank | None = None` in `DoctorBase`, `DoctorUpdate`, `DoctorResponse`; `is_facharzt` vollständig entfernen.

### Frontend

**DoctorForm:**
- `is_facharzt`-Switch entfernen
- Rang-Dropdown einfügen: leere Option (`"__none__"` → `null`) + 5 Rang-Werte
- Zod-Schema: `rank: z.string().nullable().optional()`

**Anzeige:** Rang vorerst nur in Arzt-Detailseite editierbar. Keine Darstellung im Grid oder Popover in diesem Scope.

---

## Scope-Grenzen

- Keine Rang-Anzeige im Plan-Grid oder Zuweisungs-Popover
- Keine automatische Filterung nach Rang
- `getDepartmentColor` bleibt für `BereichHeaderRow` erhalten — nur Zellen-Nutzung entfällt
- ShiftType-Farbe wird nicht rückwirkend auf exportierte Excel-Dateien angewendet
