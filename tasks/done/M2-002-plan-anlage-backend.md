# Task M2-002: Backend Plan-Anlage, Klonen und Schicht-Generierung

## Ziel
Vollständiger Backend-Stack für die Plan-Verwaltung:
- Plan anlegen mit automatischer Schicht-Generierung
- Plan klonen mit Rotations-Übernahme
- Versions-Snapshots erstellen
- Rotationszuweisungen verwalten (CRUD)

Schicht-Zuweisungen (PATCH auf einzelne Schichten) sind hier
**nicht** dabei. Sie kommen mit dem Plan-Editor in M3, wo das
Drag-and-Drop-Verhalten zentral ist.

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md, docs/decisions.md.

M2-001 hat das Plan-Datenmodell angelegt. Diese Aufgabe baut den
Service- und API-Layer auf:
- 6 Modelle existieren (Plan, PlanVersion, Shift, RotationAssignment,
  Absence, Wish)
- Die Schicht-Generierung-Logik ist hier zu implementieren
- Klon-Logik mit Datums-Offset für Rotationen ist hier zu implementieren

Hintergrund-Konzepte:
- **Hybrid-Modell:** Schichten sind bereichsunabhängig
- **Plan-Klonen:** Rotationen werden mit Datums-Offset kopiert,
  Schichten werden neu generiert (nicht kopiert)
- **Versions-Snapshot:** explizit per User-Aktion oder automatisch
  bei Statuswechsel zu RELEASED
- **T1 als optional:** wird nur generiert wenn explizit ausgewählt

## Anforderungen

### 1. Repository-Layer

#### plan_repository.py

- `list_plans(db, *, status=None) -> list[Plan]`
  - Sortierung: valid_from absteigend (neueste zuerst)
  - Optional Filter nach Status
- `get_plan(db, plan_id) -> Plan | None`
  - Mit eager-loaded shifts und rotation_assignments
- `create_plan(db, data: dict) -> Plan`
  - Nur Plan-Stammdaten, keine Schichten
- `update_plan(db, plan_id, data: dict) -> Plan | None`
- `delete_plan(db, plan_id) -> bool`

#### shift_repository.py

- `list_shifts_for_plan(db, plan_id) -> list[Shift]`
  - Sortierung: shift_date aufsteigend, dann shift_type.display_order
  - Mit eager-loaded shift_type und doctor
- `bulk_create_shifts(db, shifts: list[dict]) -> list[Shift]`
  - Effizientes Massen-Insert
- `delete_shifts_for_plan(db, plan_id) -> int`
  - Anzahl gelöschter Schichten zurück

#### rotation_assignment_repository.py

- `list_rotations_for_plan(db, plan_id) -> list[RotationAssignment]`
  - Mit eager-loaded department und doctor
  - Sortierung: doctor.name, dann valid_from
- `get_rotation(db, rotation_id) -> RotationAssignment | None`
- `create_rotation(db, plan_id, data: dict) -> RotationAssignment`
- `update_rotation(db, rotation_id, data: dict) -> RotationAssignment | None`
- `delete_rotation(db, rotation_id) -> bool`
- `bulk_create_rotations(db, rotations: list[dict]) -> list[RotationAssignment]`

#### plan_version_repository.py

- `list_versions(db, plan_id) -> list[PlanVersion]`
  - Sortierung: version_number absteigend
- `get_version(db, plan_id, version_number) -> PlanVersion | None`
- `create_version(db, plan_id, snapshot_json: dict, comment=None) -> PlanVersion`
  - Berechnet automatisch nächste version_number

### 2. Service-Layer

#### plan_service.py

##### validate_plan_data(data, existing=None)

- name nicht leer
- valid_from <= valid_to

##### generate_shifts_for_plan(plan, shift_type_ids=None)

Erzeugt Schicht-Datensätze (Liste von Dicts, nicht persistiert hier).

Logik:
- Wenn `shift_type_ids` None oder leer: alle aktiven Schichttypen
  AUSSER T1 verwenden (Default-Verhalten)
- Wenn `shift_type_ids` gesetzt: genau diese verwenden, falls aktiv
- Pro Tag im Plan-Zeitraum:
  - Wochentag bestimmen (date.isoweekday(): 1-5 = Werktag, 6-7 = Wochenende)
  - Pro Schichttyp prüfen:
    - Werktag und applies_on_weekdays=True → erzeugen
    - Wochenende und applies_on_weekend=True → erzeugen
