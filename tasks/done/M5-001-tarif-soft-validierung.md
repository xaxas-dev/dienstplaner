# Task M5-001: Tarif-Soft-Validierung (Framework, ohne konkrete Werte)

## Ziel

Phase A erhält ein read-only **Tarif-Validation-Framework**: eine
erweiterbare Plug-in-Pipeline im Backend, ein neuer API-Endpoint
`GET /api/plans/{id}/tarif-warnings` und ein zweiter Marker im
Plan-Grid neben dem bestehenden Konflikt-Warn-Dot.

Heute existiert nur `backend/app/solver/tarif_rules.py` als
Constraint-Registry mit `ConstraintId.DOUBLE_BOOKED` und drei leeren
`frozenset`s. Es gibt keinen Service, keinen Endpoint, keinen
Frontend-Indikator für tarif-relevante Regeln. Solange das so bleibt,
hat Phase A keine Andockstelle für künftige regulatorisch-harte oder
soft-Tarifregeln — und der Planungskoordinator hat keine Vorwarnung
vor Tarif-Risiken außerhalb der zwei harten Konfliktypen aus M2-005.

Konkret liefert dieser Milestone drei Bausteine, die auf demselben
Pipeline-Pattern aufsetzen:

1. **Plug-in-Architektur** — `TarifRule`-Protocol in
   `tarif_rules.py`; leere `REGISTERED_RULES`-Liste als Default.
2. **Validation-Pipeline** — `tarif_validation_service.py` ruft alle
   registrierten Regeln auf, aggregiert `TarifWarning`-Objekte pro
   Shift / Plan, analog zur Konflikt-Engine (`conflict_service.py`,
   ADR-035).
3. **Frontend-Marker** — `useTarifWarnings`-Hook + zweiter Dot
   (Sand-Token) am `ShiftCell` neben dem Konflikt-Dot. Klick öffnet
   `ContextPanel` mit `TarifWarning`-Liste.

**Bewusste Scope-Grenze.** Keine konkreten Tarif-Werte erfunden:
keine Wochenstunden-Schwelle, keine Ruhezeit-Schwelle, keine
ArbZG-Regel. `REGISTERED_RULES` bleibt im Prod-Code leer. Eine
Demo-Rule unter Test-Marker (`MaxConsecutiveDaysRule` mit Test-Schwelle)
zeigt das Plug-in-Pattern, läuft aber nur in `pytest`, nicht im laufenden
Backend. Konkrete Regeln kommen separat nach Klärung mit
Domänenexperten (siehe `docs/constraints.md`).

## Bindende Entscheidungen

1. **Pipeline-Pattern analog M2-005.** `tarif_validation_service.py`
   spiegelt `conflict_service.detect_conflicts` strukturell:
   Plan laden → bei unbekannter ID `PlanNotFoundError` →
   Shifts iterieren → pro Regel aufrufen → Warnings aggregieren.
   Memoization pro `(doctor_id, date)` falls Regeln das nutzen.
   Read-only, kein Caching über Requests hinweg (ADR-035).
2. **`TarifRule`-Protocol, kein Vererbungsbaum.** Plug-in-Schnittstelle
   per `typing.Protocol`: `class TarifRule(Protocol): id: ConstraintId;
   severity: TarifSeverity; def evaluate(self, db: Session, plan_id: int)
   -> list[TarifWarning]: ...`. Keine ABC, kein Mixin. Folgt
   Python-3.12-Idiomen aus `CLAUDE.md`.
3. **`REGISTERED_RULES` leer im Prod-Code.** Liste im Modul, aber kein
   Eintrag. Demo-Rule (`MaxConsecutiveDaysRule`) lebt im Testmodul und
   wird nur dort registriert (über lokale Liste pro Test, nicht global).
   Grep `REGISTERED_RULES` in Prod-Code = nur Definition + Import.
4. **Wrapper-Endpoint, keine Service-Logik in `api/`.**
   `GET /api/plans/{id}/tarif-warnings` ruft ausschließlich
   `compute_tarif_warnings(db, plan_id)`. Keine Geschäftslogik in
   `api/tarif_warnings.py` (CLAUDE.md-Layering).
