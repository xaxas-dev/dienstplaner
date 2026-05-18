# Task M2-004: Manuelle Schicht-Zuweisung (Backend)

## Ziel
Backend-Endpunkt zum Setzen einer Schicht-Zuweisung. Ein PATCH auf 
eine einzelne Shift kann `doctor_id`, `is_pinned` und `notes` 
verändern. Damit kann der User Schichten manuell zuweisen, lange 
bevor der Solver verfügbar ist. Das ermöglicht ein funktionierendes 
Plan-Frontend (M2-003) mit echten Daten statt Mock.

**Weiche Validierung:** Datenkonsistenz wird hart geprüft (Shift 
existiert, Doctor existiert und ist aktiv). Semantische Constraints 
(INA-Verfügbarkeit, Qualifikationen, Doppelzuweisungen) werden 
**nicht** geprüft. Konflikte werden später durch eine eigene 
Konflikt-Engine (M2-005) als Read-Only-Information zurückgegeben 
und im Frontend markiert. Begründung: medizinischer Dienstplan-
Alltag erfordert legitime Ausnahmen (Notfall-Vertretung), die ein 
hartes Validierungsmodell blockieren würde.

## Kontext
Lies vor Beginn in dieser Reihenfolge:
1. `CLAUDE.md`
2. `docs/data-model.md` (Plan-Entitäten ab M2, besonders Shift mit 
   nullable `doctor_id`, `is_pinned`, Cascade-Verhalten)
3. `docs/decisions.md`
4. `tasks/done/M2-001-plan-datenmodell.md` (Modell-Anlage)
5. `tasks/done/M2-002-plan-anlage-backend.md` (bestehender Backend-
   Stack, besonders shift_repository und Schemas)
6. `tasks/done/M2-002b-ina-verfuegbarkeit.md` (INA-Verfügbarkeits-
   service - wird hier NICHT verwendet, ist Kontext)
7. `backend/app/models/shift.py` (Shift-Modell)
8. `backend/app/repositories/shift_repository.py` (bestehende 
   Repository-Funktionen aus M2-002)
9. `backend/app/services/` (bestehende Service-Layer-Pattern)
10. `backend/app/schemas/shift.py` (bestehende Schemas: ShiftBase, 
    ShiftWithDetails)
11. `backend/app/api/error_handlers.py` (ShiftNotFoundError ist 
    bereits angelegt "für später")

## Entscheidungen für M2-004

Vor Schreiben des Briefings festgelegt:
- **Konflikt-Erkennung:** kommt als eigene Aufgabe M2-005 vor 
  M2-003b PlanGrid. Hier nicht enthalten.
- **Validierungs-Strategie:** weich. Nur Datenkonsistenz wird 
  blockierend geprüft. Verfügbarkeit, Qualifikation, Doppelbuchung 
  sind Konflikte, keine Fehler.
- **Endpunkt-Umfang:** nur `PATCH /api/shifts/{shift_id}`. Kein 
  Bulk, kein Clear-All. YAGNI bis Frontend zeigt, was gebraucht wird.

## Anforderungen

### Sub-Schritt 1: Schema ShiftUpdate

**1.1 Neues Schema in `backend/app/schemas/shift.py`**

```python
class ShiftUpdate(BaseModel):
    doctor_id: int | None = None
    is_pinned: bool | None = None
    notes: str | None = None
    
    model_config = ConfigDict(extra='forbid')
```

**Wichtig:** Alle Felder sind optional (Default `None`). Im Service 
muss `model_dump(exclude_unset=True)` verwendet werden, um zwischen 
"nicht gesetzt" und "explizit auf None gesetzt" zu unterscheiden. 
Ein expliziter Wert `doctor_id=None` im Request-Body bedeutet 
"clear assignment", ein fehlendes Feld bedeutet "unverändert lassen".

Klar im Docstring oder Kommentar dokumentieren, weil das eine 
häufige Fehlerquelle ist.

**1.2 ShiftWithDetails unverändert**

Das bestehende `ShiftWithDetails`-Schema aus M2-002 wird als 
Response-Typ wiederverwendet. Keine Änderung nötig.

**1.3 Akzeptanzkriterien für Sub-Schritt 1**