- Erzeugte Datensätze: plan_id, shift_date, shift_type_id, doctor_id=None, is_pinned=False

T1-Identifikation: short_name="T1". Falls verlässlicher: in Stammdaten 
markieren (kommt nicht hier).

##### create_plan_with_shifts(db, data, shift_type_ids=None)

Atomare Operation:
1. Plan in DB anlegen (`plan_repository.create_plan`)
2. Schichten generieren mit `generate_shifts_for_plan`
3. Schichten in DB anlegen (`shift_repository.bulk_create_shifts`)
4. Beides in einer Transaktion
5. Plan inklusive shifts zurückgeben

##### clone_plan(db, source_plan_id, new_plan_data)

Atomare Operation:
1. Quell-Plan laden, sonst PlanNotFoundError
2. Neuen Plan mit new_plan_data anlegen
3. Schichten neu generieren basierend auf neuen Schichttypen
   (Default-Verhalten wie bei normaler Anlage)
4. Rotationen kopieren mit Datums-Offset:
   - offset = new_plan.valid_from - source_plan.valid_from
   - Pro Quell-Rotation:
     - new_from = old_from + offset
     - new_to = old_to + offset
     - Wenn new_to < new_plan.valid_from → Rotation ganz wegfallen lassen
     - Wenn new_from > new_plan.valid_to → Rotation ganz wegfallen lassen
     - Sonst clippen: new_from = max(new_from, new_plan.valid_from)
                     new_to = min(new_to, new_plan.valid_to)
5. Rotationen in DB anlegen (bulk)
6. Neuen Plan zurückgeben mit Anzahl kopierter Rotationen
   und übersprungener Rotationen (für Logging/Feedback)

##### create_version_snapshot(db, plan_id, comment=None)

Erstellt einen Snapshot des aktuellen Plan-Zustands:
1. Plan + Shifts + RotationAssignments laden
2. JSON-Struktur erzeugen:
   ```python
   {
     "plan": {plan-Felder},
     "shifts": [{shift-Felder mit shift_type, doctor}, ...],
     "rotation_assignments": [{rotation-Felder mit doctor, department}, ...],
     "snapshot_date": "ISO-Datum"
   }
   ```
3. Datum als ISO-String, nicht als date-Objekt
4. PlanVersion mit nächstem version_number anlegen

##### update_plan_status(db, plan_id, new_status)

- Plan laden
- Status setzen
- Wenn neuer Status RELEASED ist und der vorherige nicht RELEASED war:
  automatisch Snapshot erstellen mit comment "Statuswechsel zu RELEASED"
- Plan speichern und zurückgeben

##### Validierungen

- `validate_rotation_dates(rotation_data, plan)`: valid_from und valid_to
  müssen innerhalb plan.valid_from / plan.valid_to liegen
- Bei Update: erst zusammengeführte Daten validieren

#### exceptions.py erweitern

- `PlanNotFoundError`
- `PlanValidationError`
- `RotationNotFoundError`
- `RotationValidationError`
- `ShiftNotFoundError` (für später, vorerst nicht zwingend)

### 3. API-Layer

#### plans.py - /api/plans

- `GET /api/plans?status=` → list[PlanResponse]
- `GET /api/plans/{plan_id}` → PlanWithRelations
- `POST /api/plans` → PlanResponse (201)
  - Body: PlanCreate, optional `shift_type_ids: list[int]`
  - Bei Erfolg: Plan inkl. generierter Schichten in Response
- `PATCH /api/plans/{plan_id}` → PlanResponse
  - Body: PlanUpdate (name, status, notes)
  - Wenn status sich ändert: durch Service-Funktion mit Snapshot-Logik
- `DELETE /api/plans/{plan_id}` → 204
- `POST /api/plans/{plan_id}/clone` → PlanWithRelations (201)
  - Body: PlanClone (name, valid_from, valid_to, optional notes)
  - Response enthält den neuen Plan plus Statistik:
    - "rotations_copied": N
    - "rotations_skipped": M (Rotationen die außerhalb lagen)

#### plan_versions.py - /api/plans/{plan_id}/versions

- `GET /api/plans/{plan_id}/versions` → list[PlanVersionResponse]
  - Sortiert: neueste zuerst
- `POST /api/plans/{plan_id}/versions` → PlanVersionResponse (201)
  - Body: optional `comment: str`
- `GET /api/plans/{plan_id}/versions/{version_number}` → PlanVersionDetail
  - mit `snapshot_json`-Feld voll ausgegeben