5. **404 bei unbekannter `plan_id`**, konsistent mit M2-005-Konvention
   (`/plans/{id}/shifts`, `/plans/{id}/conflicts`).
6. **Frontend-Marker bleibt weich (ADR-033).** Sand-Dot ist read-only
   Hint. Kein Schreibpfad-Eingriff, kein Drop-Block, kein Auswahl-Block.
   Schicht-Zuweisung in `useAssignShift` bleibt unverändert.
7. **Zwei-Dot-Layout am ShiftCell.** Konflikt-Dot oben rechts bleibt
   (ADR-041). Tarif-Dot oben links, dezent (z. B. Sand-Token-Background,
   warn-Token-Border). Click stoppt Propagation analog
   `onConflictDotClick`.
8. **Cache-Invalidierung beim Shift-PATCH.** `useAssignShift` invalidiert
   nach onSuccess zusätzlich zu `shifts` + `conflicts` auch
   `tarifWarningKeys[planId]`. Konsistent mit ADR-043 (kein optimistic
   update).
9. **Backend-Reihenfolge zuerst.** `pnpm generate-api` einmal nach
   Sub-Schritt B; danach Frontend-Schritte (C–D).
10. **Sand-Token wiederverwenden, kein neuer Token.** ADR-031 hat
    bereits `sand` (`#F3ECD8`) als pastellen Akzent etabliert. Tarif-Dot
    nutzt diesen Token + bestehende `warn`-Border.

## Kontext (Leseanleitung)

1. [CLAUDE.md](../../CLAUDE.md) — Phasenmodell, „Weiche Validierung",
   Constraint-Klassen (logisch-hart / regulatorisch-hart / soft),
   Milestone-Abschluss-Checkliste, Frontend-Konventionen (Hooks,
   Query-Keys, keine optimistic updates)
2. [docs/roadmap.md](../../docs/roadmap.md) — M5-001-Einordnung,
   ADR-052-Sequenz M3 → M7
3. [docs/decisions.md](../../docs/decisions.md) — ADR-033 (weiche
   Validierung), ADR-035 (Konflikt-Engine read-only), ADR-038
   (Decoupling PATCH ↔ Konflikte), ADR-041 (Warn-Dot vs. Zell-Klick),
   ADR-031 (Sand-Token), ADR-043 (kein optimistic update)
