# Task M6-001: Excel-Export

## Ziel

Einen Plan als `.xlsx`-Datei exportieren, damit der Planungskoordinator
den fertigen Dienstplan in das klinikinterne Tool übernehmen kann. Der
Export ist read-only auf die DB: er liest den aktuellen Plan-Stand und
erzeugt eine Tabellendatei — kein Schreibpfad, keine Validierung.

Heute existiert kein Export. Ein Plan lebt ausschließlich in der DB und im
Plan-Editor; es gibt keinen Weg, ihn als Datei aus der App zu bekommen.
Dieser Milestone schließt die letzte fachliche Lücke vor M7-001
(Phase-A-Abschluss).

Konkret liefert dieser Milestone drei Bausteine:

1. **Export-Service** — `plan_export_service.py` baut mit `openpyxl`
   in-memory ein Workbook aus dem Plan und gibt die Bytes zurück.
2. **API-Endpoint** — `GET /api/plans/{id}/export` streamt die Datei
   mit `Content-Disposition: attachment`.
3. **Frontend-Button** — Export-Button im `CommandBar` der `PlanPage`
   löst den Browser-Download aus.

**Bewusste Scope-Grenze (User-Entscheidung 2026-05-21).** M6-001 liefert
ein **pragmatisches Default-Schema**: ein einziges Tabellenblatt `Dienste`
mit allen Shifts des Plans (eine Zeile pro Shift). Kein Pivot-Layout,
keine Rotation, keine Stammdaten-Sheets. Das klinik-tool-spezifische
Schema wird **nicht** in diesem Milestone erfunden — es folgt als
separater Folge-Milestone, sobald die Spec des klinikinternen Tools
vorliegt (siehe `docs/open-questions.md`, OQ-007).

## Bindende Entscheidungen

1. **Pragmatisches Default-Schema.** Ein Sheet `Dienste`. Spalten in
   dieser Reihenfolge:
   `Datum`, `Wochentag`, `Schichttyp (Kurz)`, `Schichttyp`,
   `Arzt-Kürzel`, `Arzt`, `Gepinnt`, `Notiz`.
   Eine Datenzeile pro Shift. Header-Zeile fett. Rudimentäres
   Spalten-Autofit: `max(len(cell-string))` pro Spalte, geklemmt
   auf `[8, 40]`.
