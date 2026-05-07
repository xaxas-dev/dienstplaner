# Task M1-007: Bereichserweiterung, Sollbesetzung und Weiterbildungsjahr-Berechnung

## Ziel
Vier zusammenhängende Korrekturen und Erweiterungen:

1. **Zwei neue externe Bereiche** in Stammdaten und Seeds aufnehmen
   (Intensiv (NCH), Intensiv extern)
2. **Sollbesetzung** je Bereich: min_headcount und max_headcount,
   beide nullable, mit Werten aus Excel-Auswertung als Seed
3. **Weiterbildungsjahr automatisch berechnen** aus entry_date statt
   manueller Eingabe
4. **UI-Bereinigung:** überflüssige Hilfetexte entfernen

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md.

M1-006 ist bereits durchgeführt. Diese Aufgabe baut darauf auf:
- entry_date und virtual_entry_date sind als Felder vorhanden
- weiterbildungsjahr ist als Integer-Feld vorhanden, wird aber nicht
  mehr manuell gepflegt
- Department.requires_full_time existiert

Hintergrund:
- Die Klinik hat zwei weitere externe Rotationen (Intensiv Neurochirurgie
  und Intensiv extern), die in den ersten Excel-Auswertungen nicht
  vollständig erfasst waren
- Sollbesetzung soll min/max abbilden (kein Zielwert), alle Werte im
  Bereich sind akzeptabel
- WBJ-Berechnung soll automatisch aus entry_date erfolgen, manuelle
  Pflege ist überflüssig

## Anforderungen

### 1. Datenmodell-Änderungen

#### Department (backend/app/models/department.py)

Zwei neue Felder:
- `min_headcount` (Integer, nullable) - Mindestbesetzung
- `max_headcount` (Integer, nullable) - Maximalbesetzung

Beide nullable, weil nicht für jeden Bereich definierbar (z.B. CK).

#### Doctor (backend/app/models/doctor.py)

`weiterbildungsjahr` als gespeichertes Feld **entfernen**.
Stattdessen als computed property in der API-Response zurückgeben.

Berechnungsregel:
- Wenn `is_facharzt = True`: weiterbildungsjahr = null
- Wenn `entry_date = null`: weiterbildungsjahr = null
- Sonst: `weiterbildungsjahr = floor((heute - entry_date).days / 365.25) + 1`

Beispiele:
- entry_date=2024-05-01, heute=2026-05-07 → 2 Jahre → WBJ=3
- entry_date=2026-05-07, heute=2026-05-07 → 0 Jahre → WBJ=1
- entry_date=2025-12-31, heute=2026-05-07 → ~0.35 Jahre → WBJ=1

Implementierung:
- Im SQLAlchemy-Modell: keine Spalte mehr für weiterbildungsjahr
- Im Pydantic-DoctorResponse-Schema: `weiterbildungsjahr` als 
  `computed_field` oder als Property, das beim Serialisieren berechnet wird
- Heutiges Datum: `date.today()` aus `datetime` (UTC reicht hier, kein
  Zeitzonen-Problem)

### 2. Alembic-Migration

Neue Migration `0003_department_headcount_and_remove_wbj.py`:

Up:
- ALTER TABLE departments ADD COLUMN min_headcount INTEGER
- ALTER TABLE departments ADD COLUMN max_headcount INTEGER
- ALTER TABLE doctors DROP COLUMN weiterbildungsjahr

Achtung: SQLite unterstützte DROP COLUMN erst ab Version 3.35 nativ.
Falls das Probleme macht, Workaround mit Tabellen-Rebuild.

Down:
- min_headcount, max_headcount droppen
- weiterbildungsjahr-Spalte wiederherstellen (Integer, nullable)

### 3. Schemas anpassen

#### Department-Schemas

In allen Department-Schemas (Base, Create, Update, Response):
- `min_headcount: int | None = None`
- `max_headcount: int | None = None`

#### Doctor-Schemas

- `DoctorBase`, `DoctorCreate`, `DoctorUpdate`: weiterbildungsjahr-Feld
  ENTFERNEN
- `DoctorResponse`, `DoctorWithRelations`: weiterbildungsjahr als
  `computed_field` ergänzen

Pydantic v2 Beispiel:
```python
from pydantic import computed_field
from datetime import date

class DoctorResponse(BaseModel):
    # ... andere Felder ...
    entry_date: date | None
    is_facharzt: bool
    
    @computed_field
    @property
    def weiterbildungsjahr(self) -> int | None:
        if self.is_facharzt or self.entry_date is None:
            return None
        delta_days = (date.today() - self.entry_date).days
        if delta_days < 0:
            return None  # Eintritt liegt in der Zukunft
        return int(delta_days / 365.25) + 1
```

Anmerkung: computed_field zeigt das Feld in OpenAPI an, sodass der
Frontend-Typ automatisch korrekt ist.

### 4. Service-Layer

#### department_service.py