- [ ] `ShiftUpdate` in `backend/app/schemas/shift.py` definiert
- [ ] Alle drei Felder optional, mit klarer Semantik (gesetzt vs. 
      nicht gesetzt)
- [ ] Docstring oder Kommentar erklärt die exclude_unset-Logik
- [ ] `extra='forbid'` verhindert Tippfehler-Felder
- [ ] Schema-Test: ShiftUpdate akzeptiert leeres Dict, einzelne 
      Felder, alle Felder

**Stop-Gate nach Sub-Schritt 1:**
- Commit: `feat: M2-004/1 shift update schema`
- Warten auf Review

### Sub-Schritt 2: Repository erweitern

**2.1 Neue Funktionen in `backend/app/repositories/shift_repository.py`**

```python
def get_shift(db: Session, shift_id: int) -> Shift | None:
    """Holt eine einzelne Shift mit eager-loaded shift_type und doctor."""
    return (
        db.query(Shift)
        .options(joinedload(Shift.shift_type), joinedload(Shift.doctor))
        .filter(Shift.id == shift_id)
        .first()
    )

def update_shift(db: Session, shift_id: int, data: dict) -> Shift | None:
    """Aktualisiert spezifische Felder einer Shift. data enthält nur 
    die zu setzenden Felder (Ergebnis von exclude_unset).
    Returns None wenn Shift nicht existiert.
    """
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if shift is None:
        return None
    for key, value in data.items():
        setattr(shift, key, value)
    db.flush()
    db.refresh(shift)
    return shift
```

Die exakte Form folgt dem Pattern bestehender Repository-Funktionen 
(M2-002 hat z.B. `update_plan`, `update_rotation` als Vorlage).

**2.2 Akzeptanzkriterien für Sub-Schritt 2**

- [ ] `get_shift(db, shift_id)` existiert mit eager-load
- [ ] `update_shift(db, shift_id, data)` existiert
- [ ] Beide Funktionen folgen dem Repository-Pattern aus M2-002
- [ ] Unit-Tests für Repository-Funktionen (nicht-existente IDs, 
      Update-Cases)

**Stop-Gate nach Sub-Schritt 2:**
- Commit: `feat: M2-004/2 shift repository update functions`
- Warten auf Review

### Sub-Schritt 3: Service-Layer

**3.1 Neues Modul `backend/app/services/shift_service.py`**

Falls noch nicht vorhanden. Falls existiert, ergänzen.

```python
def update_shift(db: Session, shift_id: int, update: ShiftUpdate) -> Shift:
    """Aktualisiert eine Shift. Validiert nur Datenkonsistenz.
    
    Raises:
        ShiftNotFoundError: shift_id existiert nicht.
        ShiftValidationError: doctor_id verweist auf nicht-
            existierenden oder inaktiven Doctor.
    
    Semantische Constraints (Verfügbarkeit, Qualifikation, 
    Doppelbuchung) werden NICHT geprüft. Konflikte werden über
    die Konflikt-Engine (M2-005) zurückgegeben.
    """
    data = update.model_dump(exclude_unset=True)
    
    # Validierung doctor_id (wenn gesetzt und nicht None)
    if 'doctor_id' in data and data['doctor_id'] is not None:
        doctor = db.query(Doctor).filter(Doctor.id == data['doctor_id']).first()
        if doctor is None:
            raise ShiftValidationError(
                f"Doctor mit ID {data['doctor_id']} existiert nicht"
            )
        if not doctor.active:
            raise ShiftValidationError(
                f"Doctor {doctor.name} ist inaktiv und kann nicht "
                "zugewiesen werden"
            )
    
    shift = shift_repository.update_shift(db, shift_id, data)
    if shift is None:
        raise ShiftNotFoundError(f"Shift {shift_id} nicht gefunden")
    
    return shift
```

**3.2 ShiftValidationError ergänzen**

Falls noch nicht in `backend/app/api/error_handlers.py` vorhanden:
```python
class ShiftValidationError(Exception):
    """Datenkonsistenz-Fehler bei Shift-Operationen."""
    pass
```

Handler: → HTTP 422 mit Fehlertext im Detail-Feld.

**3.3 Akzeptanzkriterien für Sub-Schritt 3**

