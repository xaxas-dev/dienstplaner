# Task M1-003: Backend CRUD für Departments, ShiftTypes, Qualifications, RuleOverrides

## Ziel
Vollständiger Backend-Stack (Repository, Service, API) für die
verbleibenden Stammdaten: Departments, ShiftTypes, Qualifications
und RuleOverrides. Damit ist M1 backend-seitig komplett.

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md, docs/architecture.md.

M1-002 hat das Pattern für Doctor etabliert (Repository → Service → API).
Diese Aufgabe wendet dasselbe Pattern auf vier weitere Entitäten an.
Sie sind einfacher als Doctor, weil sie keine verschachtelten 
Sub-Entitäten haben.

Die M:N-Beziehung Doctor ↔ Qualification ist bereits in M1-002
abgedeckt. Hier nur die Qualification-Stammdaten selbst (CRUD).

## Anforderungen

### 1. Repository-Layer (backend/app/repositories/)

#### department_repository.py

- `list_departments(db, *, include_inactive=False) -> list[Department]`
  - Default: nur aktive
  - Sortierung: display_order aufsteigend, dann name
- `get_department(db, department_id) -> Department | None`
- `get_department_by_name(db, name) -> Department | None`
  - Hilfsfunktion für Idempotenz und Suche
- `create_department(db, data: dict) -> Department`
- `update_department(db, department_id, data: dict) -> Department | None`
- `delete_department(db, department_id) -> bool`
  - Hartes Delete

#### shift_type_repository.py

- `list_shift_types(db, *, include_inactive=False) -> list[ShiftType]`
  - Sortierung: display_order, dann name
- `get_shift_type(db, shift_type_id) -> ShiftType | None`
- `get_shift_type_by_short_name(db, short_name) -> ShiftType | None`
- `create_shift_type(db, data: dict) -> ShiftType`
- `update_shift_type(db, shift_type_id, data: dict) -> ShiftType | None`
- `delete_shift_type(db, shift_type_id) -> bool`

#### qualification_repository.py

- `list_qualifications(db, *, include_inactive=False) -> list[Qualification]`
  - Sortierung: name aufsteigend
- `get_qualification(db, qualification_id) -> Qualification | None`
- `get_qualification_by_name(db, name) -> Qualification | None`
- `create_qualification(db, data: dict) -> Qualification`
- `update_qualification(db, qualification_id, data: dict) -> Qualification | None`
- `delete_qualification(db, qualification_id) -> bool`

#### rule_override_repository.py

- `list_rule_overrides(db, *, scope=None, doctor_id=None, rule_key=None, active_on_date=None) -> list[RuleOverride]`
  - Filter optional kombinierbar
  - `active_on_date`: filtert auf Overrides, die an diesem Datum gültig
    sind (valid_from <= date and (valid_to is null or valid_to >= date))
  - Sortierung: created_at absteigend
- `get_rule_override(db, override_id) -> RuleOverride | None`
- `create_rule_override(db, data: dict) -> RuleOverride`
- `update_rule_override(db, override_id, data: dict) -> RuleOverride | None`
- `delete_rule_override(db, override_id) -> bool`

### 2. Service-Layer (backend/app/services/)

#### department_service.py

- `validate_department_data(data: dict, existing: Department | None = None) -> None`
  - Wenn `is_external=True` und `is_shift_relevant=True`:
    Warnung als Validierungsfehler? **Nein**: laut Datenmodell sind
    beide Flags unabhängig. Nur dokumentieren.
  - Wenn `name` leer oder nur Whitespace: Fehler
- `create_department_with_validation(db, data: dict) -> Department`
- `update_department_with_validation(db, department_id, data: dict) -> Department`
- `delete_department_with_check(db, department_id) -> None`
  - Vorerst kein Check auf Verwendung in Plänen (Plan-Modul existiert
    noch nicht)
  - Wenn später Pläne existieren: Service muss prüfen ob Department
    in Plänen verwendet wird, bevor gelöscht. Kommentar mit TODO im Code.

#### shift_type_service.py

- `validate_shift_type_data(data: dict, existing: ShiftType | None = None) -> None`
  - Wenn `applies_on_weekdays=False` und `applies_on_weekend=False`:
    Fehler "Schichttyp muss mindestens an einem Tag-Typ gelten"
  - Wenn `start_time` und `end_time` beide gesetzt: prüfen, dass sie
    nicht identisch sind (gleiche Zeit ist sinnlos). Wenn `start_time > end_time`:
    OK, das bedeutet Schicht über Mitternacht (z.B. Nachtdienst).
