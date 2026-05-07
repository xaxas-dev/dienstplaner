# Task M1-006: Datenmodell-Korrekturen

## Ziel
Drei Korrekturen am Datenmodell, abgeleitet aus weiteren Antworten
zur Anforderungsanalyse:

1. `Doctor.weiterbildungsjahr` darf beliebige positive Zahl sein
   (vorher 1-6 angenommen, real bis ca. 10)
2. `Doctor` bekommt zwei neue Felder: `entry_date` und `virtual_entry_date`
3. `Department.requires_full_time` neu (Boolean)
4. Neuer Schichttyp T1 (bereichsspezifisch INA, aber als globaler ShiftType
   modelliert)

Plus Frontend-Anpassungen, damit alle neuen Felder pflegbar sind.

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md.

M1 ist abgeschlossen. Diese Aufgabe macht Korrekturen, bevor M2
(Plan-Datenmodell) startet, damit nicht später durch alle Layer
durchgepatcht werden muss.

Hintergrund der Änderungen ist die Realität am UKSH Lübeck:
- Weiterbildungszeiträume können bis zu 10 Jahre dauern, nicht 6.
- Rotationszuteilung erfolgt nach virtuellem Eintrittsdatum, das
  basierend auf Anrechnungszeiten berechnet wird. Erste Version:
  manuelles Feld, später automatische Berechnung.
- Einzelne Rotationen erfordern zwingend Vollzeit-Mitarbeiter
  (aktuell nur CK = Curschmann Klinik, weitere können kommen).
- Schichttyp T1 (Tagdienst INA, 7:30-16:00, Mo-Fr) fehlt noch.

## Anforderungen

### 1. Datenmodell-Änderungen

#### Doctor (backend/app/models/doctor.py)

Bestehendes Feld anpassen:
- `weiterbildungsjahr` (Integer, nullable): Constraint 1-6 ENTFERNEN.
  Stattdessen: nur positive Werte erlauben (>= 1). Datenbank-Check
  nur auf >= 1, kein oberes Limit.

Neue Felder hinzufügen:
- `entry_date` (Date, nullable) - reales Eintrittsdatum
- `virtual_entry_date` (Date, nullable) - virtuelles Eintrittsdatum
  für Rotationspriorisierung

Beide nullable, weil sie für Externe nicht zwingend gepflegt werden.

#### Department (backend/app/models/department.py)

Neues Feld:
- `requires_full_time` (Boolean, default False) - Rotation erfordert
  zwingend Vollzeit-Beschäftigung

### 2. Pydantic-Schemas anpassen

Schemas erweitern:
- `DoctorBase`, `DoctorCreate`, `DoctorUpdate`, `DoctorResponse`,
  `DoctorWithRelations`: neue Felder ergänzen
- `DepartmentBase`, `DepartmentCreate`, `DepartmentUpdate`,
  `DepartmentResponse`: `requires_full_time` ergänzen

Zod-Validierung im Frontend (DoctorForm) erweitern:
- `weiterbildungsjahr`: positive Zahl, kein Maximum mehr
- `entry_date`, `virtual_entry_date`: optionale Datumsfelder

### 3. Alembic-Migration

Neue Migration `0002_doctor_dates_and_department_fulltime.py`:

Up:
- ALTER TABLE doctors ADD COLUMN entry_date DATE
- ALTER TABLE doctors ADD COLUMN virtual_entry_date DATE
- ALTER TABLE departments ADD COLUMN requires_full_time BOOLEAN NOT NULL DEFAULT 0
- Constraint von doctors.weiterbildungsjahr ändern: alten Check
  (1 <= wbj <= 6) entfernen, neuen Check (wbj >= 1) hinzufügen.

  Achtung SQLite: Constraints können in SQLite nicht einfach geändert
  werden. Workaround mit table-rebuild:
  - Neue Tabelle mit korrektem Constraint erstellen
  - Daten kopieren
  - Alte Tabelle droppen
  - Neue Tabelle umbenennen
  
  Alternativ kann die Migration den Constraint in der DB-Schicht
  weglassen (kein CHECK-Constraint mehr) und nur in Pydantic-Schema
  validieren. Das ist pragmatischer für SQLite.

Down:
- Spalten droppen, alten Constraint wiederherstellen

**Wichtig:** Die Migration muss auf einer bestehenden Datenbank mit
Daten laufen, ohne Verlust.

### 4. Service-Layer anpassen

#### doctor_service.py

