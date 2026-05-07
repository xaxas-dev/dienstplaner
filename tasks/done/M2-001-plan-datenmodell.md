# Task M2-001: Plan-Datenmodell und Migrationen

## Ziel
Vollständiges SQLAlchemy-Datenmodell für Pläne und alle plan-bezogenen
Entitäten: Pläne, Plan-Versionen, Schichten, Rotationszuweisungen,
Abwesenheiten und Wünsche. Inklusive Alembic-Migration und 
Smoke-Tests.

Diese Aufgabe legt nur das Modell und die Schemas. Service-Layer und
API kommen in M2-002 und folgenden.

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md, docs/decisions.md.

M1 ist abgeschlossen. Stammdaten (Doctors, Departments, ShiftTypes,
Qualifications) sind verfügbar und werden hier referenziert.

Hintergrund-Konzepte (siehe CLAUDE.md):
- **Hybrid-Modell:** Schichten sind bereichsunabhängig. Eine Schicht
  ist (Datum + Schichttyp + Arzt). Der Bereich ergibt sich aus der
  aktiven Rotation des Arztes zum Zeitpunkt der Schicht.
- **Plan immer editierbar:** Auch nach Status RELEASED bleibt der Plan
  änderbar (für Krankheitsausfälle). Versions-Historie als Snapshots.
- **Pin-Konzept Variante C:** Manuelle Zuweisungen sind gepinnt,
  Solver respektiert sie.
- **Geteilte Rotationen erlaubt:** Mehrere Ärzte können einer Rotation
  im selben Zeitraum zugeordnet sein.

## Anforderungen

### 1. Plan-Status Enum

`backend/app/models/plan.py`:

```python
class PlanStatus(StrEnum):
    DRAFT = "DRAFT"
    RELEASED = "RELEASED"
    ARCHIVED = "ARCHIVED"
```

Workflow-Hinweis (für später, hier nicht enforced):
- DRAFT: in Arbeit
- RELEASED: an Ärzte versendet, weiter editierbar
- ARCHIVED: Zeitraum vergangen, kein Editieren mehr (UI-Schutz, nicht
  DB-Schutz)

### 2. Plan-Tabelle

#### plan.py - Tabelle `plans`

- `name` (String 200, not null) - z.B. "Peripherer Plan April 2026"
- `valid_from` (Date, not null) - Beginn des Planungszeitraums
- `valid_to` (Date, not null) - Ende (inklusiv)
- `status` (Enum PlanStatus, default DRAFT)
- `notes` (Text, nullable)

Constraints:
- valid_from <= valid_to
- name nicht leer

Beziehungen:
- 1:N zu `plan_versions`
- 1:N zu `shifts`
- 1:N zu `rotation_assignments`

### 3. Plan-Version-Tabelle

#### plan_version.py - Tabelle `plan_versions`

- `plan_id` (FK, not null, ondelete CASCADE)
- `version_number` (Integer, not null) - 1-basiert, fortlaufend pro plan
- `snapshot_json` (JSON, not null) - vollständiger Stand des Plans
- `comment` (Text, nullable) - z.B. "Erstes Release", "nach Krankheit Müller"

Constraints:
- (plan_id, version_number) unique
- version_number >= 1

Snapshot-Format (für Doku, kein DB-Constraint):
```json
{
  "plan": {...},
  "shifts": [...],
  "rotation_assignments": [...]
}
```

Anmerkung: Snapshot-Erstellung und -Restore kommt erst in M2-002.
In M2-001 nur das Modell und das Feld vorbereiten.

### 4. Schicht-Tabelle

#### shift.py - Tabelle `shifts`

- `plan_id` (FK, not null, ondelete CASCADE)
- `shift_date` (Date, not null) - der Tag der Schicht
- `shift_type_id` (FK shift_types.id, not null)
- `doctor_id` (FK doctors.id, nullable) - null = unbesetzt
- `is_pinned` (Boolean, default False) - manuell gesetzt, Solver
  respektiert
- `notes` (Text, nullable)

Constraints:
- (plan_id, shift_date, shift_type_id) unique - pro Tag und Schichttyp
  genau eine Schicht
- shift_date zwischen plan.valid_from und plan.valid_to
  (Anmerkung: dieser Constraint ist schwer als CHECK abzubilden, weil
  er auf einer anderen Tabelle prüft. Im Service-Layer prüfen, nicht
  in der DB.)

Anmerkung zur Eindeutigkeit:
- Die Klinik hat aktuell pro Tag genau einen V-Dienst, einen N-Dienst,
  und am Wochenende einen T-Dienst. T1 ist ein eigener ShiftType.
- Falls später Bedarf für mehrere parallele Schichten gleichen Typs
  entsteht, muss der Constraint überarbeitet werden.

### 5. Rotationszuweisung-Tabelle

#### rotation_assignment.py - Tabelle `rotation_assignments`

- `plan_id` (FK, not null, ondelete CASCADE)
- `doctor_id` (FK doctors.id, not null, ondelete CASCADE)
- `department_id` (FK departments.id, not null, ondelete CASCADE)
- `valid_from` (Date, not null)
- `valid_to` (Date, not null)
- `notes` (Text, nullable) - z.B. "geteilt mit Dr. X" oder "Einarbeitung"