2. **`GET`-Endpoint, kein `POST`.** `GET /api/plans/{plan_id}/export`
   liefert MIME
   `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
   mit `Content-Disposition: attachment; filename="<slug>.xlsx"`.
   Die Roadmap-Formulierung `POST` wird hier bewusst auf `GET`
   korrigiert (kein Body, idempotent, Browser-Direkt-Download).
   → ADR-062.
3. **Service-Layering streng.** `plan_export_service.py` enthält die
   gesamte `openpyxl`-Logik. `api/plans.py` ruft nur den Service und
   streamt das Ergebnis. Keine `openpyxl`-Imports in `api/`
   (CLAUDE.md-Layering).
4. **404 bei unbekannter `plan_id`** via `PlanNotFoundError`, konsistent
   mit M2-005-Konvention.
5. **In-memory `BytesIO`, kein Tempfile.** Workbook bauen,
   `wb.save(buffer)`, `buffer.seek(0)`, `StreamingResponse`.
6. **Datum als ISO-8601-String** (`YYYY-MM-DD`) im Sheet. Vermeidet
   Locale-/Zeitzonen-Drift gegenüber Excel-nativem Datumstyp.
7. **Sortierung deterministisch:** `shift_date ASC`, dann
   `shift_type.display_order ASC`.
8. **Empty-Plan-Fall:** Plan ohne Shifts → Workbook mit Header-Zeile,
   keine Datenzeilen. Kein Fehler.
9. **Filename-Slug:** `re.sub(r"[^A-Za-z0-9_-]+", "-", plan.name).strip("-")`
   + `.xlsx`. Keine Slug-Library, kein Unicode-Transliterieren.
   Fallback `plan-{id}.xlsx` falls Slug leer.
10. **`openpyxl` als neue Backend-Dependency.** Eintrag in
    `backend/pyproject.toml`, `uv lock` aktualisieren. `openpyxl` ist
    in CLAUDE.md bereits als Stack-Bestandteil benannt — additive
    Ergänzung, keine neue Bibliothek im Sinne der „Rückfrage"-Regel.
11. **Frontend: Direkt-Download, kein fetch/Blob.** Export-Button im
    `CommandBar` via `primaryAction`-Prop. `onClick` →
    `window.location.assign(\`/api/plans/\${planId}/export\`)`.
    Der `GET`+`Content-Disposition`-Pfad triggert den Browser-Download
    ohne JS-Blob-Handling. Kein neuer Hook, kein Query-Key.
12. **Keine neuen Design-Tokens.** Button nutzt bestehende
    `primaryAction`-Styles aus `CommandBar.tsx`.

## Kontext (Leseanleitung)

1. [CLAUDE.md](../../CLAUDE.md) — Phasenmodell, Service-Layering
   (keine Business-Logik in `api/`), Milestone-Abschluss-Checkliste,
   API-Konventionen (ISO-8601, RFC 9457).
2. [docs/roadmap.md](../../docs/roadmap.md) — M6-001-Einordnung
   (ADR-052-Sequenz M3 → M7).
3. [tasks/done/M5-001-tarif-soft-validierung.md](../done/M5-001-tarif-soft-validierung.md) —
   **Struktur- und Workflow-Vorlage** (Sub-Schritt-Format, Stop-Gates,
   Abschluss-Doku).
4. [backend/app/api/plans.py](../../backend/app/api/plans.py) —
   bestehende Plan-Endpoints; Einbau-Punkt für `export` nach
   `apply_plan()`.
5. [backend/app/services/conflict_service.py](../../backend/app/services/conflict_service.py) —
   Vorlage für Plan-Load + 404-Pfad (`PlanNotFoundError`).
6. [backend/app/repositories/plan_repository.py](../../backend/app/repositories/plan_repository.py) —
   `get_plan(db, plan_id)` für 404-Prüfung.
7. [backend/app/models/plan.py](../../backend/app/models/plan.py),
   [shift.py](../../backend/app/models/shift.py),
   [shift_type.py](../../backend/app/models/shift_type.py),
   [doctor.py](../../backend/app/models/doctor.py) — Datenquellen für die
   Export-Spalten. Relationen: `plan.shifts → shift.shift_type`,
   `shift.doctor` (nullable).
8. [backend/pyproject.toml](../../backend/pyproject.toml) — Dependency
   ergänzen.
9. [frontend/src/features/plans/PlanPage.tsx](../../frontend/src/features/plans/PlanPage.tsx) —
   `<CommandBar />`-Einbau-Punkt (`primaryAction`-Prop).
10. [frontend/src/components/dp/CommandBar.tsx](../../frontend/src/components/dp/CommandBar.tsx) —
    `primaryAction`-Prop-Signatur (`{ label, icon?, onClick }`).

## Phase-A-Invariante

Read-only-Export. Kein Schreibpfad, keine Validierung, keine
Constraint-Prüfung. `conflict_service.py`, `ina_availability_service.py`,
`tarif_validation_service.py`, `useAssignShift`-Schreibpfad und der
Solver-Pfad bleiben unverändert. `git diff` zeigt: **neue**
Service-/Test-Dateien, **additiver** Endpoint in `api/plans.py`,
**additive** Dependency, **additiver** Button in `PlanPage.tsx`, plus Doku.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — Backend: Dependency + Export-Service

**Dateien:**
- `backend/pyproject.toml` (bearbeiten) — `openpyxl>=3.1,<4` zu
  `dependencies` ergänzen; `uv lock` ausführen, `uv.lock` committen.
- `backend/app/services/plan_export_service.py` (neu):
  - `build_plan_xlsx(db: Session, plan_id: int) -> bytes`
  - Plan laden via `plan_repository.get_plan`; `None` → `PlanNotFoundError`
  - Workbook mit einem Sheet `Dienste`; Header-Zeile (fett) gemäß
    Entscheidung 1
  - Shifts sortiert (Entscheidung 7); pro Shift eine Zeile;
    Doctor-NULL → leere Zellen für `Arzt-Kürzel`/`Arzt`
  - `Gepinnt`: `"ja"`/`""`; `Wochentag`: deutsche Kurzform (Mo–So)
  - Spalten-Autofit (Entscheidung 1)
  - `BytesIO` → `wb.save(buffer)` → `buffer.getvalue()`
- `backend/tests/services/test_plan_export_service.py` (neu):
  - `test_empty_plan_has_header_no_data_rows`
  - `test_plan_with_shifts_produces_one_row_per_shift` (3 Shifts,
    verschiedene ShiftTypes wg. UNIQUE-Constraint `(plan_id, shift_date,
    shift_type_id)`, einer ohne Doctor)
  - `test_rows_sorted_by_date_then_shifttype_order`
  - `test_unknown_plan_id_raises_plannotfounderror`
  - `test_bytes_roundtrip` — `load_workbook(BytesIO(result))` öffnet,
    Sheet `Dienste` vorhanden, Zellinhalte stimmen

**Akzeptanzkriterien:**
- [x] `uv run pytest backend/tests/services/test_plan_export_service.py` grün
- [x] `uv run pytest` Baseline (alle 290+ Tests) grün
- [x] `ruff check backend` clean
- [x] `grep -rn "openpyxl" backend/app/api/` → 0 Treffer (Layering)
- [x] `uv.lock` committed

**Stop-Gate:** Commit
`feat(export): M6-001/A openpyxl-Dep + Plan-Export-Service`,
auf Review warten.

---

### Sub-Schritt B — Backend: API-Endpoint

**Dateien:**
- `backend/app/api/plans.py` (bearbeiten) — neuer Endpoint
  `GET /{plan_id}/export`:
  - ruft `build_plan_xlsx(db, plan_id)`
  - `StreamingResponse(BytesIO(data), media_type=<xlsx-mime>,
    headers={"Content-Disposition": f'attachment; filename="{slug}.xlsx"'})`
  - Slug-Bildung (Entscheidung 9) — in den Service ziehen oder als
    kleine Helper-Funktion; `PlanNotFoundError` → 404
- `backend/tests/api/test_plan_export_endpoint.py` (neu):
  - `test_export_returns_200_xlsx_mime`
  - `test_content_disposition_contains_slug_filename`
  - `test_export_unknown_plan_returns_404`
  - `test_response_body_opens_as_workbook`

**Logik:**
- Endpoint enthält keine Workbook-Logik — nur Service-Call + Streaming.
- `PlanNotFoundError`-Handler ist seit M2-005 in `main.py` registriert
  (prüfen; ggf. ergänzen).

**Akzeptanzkriterien:**
- [x] `uv run pytest backend/tests/api/test_plan_export_endpoint.py` grün
- [x] `uv run pytest` Baseline grün
- [x] `ruff check backend` clean
- [x] `pnpm generate-api` läuft sauber; Binary-Response erzeugt **keinen**
      neuen Frontend-Type-Bruch (kein neues DTO erwartet)
- [x] Kein Service-Logik-Code in `api/plans.py`

**Stop-Gate:** Commit `feat(api): M6-001/B Excel-Export-Endpoint`,
auf Review warten.

---

### Sub-Schritt C — Frontend: Export-Button in CommandBar

**Dateien:**
- `frontend/src/features/plans/PlanPage.tsx` (bearbeiten) —
  `<CommandBar />` `primaryAction`-Prop setzen:
  - `label: "Exportieren"`, `icon: FileDown` (lucide-react)
  - `onClick: () => window.location.assign(\`/api/plans/\${planId}/export\`)`
  - nur rendern wenn `planId !== null` (kein Button ohne geladenen Plan)
- `frontend/src/features/plans/tests/PlanPage.export.test.tsx` (neu):
  - Button „Exportieren" erscheint sobald Plan geladen
  - Klick ruft `window.location.assign` mit korrekter URL
    (`window.location` in jsdom mocken — Entscheidung Stolperfallen)

**Akzeptanzkriterien:**
- [x] `pnpm typecheck` clean (kein `any`, keine `ts-ignore`)
- [x] `pnpm test` grün (alte + neue Tests)
- [x] Kein neuer Hook, kein neuer Query-Key, kein neuer Design-Token

**Stop-Gate:** Commit `feat(plan): M6-001/C Export-Button in CommandBar`,
auf Review warten.

---

### Sub-Schritt D — Smoke-Test + Abschluss-Dokumentation

**Manueller Smoke-Test:**
- Dev-Backend (`uvicorn`) + Dev-Frontend (`vite`) starten
- Plan mit einigen Shifts öffnen → „Exportieren" klicken
- `.xlsx` lädt herunter, öffnet in Excel/LibreOffice ohne Fehler,
  Header + alle Shift-Zeilen vorhanden, Sortierung korrekt
- Leeren Plan exportieren → nur Header-Zeile

**Pflichtschritte (CLAUDE.md Milestone-Abschluss-Checkliste):**
1. **`tasks/open/M6-001-excel-export.md`** → `tasks/done/`; alle `[ ]`
   → `[x]`; Abschnitt „Abschluss" anhängen (Datum, Branch, Commits A–D,
   Testergebnis pytest + vitest).