#### plan_shifts.py - /api/plans/{plan_id}/shifts

Nur Leseoperationen in dieser Aufgabe:
- `GET /api/plans/{plan_id}/shifts` → list[ShiftWithDetails]
  - Mit shift_type und doctor verschachtelt
  - Sortiert nach Datum, dann Schichttyp

Schicht-Update kommt in M3.

#### rotations.py - /api/plans/{plan_id}/rotations und /api/rotations/{id}

- `GET /api/plans/{plan_id}/rotations` → list[RotationAssignmentWithDetails]
- `POST /api/plans/{plan_id}/rotations` → RotationAssignmentResponse (201)
  - Body: RotationAssignmentCreate
- `PATCH /api/rotations/{rotation_id}` → RotationAssignmentResponse
  - Body: RotationAssignmentUpdate
- `DELETE /api/rotations/{rotation_id}` → 204

### 4. Schemas erweitern

#### PlanClone (neu)

```python
class PlanClone(BaseModel):
    name: str
    valid_from: date
    valid_to: date
    notes: str | None = None
```

#### PlanCreate erweitern

Optionales Feld:
```python
class PlanCreate(PlanBase):
    shift_type_ids: list[int] | None = None
```

shift_type_ids ist Input für die API, kein DB-Feld.

#### CloneResult

```python
class CloneResult(BaseModel):
    plan: PlanWithRelations
    rotations_copied: int
    rotations_skipped: int
```

POST /api/plans/{id}/clone gibt CloneResult zurück.

### 5. Fehlerbehandlung

In `app/api/error_handlers.py` ergänzen:
- PlanNotFoundError → 404
- PlanValidationError → 422
- RotationNotFoundError → 404
- RotationValidationError → 422
- ShiftNotFoundError → 404 (für später vorbereitet)

### 6. Tests

#### tests/integration/test_plans_api.py

- `test_create_plan_april_2026_no_t1`:
  - April 2026, ohne shift_type_ids
  - Schichten: Mo-Fr 22 Tage × 2 Schichten (V+N) = 44, Sa+So 8 Tage × 2 = 16
  - Total = 60 Schichten generiert
- `test_create_plan_april_2026_with_t1`:
  - April 2026, shift_type_ids = alle aktiven inkl. T1
  - Total = 22 × 3 + 8 × 2 = 82 Schichten
- `test_create_plan_invalid_date_range`: valid_from > valid_to → 422
- `test_create_plan_no_active_shift_types`: alle deaktiviert → 422 mit Hinweis
- `test_get_plan_with_relations`: Plan mit Schichten und Rotationen
- `test_update_plan_status_to_released_creates_snapshot`: 
  Statuswechsel DRAFT→RELEASED erzeugt Version 1 automatisch
- `test_update_plan_status_already_released_no_snapshot`:
  RELEASED→RELEASED erzeugt keinen neuen Snapshot
- `test_delete_plan_cascade`: Schichten, Rotationen, Versionen weg

#### tests/integration/test_plan_clone.py

- `test_clone_plan_same_length`:
  - April-Plan klonen zu Juni-Plan (auch 30 Tage)
  - Rotationen mit gleichem Layout, nur verschoben
  - Schichten: 60 neue (alle leer)
- `test_clone_plan_different_length`:
  - April (30) → Mai (31)
  - Datums-Offset 30 Tage, einige Rotationen werden geclippt
- `test_clone_plan_rotation_outside_skipped`:
  - Rotation im Quell-Plan endet 31.4., neuer Plan beginnt 1.6.
  - Bei Offset > 30 Tagen: Rotation fällt komplett weg
  - rotations_skipped > 0 in Response
- `test_clone_plan_with_t1_default_off`:
  - Quell-Plan hatte T1, neuer Plan ohne T1 (Default)

#### tests/integration/test_plan_versions.py

- `test_create_version_snapshot_basic`
- `test_create_version_snapshot_with_comment`
- `test_version_number_auto_increment`: erste Version 1, zweite 2, dritte 3
- `test_get_version_returns_snapshot_json`
- `test_versions_sorted_descending`

#### tests/integration/test_rotations_api.py

- `test_create_rotation_basic`
- `test_create_rotation_outside_plan_dates_422`
- `test_overlapping_rotations_allowed`: zwei Rotationen für selben 
  Doctor und Department in selber Zeit OK (geteilte Rotation)
