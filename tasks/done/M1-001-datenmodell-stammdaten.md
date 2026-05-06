# Task M1-001: Datenmodell und Migrationen für Stammdaten

## Ziel
Vollständiges SQLAlchemy-Datenmodell für alle Stammdaten-Entitäten,
zugehörige Alembic-Migration, pydantic-Schemas und ein Seed-Skript
mit den initialen Bereichen. Smoke-Tests bestätigen, dass jede Tabelle
befüllt und abgefragt werden kann.

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md (falls vorhanden,
sonst leerer Stub).

Diese Aufgabe legt das Fundament für alle weiteren Meilensteine.
Falsches Datenmodell hier bedeutet später teures Refactoring durch
alle Schichten. Gründlichkeit vor Geschwindigkeit.

Wichtige Domänen-Konzepte (siehe CLAUDE.md):
- Zwei Planungsebenen: Rotation (monatlich) + Schicht (täglich)
- Zeitabhängiger Beschäftigungsumfang
- Externe Ärzte sind ein Spezialfall (vereinfachtes Modell)
- Bereiche können externe Rotationen sein (keine Dienste planen)
- Override-Mechanismus für Tarifregeln (Ebene A global, B pro Arzt)

Diese Aufgabe enthält NUR die Stammdaten. Plan-Entitäten (Plan, Schicht,
Zuweisung, Abwesenheit, Wunsch) kommen in späteren Aufgaben (M2 ff.).

## Anforderungen

### 1. SQLAlchemy ORM-Modelle (backend/app/models/)

Eine Datei pro Modell. Alle Modelle erben von einer gemeinsamen Base
(SQLAlchemy DeclarativeBase). Alle Tabellen haben:
- `id` (Integer, PK, autoincrement)
- `created_at` (DateTime, default jetzt)
- `updated_at` (DateTime, default jetzt, onupdate jetzt)

#### doctor.py - Tabelle `doctors`
- `name` (String 200, nicht null)
- `short_name` (String 50, nullable) - Kürzel für UI/Excel
- `doctor_type` (Enum DoctorType: INTERNAL, EXTERNAL, default INTERNAL)
- `weiterbildungsjahr` (Integer, nullable) - 1 bis 6, nur bei Assistenzärzten relevant
- `is_facharzt` (Boolean, default False)
- `active` (Boolean, default True)
- `notes` (Text, nullable)

Beziehungen:
- 1:N zu `employment_periods`
- M:N zu `qualifications` (über Tabelle `doctor_qualifications`)

Wichtig: Externe Ärzte (EXTERNAL) haben oft keine `employment_periods`.
Das Modell muss das erlauben (nullable Beziehung de facto durch leere
Liste abgebildet).

#### employment_period.py - Tabelle `employment_periods`
- `doctor_id` (FK doctors.id, nicht null, ondelete CASCADE)
- `valid_from` (Date, nicht null)
- `valid_to` (Date, nullable) - null bedeutet unbefristet
- `employment_percentage` (Integer, nicht null, 1-100)
- `notes` (Text, nullable)

Constraint: `valid_from < valid_to` (falls valid_to nicht null).
Constraint: `employment_percentage` zwischen 1 und 100.

#### qualification.py - Tabelle `qualifications`
- `name` (String 200, unique, nicht null)
- `short_name` (String 50, nullable)
- `description` (Text, nullable)
- `active` (Boolean, default True)

#### doctor_qualification.py - Tabelle `doctor_qualifications`
Verknüpfungstabelle für M:N zwischen Doctor und Qualification.
- `doctor_id` (FK, nicht null, ondelete CASCADE)
- `qualification_id` (FK, nicht null, ondelete CASCADE)
- `acquired_at` (Date, nullable)
- `expires_at` (Date, nullable)
- PK: (doctor_id, qualification_id)

#### department.py - Tabelle `departments`
- `name` (String 200, unique, nicht null) - z.B. "Stroke Unit"
- `short_name` (String 50, nullable) - z.B. "SU"
- `is_external` (Boolean, default False) - externe Rotation?
- `is_shift_relevant` (Boolean, default True) - werden Dienste für diesen Bereich geplant?
- `active` (Boolean, default True)
- `display_order` (Integer, default 0) - Sortierung in der UI
- `notes` (Text, nullable)

Bemerkung: `is_external=True` impliziert oft `is_shift_relevant=False`,
aber nicht zwingend. Beide Felder bleiben unabhängig.

