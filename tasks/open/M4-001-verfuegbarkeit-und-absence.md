# Task M4-001: Verfügbarkeit & Absence-Management

## Ziel

Die dritte INA-Verfügbarkeitsquelle (Absence, ADR-016) wird im UI
pflegbar und Verfügbarkeit pro Arzt/Datum wird im Plan-Editor sichtbar.
Heute ist Absence ausschließlich datenbankseitig vorhanden — kein
Service, kein API-Router, keine UI. Solange das so bleibt, ist die
Verfügbarkeitslogik unvollständig benutzbar.

Konkret liefert dieser Milestone zwei Bausteine, die auf demselben
`get_ina_availability`-Service aufsetzen:

1. **Absence-CRUD** — neuer Backend-Service + API-Router; Frontend-Liste
   und Formular-Dialog auf der Arzt-Detailseite, analog zum
   bestehenden `INAExclusion`-Pattern.
2. **Verfügbarkeitsanzeige im Plan-Editor** — neuer dünner API-Wrapper
   um den bestehenden `get_ina_availability_for_period`-Service;
   Frontend-Hook und Visual-Hint in `RotationGrid` (während Drag) und
   `DoctorAssignPopover` (Dienste-Ansicht). Die Anzeige ist **weich**:
   Drop und Auswahl bleiben in allen Fällen erlaubt (ADR-033). Ein
   Tooltip listet die Verfügbarkeits-Gründe (Rotation, INAExclusion,
   Absence).

Backend-Pflichtarbeit ist auf zwei Services und zwei Endpoints
begrenzt; die Tarif-Regel-Engine, Excel-Export und Solver bleiben
unangetastet.

## Bindende Entscheidungen

1. **Absence-Pattern identisch zu INAExclusion.** Service-Struktur,
   Schema-Konvention (`valid_from`/`valid_to`, `notes`), API-Routing
   (nested unter Doctor + globales Update/Delete per ID), Frontend-Slot
   auf `DoctorDetailPage` werden 1:1 nachgezogen. Kein neues Muster.
2. **Verfügbarkeits-Endpoint ist Wrapper, kein Re-Implement.** Die
   bestehende Funktion `get_ina_availability_for_period` (in
   `backend/app/services/ina_availability_service.py`) wird unverändert
   aufgerufen. Die Drei-Quellen-Logik aus ADR-016 darf hier nicht
   dupliziert werden.
3. **Verfügbarkeitsanzeige ist weich (ADR-033).** Drop in
   `RotationGrid` und Auswahl im `DoctorAssignPopover` bleiben in
   allen Fällen erlaubt. Markierung ist read-only Hint, keine
   Schreibpfad-Blockade.
4. **Keine neuen Design-Tokens.** Visual-Hint nutzt bestehende
   dp-Tokens (z. B. `warning`/`amber` aus `tokens.ts`, `ring-1`, dezent).
   Falls ein passender Token fehlt, im F-Schritt als offene Frage
   notieren — kein Token-Erfinden im laufenden Sub-Schritt.
5. **Datums-Eingabe via `<input type="date">`.** Keine neue
   Calendar-Bibliothek (kein shadcn Calendar, kein react-day-picker).
   Konsistent zum bestehenden `INAExclusionFormDialog`-Pattern. Wird
   im F-Schritt als ADR fixiert.
6. **Kein optimistic update.** Absence-Mutationen invalidieren
   `absencesKeys[doctorId]` und ggf. `availabilityKeys[doctorId]`;
   kein lokales Vorschreiben. Konsistent zu ADR-043.
7. **Backend-Reihenfolge zuerst.** `pnpm generate-api` wird einmal nach
   den Backend-Schritten (A und B) gefahren; danach sind die
   generierten Typen für die Frontend-Schritte (C–E) verfügbar.

## Kontext (Leseanleitung)

1. [CLAUDE.md](../../CLAUDE.md) — Phasenmodell, „Weiche Validierung",
   INA-Verfügbarkeitsmodell, Milestone-Abschluss-Checkliste,
   Frontend-Konventionen (Hooks, Query-Keys, keine optimistic updates)
