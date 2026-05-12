# Task M2-002b: INA-Verfügbarkeitsmodell

## Ziel
Modellierung der Verfügbarkeit von Ärzten für INA-Dienste 
(V/T/N-Schichten). Drei Quellen schließen Ärzte aus:
1. Aktive Rotation in einem blockierenden Bereich (z.B. SU)
2. Manuelle Ausschluss-Einträge (Schwangerschaft, Einarbeitung, etc.)
3. Bestehende Abwesenheiten

Plus eine Service-Funktion, die für einen Arzt zu einem Datum 
beantwortet: "Verfügbar oder nicht? Warum?"

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md, docs/decisions.md.

Hintergrund (vom Planungsworkflow am UKSH):
- Der Besetzungsplan legt fest, welcher Arzt welchen Bereich rotiert
  und wer Nachtdienstwochen macht
- Daraus ergibt sich der **Pool** für INA-Dienste (V/T/N)
- Bestimmte Bereiche schließen Ärzte aus dem Pool aus
- CK ist ein Sonderfall: nur werktags ausgeschlossen, am Wochenende
  steht der Arzt für INA-Tagdienste/Nachtdienste zur Verfügung
- Schwangere Ärztinnen dürfen weiterhin Stationsarbeit machen, aber
  keine INA-Dienste (Mutterschutzgesetz, Risikoreduzierung)
- Einarbeitung (EA) ist bereichsspezifisch und blockiert ebenfalls

Diese Aufgabe modelliert das Datenmodell und stellt die Logik bereit.
Die eigentliche Anwendung (Filter im Plan-Editor, Solver-Constraints)
kommt mit M3 und M5.

## Anforderungen

### 1. Datenmodell-Erweiterungen

#### Department (bestehende Tabelle erweitern)

Zwei neue Felder:
- `blocks_ina_weekdays` (Boolean, default False) - Bereich blockiert
  INA-Verfügbarkeit Mo-Fr
- `blocks_ina_weekends` (Boolean, default False) - Bereich blockiert
  INA-Verfügbarkeit Sa/So

#### RotationAssignment (bestehende Tabelle erweitern)

Ein neues Feld:
- `is_einarbeitung` (Boolean, default False) - diese Rotation ist
  eine Einarbeitungsphase

Anmerkung: Einarbeitung könnte den Arzt automatisch ausschließen,
auch wenn das Department selbst blocks_ina_weekdays=False hat.
Implementierung: in `get_ina_availability` als zusätzliche Quelle
prüfen.

#### INAExclusion (neue Tabelle)

```python
class INAExclusionReason(StrEnum):
    SCHWANGERSCHAFT = "SCHWANGERSCHAFT"
    EINARBEITUNG = "EINARBEITUNG"
    SONSTIGES = "SONSTIGES"

class INAExclusion(Base):
    id: int
    doctor_id: FK doctors.id (CASCADE)
    valid_from: Date (not null)
    valid_to: Date (nullable) - null = unbefristet
    reason: Enum INAExclusionReason
    notes: Text (nullable)
    created_at, updated_at
```

Constraints:
- valid_from <= valid_to (falls valid_to gesetzt)

### 2. Alembic-Migration

`0005_ina_availability_model.py`:

Up:
- ALTER TABLE departments ADD COLUMN blocks_ina_weekdays BOOLEAN NOT NULL DEFAULT 0
- ALTER TABLE departments ADD COLUMN blocks_ina_weekends BOOLEAN NOT NULL DEFAULT 0
- ALTER TABLE rotation_assignments ADD COLUMN is_einarbeitung BOOLEAN NOT NULL DEFAULT 0
- CREATE TABLE ina_exclusions ...
- Index auf ina_exclusions.doctor_id

Down: alle Änderungen rückgängig.

### 3. Pydantic-Schemas

#### Department-Schemas erweitern

In allen Department-Schemas (Base, Create, Update, Response):
- `blocks_ina_weekdays: bool = False`
- `blocks_ina_weekends: bool = False`

#### RotationAssignment-Schemas erweitern

- `is_einarbeitung: bool = False` in Base, Create, Update, Response

#### INAExclusion-Schemas (neu)

- INAExclusionBase, INAExclusionCreate, INAExclusionUpdate, INAExclusionResponse
- Standard-Pattern wie andere Entitäten

### 4. Repository-Layer

#### ina_exclusion_repository.py (neu)

- `list_exclusions_for_doctor(db, doctor_id) -> list[INAExclusion]`
  - Sortierung: valid_from absteigend