2. **`docs/roadmap.md`** — M6-001-Status auf ✅ setzen.
3. **`docs/open-questions.md`** — OQ-007 eintragen:
   „Excel-Schema-Anpassung an klinikinternes Tool — welches Spalten-/
   Sheet-Layout erwartet das Tool? Default-Schema (M6-001) ist Platzhalter
   bis Spec vorliegt." Status: Offen.
4. **`docs/decisions.md`** — neue ADRs:
   - **ADR-062: Excel-Export via `GET`-Endpoint + `StreamingResponse`.**
     Begründung: idempotent, kein Body, Browser-Direkt-Download;
     korrigiert Roadmap-`POST`.
   - **ADR-063: Pragmatisches Default-Schema (ein Sheet, alle Shifts)**
     bis klinik-tool-Spec vorliegt. Begründung: Export-Pipeline jetzt
     nutzbar, Schema-Anpassung additiv möglich ohne Re-Plumbing.
5. **`docs/constraints.md`** — Abschnitt „Excel-Export (M6-001)":
   Spalten-Liste, read-only, keine Constraint-Prüfung im Export.
6. **`CLAUDE.md`** — neuer Abschnitt „Backend — Plan-Excel-Export
   (M6-001)": Service-Layering (`openpyxl` nur im Service),
   `BytesIO`-`StreamingResponse`-Pattern, Slug-Konvention;
   Frontend-Hinweis: Direkt-Download via `window.location.assign`,
   kein fetch/Blob, kein Hook.