4. [docs/constraints.md](../../docs/constraints.md) — Constraint-Klassen
   + Folge-Milestones-Tabelle (Tarif-Werte sind explizit „noch nicht
   implementiert")
5. [backend/app/solver/tarif_rules.py](../../backend/app/solver/tarif_rules.py) —
   bestehende `ConstraintId`-StrEnum und Klassifizierungs-Sets;
   Erweiterung um `TarifRule`-Protocol und `REGISTERED_RULES`
6. [backend/app/services/conflict_service.py](../../backend/app/services/conflict_service.py) —
   **Strukturvorlage** für `tarif_validation_service.py`: Plan-Load,
   404-Pfad, Memoization, Aggregation, Rückgabe-DTO
7. [backend/app/schemas/conflict.py](../../backend/app/schemas/conflict.py) —
   Vorlage für `tarif_warning.py`: `ShiftConflict`/`PlanConflicts`-Pattern
8. [backend/app/api/plans.py](../../backend/app/api/plans.py) — Vorlage
   für `api/tarif_warnings.py`-Routing (oder Einbau-Punkt — siehe
   Sub-Schritt B)
9. [backend/app/repositories/plan_repository.py](../../backend/app/repositories/plan_repository.py) —
   `get_plan(db, plan_id)` für 404-Prüfung
10. [frontend/src/features/plans/usePlanConflicts.ts](../../frontend/src/features/plans/usePlanConflicts.ts) —
    **Strukturvorlage** für `useTarifWarnings.ts`: Query-Key-Objekt,
    Disabled-Logik, Refetch-Verhalten
11. [frontend/src/features/plans/useAssignShift.ts](../../frontend/src/features/plans/useAssignShift.ts) —
    Einbau-Punkt für zusätzliche Invalidierung `tarifWarningKeys[planId]`
12. [frontend/src/features/plans/components/PlanGrid.tsx](../../frontend/src/features/plans/components/PlanGrid.tsx) +
    [ShiftCell aus components/dp/](../../frontend/src/components/dp/) —
    Einbau-Punkt für Sand-Dot pro Shift mit Tarif-Warning
13. [frontend/src/features/plans/components/ContextPanel.tsx](../../frontend/src/features/plans/components/ContextPanel.tsx) —
    Erweiterung um Tarif-Warning-Sektion
14. [frontend/src/features/plans/PlanPage.tsx](../../frontend/src/features/plans/PlanPage.tsx) —
    Hook-Aufruf + Marker-Verteilung an PlanGrid
15. [frontend/src/lib/api-types.ts](../../frontend/src/lib/api-types.ts) —
    nach Sub-Schritt B per `pnpm generate-api` aktualisieren

## Phase-A-Invariante

`conflict_service.detect_conflicts`, `get_ina_availability`,
`useAssignShift`-Schreibpfad, Solver-Pfad (M8), `tarif_rules.py`-StrEnum
(`ConstraintId.DOUBLE_BOOKED` und `LOGISCH_HART`-Set) bleiben
unverändert. Keine harte Validierung im Schreibpfad. `git diff` muss
zeigen: **additive** Erweiterung in `tarif_rules.py` (neuer Protocol,
neue Liste), **neue** Service-/Router-/Schema-Datei, **neue**
Frontend-Hook-/Test-Dateien, **additive** Marker-Logik in `PlanGrid`
und `ContextPanel`, plus Doku.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — Backend: Plug-in-Registry + Pipeline-Service

**Dateien:**
- `backend/app/solver/tarif_rules.py` (erweitern) — additiv:
  - Import `typing.Protocol`, `Session`, `date` (lazy wo möglich)
  - Neue `TarifSeverity(StrEnum)`: `INFO`, `WARNING`, `CRITICAL`
  - Neuer `TarifRule(Protocol)`: Attribute `id: ConstraintId`,
    `severity: TarifSeverity`; Methode
    `evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]`
  - Neue Liste `REGISTERED_RULES: list[TarifRule] = []` (leer in Prod)
  - `ConstraintId`-StrEnum bleibt unverändert (keine neuen IDs ohne
    Tarif-Klärung).
- `backend/app/schemas/tarif_warning.py` (neu):
  - `TarifSeverity`-Re-Export (oder Schema-eigene StrEnum, je nach
    Kreuzimport-Sauberkeit)
  - `TarifWarning`: `shift_id: int | None`, `doctor_id: int | None`,
    `shift_date: date | None`, `rule_id: str`, `severity: TarifSeverity`,
    `message: str`
  - `PlanTarifWarnings`: `plan_id: int`, `warnings: list[TarifWarning]`,
    `warning_count: int`
- `backend/app/services/tarif_validation_service.py` (neu):
  - `compute_tarif_warnings(db: Session, plan_id: int) -> PlanTarifWarnings`
  - 404-Pfad: `PlanNotFoundError` analog `conflict_service.py`
  - Iteriert `REGISTERED_RULES`; bei leerer Liste → `warnings=[]`
  - Aggregation: jede Regel liefert `list[TarifWarning]`, alle werden
    gesammelt. Keine Deduplizierung (Regeln sind unabhängig).
- `backend/tests/services/test_tarif_validation_service.py` (neu):
  - `test_empty_registry_returns_empty_warnings` (Default-Pfad)
  - `test_unknown_plan_id_raises_plannotfounderror`
  - `test_pipeline_aggregates_warnings_from_multiple_rules` mit
    **lokal definierten Test-Rules** (keine Registrierung in
    `REGISTERED_RULES`)
  - `test_rule_returning_empty_list_does_not_break_pipeline`
  - **Demo-Rule unter Test-Marker** (`MaxConsecutiveDaysRule` mit
    Test-Schwelle `n=3`): nur in Tests instanziiert, zeigt das
    Plug-in-Pattern. Schwelle ist Test-Parameter, kein Prod-Wert.

**Akzeptanzkriterien:**
- [x] `uv run pytest backend/tests/services/test_tarif_validation_service.py` grün
- [x] `uv run pytest` Baseline (alle 279+ Tests) grün
- [x] `ruff check backend` clean
- [x] `grep -n "REGISTERED_RULES.append" backend/app/` → 0 Treffer
      (keine Prod-Registrierung)
- [x] `tarif_rules.py`-Diff ist rein additiv: `DOUBLE_BOOKED`,
      `LOGISCH_HART`, `REGULATORISCH_HART`, `SOFT` unverändert
- [x] Service-Module enthält keine FastAPI-Imports

**Stop-Gate:** Commit
`feat(tarif): M5-001/A Plug-in-Registry + Pipeline-Service`,
auf Review warten.

---

### Sub-Schritt B — Backend: API-Endpoint + Schema-Generierung

**Dateien:**
- `backend/app/api/tarif_warnings.py` (neu) — Router:
  - `GET /api/plans/{plan_id}/tarif-warnings` — Response
    `PlanTarifWarnings`; 404 bei unbekannter `plan_id`
- `backend/app/main.py` — Router-Registrierung
- `backend/tests/api/test_tarif_warnings.py` (neu):
  - 200 mit leerer warnings-Liste bei bekanntem Plan
  - 404 bei unbekanntem `plan_id`
  - Response-Schema entspricht `PlanTarifWarnings`

**Logik:**
- Router-Funktion: `compute_tarif_warnings(db, plan_id)`-Aufruf, Exception
  → `PlanNotFoundError` → 404 (Exception-Handler-Registrierung prüfen
  in `main.py`; ggf. ergänzen falls noch nicht für diesen Pfad da).

**Akzeptanzkriterien:**
- [x] `uv run pytest backend/tests/api/test_tarif_warnings.py` grün
- [x] `uv run pytest` Baseline grün
- [x] `pnpm generate-api` läuft sauber;
      `frontend/src/lib/api-types.ts` enthält neue Typen
      (`PlanTarifWarnings`, `TarifWarning`, `TarifSeverity`)
- [x] `api-types.ts` committed im selben Commit oder direkt danach
- [x] Kein Service-Logik-Code in `api/tarif_warnings.py`

**Stop-Gate:** Commit `feat(api): M5-001/B Tarif-Warnings-Endpoint`,
auf Review warten.

---

### Sub-Schritt C — Frontend: Hook + Cache-Invalidierung

**Dateien:**
- `frontend/src/features/plans/useTarifWarnings.ts` (neu) —
  TanStack-Query-Hook:
  - `useTarifWarnings(planId: number | null)`; disabled wenn `null`
  - Query-Key-Objekt `tarifWarningKeys` (analog `conflictQueryKeys`)
- `frontend/src/features/plans/useAssignShift.ts` (bearbeiten) —
  Invalidierung nach `onSuccess` ergänzen: zusätzlich zu `shifts`
  + `conflicts` auch `tarifWarningKeys[planId]` invalidieren
- `frontend/src/features/plans/tests/useTarifWarnings.test.tsx`
  (neu) — Hook-Smoke-Test (lädt, parsed Response korrekt, disabled
  bei `null`)

**Akzeptanzkriterien:**
- [x] `pnpm typecheck` clean (kein `any`, keine `ts-ignore`)
- [x] `pnpm test` grün (alte + neue Tests)
- [x] Hook deaktiviert sich sauber bei `planId === null`
- [x] Invalidierung greift: Shift-Mutation triggert Refetch des
      Warnings-Endpoints (Test mit Mock + Spy)

**Stop-Gate:** Commit
`feat(plan): M5-001/C useTarifWarnings-Hook + Cache-Invalidierung`,
auf Review warten.

---

### Sub-Schritt D — Frontend: Marker im PlanGrid + ContextPanel

**Dateien:**
- `frontend/src/features/plans/PlanPage.tsx` (bearbeiten) —
  `useTarifWarnings(planId)`-Aufruf; Verteilung pro `shift_id` per
  Map (`Record<number, TarifWarning[]>`) an PlanGrid-Props
- `frontend/src/features/plans/components/PlanGrid.tsx` (bearbeiten) —
  pro Zelle: wenn `tarifWarnings[shift_id]?.length > 0` → Sand-Dot
  oben links rendern. Click-Handler öffnet ContextPanel mit
  Tarif-Warnings für diese Shift; `e.stopPropagation()` analog
  Konflikt-Dot (ADR-041).
- `frontend/src/features/plans/components/ContextPanel.tsx`
  (bearbeiten) — neue Sektion „Tarif-Warnungen" unterhalb
  „Konflikte". Severity-Chip pro Eintrag (INFO/WARNING/CRITICAL,
  Farbe aus Sand-/Warn-Token).
