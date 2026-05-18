# Task M2-005: Konflikt-Engine (read-only)

## Ziel
Ein Read-Only-Service, der für einen Plan zwei Konflikt-Typen 
berechnet und in zwei Projektionen bereitstellt. Damit kann das 
Plan-Frontend (M2-003) Konflikte visuell markieren und auf dem 
Dashboard zählen, ohne dass der Solver existiert.

**Zwei Konflikt-Typen (mehr ist mit dem aktuellen Datenmodell nicht 
berechenbar):**
1. `NOT_AVAILABLE` — Arzt ist einer Schicht zugewiesen, an dem Tag 
   aber nicht INA-verfügbar (blockierende Rotation, Abwesenheit, 
   INAExclusion). Quelle: `get_ina_availability` aus M2-002b.
2. `DOUBLE_BOOKED` — Arzt ist am selben Kalendertag mehreren 
   Schichten zugewiesen.

**Offene Schichten** (`doctor_id = NULL`) sind kein Konflikt, 
sondern ein normaler Planungs-Zwischenstand. Sie werden als 
separates Aggregat zurückgegeben.

Keine Schreib-Operationen. Konflikte blockieren nichts (weiche 
Philosophie aus M2-004). Der Service informiert nur.

## Kontext
Lies vor Beginn in dieser Reihenfolge:
1. `CLAUDE.md`
2. `docs/data-model.md`, besonders Abschnitt "INA-Verfügbarkeits-
   modell (ab M2)" (ca. Zeile 441 ff.) und Shift-Entität
3. `docs/constraints.md` (Platzhalter — die volle Tarif-/Ruhezeiten-
   /Wochenstunden-Logik kommt erst mit dem Solver, NICHT hier)
4. `docs/decisions.md`
5. `tasks/done/M2-002b-ina-verfuegbarkeit.md` (Signatur und 
   Verhalten von `get_ina_availability`)
6. `tasks/done/M2-004-shift-assignment.md` (ShiftWithDetails-Schema, 
   shift_service, PATCH-Verhalten)
7. `backend/app/services/ina_availability_service.py` (oder wo 
   `get_ina_availability` liegt)
8. `backend/app/schemas/shift.py` (ShiftWithDetails, wird additiv 
   erweitert)
9. `backend/app/repositories/shift_repository.py` (get_shift, 
   Shifts-pro-Plan-Abfrage aus M2-002/M2-004)
10. `backend/app/api/error_handlers.py` (PlanNotFoundError aus 
    M2-002)

## Entscheidungen für M2-005

Vor Schreiben des Briefings festgelegt:
- **Konflikt-Typen:** nur `NOT_AVAILABLE` und `DOUBLE_BOOKED`. 
  Qualifikations-Konflikt ist vertagt — es gibt keine 
  ShiftType→Qualifikation-Beziehung im Datenmodell, und das 
  Constraint-Design kommt ohnehin mit dem Solver.
- **API-Form:** beides. Ein Aggregat-Endpunkt pro Plan UND 
  Konflikte eingebettet pro Shift in den bestehenden GET-Shift-
  Responses.
- **Offene Schichten:** getrennt als eigenes Aggregat 
  (`open_shift_count` + Liste), kein Konflikt-Typ. Begründung: ein 
  halbfertiger Plan ist normal, offene Schichten dürfen die 
  Konflikt-KPI nicht aufblähen.
- **PATCH-Response-Entkopplung:** die PATCH-Response aus M2-004 
  bleibt unverändert (ohne `conflicts`). Das Frontend lädt nach 
  einer Zuweisung die Konflikte neu (refetch). Begründung: ein 
  Einzel-Shift-PATCH müsste sonst Doppelbuchungs-Logik über andere 
  Shifts mitziehen — unnötige Kopplung bei einer lokalen App, wo 
  ein Refetch billig ist.
- **Read-only, plan-intern:** Konflikte werden pro Plan berechnet, 
  nicht plan-übergreifend. Kein Caching, kein Materialisieren.

## Anforderungen

### Sub-Schritt 1: Konflikt-Schemas

**1.1 Neue Schemas in `backend/app/schemas/conflict.py`** (neue Datei)