In `validate_department_data` ergänzen:
- Wenn min_headcount und max_headcount beide gesetzt sind:
  min_headcount <= max_headcount, sonst DepartmentValidationError
- min_headcount >= 0
- max_headcount >= 0
- max_headcount = 0 ist erlaubt (Bereich darf geschlossen sein)

#### doctor_service.py

`validate_doctor_data` aktualisieren:
- weiterbildungsjahr-Validierung **entfernen** (Feld existiert nicht mehr)
- restliche Validierungen bleiben

### 5. Seed-Skripte

#### scripts/seed_departments.py

**Schritt 1:** Zwei neue Bereiche hinzufügen (idempotent):

```
22. Intensiv (NCH)         → is_external=True, is_shift_relevant=False, display_order=22
23. Intensiv extern        → is_external=True, is_shift_relevant=False, display_order=23
```

**Schritt 2:** min/max-Werte für alle Bereiche setzen (idempotent):

| Bereich | min | max |
|---|---|---|
| 511/LBEST | 1 | 1 |
| 511 | 2 | 3 |
| ITS | 2 | 3 |
| SU-Stationsarzt | 1 | 1 |
| SU | 6 | 8 |
| Duplex | 1 | 1 |
| Poli | 1 | 1 |
| Poli/EMG | 1 | 1 |
| EMG | 1 | 1 |
| Springer | 2 | 2 |
| Parkinson Komplextherapie | 1 | 1 |
| Tagesklinik | 1 | 1 |
| Neuromotorik-TK | 1 | 1 |
| Poli/Botox/THS | 1 | 1 |
| Poli/Botox | 1 | 1 |
| MS-Sprechstunde/Konsile | 1 | 1 |
| Forschung | 4 | 5 |
| Curschmann Klinik | null | null |
| Intensiv Innere | 1 | 1 |
| Psychiatrie | 2 | 4 |
| ZIP | 0 | 1 |
| Intensiv (NCH) | 1 | 1 |
| Intensiv extern | 1 | 1 |

**Idempotenz-Regel:**
- Wenn ein Bereich bereits min_headcount oder max_headcount gesetzt hat
  (nicht null), soll das Seed-Skript die Werte NICHT überschreiben
  (manuelle Pflege respektieren)
- Nur wenn beide Werte null sind, wird der Default aus der Tabelle gesetzt
- Konsole-Output: "Bereich X: min/max gesetzt" oder "Bereich X: min/max
  bereits gepflegt, übersprungen"

### 6. Frontend-Anpassungen

#### DepartmentFormDialog.tsx

Zwei neue Number-Input Felder:
- "Mindestbesetzung" (min_headcount)
- "Maximalbesetzung" (max_headcount)

Validierung mit Zod:
- Beide nullable (optional)
- Wenn beide gesetzt: min <= max
- Beide >= 0

UI-Hinweis (klein, unter den Feldern): "Lassen Sie die Felder leer,
wenn die Besetzung nicht definierbar ist."

#### DepartmentListPage.tsx

Neue Spalte "Besetzung":
- Format: "min - max" wenn beide gesetzt (z.B. "6 - 8")
- Format: "min" wenn nur min gesetzt (z.B. "≥ 2")
- Format: "max" wenn nur max gesetzt (z.B. "≤ 5")
- Format: "—" wenn beide null

Spalte zwischen "Dienst-relevant" und "Aktiv" einfügen.

#### DoctorForm.tsx

- weiterbildungsjahr-Feld **entfernen**. Es wird nicht mehr eingegeben.
- Hilfetext zum Weiterbildungsjahr entfernen
- Hilfetext zum virtuellen Eintrittsdatum entfernen
- entry_date bleibt mit Label "Eintrittsdatum"
- virtual_entry_date bleibt mit Label "Virtuelles Eintrittsdatum"

#### DoctorListPage.tsx

In der WBJ-Spalte (falls vorhanden): zeigt jetzt den computed-Wert
aus der API. Read-only.

#### DoctorDetailPage.tsx

Im Stammdaten-Bereich das berechnete WBJ anzeigen (read-only):
- Format: "3. Weiterbildungsjahr" oder "—" wenn null
- Bei Fachärzten: "—"

### 7. Tests

#### Backend

- `test_department_min_max_headcount`: Werte setzen, abrufen
- `test_department_min_greater_than_max`: 422
- `test_department_negative_min`: 422
- `test_department_zero_max_allowed`: max=0, erlaubt
- `test_seed_two_new_departments`: nach Seed sind 23 Bereiche da
- `test_seed_min_max_values`: nach Seed sind die Tabellenwerte gesetzt
- `test_seed_min_max_idempotent`: zweiter Aufruf überschreibt keine
  manuell gepflegten Werte
- `test_doctor_weiterbildungsjahr_computed_facharzt`: facharzt → null
- `test_doctor_weiterbildungsjahr_computed_no_entry_date`: ohne
  entry_date → null