**Stop-Gate:** Commit `docs: M6-001 Abschluss + ADRs + CLAUDE.md`,
auf Review warten.

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] Backend: `openpyxl` in `pyproject.toml` + `uv.lock`
- [x] Backend: `plan_export_service.build_plan_xlsx` + Tests; pytest grün
- [x] Backend: `GET /api/plans/{id}/export` registriert, 404 bei
      unbekannter `plan_id`, korrekter MIME + `Content-Disposition`
- [x] Frontend: Export-Button im CommandBar; Klick triggert Download
- [x] Service-Layering: keine `openpyxl`-Imports in `api/`
- [x] Read-only: kein Schreibpfad, keine Validierung; Phase-A-Invariante
      (`git diff` rein additiv)
- [x] `pnpm typecheck`, `pnpm test` grün; `ruff check`, `uv run pytest` grün
- [x] `pnpm generate-api` lief ohne Type-Bruch
- [x] Manueller Smoke-Test bestanden (Plan mit Shifts + leerer Plan)
- [x] Milestone-Abschluss-Checkliste (Sub-Schritt D) vollständig

## Out of Scope

- **Klinik-tool-spezifisches Schema** — Folge-Milestone nach Spec (OQ-007)
- **Pivot-Layout** (Datum × Schichttyp), Multi-Sheet, Rotation-Sheet,
  Stammdaten-Sheet
