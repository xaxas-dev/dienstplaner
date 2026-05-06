# Task M1-002: Backend CRUD für Ärzte

## Ziel
Vollständiger Backend-Stack für die Verwaltung von Ärzten:
Repository-Layer, Service-Layer und API-Endpunkte. Inklusive
Beschäftigungszeiträume und Qualifikationszuweisungen.
Lese-Endpunkt liefert Doctor mit verschachtelten EmploymentPeriods
und Qualifications. Schreib-Operationen auf Sub-Entitäten gehen
über eigene Endpunkte (Mischform).

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md, docs/architecture.md.

M1-001 hat alle Stammdaten-Modelle und Schemas angelegt.
Diese Aufgabe baut den Repository-Layer, Service-Layer und API-Layer
für die Doctor-Entität auf, einschließlich der gekoppelten Entitäten
EmploymentPeriod und der M:N-Beziehung zu Qualification.

Die übrigen Stammdaten (Departments, ShiftTypes, Qualifications,
RuleOverrides) kommen in M1-003.

## Anforderungen

### 1. Repository-Layer (backend/app/repositories/)

Reines Datenzugriffs-Modul. Keine Business-Logik, keine HTTP-Konzepte.
Eine Datei je Aggregat.

#### doctor_repository.py

Funktionen:
- `list_doctors(db, *, include_inactive=False) -> list[Doctor]`
  - Default: nur aktive Ärzte
  - Sortierung: name aufsteigend
  - Eager-loading von `employment_periods` und `qualifications`
- `get_doctor(db, doctor_id) -> Doctor | None`
  - Eager-loading wie oben
- `create_doctor(db, data: dict) -> Doctor`
  - Nur das Doctor-Objekt selbst, keine Sub-Entitäten
- `update_doctor(db, doctor_id, data: dict) -> Doctor | None`
  - Partial update, nur gesetzte Felder ändern
- `delete_doctor(db, doctor_id) -> bool`
  - Hartes Delete (nicht active=False), kaskadiert auf
    employment_periods und doctor_qualifications

#### employment_period_repository.py

Funktionen:
- `list_employment_periods(db, doctor_id) -> list[EmploymentPeriod]`
  - Sortierung: valid_from absteigend (neueste zuerst)
- `get_employment_period(db, ep_id) -> EmploymentPeriod | None`
- `create_employment_period(db, doctor_id, data: dict) -> EmploymentPeriod`
- `update_employment_period(db, ep_id, data: dict) -> EmploymentPeriod | None`
- `delete_employment_period(db, ep_id) -> bool`

#### doctor_qualification_repository.py

Funktionen:
- `add_qualification(db, doctor_id, qualification_id, *, acquired_at=None, expires_at=None) -> DoctorQualification`
- `remove_qualification(db, doctor_id, qualification_id) -> bool`
- `list_qualifications_for_doctor(db, doctor_id) -> list[Qualification]`

### 2. Service-Layer (backend/app/services/)

Business-Logik. Keine FastAPI-Imports hier.

#### doctor_service.py

Validierungs- und Geschäftslogik, die über reines CRUD hinausgeht:

- `validate_employment_period_overlap(db, doctor_id, valid_from, valid_to, exclude_ep_id=None) -> bool`
  - Prüft ob ein neuer/geänderter EP sich mit bestehenden EPs des selben Arztes überschneidet
  - Wirft `EmploymentPeriodOverlapError` wenn Überlappung gefunden
- `validate_doctor_data(data: dict) -> None`
  - Prüft fachliche Konsistenz:
    - Wenn `is_facharzt=True`, dann `weiterbildungsjahr` sollte null sein
    - Wenn `doctor_type=EXTERNAL`, dann `weiterbildungsjahr` sollte null sein
  - Wirft `DoctorValidationError` mit klarer Meldung
- `create_doctor_with_validation(db, data: dict) -> Doctor`
  - Ruft `validate_doctor_data`, dann Repository
- `update_doctor_with_validation(db, doctor_id, data: dict) -> Doctor`
  - Bei Update prüft die *zusammengeführten* Daten
- `add_employment_period_with_validation(db, doctor_id, data: dict) -> EmploymentPeriod`
  - Prüft Overlap, dann Repository
- `update_employment_period_with_validation(db, ep_id, data: dict) -> EmploymentPeriod`
  - Prüft Overlap (außer mit sich selbst)

Eigene Exception-Klassen in `app/services/exceptions.py`:
- `DoctorNotFoundError`
- `EmploymentPeriodNotFoundError`
- `EmploymentPeriodOverlapError`
- `DoctorValidationError`
- `QualificationNotFoundError`