- `frontend/src/features/plans/tests/PlanGrid.tarifWarnings.test.tsx`
  (neu):
  - Render mit `tarifWarnings`-Map → markierte Zellen erhalten
    Sand-Dot
  - Click auf Sand-Dot öffnet ContextPanel mit den richtigen
    Warnungs-Einträgen
  - Click auf Sand-Dot stoppt Propagation (Zell-Klick wird **nicht**
    ausgelöst)

**Logik:**
- Sand-Dot bleibt rein visuell. Zell-Klick (Zuweisung ändern) bleibt
  unverändert nutzbar. Phase-A-Invariante.
- Cache wird über `useTarifWarnings` aus Sub-Schritt C wiederverwendet.

**Akzeptanzkriterien:**
- [x] `pnpm typecheck` clean
- [x] `pnpm test` grün
- [x] Manueller Smoke-Test in dev: PlanPage öffnen → keine Sand-Dots
      (leerer Default-Regelsatz) → Hook im Network-Tab feuert
      erfolgreich → keine UI-Regression
- [x] Bei manuell injizierten Test-Warnings (via React-DevTools
      oder Mock im Vitest) erscheinen Sand-Dots an den richtigen
      Zellen, Click öffnet ContextPanel
- [x] Keine neuen Design-Tokens; Sand-Token aus ADR-031
      wiederverwendet