2. [docs/decisions.md](../../docs/decisions.md) — ADR-016 (drei Quellen),
   ADR-017 (weekday/weekend-Trennung), ADR-018 (Schwangerschaft als
   INAExclusion), ADR-024 (dp vs ui), ADR-033 (weiche Validierung),
   ADR-043 (kein optimistic update)
3. [docs/roadmap.md](../../docs/roadmap.md) — Position M4-001 in M3–M7
4. [backend/app/models/absence.py](../../backend/app/models/absence.py) —
   bestehendes Model (`AbsenceType` StrEnum, `valid_from`/`valid_to`,
   `notes`), CHECK-Constraint vorhanden
5. [backend/app/schemas/absence.py](../../backend/app/schemas/absence.py) —
   bestehende Pydantic-Schemas (Create/Read/Update)
6. [backend/app/services/ina_exclusion_service.py](../../backend/app/services/ina_exclusion_service.py) —
   Vorlage für `absence_service.py` (Signaturen, Fehlerbehandlung,
   Repository-Pattern)
7. [backend/app/api/ina_exclusions.py](../../backend/app/api/ina_exclusions.py) —
   Vorlage für `api/absences.py` (Routing nested + global)
8. [backend/app/services/ina_availability_service.py](../../backend/app/services/ina_availability_service.py) —
   Zeile 78 ff.: `get_ina_availability_for_period(db, doctor_id,
   start_date, end_date) → dict[date, INAAvailability]`. Nicht ändern,
   nur wrappen
9. [backend/app/api/doctors.py](../../backend/app/api/doctors.py) —
   Einbau-Punkt für `GET /api/doctors/{id}/ina-availability`
10. [frontend/src/features/doctors/INAExclusionList.tsx](../../frontend/src/features/doctors/INAExclusionList.tsx)
    + [INAExclusionFormDialog.tsx](../../frontend/src/features/doctors/INAExclusionFormDialog.tsx) —
    Vorlage für `AbsenceList.tsx` + `AbsenceFormDialog.tsx`
11. [frontend/src/features/doctors/DoctorDetailPage.tsx](../../frontend/src/features/doctors/DoctorDetailPage.tsx) —
    Einbau-Punkt für Absence-Section
12. [frontend/src/features/plans/components/RotationGrid.tsx](../../frontend/src/features/plans/components/RotationGrid.tsx) —
    Drop-Zellen bekommen Verfügbarkeits-Hint während Drag
13. [frontend/src/features/plans/components/DoctorAssignPopover.tsx](../../frontend/src/features/plans/components/DoctorAssignPopover.tsx) —
    Dienste-Popover bekommt Verfügbarkeits-Marker pro Doctor-Option
14. [frontend/src/features/plans/PlanPage.tsx](../../frontend/src/features/plans/PlanPage.tsx) —
    `activeDragDoctor`-State existiert; triggert Availability-Lookup
15. [frontend/src/lib/api-types.ts](../../frontend/src/lib/api-types.ts) —
    nach Schritt B regenerieren mit `pnpm generate-api`

## Phase-A-Invariante

Konflikt-Engine (M2-005), `useAssignShift`, `usePlanRotations`,
`planGridUtils.ts`, `rotationGridUtils.ts`, Solver-Pfad (M8) und
Tarif-Engine bleiben unverändert. Keine harte Validierung im
Schreibpfad. `get_ina_availability` selbst wird nicht verändert —
`git diff` muss zeigen: nur **neue** Service-/Router-Datei für
Absence, **ein neuer Endpoint** in `doctors.py`, neue Frontend-Dateien
für Absence, **additive** Hint-Logik in `RotationGrid` und
`DoctorAssignPopover` plus Doku.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — Backend: Absence-Service + API-Router