- `create_shift_type_with_validation(db, data: dict) -> ShiftType`
- `update_shift_type_with_validation(db, shift_type_id, data: dict) -> ShiftType`

#### qualification_service.py

- `validate_qualification_data(data: dict) -> None`
  - Name nicht leer
- `create_qualification_with_validation(db, data: dict) -> Qualification`
- `update_qualification_with_validation(db, qualification_id, data: dict) -> Qualification`
- `delete_qualification_with_check(db, qualification_id) -> None`
  - Prüft ob die Qualifikation aktuell Ärzten zugewiesen ist.
  - Wenn ja: `QualificationInUseError` mit Liste der Ärzte
  - Wenn nein: Repository delete

#### rule_override_service.py

- `validate_rule_override_data(data: dict) -> None`
  - Wenn `scope=DOCTOR` und kein `doctor_id`: Fehler
  - Wenn `scope=GLOBAL` und `doctor_id` gesetzt: Fehler
  - Wenn `valid_from` und `valid_to` beide gesetzt und `valid_from > valid_to`: Fehler
  - `rule_key` nicht leer
  - `override_value` nicht leer
- `create_rule_override_with_validation(db, data: dict) -> RuleOverride`
- `update_rule_override_with_validation(db, override_id, data: dict) -> RuleOverride`

#### exceptions.py erweitern

Neue Exception-Klassen ergänzen:
- `DepartmentNotFoundError`
- `DepartmentValidationError`
- `ShiftTypeNotFoundError`
- `ShiftTypeValidationError`
- `QualificationInUseError` (mit Attribut `doctor_names: list[str]`)
- `QualificationValidationError`
- `RuleOverrideNotFoundError`
- `RuleOverrideValidationError`

`QualificationNotFoundError` existiert bereits aus M1-002.

### 3. API-Layer (backend/app/api/)

Eine Datei je Entität. Standard-Pattern: GET (Liste), GET (einzeln),
POST, PATCH, DELETE.

#### departments.py

Prefix: `/api/departments`

- `GET /api/departments` → `list[DepartmentResponse]`
  - Query: `include_inactive: bool = False`
- `GET /api/departments/{department_id}` → `DepartmentResponse`
- `POST /api/departments` → `DepartmentResponse` (201)
- `PATCH /api/departments/{department_id}` → `DepartmentResponse`
- `DELETE /api/departments/{department_id}` → 204

#### shift_types.py

Prefix: `/api/shift-types`

Analog zu Departments mit `ShiftTypeResponse`.

#### qualifications.py

Prefix: `/api/qualifications`

Analog. DELETE liefert 422 mit Liste der zugewiesenen Ärzte, wenn
in Verwendung.

#### rule_overrides.py

Prefix: `/api/rule-overrides`

- `GET /api/rule-overrides` → `list[RuleOverrideResponse]`
  - Query: `scope: OverrideScope | None`, `doctor_id: int | None`,
    `rule_key: str | None`, `active_on_date: date | None`
- `GET /api/rule-overrides/{override_id}` → `RuleOverrideResponse`
- `POST /api/rule-overrides` → `RuleOverrideResponse` (201)
- `PATCH /api/rule-overrides/{override_id}` → `RuleOverrideResponse`
- `DELETE /api/rule-overrides/{override_id}` → 204

### 4. Fehlerhandler erweitern

In `app/api/error_handlers.py` die neuen Exceptions registrieren:

- `DepartmentNotFoundError` → 404
- `DepartmentValidationError` → 422
- `ShiftTypeNotFoundError` → 404
- `ShiftTypeValidationError` → 422
- `QualificationNotFoundError` → 404 (existiert ggf. schon)
- `QualificationInUseError` → 422 mit Detail das die zugewiesenen Ärzte enthält:
  ```json
  {
    "detail": "Qualifikation wird noch von folgenden Ärzten verwendet: Dr. A, Dr. B"
  }
  ```
- `QualificationValidationError` → 422
- `RuleOverrideNotFoundError` → 404
- `RuleOverrideValidationError` → 422

### 5. Tests (backend/tests/)

Eine Test-Datei je Entität:
- `tests/integration/test_departments_api.py`
- `tests/integration/test_shift_types_api.py`
- `tests/integration/test_qualifications_api.py`
- `tests/integration/test_rule_overrides_api.py`

Pro Datei mindestens diese Tests (analog zu M1-002):

**Standard-Tests pro Entität:**
- `test_list_empty`
- `test_create_minimal` (nur Pflichtfelder)
- `test_create_full` (alle Felder)
- `test_get_404`
- `test_update_partial`
- `test_delete_204`
- `test_include_inactive_filter`