```python
class ConflictType(str, Enum):
    NOT_AVAILABLE = "not_available"
    DOUBLE_BOOKED = "double_booked"

class ShiftConflict(BaseModel):
    shift_id: int
    conflict_type: ConflictType
    message: str            # deutscher Klartext für die UI
    doctor_id: int
    doctor_name: str
    shift_date: date
    shift_type_short_name: str

class OpenShift(BaseModel):
    shift_id: int
    shift_date: date
    shift_type_short_name: str

class PlanConflicts(BaseModel):
    plan_id: int
    conflicts: list[ShiftConflict]
    conflict_count: int
    open_shifts: list[OpenShift]
    open_shift_count: int
```

Felder wie `doctor_name`, `shift_type_short_name` werden mitgegeben, 
damit das Frontend für die "Aufmerksamkeit"-Liste (§8) und Tooltips 
keine zusätzlichen Lookups braucht.

**1.2 ShiftWithDetails additiv erweitern**

In `backend/app/schemas/shift.py`:
```python
class ShiftWithDetails(...):
    # ... bestehende Felder unverändert ...
    conflicts: list[ShiftConflict] = []
```

Additive Änderung mit Default `[]`. Bestehende M2-004-Tests dürfen 
nicht brechen (wenn ein Test exakte Feld-Mengen prüft, anpassen).

**1.3 Akzeptanzkriterien für Sub-Schritt 1**

- [ ] `schemas/conflict.py` mit ConflictType, ShiftConflict, 
      OpenShift, PlanConflicts
- [ ] `ShiftWithDetails.conflicts` additiv ergänzt, Default `[]`
- [ ] Bestehende Schema-/M2-004-Tests grün (ggf. additive 
      Anpassung)

**Stop-Gate nach Sub-Schritt 1:**
- Commit: `feat: M2-005/1 conflict schemas`
- Warten auf Review

### Sub-Schritt 2: Conflict-Detection Service

**2.1 Neues Modul `backend/app/services/conflict_service.py`**

```python
def detect_conflicts(db: Session, plan_id: int) -> PlanConflicts:
    """Berechnet alle Konflikte eines Plans (read-only).
    
    Raises:
        PlanNotFoundError: plan_id existiert nicht.
    """
```

Logik:
1. Plan-Existenz prüfen, sonst `PlanNotFoundError`.
2. Alle Shifts des Plans laden, eager-loaded `doctor` und 
   `shift_type` (eine Query, kein N+1).
3. **Offene Schichten:** alle mit `doctor_id is None` → in 
   `open_shifts` sammeln, `open_shift_count` setzen. Keine weitere 
   Prüfung für diese.
4. **NOT_AVAILABLE:** für jede besetzte Shift 
   `get_ina_availability(db, doctor_id, shift_date)` aufrufen. Wenn 
   `available is False` → `ShiftConflict` mit `conflict_type=
   NOT_AVAILABLE`. `message` aus den von `get_ina_availability` 
   gelieferten deutschen `reasons` zusammensetzen (nicht neu 
   formulieren, die Strings sind UI-fertig).
5. **DOUBLE_BOOKED:** besetzte Shifts nach `(doctor_id, 
   shift_date)` gruppieren. Bei Gruppengröße > 1 → **alle** Shifts 
   der Gruppe als `ShiftConflict` mit `conflict_type=DOUBLE_BOOKED` 
   (nicht nur die "zweite", sonst weiß das Frontend nicht, welche 
   Zellen zu markieren sind). `message` z.B. "Mehrfachzuweisung am 
   <Datum>: auch <andere Schicht>".
6. Eine Shift kann beide Konflikt-Typen gleichzeitig haben → dann 
   zwei Einträge in `conflicts` für dieselbe `shift_id`.
7. `conflict_count = len(conflicts)`.

**2.2 Performance-Memoization**

`get_ina_availability` ist pro `(doctor_id, date)`. Innerhalb eines 
`detect_conflicts`-Laufs die Ergebnisse pro `(doctor_id, date)` in 
einem lokalen Dict memoizen, damit derselbe Arzt am selben Tag (bei 
Doppelbuchung) nicht doppelt geprüft wird. Kein globales Caching 
über Requests hinweg.

**2.3 Akzeptanzkriterien für Sub-Schritt 2**

- [ ] `conflict_service.detect_conflicts` implementiert
- [ ] Shifts in einer Query eager-loaded (kein N+1)
- [ ] NOT_AVAILABLE nutzt `get_ina_availability`-Reasons unverändert
- [ ] DOUBLE_BOOKED markiert ALLE beteiligten Shifts
- [ ] Offene Schichten separat, kein Konflikt
- [ ] `(doctor_id, date)`-Memoization innerhalb eines Laufs
- [ ] `PlanNotFoundError` bei unbekanntem Plan