- [ ] `shift_service.update_shift` implementiert
- [ ] Validierung: Doctor existiert und ist aktiv (wenn doctor_id 
      explizit gesetzt)
- [ ] Validierung: Shift existiert (sonst ShiftNotFoundError)
- [ ] Keine semantische Validierung (Verfügbarkeit, Qualifikation)
- [ ] ShiftValidationError im error_handlers definiert und gemappt 
      auf 422

**Stop-Gate nach Sub-Schritt 3:**
- Commit: `feat: M2-004/3 shift service update`
- Warten auf Review

### Sub-Schritt 4: API-Endpunkt

**4.1 Neuer Endpunkt `PATCH /api/shifts/{shift_id}`**

In `backend/app/api/shifts.py` (neue Datei) oder in bestehendem 
`plan_shifts.py` (laut M2-002).

```python
@router.patch("/{shift_id}", response_model=ShiftWithDetails)
def patch_shift(
    shift_id: int,
    update: ShiftUpdate,
    db: Session = Depends(get_db),
) -> Shift:
    return shift_service.update_shift(db, shift_id, update)
```

**Wichtig zur Route-Struktur:** der bestehende Endpunkt aus M2-002 
war `GET /api/plans/{plan_id}/shifts`. Der neue PATCH ist 
`PATCH /api/shifts/{shift_id}` (ohne plan_id im Pfad). Begründung: 
die Shift-ID ist global eindeutig, plan_id wäre redundant. Pattern: 
read-collection per Parent, update-single per ID.

Falls Pattern in M2-002 anders war, an dieses anpassen und 
dokumentieren.

**4.2 Akzeptanzkriterien für Sub-Schritt 4**

- [ ] `PATCH /api/shifts/{shift_id}` existiert
- [ ] Request: ShiftUpdate, Response: ShiftWithDetails
- [ ] 200 bei Erfolg
- [ ] 404 wenn Shift nicht existiert
- [ ] 422 bei Validierungsfehlern (nicht-existenter oder inaktiver 
      Doctor, unbekannte Felder)
- [ ] OpenAPI-Spec enthält den neuen Endpunkt

**Stop-Gate nach Sub-Schritt 4:**
- Commit: `feat: M2-004/4 patch shift endpoint`
- Warten auf Review

### Sub-Schritt 5: Tests

**5.1 Integration-Tests in `tests/integration/test_shifts_api.py`**

Neue Datei. Test-Fixtures aus bestehenden M2-002-Tests übernehmen 
(Plan mit generierten Shifts, aktive Doctors).

```python
# Erfolgs-Cases
def test_patch_shift_assigns_doctor():
    # Shift hat zunächst doctor_id=None
    # PATCH mit doctor_id=X
    # → 200, doctor in Response, doctor_id in DB gesetzt

def test_patch_shift_clears_doctor():
    # Shift hat doctor_id=X
    # PATCH mit doctor_id=None (explizit)
    # → 200, doctor=None in Response

def test_patch_shift_no_change_if_field_omitted():
    # Shift hat doctor_id=X, is_pinned=False
    # PATCH nur mit is_pinned=True
    # → doctor_id bleibt X, is_pinned wird True

def test_patch_shift_sets_pinned():
    # is_pinned True

def test_patch_shift_updates_notes():
    # notes-String

def test_patch_shift_all_fields_at_once():
    # doctor_id + is_pinned + notes in einem Call

# Validierungs-Cases (hart)
def test_patch_shift_404_when_not_exists():
    # PATCH /api/shifts/999999 → 404

def test_patch_shift_422_when_doctor_not_exists():
    # PATCH mit doctor_id=999999 → 422

def test_patch_shift_422_when_doctor_inactive():
    # Doctor mit active=False
    # PATCH mit dessen ID → 422

def test_patch_shift_422_when_extra_field():
    # PATCH mit unbekanntem Feld → 422

# Weiche Validierung (semantisch)
def test_patch_shift_assigns_doctor_on_vacation():
    # Doctor hat Absence im Shift-Zeitraum
    # PATCH erfolgreich → 200 (kein Block!)
    # Konflikte werden später durch M2-005 markiert

def test_patch_shift_double_booking_allowed():
    # Doctor schon für andere Schicht am selben Tag zugewiesen
    # PATCH erfolgreich → 200

def test_patch_shift_missing_qualification_allowed():
    # Doctor ohne nötige Qualifikation
    # PATCH erfolgreich → 200
```