- `list_active_exclusions_at(db, doctor_id, target_date) -> list[INAExclusion]`
  - Filter: valid_from <= target_date AND (valid_to is null OR valid_to >= target_date)
- `get_exclusion(db, exclusion_id) -> INAExclusion | None`
- `create_exclusion(db, doctor_id, data) -> INAExclusion`
- `update_exclusion(db, exclusion_id, data) -> INAExclusion | None`
- `delete_exclusion(db, exclusion_id) -> bool`

### 5. Service-Layer

#### ina_availability_service.py (neu)

##### Datentyp INAAvailability

```python
@dataclass
class INAAvailability:
    available: bool
    reasons: list[str]
```

##### get_ina_availability(db, doctor_id, target_date) -> INAAvailability

Prüft ob ein Arzt am Datum für INA-Dienste verfügbar ist.

Logik:
1. Bestimme `is_weekend = target_date.weekday() >= 5`
2. Sammle reasons (Liste leerer Strings)
3. **Aktive Rotationen** am Datum prüfen:
   - Lade RotationAssignments mit valid_from <= target_date <= valid_to
   - Pro Rotation: lade Department
     - Wenn `is_weekend` und department.blocks_ina_weekends=True: 
       reason hinzufügen "Rotation auf {department.name}"
     - Wenn nicht weekend und department.blocks_ina_weekdays=True:
       reason hinzufügen
     - Wenn rotation.is_einarbeitung=True (unabhängig vom Department):
       reason "Einarbeitung in {department.name}"
4. **INAExclusions** am Datum prüfen:
   - Lade aktive Exclusions
   - Pro Exclusion: reason hinzufügen je nach reason-Enum
     - SCHWANGERSCHAFT: "Schwangerschaft"
     - EINARBEITUNG: "Einarbeitung"
     - SONSTIGES: notes oder "Manuell ausgeschlossen"
5. **Abwesenheiten** am Datum prüfen:
   - Lade aktive Absences
   - Pro Absence: reason hinzufügen "Abwesenheit: {absence_type}"
6. Wenn reasons leer: available=True, sonst available=False

##### get_ina_availability_for_period(db, doctor_id, start_date, end_date) -> dict[date, INAAvailability]

Hilfsfunktion: für jeden Tag im Zeitraum die Verfügbarkeit prüfen.
Wird von der Plan-UI aufgerufen, um pro Schicht zu zeigen wer verfügbar ist.

Sollte effizient sein: einmal Stammdaten laden, nicht pro Tag. 
Optimierung: Rotationen, Exclusions und Absences einmal pro Doctor 
für den Zeitraum laden, dann pro Tag durchlaufen.

#### ina_exclusion_service.py (neu)

- `validate_exclusion_data(data) -> None`
  - valid_from <= valid_to (wenn beide gesetzt)
  - Reason gültig
- `create_exclusion_with_validation(db, doctor_id, data) -> INAExclusion`
- `update_exclusion_with_validation(db, exclusion_id, data) -> INAExclusion`

#### exceptions.py erweitern

- INAExclusionNotFoundError → 404
- INAExclusionValidationError → 422

### 6. API-Endpunkte

#### ina_exclusions.py (neu)

Prefix: `/api/doctors/{doctor_id}/ina-exclusions` für Liste/Create
Plus: `/api/ina-exclusions/{exclusion_id}` für Update/Delete

- `GET /api/doctors/{doctor_id}/ina-exclusions` → list[INAExclusionResponse]
- `POST /api/doctors/{doctor_id}/ina-exclusions` → 201
- `PATCH /api/ina-exclusions/{exclusion_id}` → INAExclusionResponse
- `DELETE /api/ina-exclusions/{exclusion_id}` → 204

#### Verfügbarkeits-Endpunkt

- `GET /api/doctors/{doctor_id}/ina-availability?date=YYYY-MM-DD` → INAAvailabilityResponse
  - Optional Query-Parameter: from + to → list[INAAvailabilityResponse] mit date

Format der Antwort:
```json
{
  "date": "2026-05-15",
  "available": false,
  "reasons": ["Rotation auf SU"]
}
```

### 7. Seed-Erweiterung

`scripts/seed_departments.py` erweitern, idempotent:

| Bereich | blocks_weekdays | blocks_weekends |
|---|---|---|
| 511/LBEST | False | False |
| 511 | False | False |
| ITS | False | False |
| SU-Stationsarzt | True | True |
| SU | True | True |
| Duplex | False | False |
| Poli | False | False |
| Poli/EMG | False | False |
| EMG | False | False |
| Springer | False | False |
| Parkinson Komplextherapie | False | False |
| Tagesklinik | False | False |
| Neuromotorik-TK | False | False |
| Poli/Botox/THS | False | False |
| Poli/Botox | False | False |
| MS-Sprechstunde/Konsile | False | False |
| Forschung | False | False |
| Curschmann Klinik (CK) | **True** | **False** |
| Intensiv Innere | True | True |
| Psychiatrie | True | True |
| ZIP | True | True |
| Intensiv (NCH) | True | True |
| Intensiv extern | True | True |

**Idempotenz:** Wenn ein Bereich schon einen Wert ungleich Default hat
(d.h. blocks_ina_weekdays=True oder blocks_ina_weekends=True), werte
nicht überschreiben. Manuell gesetzte Werte respektieren.

Allerdings: bei einem brandneuen Department-Datenbestand sind alle 
Defaults False. Dann setzen die Werte aus der Tabelle. Pragmatischer
Ansatz: setzen, wenn beide Felder False sind. Sonst überspringen.

### 8. Frontend-Anpassungen

#### DepartmentFormDialog.tsx

Zwei neue Switches mit klaren Labels:
- "INA-Dienste (Werktag) blockiert" - blocks_ina_weekdays
- "INA-Dienste (Wochenende) blockiert" - blocks_ina_weekends

Hilfetext darunter (klein):
"Wenn aktiviert: Ärzte auf dieser Rotation können in dem entsprechenden
Zeitraum keine V/T/N-Dienste übernehmen."

#### DepartmentListPage.tsx

Optional: zusätzliche Spalten oder Kombi-Anzeige in bestehender 
"Dienst-relevant"-Spalte. Pragmatisch: zwei Badges "WT blockiert" /
"WE blockiert" wenn jeweils True. Falls Tabellenbreite zu eng wird:
nicht zwingend, kann auch nur im Detail-Dialog sichtbar sein.

#### DoctorDetailPage.tsx

Neuer Bereich "INA-Ausschlüsse" zwischen "Beschäftigungszeiträume" 
und "Qualifikationen":
- Liste vorhandener Ausschlüsse, sortiert nach valid_from absteigend
- Spalten: Zeitraum (von - bis oder "ab ... unbefristet"), Grund, Notizen, Aktionen
- Button "Neuer Ausschluss" öffnet Dialog
- Aktionen: Bearbeiten (Dialog), Löschen (Bestätigung)

Empty-State: "Keine INA-Ausschlüsse hinterlegt."

#### INAExclusionFormDialog.tsx (neue Komponente)

Felder:
- valid_from (Date, Pflicht)
- valid_to (Date, optional, "leer = unbefristet")
- reason (Select: Schwangerschaft / Einarbeitung / Sonstiges)
- notes (Textarea, optional)

Validierung mit Zod analog zu EmploymentPeriodFormDialog.

#### Neuer Hook: useINAExclusions(doctorId)

In `src/features/doctors/`:
```
useINAExclusions(doctorId)
useCreateINAExclusion
useUpdateINAExclusion
useDeleteINAExclusion
```

### 9. Tests

#### Backend Unit-Tests (test_ina_availability_service.py)

Mindestens:
- `test_available_no_blockers`: Doctor ohne Rotation/Exclusion/Absence → verfügbar
- `test_blocked_by_su_weekday`: Rotation auf SU am Werktag → blockiert
- `test_blocked_by_su_weekend`: Rotation auf SU am Wochenende → blockiert
- `test_ck_blocked_weekday`: Rotation auf CK am Mo-Fr → blockiert
- `test_ck_available_weekend`: Rotation auf CK am Sa/So → verfügbar
- `test_blocked_by_einarbeitung`: Rotation mit is_einarbeitung=True → blockiert
- `test_blocked_by_pregnancy_exclusion`: aktive INAExclusion 
  SCHWANGERSCHAFT → blockiert
- `test_blocked_by_absence`: aktive Abwesenheit → blockiert
- `test_multiple_reasons`: mehrere blockierende Quellen → alle in 
  reasons enthalten
- `test_exclusion_unbefristet`: valid_to=null, target_date in der 
  Zukunft → noch immer aktiv

#### Backend Integration-Tests (test_ina_exclusions_api.py)