Constraints:
- valid_from <= valid_to
- valid_from und valid_to innerhalb des plan-Zeitraums
  (auch hier: Service-Layer-Validierung)

Wichtig: KEIN Unique-Constraint auf (plan_id, doctor_id, department_id, ...).
Mehrere Einträge mit überlappenden Zeiträumen sind OK (geteilte Rotationen).

### 6. Abwesenheit-Tabelle

#### absence.py - Tabelle `absences`

Abwesenheiten sind plan-unabhängig (Urlaub gilt für alle Pläne, die
den Zeitraum berühren).

```python
class AbsenceType(StrEnum):
    URLAUB = "URLAUB"
    KRANKHEIT = "KRANKHEIT"
    FORTBILDUNG = "FORTBILDUNG"
    ELTERNZEIT = "ELTERNZEIT"
    MUTTERSCHUTZ = "MUTTERSCHUTZ"
    SONSTIGES = "SONSTIGES"
```

- `doctor_id` (FK, not null, ondelete CASCADE)
- `absence_type` (Enum AbsenceType, not null)
- `valid_from` (Date, not null)
- `valid_to` (Date, not null)
- `notes` (Text, nullable)

Constraints:
- valid_from <= valid_to

### 7. Wunsch-Tabelle

#### wish.py - Tabelle `wishes`

Wünsche sind doctor-bezogen, beziehen sich auf einen konkreten Tag.
Recurring-Wünsche und Cross-Day-Constraints (Diensttyp X nach Y)
kommen in einem späteren Schema-Update; vorerst nur date-basiert.

```python
class WishType(StrEnum):
    AVOID_DAY = "AVOID_DAY"           # an dem Tag kein Dienst
    AVOID_SHIFT = "AVOID_SHIFT"       # bestimmten Diensttyp vermeiden
    REQUIRE_SHIFT = "REQUIRE_SHIFT"   # bestimmten Diensttyp wünschen
```

- `doctor_id` (FK, not null, ondelete CASCADE)
- `wish_date` (Date, not null) - bezogen auf welchen Tag
- `wish_type` (Enum WishType, not null)
- `shift_type_id` (FK shift_types.id, nullable) - nur bei AVOID_SHIFT
  und REQUIRE_SHIFT relevant
- `priority` (Integer, default 1) - 1=hoch, 2=mittel, 3=niedrig
- `notes` (Text, nullable)

Constraints:
- priority zwischen 1 und 3
- AVOID_DAY: shift_type_id muss null sein
- AVOID_SHIFT, REQUIRE_SHIFT: shift_type_id muss gesetzt sein
  (Service-Validierung, da Cross-Field)

### 8. Pydantic-Schemas

Eine Datei je Modell unter `backend/app/schemas/`:
- plan.py: PlanBase, PlanCreate, PlanUpdate, PlanResponse,
  PlanWithRelations (mit shifts und rotation_assignments)
- plan_version.py: nur Response-Schema und Create-Schema (intern, kein Update/Delete)
- shift.py: ShiftBase, ShiftCreate, ShiftUpdate, ShiftResponse,
  ShiftWithDetails (mit ShiftType und Doctor verschachtelt)
- rotation_assignment.py: alle vier Varianten + RotationAssignmentWithDetails
- absence.py: alle vier Varianten
- wish.py: alle vier Varianten

Pydantic v2 Syntax wie etabliert (model_config, computed_field bei Bedarf,
from_attributes=True).

### 9. Alembic-Migration

Eine Migration `0004_plan_data_model.py`:

Up:
- Alle 6 Tabellen anlegen
- Foreign Keys mit CASCADE wie spezifiziert
- Check-Constraints wo möglich (priority, version_number, valid_from <= valid_to)
- Indizes auf häufig gefragte Felder:
  - shifts.plan_id
  - shifts.shift_date
  - shifts.doctor_id
  - rotation_assignments.plan_id, doctor_id, department_id
  - absences.doctor_id
  - wishes.doctor_id, wish_date

Down: alle 6 Tabellen droppen.

### 10. Smoke-Tests

`tests/test_plan_models.py`:

- `test_plan_create_and_query`: Plan anlegen, Felder prüfen
- `test_plan_invalid_date_range`: valid_from > valid_to → IntegrityError
  oder durch Service abfangen, je nach Wahl
- `test_shift_unique_per_day_and_type`: zwei Shifts gleichen Tags und 
  Typs in einem Plan → IntegrityError
- `test_shift_unassigned`: doctor_id=null erlaubt
- `test_shift_pinned_default_false`: Defaults korrekt
- `test_plan_version_unique_number`: zweite Version mit gleicher 
  version_number im selben Plan → IntegrityError
- `test_plan_version_snapshot_json_roundtrip`: JSON-Daten speichern und 
  korrekt zurücklesen
- `test_rotation_assignment_overlap_allowed`: zwei Assignments mit 
  überlappenden Zeiträumen für selben Plan → erlaubt