**Stop-Gate nach Sub-Schritt 2:**
- Commit: `feat: M2-005/2 conflict detection service`
- Warten auf Review

### Sub-Schritt 3: Aggregat-Endpunkt

**3.1 `GET /api/plans/{plan_id}/conflicts`**

In bestehendem Plan-Router (aus M2-002) oder neuem Conflict-Router.

```python
@router.get("/{plan_id}/conflicts", response_model=PlanConflicts)
def get_plan_conflicts(plan_id: int, db: Session = Depends(get_db)):
    return conflict_service.detect_conflicts(db, plan_id)
```

- 200 mit `PlanConflicts`
- 404 wenn Plan nicht existiert

**3.2 Akzeptanzkriterien für Sub-Schritt 3**

- [ ] `GET /api/plans/{plan_id}/conflicts` existiert
- [ ] Response `PlanConflicts`
- [ ] 404 bei unbekanntem Plan
- [ ] OpenAPI enthält den Endpunkt

**Stop-Gate nach Sub-Schritt 3:**
- Commit: `feat: M2-005/3 plan conflicts endpoint`
- Warten auf Review

### Sub-Schritt 4: Konflikte eingebettet in Shift-Responses

**4.1 Bestehenden GET-Shifts-Endpunkt erweitern**

Der Endpunkt `GET /api/plans/{plan_id}/shifts` (aus M2-002) liefert 
`list[ShiftWithDetails]`. Jede Shift bekommt jetzt ihr `conflicts`-
Feld gefüllt.

Implementierung: `detect_conflicts` einmal pro Request aufrufen, die 
resultierenden `ShiftConflict`s nach `shift_id` gruppieren und den 
jeweiligen `ShiftWithDetails` zuordnen. **Nicht** pro Shift einzeln 
berechnen (Doppelbuchung braucht den Gesamt-Kontext, und es wäre 
ineffizient).

**4.2 PATCH-Response bewusst NICHT erweitern**

`PATCH /api/shifts/{shift_id}` (M2-004) bleibt unverändert — 
`conflicts` dort leer/Default. Das ist die in den Entscheidungen 
festgelegte Entkopplung. Im Code mit einem kurzen Kommentar 
markieren, damit niemand es später "vergessen" repariert.

**4.3 Akzeptanzkriterien für Sub-Schritt 4**

- [ ] `GET /api/plans/{plan_id}/shifts` füllt `conflicts` pro Shift
- [ ] Konflikte werden einmal pro Request berechnet, dann zugeordnet 
      (kein Per-Shift-Recompute)
- [ ] PATCH-Response unverändert, Kommentar erklärt die Entkopplung

**Stop-Gate nach Sub-Schritt 4:**
- Commit: `feat: M2-005/4 embed conflicts in shift list`
- Warten auf Review

### Sub-Schritt 5: Tests

**5.1 Unit-Tests `tests/unit/services/test_conflict_service.py`**

Fixtures aus M2-002/M2-002b/M2-004 wiederverwenden (Plan mit Shifts, 
Doctors, Absences, Rotationen).

```python
def test_no_conflicts_empty_plan()
    # Plan ohne Shifts → leere Listen, alle counts 0

def test_open_shift_counted_not_conflict()
    # Shift mit doctor_id=None → open_shift_count=1, conflicts leer

def test_doctor_on_vacation_is_not_available()
    # Doctor mit Absence am shift_date → NOT_AVAILABLE,
    # message enthält den deutschen Reason aus get_ina_availability

def test_doctor_blocking_rotation_is_not_available()
    # Doctor mit aktiver Rotation in blockierendem Department
    # → NOT_AVAILABLE

def test_ina_exclusion_is_not_available()
    # Doctor mit INAExclusion im Zeitraum → NOT_AVAILABLE

def test_double_booking_marks_all_involved_shifts()
    # Doctor zwei Shifts am selben Tag → beide als DOUBLE_BOOKED

def test_available_single_shift_no_conflict()
    # Doctor verfügbar, eine Shift → kein Konflikt

def test_shift_can_have_both_conflict_types()
    # Doctor im Urlaub UND doppelt gebucht am selben Tag
    # → zwei conflicts-Einträge für dieselbe shift_id

def test_conflict_count_matches_list_length()

def test_plan_not_found_raises()
```