#### shift_type.py - Tabelle `shift_types`
- `name` (String 100, unique, nicht null) - z.B. "V-Dienst"
- `short_name` (String 20, unique, nicht null) - z.B. "V"
- `applies_on_weekdays` (Boolean, default True)
- `applies_on_weekend` (Boolean, default False)
- `start_time` (Time, nullable) - vorerst optional
- `end_time` (Time, nullable)
- `display_order` (Integer, default 0)
- `active` (Boolean, default True)
- `notes` (Text, nullable)

#### rule_override.py - Tabelle `rule_overrides`
Für Override-Ebenen A (global) und B (arzt-spezifisch).
Ebene C (Einzel-Verstoß-Akzeptanz) ist Plan-bezogen und kommt in M2/M5.

- `rule_key` (String 100, nicht null) - z.B. "max_bereitschaft_per_month"
- `scope` (Enum OverrideScope: GLOBAL, DOCTOR, default GLOBAL)
- `doctor_id` (FK doctors.id, nullable) - nur wenn scope=DOCTOR
- `valid_from` (Date, nullable) - null bedeutet unbegrenzt zurück
- `valid_to` (Date, nullable) - null bedeutet unbegrenzt vorwärts
- `override_value` (String 500, nicht null) - String-Repräsentation
- `reason` (Text, nullable) - optional, freie Begründung

Constraint: wenn scope=DOCTOR, dann doctor_id nicht null.
Constraint: wenn scope=GLOBAL, dann doctor_id null.

### 2. Pydantic-Schemas (backend/app/schemas/)

Eine Datei pro Modell, mit jeweils:
- `Base` (gemeinsame Felder ohne id/timestamps)
- `Create` (für POST, ohne id/timestamps)
- `Update` (für PATCH, alle Felder optional)
- `Response` (für GET, mit id und timestamps)

Beispielstruktur für `doctor.py`:

```python
class DoctorBase(BaseModel):
    name: str
    short_name: str | None = None
    doctor_type: DoctorType = DoctorType.INTERNAL
    weiterbildungsjahr: int | None = None
    is_facharzt: bool = False
    active: bool = True
    notes: str | None = None

class DoctorCreate(DoctorBase): ...
class DoctorUpdate(BaseModel):
    # alle Felder optional
    name: str | None = None
    # ...

class DoctorResponse(DoctorBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

Pydantic v2 Syntax verwenden (model_config statt class Config).

### 3. Alembic-Migration

Eine einzige Migration in `backend/alembic/versions/` mit allen Tabellen.
Migration-Name: `0001_initial_master_data.py` oder ähnlich.

Inhalt:
- Alle 7 Tabellen anlegen
- Alle Foreign Keys
- Alle Check-Constraints
- Alle Indizes (implizit auf FKs, sowie auf häufig gesuchte Felder
  wie doctor.name, department.name)

Down-Migration: alle Tabellen droppen.

### 4. Seed-Skript

Datei: `backend/scripts/seed_departments.py`

Inhalt: Initiale Bereichsliste mit allen 21 Bereichen aus
docs/data-model.md (siehe unten). Lädt sie in die Datenbank,
falls noch keine Bereiche existieren. Idempotent: zweiter
Aufruf darf nicht doppelt einfügen.

Bereichsliste:

```
Interne, dienst-relevante Bereiche (display_order 1-18):
1.  511/LBEST                       (LBEST)
2.  511                              (511)
3.  ITS
4.  SU-Stationsarzt                  (SU-SA)
5.  SU
6.  Duplex                           (Du)
7.  Poli
8.  Poli/EMG
9.  EMG
10. Springer                         (Spr)
11. Parkinson Komplextherapie        (ParkiKomp)
12. Tagesklinik                      (TK)
13. Neuromotorik-TK                  (NM-TK)
14. Poli/Botox/THS
15. Poli/Botox
16. MS-Sprechstunde/Konsile          (MS)
17. Forschung                        (Fo)
18. Curschmann Klinik                (CK)