**Stop-Gate:** Commit
`feat(plan): M5-001/D Tarif-Warning-Marker im PlanGrid`,
auf Review warten.

---

### Sub-Schritt E — Abschluss-Dokumentation

Pflichtschritte laut [CLAUDE.md](../../CLAUDE.md)
Milestone-Abschluss-Checkliste:

1. **`tasks/open/M5-001-tarif-soft-validierung.md`** →
   `tasks/done/` verschieben; alle `[ ]` → `[x]`; Abschnitt
   „Abschluss" anhängen (Datum, Branch, Commits A–E, Testergebnis
   pytest + vitest, ggf. neue offene Fragen).
2. **`docs/open-questions.md`** — Demo-Rule-Schwelle-Quelle als offene
   Frage notieren (z. B. „Tarif-Werte: aus `app_settings` oder aus
   `RuleOverride` lesen?"); ggf. weitere offene Fragen aus Sub-Schritten.
3. **`docs/decisions.md`** — neue ADRs:
   - **Tarif-Validierung als Plug-in-Pipeline**: `TarifRule`-Protocol,
     `REGISTERED_RULES`-Liste, leer im Prod-Code.
   - **Read-only Tarif-Warnings, weiche Markierung** analog
     Konflikt-Engine (ADR-035 / ADR-033).
   - **Sand-Dot oben links, Konflikt-Dot oben rechts** als
     Zwei-Indikator-Konvention am ShiftCell.
4. **`docs/constraints.md`** — neuer Abschnitt
   „Tarif-Validation-Framework (M5-001)": Pipeline-Pattern, leerer
   Regelsatz, Liste der noch nicht implementierten regulatorisch-harten
   und soft-Constraints bleibt bestehen (max-weekly-hours, min-rest-time,
   fairness-distribution).
5. **`CLAUDE.md`** — neuer Abschnitt „Frontend — Tarif-Warnings-Pattern
   (M5-001)": Hook-Konvention `useTarifWarnings`, Query-Key-Konvention,
   Sand-Dot bleibt weich, kein Drop-/Auswahl-Block, Cache-Invalidierung
   bei Shift-Mutation; **Backend — Tarif-Plug-in-Pipeline**:
   `TarifRule`-Protocol, `REGISTERED_RULES`-Konvention, neue Regeln
   liefern `list[TarifWarning]`, Severity-Klassifizierung.

**Stop-Gate:** Commit
`docs: M5-001 Abschluss + ADRs + CLAUDE.md`,
auf Review warten.

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] Backend: `tarif_rules.py` additiv um `TarifRule`-Protocol +
      `REGISTERED_RULES: list = []` erweitert; `ConstraintId`-StrEnum
      unverändert