- `test_update_rotation`
- `test_delete_rotation`

#### tests/unit/test_plan_service.py

- `test_generate_shifts_april_count`
- `test_generate_shifts_with_t1_filter`
- `test_clone_offset_calculation`
- `test_clone_clipping_logic`

## Akzeptanzkriterien

- [ ] Repository für Plan, Shift, RotationAssignment, PlanVersion
- [ ] Service mit allen genannten Funktionen
- [ ] API mit ~14 Endpunkten
- [ ] Schicht-Generierung korrekt für Werktag/Wochenende
- [ ] T1 wird nur bei expliziter Auswahl generiert
- [ ] Klonen kopiert Rotationen mit Offset und Clipping
- [ ] Klonen erzeugt neue, leere Schichten
- [ ] Versions-Snapshot enthält serialisierte Daten als JSON
- [ ] Status-Wechsel zu RELEASED erzeugt automatisch Snapshot
- [ ] Alle Tests grün
- [ ] Bestehende Tests bleiben grün
- [ ] ruff check grün
- [ ] OpenAPI vollständig

## Out of Scope

- Schicht-Update (PATCH /api/shifts/{id}): kommt mit M3
- Plan-Editor / DnD: kommt mit M3
- Frontend (kommt mit M2-003)
- Validierung gegen Bereichs-Sollbesetzung (kommt mit M5)
- Constraint-Verstoß-Anzeige (kommt mit M5)
- Solver-Integration (kommt mit M8)
- Versionssnapshot zurückspielen / Rollback
- Versions-Vergleichs-Ansicht (Diff)
- Plan-Status-Workflow-Validierung (z.B. "ARCHIVED nur wenn Zeitraum vorbei")
- Mehrere parallele Schichten gleichen Typs am gleichen Tag

## Bekannte Stolperfallen

- **Datum-Vergleich:** Pythons `date` ist immutable, nutze 
  `from datetime import date, timedelta`
- **Schaltjahre:** date-Arithmetik mit timedelta funktioniert korrekt
  über Schaltjahr-Grenzen, aber Plan-Klonen "April → Februar" hat 
  weniger Tage. Clipping korrekt implementieren.
- **Bulk-Insert in SQLAlchemy:** `db.bulk_save_objects` umgeht 
  ORM-Events. Sicherer ist `db.add_all(...)` plus einmal `db.commit()`.
- **JSON-Serialisierung von date:** SQLAlchemy JSON-Typ kann date nicht
  direkt serialisieren. Manuelle Konvertierung zu ISO-String nötig.
  Pydantic kann das, also Schema-Layer als Konvertierer nutzen oder
  expliziten Converter schreiben.
- **Snapshot-Größe:** Bei großen Plänen (40 Ärzte × 30 Tage = 1200 
  Schichten) wird der JSON-Snapshot mehrere KB bis 100 KB groß. SQLite 
  TEXT-Spalte hat de facto kein Limit, aber die DB wächst entsprechend.
- **Cascade-Reihenfolge:** Beim Plan-Delete kaskadieren Shifts, 
  PlanVersions, RotationAssignments. Wenn die ORM-Relations nicht 
  korrekt cascaded sind, scheitert der Delete an FK-Constraints.
- **isoweekday vs weekday:** date.isoweekday() gibt 1 (Mo) bis 7 (So).
  date.weekday() gibt 0 (Mo) bis 6 (So). Beide verwenden, aber 
  konsistent bleiben.
- **Snapshot Idempotenz beim Statuswechsel:** Wenn Status mehrfach auf 
  RELEASED gesetzt wird (z.B. PATCH mit gleichem Wert): kein neuer 
  Snapshot. Nur bei tatsächlichem Wechsel.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- T1 wird per `short_name="T1"` identifiziert. Wenn fragil: in 
  Department-Schicht-Zuordnung später strukturierter abbilden.
- Klonen kopiert nur Rotationen, keine Schichten und keine Wünsche.
- Versions-Snapshot ist read-only. Es gibt kein Restore-Feature 
  in dieser Aufgabe.
- ARCHIVED ist der manuelle Endstatus, kein automatisches Archivieren.
- "Aktive" Schichttypen werden generiert (active=True). Inaktive werden
  übersprungen, auch wenn explizit in shift_type_ids.
- Schichten werden in der Reihenfolge ihres Datums plus 
  shift_type.display_order erzeugt. Reihenfolge ist nicht semantisch
  relevant, aber konsistent.