**5.2 Integration-Tests `tests/integration/test_conflicts_api.py`**

```python
def test_get_conflicts_returns_aggregate()
def test_get_conflicts_404_unknown_plan()
def test_get_shifts_embeds_conflicts()
    # GET /shifts: eine bekannte Konflikt-Shift hat conflicts gefüllt
def test_patch_response_has_no_conflicts()
    # PATCH /shifts/{id} (M2-004): conflicts bleibt leer/Default
```

**5.3 Akzeptanzkriterien für Sub-Schritt 5**

- [ ] Unit-Tests decken beide Konflikt-Typen, Kombination, offene 
      Schichten, leeren Plan, Plan-not-found ab
- [ ] Integration-Tests für Aggregat-Endpunkt und eingebettete 
      Konflikte
- [ ] Test bestätigt: PATCH-Response ohne conflicts
- [ ] Alle bestehenden Tests weiterhin grün (`pytest`)

**Stop-Gate nach Sub-Schritt 5:**
- Commit: `test: M2-005/5 conflict engine tests`
- Warten auf Review

### Sub-Schritt 6: OpenAPI und Doku

**6.1 OpenAPI-Client regenerieren**

```
cd frontend
pnpm generate-api
```

Sicherstellen: `getPlanConflicts` und das erweiterte 
`ShiftWithDetails` (mit `conflicts`) sind getypt verfügbar.

**6.2 Doku aktualisieren**

`docs/decisions.md`:
- ADR: Konflikt-Engine ist read-only, plan-intern, kein Caching
- ADR: nur zwei Konflikt-Typen (NOT_AVAILABLE, DOUBLE_BOOKED). 
  Qualifikation vertagt bis Constraint-/Solver-Design steht
- ADR: offene Schichten sind kein Konflikt, separates Aggregat
- ADR: PATCH-Response trägt keine conflicts; Frontend refetcht 
  (bewusste Entkopplung)
- ADR: DOUBLE_BOOKED markiert alle beteiligten Shifts

`docs/constraints.md`:
- Kurzer Hinweis ergänzen: "Vor dem Solver existiert eine read-only 
  Konflikt-Engine (M2-005) mit zwei Typen. Tarif-/Ruhezeiten-/
  Wochenstunden-Constraints kommen mit der Solver-Integration."

`docs/data-model.md`:
- Hinweis im Shift-/INA-Abschnitt auf die Konflikt-Engine als 
  Read-Consumer von `get_ina_availability`

**6.3 Akzeptanzkriterien für Sub-Schritt 6**

- [ ] `pnpm generate-api` erfolgreich, neue Typen verfügbar
- [ ] decisions.md, constraints.md, data-model.md aktualisiert

**Stop-Gate nach Sub-Schritt 6:**
- Commit: `chore: M2-005/6 openapi and docs`
- Final-Review durch User
- Merge in main (Standard-Sequenz)

## Akzeptanzkriterien (Gesamtaufgabe)

- [ ] `schemas/conflict.py` (ConflictType, ShiftConflict, 
      OpenShift, PlanConflicts)
- [ ] `ShiftWithDetails.conflicts` additiv ergänzt
- [ ] `conflict_service.detect_conflicts` mit beiden Typen + 
      offenen Schichten + Memoization
- [ ] `GET /api/plans/{plan_id}/conflicts` Aggregat-Endpunkt
- [ ] `GET /api/plans/{plan_id}/shifts` füllt conflicts pro Shift
- [ ] PATCH-Response (M2-004) bewusst unverändert
- [ ] Unit- und Integration-Tests grün
- [ ] OpenAPI-Client regeneriert
- [ ] decisions.md, constraints.md, data-model.md aktualisiert
- [ ] `pytest` grün (bestehende + neue Tests)

## Out of Scope

- Qualifikations-Konflikt (kein Datenmodell, kommt mit Solver)
- Tarifregeln, Ruhezeiten, Wochenstunden-Limits (Solver-Phase)
- Schreib-Operationen jeglicher Art
- Konflikt-Auflösungs-Vorschläge oder Auto-Fix
- Caching, Materialisierung, Konflikt-Persistenz
- Plan-übergreifende Konflikte
- Severity-Stufen (alle Konflikte gleichwertig; weiche Philosophie. 
  Kann mit Solver-Constraints später ergänzt werden)
- conflicts in der PATCH-Response (bewusste Entkopplung)
- Frontend-Anbindung (kommt mit M2-003)