**5.2 Unit-Tests im Service-Layer**

`tests/unit/services/test_shift_service.py`:
- ShiftNotFoundError-Raises
- ShiftValidationError-Raises (Doctor nicht existiert, inaktiv)
- Erfolgreicher Update (alle Felder, partielle Felder)
- Cleared assignment (doctor_id=None explizit)

**5.3 Akzeptanzkriterien für Sub-Schritt 5**

- [ ] Integration-Tests decken Erfolgs- und Fehler-Cases ab
- [ ] Weiche Validierung getestet (Urlaub, Doppelbuchung, fehlende 
      Quali sind erlaubt)
- [ ] Unit-Tests für Service-Layer
- [ ] Alle Tests grün (`pytest`)

**Stop-Gate nach Sub-Schritt 5:**
- Commit: `test: M2-004/5 shift assignment tests`
- Warten auf Review

### Sub-Schritt 6: OpenAPI-Update und Doku

**6.1 OpenAPI-Spec regenerieren**

Da Frontend in M2-003 die getypten Hooks braucht:
```
cd frontend
pnpm generate-api
```

Sicherstellen, dass `patchShift` oder ähnlich getippt in der Client-
Library landet.

**6.2 Doku aktualisieren**

`docs/decisions.md` ergänzen:
- ADR: Schicht-Zuweisung wird weich validiert. Nur Datenkonsistenz 
  (Existenz, aktiver Doctor) wird hart geprüft. Semantische 
  Konflikte werden read-only zurückgegeben (M2-005).
- ADR: PATCH-Pattern für Shifts: globale Shift-ID statt nested 
  unter Plan. Begründung: ID ist global eindeutig, plan_id wäre 
  redundant.

`docs/data-model.md` ergänzen:
- Hinweis im Shift-Abschnitt: "Zuweisung kann manuell per PATCH 
  geändert werden (M2-004). Semantische Validierung erfolgt nicht 
  im Schreib-Pfad, sondern read-only durch die Konflikt-Engine 
  (M2-005)."

`README.md` API-Übersicht (falls vorhanden):
- PATCH /api/shifts/{id} hinzufügen

**6.3 Akzeptanzkriterien für Sub-Schritt 6**

- [ ] `pnpm generate-api` erfolgreich, neue Client-Funktion 
      verfügbar
- [ ] `docs/decisions.md` enthält die zwei ADRs
- [ ] `docs/data-model.md` Hinweis ergänzt
- [ ] README aktualisiert (falls API-Übersicht dort)

**Stop-Gate nach Sub-Schritt 6:**
- Commit: `chore: M2-004/6 openapi and docs`
- Final-Review durch User
- Merge in main (Standard-Sequenz)

## Akzeptanzkriterien (Gesamtaufgabe)

- [ ] `ShiftUpdate`-Schema in `schemas/shift.py`
- [ ] `shift_repository.get_shift` mit eager-load
- [ ] `shift_repository.update_shift`
- [ ] `shift_service.update_shift` mit weicher Validierung
- [ ] `ShiftValidationError` in error_handlers
- [ ] `PATCH /api/shifts/{shift_id}` Endpunkt
- [ ] Integration- und Unit-Tests grün
- [ ] Weiche Validierung getestet (Urlaub/Konflikt/fehlende Quali 
      sind erlaubt)
- [ ] OpenAPI-Client regeneriert
- [ ] decisions.md und data-model.md aktualisiert
- [ ] `pytest` grün (alle bestehenden + neue Tests)

## Out of Scope

- Konflikt-Erkennung (kommt in M2-005)
- Bulk-Endpunkte (kommt wenn Frontend Bedarf zeigt)
- Frontend-Anbindung (kommt mit M2-003b PlanGrid)
- Versionierung beim PATCH (kein automatischer Snapshot)
- Plan-Status-Checks (auch ARCHIVED-Pläne sind editierbar, 
  Frontend regelt UI-Schutz)
- Schichttyp ändern (Shift hat einen festen shift_type_id, der 
  durch die Schicht-Generierung bei Plan-Anlage gesetzt wird)