- `test_absence_with_doctor`: Abwesenheit mit FK
- `test_wish_avoid_day_with_shift_type_null`: AVOID_DAY ohne 
  shift_type_id → erlaubt
- `test_wish_priority_range`: priority=4 → IntegrityError
- `test_cascade_plan_delete`: Plan löschen → shifts, rotation_assignments,
  plan_versions weg, aber doctors und departments bleiben

Optional, falls einfach: ein Test pro Beziehung (selectinload).

### 11. Dokumentation

`docs/data-model.md` aktualisieren:
- Plan-Modell erklären
- Hybrid-Modell-Hinweis (Schicht ohne Bereich)
- Versionierungs-Modell (Snapshot-JSON)
- Beziehungen als Mermaid-Diagramm

`docs/decisions.md` ergänzen:
- ADR: Hybrid-Modell statt bereichsspezifischer Schichten
- ADR: Plan-Versionierung als JSON-Snapshot statt Schatten-Tabellen
- ADR: Plan immer editierbar (kein Lock nach RELEASED)
- ADR: Wünsche zunächst nur date-basiert, recurring später
- ADR: Geteilte Rotationen ohne UNIQUE-Constraint

## Akzeptanzkriterien

- [ ] Alle 6 ORM-Modelle existieren
- [ ] models/__init__.py exportiert alles
- [ ] Alle Pydantic-Schemas vorhanden
- [ ] Alembic-Migration läuft up und down fehlerfrei
- [ ] Smoke-Tests laufen grün
- [ ] Bestehende Tests bleiben grün
- [ ] ruff check grün
- [ ] OpenAPI noch nicht ergänzt (kommt in M2-002, kein Endpoint hier)
- [ ] docs/data-model.md erweitert mit Mermaid-Diagramm
- [ ] docs/decisions.md mit ADRs erweitert

## Out of Scope

- Repository-Layer (M2-002)
- Service-Layer (M2-002)
- API-Endpunkte (M2-002 und folgende)
- Frontend (M2-003 und folgende)
- Snapshot-Erstellung und -Restore-Logik
- Cross-Day-Wünsche (z.B. "T nach N vermeiden")
- Recurring-Wünsche (z.B. "jeden Mittwoch frei")
- Schicht-Generierung beim Plan-Anlegen (M2-002)
- Rotation kopieren aus Vormonat (M2-002)
- Plan-Validierung gegen Bereichs-Sollbesetzung (M5)
- Solver-Integration (M8)

## Bekannte Stolperfallen

- **JSON in SQLite:** SQLAlchemy 2 hat einen JSON-Typ, der in SQLite
  als TEXT gespeichert wird. Funktioniert für unsere Zwecke, aber
  keine JSON-Pfade abfragbar in SQL.
- **Cross-Table-Constraints:** SQLite unterstützt keine FK-bezogenen
  CHECK-Constraints. Constraint "shift_date innerhalb plan-Zeitraum"
  also nicht in DB, sondern in Service.
- **Cross-Field-Validation für Wishes:** AVOID_DAY ohne shift_type_id,
  AVOID_SHIFT mit shift_type_id. Sauberste Lösung: Pydantic 
  model_validator. Im DB-Modell nur lockerer Constraint.
- **CASCADE und SQLAlchemy:** ondelete CASCADE in der DB plus
  cascade="all, delete-orphan" in der ORM-Beziehung. Beide müssen
  konsistent sein.
- **Datums-Bereiche bei Rotation-Assignments:** Mehrere Einträge für
  selben Doctor+Department+Plan sind OK (geteilte Rotation). Das
  System prüft im Solver später, nicht hier.
- **Pydantic Discriminator für Wishes:** Bei AVOID_SHIFT/REQUIRE_SHIFT
  ist shift_type_id Pflicht, bei AVOID_DAY verboten. Das mit 
  Pydantic-Discriminator zu modellieren ist möglich aber Overkill.
  Ein einfacher model_validator reicht.
- **Plan-Cascade:** Wenn Plan gelöscht wird, sollen Shifts, 
  RotationAssignments und PlanVersions kaskadiert weg. Aber NICHT
  Doctors, Departments, Absences (die sind plan-unabhängig).

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- Plan-Zeitraum kann jeden Datums-Range haben, typischerweise ein
  Monat. Keine harte Beschränkung.
- valid_to ist inklusiv (der letzte Tag des Plans).
- Geteilte Rotationen sind ein eigener Datensatz pro Doctor, kein
  share_pattern oder ähnliche Aufteilungs-Information. Das System
  zeigt nur "Doctor A und Doctor B sind beide auf SU vom 1. bis 30."
- Abwesenheiten sind plan-unabhängig in eigener Tabelle.
- Wünsche sind doctor-bezogen mit Datum, kein direkter plan_id-FK
  (sie gelten plan-übergreifend für den Tag).
- Tageszeit-Auflösung reicht (keine Sub-Tag-Granularität).
- WishType wird beim Solver später passend gewichtet, hier nur
  Datenmodell.