- **Zeitraum-/Sub-Plan-Filter** im Export (Body-Parameter)
- **PDF-Export**
- **Bulk-Export** mehrerer Pläne — kein Anwendungsfall (Single-User-Lokal)
- **Style-/Branding** (Logos, Farben, Zellformatierung über Header-Fett
  + Autofit hinaus)
- **Import** (Excel → DB) — nicht Teil dieses Milestones

## Bekannte Stolperfallen

- **`StreamingResponse` + `BytesIO`:** `buffer.seek(0)` vor Übergabe,
  sonst 0 Bytes. Bei `getvalue()`-Variante neuen `BytesIO(data)` im
  Endpoint erzeugen.
- **`uv lock` nicht vergessen.** Ohne aktualisierte `uv.lock` brechen
  saubere Installs / CI.
- **Doctor-NULL-Fall:** Shift ohne `doctor_id` → leere Zellen, kein Crash.
- **UNIQUE-Constraint in Tests:** mehrere Shifts am selben Plan+Tag
  brauchen verschiedene `ShiftType`s (CLAUDE.md Tests-Konvention).
- **`Content-Disposition`-Sonderzeichen:** Plan-Name kann Umlaute/Slashes
  enthalten. Slug (Entscheidung 9) entfernt sie vorab → kein
  RFC-5987-`filename*`-Encoding nötig.
- **Frontend-Test `window.location.assign`:** in jsdom nicht direkt
  überschreibbar — via `Object.defineProperty(window, 'location',
  { value: { assign: vi.fn() }, writable: true })` mocken.
- **`PlanNotFoundError`-Handler:** prüfen, dass er in `main.py` für den
  neuen Pfad greift (seit M2-005 vorhanden) — sonst 500 statt 404.

## Annahmen

- `plan_repository.get_plan`, `PlanNotFoundError`-Handler und die
  Plan-/Shift-/ShiftType-/Doctor-Modelle sind im Stand 2026-05-21
  (Post-M5-001) verwendbar wie vorgefunden.
- `openpyxl` ist in CLAUDE.md als Stack-Bestandteil deklariert →
  Hinzufügen ist erwartet, keine separate Bibliotheks-Rückfrage nötig.
- `CommandBar.primaryAction`-Prop (`{ label, icon?, onClick }`) ist
  vorhanden und gerendert.
- Baseline-Tests: pytest 290 passed, vitest 158 passed (nach M5-001).

Bei Unklarheit: `tasks/done/M5-001-tarif-soft-validierung.md` für das
Service-/Endpoint-/Abschluss-Muster.

## Workflow-Reminder (Branch und Merge)

Vor Start:

```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M6-001-excel-export
```

`pnpm generate-api` einmal nach Sub-Schritt B fahren.

Nach Abschluss aller Sub-Schritte:

```powershell
git push origin task/M6-001-excel-export
# PR erstellen oder direkt mergen nach Review
git checkout main
git pull origin main
git merge task/M6-001-excel-export
git push origin main
```

## Abschluss

- **Datum:** 2026-05-22
- **Branch:** `task/M6-001-excel-export`
- **Commits:**
  - `18d07d2` feat(export): M6-001/A openpyxl-Dep + Plan-Export-Service
  - `c01ec81` feat(api): M6-001/B Excel-Export-Endpoint
  - `37d3000` feat(plan): M6-001/C Export-Button in CommandBar
  - D-Commit: docs: M6-001 Abschluss + ADRs + CLAUDE.md
- **Testergebnis:**
  - pytest: 311 passed, 26 skipped (Baseline 290 → +11 neue Tests)
  - vitest: 164 passed (Baseline 158 → +3 neue Tests)
- **Neue offene Fragen:** OQ-007 (Excel-Schema für klinikinternes Tool)
- **ADRs:** ADR-063 (GET-Endpoint + StreamingResponse), ADR-064 (Default-Schema)
- **Phase-A-Invariante eingehalten:** Kein Schreibpfad, keine Validierung,
  alle bestehenden Services unverändert.