- [x] Backend: `tarif_validation_service.py` + Schemas + Tests; pytest
      grün (Baseline + neue Tests)
- [x] Backend: `GET /api/plans/{id}/tarif-warnings` registriert,
      404 bei unbekannter `plan_id`
- [x] Frontend: `useTarifWarnings`-Hook + `tarifWarningKeys`-Query-Keys
- [x] Frontend: Sand-Dot in PlanGrid pro Shift mit Tarif-Warning;
      Click öffnet ContextPanel mit Warnings-Liste
- [x] Cache-Invalidierung bei Shift-Mutation; keine optimistic updates
- [x] Schreibpfad (PATCH Shift) unverändert; Drop und Auswahl in allen
      Fällen erlaubt (ADR-033)
- [x] Keine konkreten Tarif-Werte im Prod-Code (`grep` findet keine
      Schwellen außerhalb des Test-Moduls)
- [x] Keine neuen Design-Tokens; Sand-Token aus ADR-031
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` grün;
      `ruff check`, `uv run pytest` grün
- [x] `pnpm generate-api` lief; `api-types.ts` committed
- [x] `conflict_service.py`, `ina_availability_service.py`, Solver-Pfad
      unverändert (`git diff` zeigt nur additive Änderungen)
- [x] Milestone-Abschluss-Checkliste (Sub-Schritt E) vollständig

## Out of Scope

- **Konkrete Tarif-Regeln** (max-weekly-hours, min-rest-time, ArbZG)
  — kommen separat nach Domänenklärung; Prod-Code bleibt regelfrei
- **Override-Mechanismus für Tarif-Warnings** (A/B/C) — gehört zur
  Phase-B-Constraint-Klärung, nicht in M5
- **Solver-Constraints** (M8-003+) — additiver Pfad; Plug-in-Pipeline
  ist Phase-A-Pendant, kein Solver-Ersatz
- **Excel-Export** (M6-001)
- **Heatmap-Ansicht** der Tarif-Warnings über Monat — Folge-Milestone
- **Bulk-Endpoint** für mehrere Pläne — kein Anwendungsfall in
  Single-User-Lokal-App
- **Cross-Plan-Validierung** (z. B. Wochenstunden über
  Plan-Grenzen hinweg) — datenmodell-fern; vertagt
- **Configurable Severity per Rule** zur Laufzeit — kommt mit
  konkreten Regeln, nicht im Framework

## Bekannte Stolperfallen

- **`REGISTERED_RULES` darf nicht aus Tests heraus mutiert werden.**
  Tests definieren lokale Listen pro Test (Pytest-Fixture mit
  `monkeypatch.setattr(tarif_rules, "REGISTERED_RULES", [TestRule()])`
  ist ein sauberes Pattern). Globale `.append()` in Tests verschmutzt
  spätere Tests in derselben Session.
- **Demo-Rule nicht produktiv registrieren.** `MaxConsecutiveDaysRule`
  ist Test-Code; sie lebt im Test-Modul oder als reine Test-Fixture,
  nicht in `app/`. Sonst erscheinen im laufenden Backend Warnings mit
  einer Schwelle, die keiner geklärt hat.
- **Sand-Dot vs. Konflikt-Dot — Positionierung.** Konflikt-Dot oben
  rechts (ADR-041) bleibt; Tarif-Dot oben links. Beide Stop-Propagation
  unabhängig. Tests müssen prüfen, dass Click auf den einen nicht den
  anderen Handler triggert.
- **Cache-Invalidierung kreuzt Domänen.** `useAssignShift` invalidiert
  bereits `shifts` + `conflicts` (ADR-043). Erweiterung um
  `tarifWarningKeys[planId]` nicht vergessen, sonst hängt der
  Tarif-Dot eine Mutation hinterher.
- **`pnpm generate-api`-Reihenfolge.** Frontend-Schritte (C–D) erst
  nach Sub-Schritt B starten — neue Typen (`PlanTarifWarnings`,
  `TarifWarning`, `TarifSeverity`) müssen vorhanden sein.
- **`PlanNotFoundError`-Exception-Handler.** Falls noch nicht in
  `main.py` für FastAPI registriert für die neuen Router-Pfade,
  ergänzen — sonst kommen 500er statt 404.
- **Backend-Schema-Re-Export von `TarifSeverity`.** Wenn das Schema
  und das Solver-Modul beide eine `TarifSeverity` definieren, gibt es
  Doppeldefinition. Entscheidung: StrEnum lebt im Schema (`schemas/
  tarif_warning.py`), Solver-Modul importiert dort. Sonst zirkulärer
  Import-Pfad zwischen `schemas/` und `solver/`.
- **Optionale Felder in `TarifWarning`.** `shift_id`, `doctor_id`,
  `shift_date` sind `| None`, weil Plan-globale Warnings (z. B.
  „Sollbesetzung unterschritten") nicht an eine konkrete Shift gebunden
  sind. Frontend-Verteilung filtert auf `shift_id !== null` für
  Cell-Marker; Plan-globale Warnings landen im ContextPanel ohne
  Cell-Marker.

## Annahmen

- `tarif_rules.py`, `conflict_service.py`, `usePlanConflicts.ts` und
  `PlanGrid.tsx` sind im Stand 2026-05-21 (Post-M4-001) verwendbar wie
  vorgefunden — kein zwischenzeitlicher Umbau.
- `PlanNotFoundError` ist bereits an einen 404-Handler in `main.py`
  gebunden (Spur aus M2-005). Falls nicht: zusätzlich in Sub-Schritt B
  registrieren.
- Sand-Token aus ADR-031 (`#F3ECD8`) ist als Tailwind-Klasse `bg-sand`
  (oder analog) bereits gebunden — andernfalls aus `tokens.ts` ableiten,
  kein neuer Hex-Wert.