**Dateien:**
- `backend/app/services/absence_service.py` (neu) — `create_absence`,
  `get_absences_for_doctor`, `update_absence`, `delete_absence`. 404
  bei unbekannter `absence_id`, 422 bei `valid_from > valid_to`
  (Model-CHECK greift, im Service explizit prüfen für klaren Fehler).
- `backend/app/api/absences.py` (neu) — Router:
  - `GET /api/doctors/{doctor_id}/absences` — Liste pro Arzt
  - `POST /api/doctors/{doctor_id}/absences` — anlegen
  - `PATCH /api/absences/{id}` — Update per globaler ID
  - `DELETE /api/absences/{id}` — Löschen per globaler ID
- `backend/app/main.py` — Router-Registrierung.
- `backend/tests/services/test_absence_service.py` (neu) — Happy-Path
  + 404 + 422.
- `backend/tests/api/test_absences.py` (neu) — Endpoint-Tests pro Route.

**Akzeptanzkriterien:**
- [ ] `uv run pytest` grün; mind. ein positiver und ein negativer Test
      pro Service-Funktion (CLAUDE.md-Konvention)
- [ ] Router-Pfade entsprechen CLAUDE.md-API-Konvention (Nested-Read,
      globaler Single-Update)
- [ ] Kein Service-Import in `api/` (Geschäftslogik nur in `services/`)
- [ ] `ruff check` clean

**Stop-Gate:** Commit `feat(absence): M4-001/A Absence-Service + API`,
auf Review warten.

---

### Sub-Schritt B — Backend: Verfügbarkeits-Endpoint