Externe Rotationen (is_external=True, is_shift_relevant=False, display_order 19-21):
19. Intensiv Innere
20. Psychiatrie
21. ZIP
```

Aufruf: `uv run python scripts/seed_departments.py`

### 5. Zweites Seed-Skript für Schichttypen

Datei: `backend/scripts/seed_shift_types.py`

Inhalt:
```
Name           Short  Werktag  Wochenende  display_order
V-Dienst       V      true     false       1
Tagdienst      T      false    true        2
Nachtdienst    N      true     true        3
```

Idempotent.

Bemerkung: Uhrzeiten bleiben vorerst null. Werden später konfiguriert.

### 6. Smoke-Tests (backend/tests/)

Datei: `tests/test_models.py`

Mindestens diese Tests, jeweils mit in-memory SQLite:

- `test_doctor_create_and_query`: Arzt anlegen, abfragen, Felder prüfen
- `test_employment_period_with_doctor`: EP mit FK auf Doctor anlegen,
  über Beziehung abfragen
- `test_department_external_flag`: externen Bereich anlegen, Flag prüfen
- `test_qualification_many_to_many`: 1 Arzt, 2 Qualifikationen, M:N abfragen
- `test_shift_type_unique_short_name`: Doppelter short_name wirft IntegrityError
- `test_rule_override_global_vs_doctor`: beide scope-Varianten anlegen

Tests dürfen ein gemeinsames Fixture für die Test-Datenbank nutzen
(SQLite in-memory, mit alembic upgrade head pro Test oder Session).

### 7. Dokumentation

Datei: `docs/data-model.md`

Inhalt: Übersicht aller Entitäten, Beziehungen (gerne als Mermaid-Diagramm),
Erläuterung der wichtigsten Konzepte:
- Warum employment_period zeitabhängig ist
- Was DoctorType.EXTERNAL bedeutet
- Warum is_external und is_shift_relevant getrennt sind
- Wie rule_override funktioniert (Ebene A und B)

Hinweis am Ende: Plan-Entitäten kommen in M2.

## Akzeptanzkriterien

- [ ] Alle 7 ORM-Modelle existieren in backend/app/models/
- [ ] Eigene `__init__.py` in models/ exportiert alle Modelle
- [ ] Alle 7 Schemas existieren in backend/app/schemas/
- [ ] Eine Alembic-Migration legt alle Tabellen an
- [ ] `uv run alembic upgrade head` läuft fehlerfrei
- [ ] `uv run alembic downgrade base` läuft fehlerfrei (alle Tabellen weg)
- [ ] Seed-Skripte laufen idempotent (zweiter Aufruf keine Duplikate)
- [ ] Nach `seed_departments.py` sind 21 Bereiche in der DB
- [ ] Nach `seed_shift_types.py` sind 3 Schichttypen in der DB
- [ ] Alle Smoke-Tests laufen grün (`uv run pytest`)
- [ ] `uv run ruff check .` läuft grün
- [ ] docs/data-model.md ist aktualisiert mit Beziehungs-Diagramm

## Out of Scope

- Kein Repository-Layer (kommt in M1-002)
- Keine API-Endpunkte (kommen in M1-002 ff.)
- Kein Frontend
- Keine Plan-Entitäten (Plan, Schicht, Zuweisung, Abwesenheit, Wunsch)
- Keine OpenAPI-Typgenerierung im Frontend (auto-aktualisiert sobald
  Endpoints existieren)
- Keine Solver-Integration
- Keine Authentifizierung
- Keine Validierung über Schema hinaus (z.B. komplexe Business-Regeln)

## Bekannte Stolperfallen

- **SQLite und Enums:** SQLAlchemy speichert Python-Enums in SQLite als
  String. Das funktioniert, aber Migration muss explizit Enum-Werte
  als VARCHAR + Check-Constraint anlegen, nicht als Postgres-ENUM.
- **Date vs DateTime:** Beschäftigungszeiträume sind Tagesgenau (Date).
  created_at/updated_at sind DateTime. Nicht verwechseln.
- **Pydantic v2:** Syntax hat sich geändert gegenüber v1. Nutze:
  - `model_config = ConfigDict(...)` statt `class Config`
  - `Field(...)` für Constraints
  - `from_attributes=True` statt `orm_mode=True`
- **Alembic env.py:** muss die SQLAlchemy Base aus app.models importieren,
  damit autogenerate funktioniert. Falls schon konfiguriert in M0-001:
  prüfen ob es passt.
- **Externe Ärzte:** keine harte FK-Lücke. Das Modell erlaubt
  EXTERNAL-Ärzte ohne employment_periods, und die Anwendungslogik
  später muss damit umgehen.
- **doctor.weiterbildungsjahr:** ist nullable, weil Fachärzte und
  externe Ärzte das Feld nicht haben. Bei is_facharzt=True
  konventionell null.
- **Idempotente Seeds:** wirklich idempotent. Prüfung per `name`
  oder `short_name`. Wenn ein Bereich umbenannt wurde, soll der
  zweite Aufruf nicht erneut einfügen, sondern nichts tun (kein
  Update).

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.
Beispiele für mögliche Unsicherheiten:
- Soll Forschung ein eigenes "Bereich-Tag" haben (z.B. is_research)?
  → Nein, vorerst nicht. Forschung ist ein normaler Bereich.
- Sollen Soft-Deletes (active=False) statt richtigem DELETE bevorzugt
  werden? → Ja, die `active`-Flags sind genau dafür. DELETE ist nur
  für Cleanup von Testdaten.