- Baseline-Tests: pytest 279 passed (nach M4-001), vitest 152 passed
  (nach M4-001).

Bei Unklarheit: `tasks/done/M2-005-konflikt-engine.md` für das
Konflikt-Engine-Pattern, `tasks/done/M4-001-verfuegbarkeit-und-absence.md`
für Hook-/Invalidierungs-Muster.

## Workflow-Reminder (Branch und Merge)

Vor Start:

```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M5-001-tarif-soft-validierung
```

`pnpm generate-api` einmal nach Sub-Schritt B fahren, danach Frontend.

Nach Abschluss aller Sub-Schritte:

```powershell
git push origin task/M5-001-tarif-soft-validierung
# PR erstellen oder direkt mergen nach Review
git checkout main
git pull origin main
git merge task/M5-001-tarif-soft-validierung
git push origin main
```

## Abschluss

- **Datum:** 2026-05-21
- **Branch:** `task/M5-001-tarif-soft-validierung`
- **Commits:**
  - `53fba15` feat(tarif): M5-001/A Plug-in-Registry + Pipeline-Service
  - `16d9f9e` feat(api): M5-001/B Tarif-Warnings-Endpoint
  - `f9f89ed` feat(plan): M5-001/C useTarifWarnings-Hook + Cache-Invalidierung
  - `3b86410` feat(plan): M5-001/D Tarif-Warning-Marker im PlanGrid
  - E-Commit: docs: M5-001 Abschluss + ADRs + CLAUDE.md
- **Testergebnis:**
  - pytest: 290 passed (Baseline 279 → +11 neue Tests)
  - vitest: 158 passed (Baseline 152 → +6 neue Tests)
- **Neue offene Fragen:** OQ-006 (Tarif-Werte-Quelle: `app_settings` oder `RuleOverride`?)
- **Phase-A-Invariante eingehalten:** `conflict_service.py`,
  `ina_availability_service.py`, Solver-Pfad unverändert.
  Schreibpfad nicht blockiert.