**Dateien:**
- `backend/app/api/doctors.py` — neuer Endpoint:
  `GET /api/doctors/{doctor_id}/ina-availability?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `backend/app/schemas/ina_availability.py` — falls noch nicht
  vorhanden: Pydantic-Schema `INAAvailability` (`available: bool`,
  `reasons: list[str]`) und `INAAvailabilityResponse`
  (Mapping `date → INAAvailability`).
- `backend/tests/api/test_doctor_availability.py` (neu) — Tests:
  - Arzt ohne Einträge → alle Tage `available=true`
  - Arzt mit Rotation in blockierendem Bereich → werktags blockiert,
    Wochenende nicht (ADR-017)
  - Arzt mit aktiver Absence → Tag im Range blockiert mit Grund
  - Arzt mit überschneidender INAExclusion → Grund enthalten
  - `from > to` → 422
  - Unbekannte `doctor_id` → 404

**Logik:**
- Endpoint ruft `get_ina_availability_for_period` aus
  `ina_availability_service.py` direkt auf — kein Re-Implement.
- Response serialisiert `INAAvailability`-Dataclass in JSON
  (`{"2026-05-21": {"available": false, "reasons": [...]}, ...}`).

**Akzeptanzkriterien:**
- [ ] Endpoint nutzt **ausschließlich** den bestehenden Service
      (`grep` zeigt nur ein Aufruf, keine duplizierte Logik)
- [ ] `pnpm generate-api` läuft sauber, `frontend/src/lib/api-types.ts`
      ist aktualisiert und committed
- [ ] pytest grün

**Stop-Gate:** Commit `feat(api): M4-001/B INA-Availability-Endpoint`,
auf Review warten.

---

### Sub-Schritt C — Frontend: Absence-CRUD in Arzt-Detailseite

**Dateien:**
- `frontend/src/features/doctors/useAbsences.ts` (neu) — TanStack-Query-Hooks
  analog `useINAExclusions`: `useAbsences(doctorId)`, `useCreateAbsence`,
  `useUpdateAbsence`, `useDeleteAbsence`. Query-Key-Objekt
  `absenceKeys`.
- `frontend/src/features/doctors/AbsenceList.tsx` (neu) — Liste mit
  Einträgen (Typ-Badge, Zeitraum, Notizen), Edit-/Delete-Aktionen,
  Empty-State.
- `frontend/src/features/doctors/AbsenceFormDialog.tsx` (neu) —
  Dialog mit Select für `AbsenceType`, Datum-Inputs für
  `valid_from`/`valid_to`, Textarea für `notes`. Validation:
  `valid_from <= valid_to` (client-side Hint, Backend-CHECK greift
  serverseitig).
- `frontend/src/features/doctors/DoctorDetailPage.tsx` — neue
  Sektion „Abwesenheiten" zwischen INAExclusion-Liste und
  EmploymentPeriod-Liste (oder darunter, je nach bestehender
  Reihenfolge).
- `frontend/src/features/doctors/tests/AbsenceFormDialog.test.tsx`
  (neu) — Happy-Path, Validation-Fehler.
- `frontend/src/features/doctors/tests/AbsenceList.test.tsx` (neu) —
  Empty-State, mehrere Einträge, Edit-Trigger, Delete-Trigger.

**Logik:**
- Datums-Eingabe als `<input type="date">` (siehe bindende
  Entscheidung 5).
- `useUpdateAbsence`/`useDeleteAbsence` invalidieren
  `absenceKeys[doctorId]` und `availabilityKeys[doctorId]` (für
  Konsistenz mit Plan-Editor-Indikator).

**Akzeptanzkriterien:**
- [ ] `pnpm test` (vitest) grün, neue Tests inklusive
- [ ] `pnpm typecheck` clean, kein `any`, keine `ts-ignore`
- [ ] DoctorDetailPage rendert neue Sektion ohne Layout-Riss
- [ ] Pattern entspricht INAExclusion-Schwester-Komponenten

**Stop-Gate:** Commit `feat(doctors): M4-001/C Absence-UI in Arzt-Detail`,
auf Review warten.

---

### Sub-Schritt D — Frontend: Verfügbarkeits-Hook + Hint im RotationGrid

**Dateien:**
- `frontend/src/features/plans/useDoctorAvailability.ts` (neu) —
  `useDoctorAvailability(doctorId, from, to)`. Query-Key-Objekt
  `availabilityKeys`. Disabled wenn `doctorId === null`.
- `frontend/src/features/plans/PlanPage.tsx` — wenn `activeDragDoctor`
  gesetzt, Hook für Plan-Zeitraum aktivieren.
- `frontend/src/features/plans/components/RotationGrid.tsx` — pro
  Drop-Zelle prüfen: Datum in `availability` und
  `availability[date].available === false` → Hint-Klasse (z. B.
  `ring-1 ring-warning/40`). Tooltip mit `reasons.join(", ")`.
- `frontend/src/features/plans/tests/RotationGrid.availability.test.tsx`
  (neu) — Simulation von `activeDragDoctor` + Availability-Map →
  korrekte Zellen erhalten Hint-Klasse, Tooltip zeigt Gründe.

**Logik:**
- Hint ist **rein visuell**. Drop bleibt erlaubt; `onDragEnd` bleibt
  unverändert. Phase-A-Invariante.
- Kein doppelter Request: Cache wird in Schritt E wiederverwendet.

**Akzeptanzkriterien:**
- [ ] vitest grün (alte + neue Tests)
- [ ] Drop funktioniert auch in markierter Zelle (manueller Smoke-Test
      im Review)
- [ ] Keine neuen Tokens; nur bestehende dp-Klassen
- [ ] Hook deaktiviert sich sauber, wenn `activeDragDoctor === null`
      (keine Background-Requests im Idle-State)

**Stop-Gate:** Commit `feat(plan): M4-001/D Verfügbarkeits-Hint im RotationGrid`,
auf Review warten.

---

### Sub-Schritt E — Frontend: Verfügbarkeit im DoctorAssignPopover (Dienste)

**Dateien:**
- `frontend/src/features/plans/components/DoctorAssignPopover.tsx` —
  pro Doctor-Option `useDoctorAvailability` für das Schicht-Datum
  (oder ein gemeinsamer Bulk-Hook für alle Optionen, falls vom
  Backend her natürlich; sonst per-Doctor mit React-Query-Dedup).
  Visueller Marker (z. B. warn-Dot oder Sand-Token-Akzent am Avatar);
  Tooltip mit `reasons`.
- `frontend/src/features/plans/tests/DoctorAssignPopover.test.tsx` —
  erweitern: mit Mocks für Availability → markierte Optionen.

**Logik:**
- Auswahl eines markierten Arztes bleibt erlaubt (ADR-033).
- Konflikt-Engine (M2-005) markiert nach Schreiben weiterhin
  `NOT_AVAILABLE` — der Popover-Marker ist die präventive Variante.
- Bevorzugung: einzelner Bulk-Request für den Schicht-Tag über alle
  Ärzte ist wünschenswert; falls neuer Backend-Endpoint nötig wäre,
  in F-Schritt als Folge-Frage notieren, NICHT in M4 spontan
  hinzufügen (Scope-Disziplin).

**Akzeptanzkriterien:**
- [ ] vitest grün
- [ ] Auswahl markierter Optionen schreibt unverändert
- [ ] Kein UI-Glitch bei sich änderndem Schicht-Datum

**Stop-Gate:** Commit `feat(plan): M4-001/E Verfügbarkeits-Marker im Dienste-Popover`,
auf Review warten.

---

### Sub-Schritt F — Abschluss-Dokumentation

Pflichtschritte laut [CLAUDE.md](../../CLAUDE.md) Milestone-Abschluss-Checkliste:

1. **`tasks/open/M4-001-verfuegbarkeit-und-absence.md`** →
   `tasks/done/` verschieben; alle `[ ]` → `[x]`; Abschnitt „Abschluss"
   anhängen (Datum, Branch, Commits A–F, Testergebnis vitest + pytest,
   ggf. neue offene Fragen).
2. **`docs/open-questions.md`** — neue offene Fragen aus M4 eintragen
   (z. B. Heatmap-Variante, Calendar-Komponente, Bulk-Availability-Endpoint).
3. **`docs/decisions.md`** — neue ADRs:
   - **Absence-Pattern**: CRUD an Arzt-Detail, nicht Sammelübersicht.
   - **Availability-Endpoint**: dünner Wrapper, keine Logik-Duplikation
     mit `get_ina_availability_for_period`.
   - **Date-Input**: HTML-`<input type="date">` Standard für
     Formulare, kein shadcn-Calendar.
4. **`docs/constraints.md`** — Verfügbarkeitsanzeige als read-only,
   weiche Markierung dokumentieren (analog Konflikt-Engine M2-005,
   ADR-033). Keine neue harte Constraint.
5. **`CLAUDE.md`** — neuer Abschnitt „Frontend — Availability-Pattern
   (M4-001)": Hook-Konvention `useDoctorAvailability`, Visual-Hint
   bleibt weich, kein Drop-Block, Query-Key-Konvention.

**Stop-Gate:** Commit `docs: M4-001 Abschluss + ADRs + CLAUDE.md`,
auf Review warten.

## Akzeptanzkriterien (Gesamtaufgabe)

- [ ] Backend: `absence_service.py` + `api/absences.py` + Router
      registriert; pytest grün (Baseline + neue Tests)
- [ ] Backend: `GET /api/doctors/{id}/ina-availability` nutzt nur den
      bestehenden Service, kein Re-Implement
- [ ] Frontend: Absence-Liste + Formular in Arzt-Detail, analog
      INAExclusion-Pattern
- [ ] Frontend: `useDoctorAvailability`-Hook; Visual-Hint in
      `RotationGrid` während Drag; Marker in `DoctorAssignPopover`
- [ ] Drop und Auswahl bleiben in allen Fällen erlaubt (Phase-A,
      ADR-033)
- [ ] Keine neuen Design-Tokens (oder dokumentiert in F-Schritt)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` grün; `ruff check`,
      `uv run pytest` grün