## Bekannte Stolperfallen

- **DOUBLE_BOOKED alle markieren:** wenn nur die "zweite" Shift 
  markiert wird, kann das Frontend die erste Zelle nicht 
  hervorheben. Immer die gesamte Gruppe.
- **get_ina_availability-Last:** ein Call pro besetzter Shift. Bei 
  40 Ärzten × 60 Tagen sind das im worst case ~2400 Calls pro 
  detect_conflicts. Für eine lokale SQLite-Single-User-App 
  akzeptabel, aber Memoization pro `(doctor_id, date)` innerhalb 
  des Laufs ist Pflicht (Doppelbuchung würde sonst denselben 
  Arzt/Tag mehrfach prüfen). Falls in Review träge: Hinweis für 
  spätere Optimierung notieren, aber NICHT jetzt cachen.
- **Reason-Strings nicht neu formulieren:** `get_ina_availability` 
  liefert UI-fertige deutsche Strings. In die `message` übernehmen, 
  nicht paraphrasieren — sonst driften zwei Formulierungen 
  auseinander.
- **Doppelbuchung-Definition:** zwei besetzte Shifts desselben 
  Arztes am selben Kalendertag = Konflikt. Annahme: es gibt keine 
  legitime Kombination von zwei Schichten/Person/Tag im INA-Modell. 
  Falls fachlich doch (sehr unwahrscheinlich), bleibt es trotzdem 
  ein weicher Hinweis (kein Block), den der User ignorieren kann. 
  Bei echter Unsicherheit am Stop-Gate fragen, nicht stillschweigend 
  Sonderfälle einbauen.
- **Additive Schema-Änderung:** `ShiftWithDetails.conflicts` mit 
  Default `[]`. Falls M2-004-Tests exakte Response-Strukturen 
  vergleichen, additiv anpassen — kein Verhalten ändern.
- **Eine Shift, zwei Konflikte:** Schema und Frontend-Vertrag 
  erlauben mehrere `ShiftConflict` mit derselben `shift_id`. Nicht 
  deduplizieren oder zu einem zusammenfassen.
- **PlanNotFoundError:** vermutlich aus M2-002 vorhanden. 
  Wiederverwenden, nicht neu anlegen.
- **Endpunkt-Routing:** Konflikt-Aggregat unter 
  `/api/plans/{id}/conflicts` ist nested unter Plan (read-collection 
  pro Parent), konsistent mit `GET /api/plans/{id}/shifts`. Nicht 
  als `/api/conflicts?plan_id=` bauen.

## Annahmen die ich treffe

OK-Annahmen:
- `get_ina_availability(db, doctor_id, target_date)` liefert ein 
  Objekt mit `available: bool` und `reasons: list[str]` (deutsche 
  Strings), wie in data-model.md beschrieben
- `PlanNotFoundError` existiert aus M2-002
- Es gibt eine Repository-Funktion oder Query, die alle Shifts 
  eines Plans eager-loaded liefert (aus M2-002/M2-004)
- `ShiftWithDetails` aus M2-004 ist additiv erweiterbar
- Zwei besetzte Schichten/Person/Tag = immer Konflikt (weiche 
  Markierung)
- PATCH-Response bleibt entkoppelt (Frontend refetcht Konflikte)
- Severity wird nicht gebraucht; einheitliche Behandlung reicht
- Test-Fixtures aus M2-002b decken Absence/Rotation/INAExclusion-
  Szenarien bereits ab oder sind leicht erweiterbar

Bei Unklarheit: zuerst M2-002b-Briefing und bestehenden 
`get_ina_availability`-Code als Referenz, dann hier ergänzen und 
stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:
```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M2-005-konflikt-engine
```

Briefing nach `tasks\open\M2-005-konflikt-engine.md` kopieren.

Nach Abschluss aller Sub-Schritte:
```powershell
git push origin task/M2-005-konflikt-engine

git checkout main
git pull origin main
git merge task/M2-005-konflikt-engine
git push origin main

move tasks\open\M2-005-konflikt-engine.md tasks\done\
git add .
git commit -m "chore: archive completed task M2-005"
git push
```

**`pnpm generate-api` wurde in Sub-Schritt 6 ausgeführt** — 
Backend-Schema-Änderung (PlanConflicts, ShiftWithDetails.conflicts) 
erfordert das für die Frontend-Typen in M2-003.