**Spezifische Tests:**

departments:
- `test_create_external_department` (is_external=True)
- `test_sort_by_display_order`
- `test_seed_data_present` (nach Seed-Skript: 21 Bereiche da)

shift_types:
- `test_validation_no_day_type` (beide Flags False → 422)
- `test_validation_identical_times` (start_time == end_time → 422)
- `test_night_shift_over_midnight` (start_time > end_time, OK)
- `test_seed_data_present` (3 Schichttypen da)

qualifications:
- `test_delete_in_use` (Qualifikation an Doctor zuweisen, dann
  DELETE → 422 mit Doctor-Name)
- `test_delete_unused` (DELETE → 204)
- `test_unique_name` (zweite mit gleichem Namen → IntegrityError → 422)

rule_overrides:
- `test_create_global` (scope=GLOBAL, kein doctor_id)
- `test_create_for_doctor` (scope=DOCTOR, mit doctor_id)
- `test_validation_global_with_doctor_id` → 422
- `test_validation_doctor_without_doctor_id` → 422
- `test_filter_by_scope`
- `test_filter_by_doctor`
- `test_filter_by_active_on_date` (Override mit valid_from/valid_to,
  Datum innerhalb und außerhalb prüfen)

**Unit-Tests pro Service in `tests/unit/`:**
Mindestens für nicht-triviale Validierungen (Overlap, In-Use-Check).

### 6. Manueller Smoke-Test

Nach Implementierung alle neuen Endpunkte in der Swagger-UI sichtbar
und aufrufbar. Kein Stub, kein 501.

## Akzeptanzkriterien

- [ ] 4 neue Repositories
- [ ] 4 neue Service-Module
- [ ] 4 neue API-Module mit insgesamt 20 Endpunkten
- [ ] Erweiterte exceptions.py
- [ ] Erweiterte error_handlers.py mit neuen Mappings
- [ ] Alle neuen Tests laufen grün
- [ ] Bestehende Tests laufen weiter grün
- [ ] `uv run ruff check .` läuft grün
- [ ] OpenAPI-Schema enthält alle neuen Endpunkte korrekt
- [ ] Manuell prüfbar in /docs: alle 4 Tag-Gruppen vorhanden

## Out of Scope

- Kein Frontend (kommt in M1-004 und M1-005)
- Keine OpenAPI-Typgenerierung (manueller pnpm generate-api Schritt
  nach Merge)
- Keine Verwendungs-Checks für Departments (Pläne existieren noch nicht)
- Keine Verwendungs-Checks für ShiftTypes (Pläne existieren noch nicht)
- Keine RuleOverride-Anwendungslogik (kommt erst mit Solver/Validierung
  in M5/M8)
- Keine Bulk-Operationen
- Keine Pagination

## Bekannte Stolperfallen

- **Sortierung Departments:** display_order ist Integer, viele 0er
  möglich. Sekundärsortierung nach name garantiert Stabilität.
- **ShiftType Mitternachts-Schichten:** start_time > end_time ist
  fachlich korrekt für Nachtdienste (z.B. 21:00 bis 07:00). Validierung
  darf das nicht ablehnen.
- **QualificationInUseError:** Detail-Message soll Doctor-Namen
  enthalten, sortiert und gut lesbar. Bei vielen Ärzten (>10):
  abkürzen mit "... und 5 weitere".
- **RuleOverride active_on_date:** SQLite hat eigene Datums-Behandlung.
  Filter mit `coalesce(valid_to, '9999-12-31')` oder Python-Logik.
  Nicht auf Postgres-spezifische Funktionen verlassen.
- **404 vs 422:** Pydantic-Validierung gibt 422 für Schema-Fehler.
  Eigene Service-Validierungen auch 422 (gleiches Format). 404 nur
  für nicht-existierende Ressourcen.
- **Idempotenz im Test-Setup:** Wenn Tests einer Datei sich Departments
  oder ShiftTypes anlegen und löschen, müssen sie mit anderen Tests
  nicht kollidieren. Saubere Fixtures pro Test-Funktion oder
  in-memory DB pro Test.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

Beispiel-Annahmen, die OK sind:
- DELETE auf Department und ShiftType ist hart, ohne Verwendungs-Check
  (TODO im Code für später).
- DELETE auf Qualification mit Verwendungs-Check (Doctors-Beziehung
  existiert).
- RuleOverride.override_value bleibt String, keine Typkonvertierung
  hier (kommt erst beim Anwenden in M5/M8).
- `display_order` darf bei POST weggelassen werden (Default 0).