- [ ] `pnpm generate-api` lief; `api-types.ts` committed
- [ ] `get_ina_availability`/`get_ina_availability_for_period` und
      Konflikt-Engine unverändert (`git diff` zeigt nur additive
      Änderungen)
- [ ] Milestone-Abschluss-Checkliste (Sub-Schritt F) vollständig

## Out of Scope

- **Heatmap-Ansicht** Verfügbarkeit pro Arzt über ganzen Monat als
  separate Sicht — Folge-Milestone falls gewünscht
- **Bulk-Absence-Import** (CSV/Excel)
- **Absence-Konflikt-Detection** (überschneidende Abwesenheiten
  desselben Arztes) — gehört thematisch in M5
- **shadcn Calendar / react-day-picker** — HTML-Date-Input genügt
- **Reassign per Drag in RotationGrid** (Zelle → Zelle)
- **Tarif-Soft-Validierung** (M5-001)
- **Excel-Export** (M6-001)
- **Solver-Constraint für Absence** (M8-003 separat, additiver Pfad)

## Bekannte Stolperfallen

- **Drei-Quellen-Logik nicht duplizieren.** Der neue
  Availability-Endpoint **muss** den bestehenden Service aufrufen.
  Bei jeder Code-Review prüfen: `grep -n "blocks_ina"`
  in neuen Dateien → erwartet 0 Treffer.