`validate_doctor_data` aktualisieren:
- weiterbildungsjahr: keine obere Grenze mehr, nur >= 1 falls gesetzt
- entry_date <= virtual_entry_date wenn beide gesetzt:
  vorerst KEIN Check, weil das virtuelle Datum auch früher liegen kann
  (durch Anrechnungen vor Eintritt). Kommentar im Code.

### 5. Seed-Anpassung

#### scripts/seed_departments.py

Curschmann Klinik (CK) bekommt `requires_full_time = True`.
Restliche Bereiche behalten Default `False`.

Idempotenz: Wenn CK bereits in der DB ist, soll das Skript das Feld
korrigieren (Update bei vorhandenem Record), oder zumindest dokumentieren
warum nicht. Pragmatische Lösung: Update via SQL-Statement im Skript.

#### scripts/seed_shift_types.py erweitern

Neuer Schichttyp T1 hinzufügen:
- name: "Tagdienst INA" (oder "T1-Dienst", entscheide nach Konsistenz mit bestehenden Namen)
- short_name: "T1"
- applies_on_weekdays: True
- applies_on_weekend: False
- start_time: 07:30
- end_time: 16:00
- display_order: 4 (nach den drei bestehenden)
- active: True
- notes: "Tagdienst Interdisziplinäre Notaufnahme (Mo-Fr)"

T2 ist der bereits bestehende Tagdienst (umbenennen?). Drei Optionen:
- a) Bestehender "Tagdienst" bleibt unverändert, T1 kommt dazu.
- b) Bestehender "Tagdienst" wird zu "T2-Tagdienst" mit short_name="T2".

Empfehlung: **a)**. Der bestehende "Tagdienst" wird im Klinikalltag
sehr wahrscheinlich auch nur als "Tagdienst" oder "T" referenziert.
T2 ist eher der interne Name in der Excel. Konsistenz mit bestehenden
Daten.

Falls deine Frau widerspricht: dann b. Dokumentiere die Wahl in
docs/decisions.md.

### 6. Frontend-Anpassungen

#### 6a. Toast-Position korrigieren

In `src/main.tsx` (oder wo der Toaster eingebunden ist):

Der bisherige Toaster (sonner) erscheint oben rechts und verdeckt
dort liegende Action-Buttons (z.B. "Neuer Arzt", "Neuer Bereich").
Das blockiert den Workflow.

Anpassen auf:
- Position: `bottom-right` (Default-Empfehlung)
- closeButton aktivieren (X zum Quittieren)
- richDuration für Server-Fehler (5-7 Sekunden, bisher zu kurz)

Beispiel:
```tsx
<Toaster
  position="bottom-right"
  closeButton
  duration={5000}
  richColors
/>
```

`richColors` macht die Toasts farblich unterscheidbar (Erfolg grün,
Fehler rot, Warnung gelb). Das hilft Nutzern, den Status auf einen
Blick zu erfassen.

Bei Toast-Aufrufen die Standard-Dauer überschreiben, falls eine
Meldung länger sichtbar bleiben soll:
```tsx
toast.error("Speichern fehlgeschlagen", { duration: 7000 });
```

Damit ist der Default-Toast nicht mehr im Weg, und Nutzer können
ihn aktiv schließen.

#### 6b. DoctorForm.tsx (src/features/doctors/)

Neue Felder ergänzen:
- `entry_date`: Date-Input, optional
- `virtual_entry_date`: Date-Input, optional, mit Hilfetext
  "Berechnet sich aus Eintrittsdatum + Anrechnungszeiten. Manuell pflegen."

`weiterbildungsjahr`: Maximum entfernen. Hilfetext aktualisieren:
"Aktuelles Weiterbildungsjahr (1, 2, 3, ...). Kann auch >6 sein bei
verlängerten Weiterbildungen."

#### 6c. DoctorListPage.tsx

Spalte für Weiterbildungsjahr bleibt. Optional: Eintrittsdatum
mit anzeigen, falls Tabellen-Layout es zulässt. Nicht zwingend.

#### 6d. DepartmentFormDialog.tsx

Neues Feld:
- `requires_full_time`: Switch mit Label "Vollzeit erforderlich"
- Hilfetext: "Diese Rotation kann nur von Vollzeit-Mitarbeitern besetzt werden."

#### 6e. DepartmentListPage.tsx

Optional: neue Spalte oder Badge "Vollzeit" für Bereiche mit
`requires_full_time=true`. Nicht zwingend.

### 7. Tests

Neue oder erweiterte Tests:

**Backend:**
- `test_doctor_weiterbildungsjahr_above_6`: WBJ=8 wird akzeptiert
- `test_doctor_weiterbildungsjahr_zero_invalid`: WBJ=0 → 422
- `test_doctor_with_entry_dates`: beide Felder setzen, abrufen
- `test_department_requires_full_time`: Feld setzen, abrufen
- `test_seed_ck_has_requires_full_time`: nach Seed, CK hat Flag=true
- `test_seed_t1_present`: nach Seed, T1 existiert

**Frontend:**
- DoctorForm: WBJ=10 ist valide
- DoctorForm: WBJ=0 ist invalide
- DepartmentFormDialog: Switch für requires_full_time funktioniert

### 8. Dokumentation

`docs/data-model.md` aktualisieren:
- Neue Felder dokumentieren
- Hinweis zur virtual_entry_date Berechnung (manuell, später automatisch)
- Hinweis zur Vollzeit-Anforderung an Bereichen

`docs/decisions.md` ergänzen:
- Entscheidung: weiterbildungsjahr ohne oberes Limit, weil Realität
  bis 10 Jahre
- Entscheidung: virtual_entry_date manuell, später Automatisierung
- Entscheidung: T1 als globaler Schichttyp (nicht bereichsspezifisch
  modelliert), weil INA b) gewählt wurde

## Akzeptanzkriterien

- [ ] Toaster-Position auf bottom-right, mit closeButton und richColors
- [ ] Toasts verdecken keine Action-Buttons mehr
- [ ] Migration läuft fehlerfrei auf bestehender DB
- [ ] Migration up und down funktionieren
- [ ] Doctor-Felder (entry_date, virtual_entry_date) in Schema und API
- [ ] Department.requires_full_time in Schema und API
- [ ] weiterbildungsjahr akzeptiert Werte > 6
- [ ] Seed setzt CK auf requires_full_time=True (idempotent)
- [ ] Seed legt T1 als neuen Schichttyp an (idempotent)
- [ ] DoctorForm zeigt neue Felder, validiert korrekt
- [ ] DepartmentFormDialog zeigt neuen Switch
- [ ] Alle Tests grün (Backend + Frontend)
- [ ] ruff und type-check grün
- [ ] OpenAPI-Schema aktualisiert
- [ ] `pnpm generate-api` ausgeführt, Typen aktualisiert
- [ ] docs/data-model.md, docs/decisions.md aktualisiert

## Out of Scope

- Berechnungslogik für virtual_entry_date (kommt später)
- Validierung am Frontend, dass Vollzeit-Bereich nicht von
  Teilzeit-Arzt zugewiesen wird (kommt mit Plan-Modul/Validation in M5)
- INA als eigener Bereich (laut Klärung nicht nötig)
- T1-Eingrenzung auf bestimmte Bereiche im Solver (kommt mit M8)
- Automatische Anzeige aller Schichttypen mit Uhrzeiten in der UI
  (Stammdaten-Form reicht)
- Hinzufügen weiterer Schichttypen (z.B. Bereitschaftsdienst, Rufdienst).
  Wird klar in M2 oder bei Bedarf separat ergänzt.

## Bekannte Stolperfallen

- **SQLite Constraint-Änderung:** SQLite erlaubt kein einfaches
  ALTER TABLE für Constraints. Entweder Tabelle neu aufbauen oder
  CHECK-Constraint nur in Pydantic, nicht in DB-Schema. Pragmatische
  Empfehlung: Pydantic-Validierung reicht für lokale Single-User-App.
- **Bestehende Daten:** Nach Migration müssen alle bestehenden Doctor-
  und Department-Records weiter funktionieren. Defaults für neue
  Felder sind nullable bzw. False, das ist sauber.
- **Idempotente Seed-Updates:** Bei Department.requires_full_time
  ist es jetzt nicht mehr nur "insert wenn fehlt", sondern "korrigieren
  wenn falsch". Klar im Code dokumentieren, Test schreiben.
- **Form-State bei Edit:** Wenn ein bestehender Doctor ohne entry_date
  geöffnet wird, sollen die Felder leer sein, nicht "Invalid Date".
- **TypeScript-Typen:** Nach Backend-Änderung muss `pnpm generate-api`
  laufen. Die `DoctorWithRelations` und `DepartmentResponse` haben
  jetzt neue Felder. Frontend muss damit umgehen.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

Annahmen die OK sind:
- entry_date und virtual_entry_date können beide leer sein
- requires_full_time hat Default false
- T1 wird Bereich-unabhängig modelliert (Bereich-Eingrenzung kommt
  später als Constraint, nicht als Schema-Beziehung)
- Bestehender "Tagdienst" wird nicht umbenannt (Variante a, siehe oben)