- `test_doctor_weiterbildungsjahr_computed_normal`: entry_date 2 Jahre
  zurück → 3
- `test_doctor_weiterbildungsjahr_computed_future`: entry_date in der
  Zukunft → null

#### Frontend

- DepartmentFormDialog: min > max → Fehler
- DepartmentFormDialog: nur min gesetzt → OK
- DoctorForm: kein WBJ-Feld mehr sichtbar

### 8. Dokumentation

`docs/data-model.md` aktualisieren:
- Department: min/max_headcount erklären
- Doctor: weiterbildungsjahr als computed Feld dokumentieren
- Hinweis: max_headcount=null bedeutet "unbegrenzt", nicht "nicht
  besetzbar". 0 bedeutet "nicht besetzbar".

`docs/decisions.md` ergänzen:
- Sollbesetzung mit min/max statt target, weil flexibler
- Werte aus Excel-Stichprobe als Defaults, manuell anpassbar
- WBJ als computed property statt gespeichertes Feld, weil leicht
  veraltet bei manueller Pflege

## Akzeptanzkriterien

- [ ] Migration läuft fehlerfrei auf bestehender DB
- [ ] Migration up und down funktionieren
- [ ] 23 Bereiche nach Seed (statt 21)
- [ ] min/max-Werte korrekt im Seed gesetzt
- [ ] Idempotenz: zweiter Seed-Aufruf überschreibt nichts
- [ ] WBJ wird bei jedem GET korrekt berechnet (nicht aus DB gelesen)
- [ ] WBJ-Eingabefeld im DoctorForm verschwunden
- [ ] DepartmentFormDialog zeigt min/max-Felder
- [ ] DepartmentListPage zeigt Besetzungs-Spalte
- [ ] Hilfetexte zu WBJ und virtuellem Eintrittsdatum entfernt
- [ ] DoctorDetailPage zeigt WBJ korrekt als computed Wert
- [ ] Validierung min > max liefert sinnvolle Fehlermeldung
- [ ] Tests grün (Backend + Frontend)
- [ ] ruff und type-check grün
- [ ] OpenAPI-Schema aktualisiert
- [ ] `pnpm generate-api` ausgeführt, Typen aktualisiert
- [ ] docs/data-model.md, docs/decisions.md aktualisiert

## Out of Scope

- Live-Counter "X/Y Stellen besetzt" im Plan-Editor (kommt mit M3)
- Solver-Constraint für min/max-Besetzung (kommt mit M8)
- Validierung in der UI, dass Bereiche bei aktueller Plan-Lage min
  unterschreiten (kommt mit M5)
- Automatische Anpassung der min/max bei Saisonalität
- Historie der min/max-Änderungen
- Suchfilter "Bereiche unter Mindestbesetzung"
- Visualisierung der zeitlichen Schwankung der Sollbesetzung
- Tippfehler-Aliase (Polli vs Poli)
- Berechnung des virtuellen Eintrittsdatums (bleibt manuell)

## Bekannte Stolperfallen

- **DROP COLUMN in SQLite:** SQLite ab 3.35 unterstützt DROP COLUMN,
  ältere Versionen brauchen Tabellen-Rebuild. Wenn alembic Probleme
  hat: explizit Batch-Mode für SQLite verwenden:
  ```python
  with op.batch_alter_table('doctors') as batch_op:
      batch_op.drop_column('weiterbildungsjahr')
  ```
- **computed_field in Pydantic v2:** muss zusätzlich zu `@property`
  mit `@computed_field` dekoriert werden, sonst nicht in OpenAPI.
- **Datum aktuelles vs Eintritt:** date.today() reicht. Keine UTC/Local
  Zeitzonen-Probleme bei Datums-Vergleich.
- **Future-entry_date:** Wenn jemand bei Anlage ein zukünftiges 
  Eintrittsdatum setzt (z.B. neuer Mitarbeiter), darf WBJ nicht negativ
  werden. Im computed property auf null setzen.
- **Idempotente Update-Logik:** Beim Seed nicht blind UPDATE machen,
  sondern erst prüfen ob Werte null sind. Sonst zerstören manuelle
  Pflegeaktionen ihre Daten beim nächsten Seed-Aufruf.
- **Migration-Reihenfolge:** Zuerst neue Spalten hinzufügen, dann
  weiterbildungsjahr droppen. Nicht umgekehrt.
- **Frontend Zod-Schema:** wenn weiterbildungsjahr aus DoctorCreate
  und DoctorUpdate weg ist, müssen die alten Form-Definitionen
  bereinigt werden, sonst läuft die TypeScript-Validierung schief.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- WBJ-Berechnung mit 365.25 Tagen pro Jahr (Schaltjahre durchschnittlich)
- Alle 23 Bereiche aktiv (active=true) nach Seed
- Hilfetexte komplett entfernt, nicht nur ausgeblendet
- min_headcount=0 ist gültig und bedeutet "kann auch leer bleiben"
- max_headcount=null bedeutet "keine Obergrenze"