- **Absence-Schema bereits vorhanden.** In Schritt A nicht erneut
  Schemas erfinden — `backend/app/schemas/absence.py` lesen und
  ggf. nur ergänzen (z. B. Update-Schema).
- **`activeDragDoctor` ist Trigger.** Hook in Schritt D nur laden,
  wenn `activeDragDoctor !== null` — sonst feuern Background-Requests
  beim Idle Mounten der Page.
- **Query-Invalidierung kreuzt zwei Domänen.** Absence-Mutationen
  invalidieren auch `availabilityKeys[doctorId]`. Sonst hängt der
  Plan-Indikator nach Absence-Anlage einen Cache-Zyklus hinterher.
- **`<input type="date">` Lokalisierung.** Browser zeigt das Datum
  lokal (DE-Format), sendet aber ISO. Konsistenz mit Backend-`date`
  ist gesichert — keine extra Konvertierung nötig.
- **Tests-Reihenfolge.** Frontend-Schritte (C–E) erst nach
  `pnpm generate-api` aus Schritt B starten, sonst fehlen die
  generierten Typen.
- **Bulk-Availability-Wunsch in Schritt E.** Falls Performance im
  Popover schlecht ist, ist die richtige Lösung ein neuer Bulk-Endpoint
  — nicht spontan in M4 hinzufügen. Stattdessen in
  `docs/open-questions.md` als Folge-Frage notieren.

## Annahmen

- `backend/app/models/absence.py` und `backend/app/schemas/absence.py`
  sind verwendbar wie vorgefunden; keine Migration nötig (Table existiert
  laut Stand der Modelle bereits).
- `get_ina_availability_for_period` bleibt unverändert; sein Verhalten
  ist Stand 2026-05-21 bzgl. ADR-016/017 korrekt.
- `INAExclusion`-Frontend-Komponenten zeigen das Pattern, das hier
  übernommen wird; keine zwischenzeitliche Umstrukturierung dort.
- Baseline-Tests: pytest 278 passed (nach M8-002), vitest 131 passed
  (nach M3-001).

Bei Unklarheit: `tasks/done/M3-001-plan-editor-v2-dnd.md` als
Briefing-Referenz; INAExclusion-Pattern als Code-Referenz.

## Workflow-Reminder (Branch und Merge)

Vor Start:

```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M4-001-verfuegbarkeit-und-absence
```

`pnpm generate-api` einmal nach Schritt B fahren, danach Frontend.

Nach Abschluss aller Sub-Schritte:

```powershell
git push origin task/M4-001-verfuegbarkeit-und-absence
# PR erstellen oder direkt mergen nach Review
git checkout main
git pull origin main
git merge task/M4-001-verfuegbarkeit-und-absence
git push origin main
```