### 3. API-Layer (backend/app/api/)

#### doctors.py

REST-Endpunkte unter Prefix `/api/doctors`.

**Lese-Endpunkte (geschachtelt):**
- `GET /api/doctors` → `list[DoctorWithRelations]`
  - Query-Parameter: `include_inactive: bool = False`
  - Response: Liste mit verschachtelten employment_periods und qualifications
- `GET /api/doctors/{doctor_id}` → `DoctorWithRelations`
  - 404 wenn nicht gefunden

**Schreib-Endpunkte für Doctor (ohne Sub-Entitäten):**
- `POST /api/doctors` → `DoctorResponse` (status 201)
  - Body: `DoctorCreate`
  - Validierungsfehler: 422
- `PATCH /api/doctors/{doctor_id}` → `DoctorResponse`
  - Body: `DoctorUpdate`
  - 404 wenn nicht gefunden
- `DELETE /api/doctors/{doctor_id}` → status 204
  - 404 wenn nicht gefunden

**Schreib-Endpunkte für EmploymentPeriods (eigene Routen):**
- `POST /api/doctors/{doctor_id}/employment-periods` → `EmploymentPeriodResponse` (status 201)
  - Body: `EmploymentPeriodCreate`
  - 404 wenn doctor nicht gefunden
  - 422 bei Overlap
- `PATCH /api/employment-periods/{ep_id}` → `EmploymentPeriodResponse`
  - Body: `EmploymentPeriodUpdate`
  - 404 wenn nicht gefunden
  - 422 bei Overlap
- `DELETE /api/employment-periods/{ep_id}` → status 204

**Schreib-Endpunkte für Qualifikations-Zuweisungen:**
- `POST /api/doctors/{doctor_id}/qualifications/{qualification_id}` → `DoctorQualificationResponse` (status 201)
  - Body optional: `{acquired_at?, expires_at?}`
  - 404 wenn doctor oder qualification nicht gefunden
  - 409 wenn Zuweisung bereits existiert
- `DELETE /api/doctors/{doctor_id}/qualifications/{qualification_id}` → status 204

### 4. Erweiterte Schemas (backend/app/schemas/)

In `doctor.py` ein neues Schema:

```python
class DoctorWithRelations(DoctorResponse):
    employment_periods: list[EmploymentPeriodResponse] = []
    qualifications: list[QualificationResponse] = []
```

Falls `EmploymentPeriodResponse` und `QualificationResponse` nicht
in M1-001 angelegt: jetzt ergänzen.

Neues Schema `DoctorQualificationResponse` in 
`schemas/doctor_qualification.py`:

```python
class DoctorQualificationResponse(BaseModel):
    doctor_id: int
    qualification_id: int
    acquired_at: date | None
    expires_at: date | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

### 5. Fehlerbehandlung

In `app/api/error_handlers.py` (neue Datei) FastAPI Exception-Handler
für die Service-Exceptions registrieren:

- `DoctorNotFoundError` → HTTP 404
- `EmploymentPeriodNotFoundError` → HTTP 404
- `QualificationNotFoundError` → HTTP 404
- `EmploymentPeriodOverlapError` → HTTP 422 mit Detail-Message
- `DoctorValidationError` → HTTP 422 mit Detail-Message

Antwortformat soll dem RFC-9457-Stil folgen (Problem Details), aber
FastAPI-typische Vereinfachung ist OK:

```json
{
  "detail": "Beschäftigungszeitraum überschneidet sich mit bestehendem Eintrag (1.5.2025 - 31.12.2025)"
}
```

In `main.py` die Handler registrieren.

### 6. Tests (backend/tests/)

#### tests/integration/test_doctors_api.py

API-Tests mit FastAPI TestClient und in-memory SQLite.

Mindestens diese Tests:
- `test_list_doctors_empty`: leere Liste, status 200
- `test_create_doctor_minimal`: nur name, restliche Defaults
- `test_create_doctor_full`: alle Felder, prüfen dass alles gespeichert ist
- `test_create_doctor_validation_facharzt_with_wbj`: Facharzt + Weiterbildungsjahr → 422
- `test_get_doctor_with_relations`: Doctor mit 2 EPs und 2 Qualifications
  abrufen, prüfen dass alles in der Response ist
- `test_get_doctor_404`: nicht-existierende ID → 404
- `test_update_doctor_partial`: nur ein Feld ändern, andere bleiben
- `test_delete_doctor_cascades`: löschen, EPs und Qualis weg
- `test_create_employment_period_overlap`: zwei überlappende EPs → 422
- `test_create_employment_period_unbefristet`: valid_to=null
- `test_add_and_remove_qualification`: Qualifikation zuweisen, abrufen, entfernen
- `test_add_qualification_duplicate`: doppelte Zuweisung → 409
- `test_include_inactive_filter`: Default zeigt nur aktive, mit Flag alle

#### tests/unit/test_doctor_service.py

Unit-Tests für Service-Layer ohne API:
- `test_validate_doctor_data_facharzt_no_wbj`: gültig
- `test_validate_doctor_data_facharzt_with_wbj`: Exception
- `test_validate_doctor_data_external_with_wbj`: Exception
- `test_validate_employment_period_overlap_*`: verschiedene
  Überlappungs-Szenarien (vorher, nachher, vollständig drin, teilweise)

### 7. Test-Fixtures

In `tests/conftest.py` (neu oder erweitert):
- Fixture für in-memory SQLite mit alembic upgrade head
- Fixture für FastAPI TestClient
- Fixture für eine vorbereitete Test-DB mit ein paar Beispiel-Ärzten,
  Qualifikationen und Departments (Reuse über Tests)

## Akzeptanzkriterien

- [ ] Repository-Layer für Doctor, EmploymentPeriod, DoctorQualification
- [ ] Service-Layer mit Validierungs- und Overlap-Logik
- [ ] Alle 13 API-Endpunkte implementiert und über /docs erreichbar
- [ ] Verschachtelte Lese-Antworten enthalten employment_periods und qualifications
- [ ] Schreib-Operationen für Sub-Entitäten über eigene Endpunkte
- [ ] Fehlerhandler liefert sinnvolle Fehlermeldungen (nicht nur Stack Trace)
- [ ] Alle neuen Tests laufen grün (`uv run pytest`)
- [ ] Bestehende Tests laufen weiter grün
- [ ] `uv run ruff check .` läuft grün
- [ ] OpenAPI-Schema enthält alle neuen Endpunkte korrekt
- [ ] Manuell prüfbar: POST → GET zeigt verschachtelte Daten

## Out of Scope

- Kein Frontend (kommt in M1-004)
- Keine Endpunkte für Departments, ShiftTypes, Qualifications, RuleOverrides
  (kommt in M1-003)
- Keine Auth (Single-User, lokal)
- Keine Soft-Delete-Logik (active-Flag wird gesetzt, aber harter DELETE
  ist auch erlaubt)
- Keine Pagination (kommt erst wenn nötig)
- Keine Such-/Filter-Endpunkte außer include_inactive
- Keine Audit-Logs

## Bekannte Stolperfallen

- **Eager Loading:** SQLAlchemy lädt Beziehungen nur auf Anforderung.
  Für `DoctorWithRelations` müssen `employment_periods` und 
  `qualifications` per `selectinload` oder `joinedload` geladen werden,
  sonst hat man N+1-Queries oder leere Listen in der Response.
- **Pydantic Serialisierung von Beziehungen:** mit `from_attributes=True`
  funktioniert das, aber zirkuläre Imports können bei verschachtelten
  Schemas auftreten. Aufpassen bei import order.
- **Overlap-Validierung:** zwei Zeiträume überschneiden sich, wenn
  `not (a.valid_to < b.valid_from or b.valid_to < a.valid_from)`.
  valid_to=null bedeutet "unendlich". Spezialfall sauber abdecken.
- **DELETE mit Cascade:** SQLAlchemy-Cascade-Konfiguration muss zur
  DB-Cascade in der Migration passen, sonst inkonsistent.
- **TestClient und Sessions:** FastAPI TestClient muss eine separate
  Test-DB-Session bekommen (override_dependency), nicht die echte DB.
- **datetime/date in JSON:** Pydantic v2 serialisiert date/datetime als
  ISO-Strings, aber Tests müssen das im Vergleich beachten.
- **Status Codes:** Pydantic-Validierung wirft 422 automatisch. Eigene
  422 nur für Business-Validierung. Nicht 400 verwenden.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.
Beispiel-Annahmen, die OK sind:
- DELETE auf Doctor ist hart (nicht soft). Soft-Delete ist ein eigenes
  Feature für später.
- Reihenfolge in Listen: Doctors nach name aufsteigend, EPs nach
  valid_from absteigend (neueste zuerst), Qualifications nach name.
- `include_inactive` Default ist False. Wer auch inaktive sehen will,
  setzt explizit True.