- CRUD mit Doctor-Bezug
- Validierung valid_from > valid_to → 422
- DELETE 204
- 404 wenn Doctor oder Exclusion nicht existiert

#### Backend Test (test_seed_blocks_correct_values)

Nach Seed: SU hat beide True, CK hat WT=True/WE=False, normale Bereiche
beide False.

#### Frontend-Tests

- INAExclusionFormDialog: Validierung valid_from > valid_to
- INAExclusionFormDialog: reason ist Pflicht

### 10. Dokumentation

`docs/data-model.md` erweitern:
- INA-Verfügbarkeits-Modell erklären
- Drei Quellen (Rotation, Exclusion, Absence) dokumentieren
- CK als Sonderfall hervorheben

`docs/decisions.md` ergänzen:
- ADR: INA-Verfügbarkeit aus drei Quellen, Service-Funktion zentral
- ADR: blocks_ina_weekdays/weekends getrennt, weil Werktag/Wochenende 
  unterschiedlich behandelt werden müssen (CK)
- ADR: Schwangerschaft als INAExclusion, kein eigener Doctor-Status
  (zeitabhängig + neben anderen Gründen)

## Akzeptanzkriterien

- [ ] Migration läuft up und down
- [ ] Seed setzt korrekte blocks-Werte für SU, CK, externe Bereiche
- [ ] INAExclusion CRUD funktioniert per API
- [ ] get_ina_availability liefert korrekte Ergebnisse für alle 
      Test-Szenarien
- [ ] CK-Sonderfall korrekt: WT blockiert, WE verfügbar
- [ ] DepartmentFormDialog zeigt zwei neue Switches
- [ ] DoctorDetailPage hat neuen INA-Ausschlüsse-Bereich
- [ ] Backend-Tests grün
- [ ] Frontend-Tests grün
- [ ] ruff und type-check grün
- [ ] OpenAPI vollständig
- [ ] `pnpm generate-api` ausgeführt

## Out of Scope

- Anwendung der Verfügbarkeit im Plan-Editor (kommt mit M3)
- Solver-Constraint für Verfügbarkeit (kommt mit M8)
- Validierung beim Schicht-Zuweisen, dass Arzt verfügbar ist 
  (kommt mit M3 oder M5)
- Übersicht "wer ist diesen Monat überhaupt verfügbar" als eigener 
  Report (M10 oder Plan-Editor-Feature)
- Verlauf der Schwangerschaft (Trimester etc.) - nur Zeitraum
- Automatischer Übergang Schwangerschaft → Mutterschutz → Elternzeit
- E-Mail-Benachrichtigung bei Schwangerschafts-Eintragung

## Bekannte Stolperfallen

- **valid_to nullable bedeutet unbefristet:** korrekt vergleichen, 
  z.B. mit `coalesce(valid_to, '9999-12-31')` oder Python-Logik
- **Department-Update mit blocks-Feldern:** wenn neuer Wert gesetzt, 
  validieren dass die Felder korrekt sind. Sonst läuft die Migration
  durch, aber Service liefert falsche Ergebnisse.
- **Rotation und Einarbeitung:** is_einarbeitung am RotationAssignment
  ist eigenes Feld. Auch wenn Department selbst nicht blockiert (z.B.
  EMG), blockiert Einarbeitung den Arzt.
- **Performance bei get_ina_availability_for_period:** N+1 Queries
  vermeiden. Einmal Daten laden, dann iterieren.
- **target_date ist Datum, nicht datetime:** Vergleich mit valid_from/
  valid_to ohne Zeitanteil.
- **Idempotenz bei Department-Seed:** zweiter Seed-Lauf darf 
  manuell gepflegte Werte nicht zurücksetzen. Pragmatische Regel: 
  nur setzen wenn beide Felder False sind.
- **Reason-Mapping in Service:** Strings für UI sollen deutsch sein, 
  Enum bleibt englisch in der DB.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- Externe Bereiche (Intensiv Innere, NCH, Psychiatrie, ZIP) blockieren
  pauschal beide (WT und WE)
- INAExclusion ist immer arzt-bezogen, nie plan-bezogen
- get_ina_availability gibt nur das Verdikt für das übergebene Datum, 
  nicht für angrenzende Tage
- Reasons sind deutsche Strings für UI-Anzeige, kein i18n-Key
- Abwesenheiten zählen pauschal als Blocker, unabhängig vom Typ
  (Urlaub, Krankheit, Mutterschutz blockieren alle gleich)