- Datum ändern (analog: shift_date kommt aus der Generierung)
- Solver-Anbindung

## Bekannte Stolperfallen

- **exclude_unset:** der Unterschied zwischen "Feld nicht im 
  Request" und "Feld explizit auf None" ist kritisch. Pydantic-v2: 
  `model_dump(exclude_unset=True)` liefert nur explizit gesetzte 
  Felder. Wenn jemand stattdessen `model_dump(exclude_none=True)` 
  verwendet, kann doctor_id niemals auf NULL gesetzt werden. Im 
  Service unbedingt `exclude_unset` verwenden.
- **eager-load in Response:** ShiftWithDetails braucht 
  `shift_type` und `doctor` nested. Wenn das Repository die 
  Relations nicht eager lädt, kommt es zu N+1 oder zu leeren 
  Nested-Objekten in der Response. Im `update_shift` nach 
  `db.refresh` sicherstellen, dass die Relations geladen sind.
- **Inactive Doctor:** Validierung blockiert nur NEUE Zuweisungen 
  an inactive Doctors. Bestehende Zuweisungen, wo der Doctor 
  später deaktiviert wurde, bleiben unverändert (Daten-Konsistenz, 
  keine Migration nötig).
- **Cascade-Verhalten:** Wenn Doctor gelöscht wird, sind Shifts 
  per SET NULL betroffen (laut data-model.md). Das ist bereits 
  in M2-001 konfiguriert, hier nichts zu tun, aber im Test 
  bestätigen.
- **`extra='forbid'` im Schema:** schützt vor Tippfehlern wie 
  `doctorid` statt `doctor_id`. Ohne dieses Setting würden 
  unbekannte Felder schweigend ignoriert.
- **Plan-Status nicht prüfen:** auch wenn ein Plan ARCHIVED ist, 
  erlaubt das Backend Änderungen. Frontend muss bei Bedarf das 
  Schreib-UI deaktivieren. Hier KEIN Backend-Check.
- **Test-Daten:** für die "weiche Validierung"-Tests braucht es 
  Doctor mit Absence, Doctor ohne nötige Quali, etc. Fixtures aus 
  M2-002/M2-002b wiederverwenden, nicht neu bauen.
- **Routing:** falls bestehender Code in `plan_shifts.py` schon 
  unter `/api/plans/{id}/shifts` mounted, neue PATCH-Route in 
  separatem Router `shifts.py` mit Mount-Path `/api/shifts`. 
  Trennung in zwei Dateien ist OK.

## Annahmen die ich treffe

OK-Annahmen:
- M2-002 hat ShiftWithDetails-Schema mit nested shift_type und 
  doctor. Falls anders strukturiert: anpassen, aber nicht neu 
  schreiben
- ShiftNotFoundError-Klasse ist bereits in error_handlers oder 
  einer ähnlichen zentralen Datei definiert (laut M2-002 "für 
  später vorbereitet")
- Bestehender Service-Layer-Pattern aus M2-002 (plan_service.py) 
  ist als Vorlage geeignet
- Doctor-Modell hat `active`-Feld (laut data-model.md ja)
- joinedload-Pattern aus M2-002 (eager loading) wiederverwendbar
- Tests laufen mit der bestehenden Test-Fixture-Infrastruktur 
  (vermutlich pytest mit SQLite-In-Memory)
- generate-api-Skript existiert seit M0-003 und funktioniert

Bei Unklarheit: zuerst M2-002-Briefing und bestehenden Code als 
Referenz nutzen, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:
```powershell
cd D:\Softwareprojekte\Dienstplaner
git status                  # sauber?
git checkout main
git pull origin main
git checkout -b task/M2-004-shift-assignment
```

Briefing nach `tasks\open\M2-004-shift-assignment.md` kopieren.

Nach Abschluss aller Sub-Schritte:
```powershell
git push origin task/M2-004-shift-assignment

git checkout main
git pull origin main
git merge task/M2-004-shift-assignment
git push origin main

move tasks\open\M2-004-shift-assignment.md tasks\done\
git add .
git commit -m "chore: archive completed task M2-004"
git push
```

**`pnpm generate-api` wurde in Sub-Schritt 6 ausgeführt.** Backend-
Änderung erfordert das, damit das Frontend die neuen Typen 
bekommt.
