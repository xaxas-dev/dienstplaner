# Task M8-001: Solver-Skeleton (Phase B Start)

## Ziel
Erster Durchstich der Timefold-Solver-Integration (Phase B). Ein **Thin
Walking Skeleton**: Timefold ist als Dependency integriert, ein Plan kann
gelöst werden, **genau eine** logisch-harte Constraint (DOUBLE_BOOKED) ist
umgesetzt, gepinnte Shifts werden respektiert, alles isoliert im
`solver/`-Modul. **Additiv** — Phase A (manueller Planungsassistent) bleibt
vollständig unangetastet. NICHT die volle Tarif-Engine.

## Bindende Entscheidungen
1. **Milestone-ID M8-001** (doku-treu zu ADR-006/data-model.md; ein ADR
   stellt die Roadmap-Lücke M3–M7 klar).
2. **`POST /api/plans/{id}/solve` liefert nur einen read-only Vorschlags-Diff
   — KEIN DB-Write.** „Anwenden" ist ein Folge-Milestone.
3. **Erste Constraint: DOUBLE_BOOKED** (kein Arzt zweimal am selben Tag).
4. Synchroner Solve-Aufruf, Termination-Limit als benannte Konstante
   (Startwert 30 s Spent-Limit).

## Kontext (Leseanleitung)
1. `CLAUDE.md` (Phasenmodell, „Weiche Validierung", „solver/"-Konvention)
2. `docs/constraints.md`, `docs/decisions.md` (ADR-006, ADR-011)
3. `docs/data-model.md` (Pin-Konzept, Hybrid-Modell)
4. `backend/app/models/shift.py`, `plan.py`
5. `backend/app/repositories/shift_repository.py`, `plan_repository.py`
6. `backend/app/services/conflict_service.py` (read-only Konflikt-Wahrheit)
7. Offizielle Timefold-**Python**-Doku (timefold-Paket) — KEINE API aus
   dem Gedächtnis (Halluzinationswarnung CLAUDE.md)

## Phase-A-Invariante
Keine inhaltliche Änderung an `conflict_service.py`, `shift_service.py`,
`plan_shifts.py`, `shifts.py`, Modellen oder Schreibpfad. `git diff` zeigt
nur additive Solver-Dateien, eine additive Route in `plans.py`, Doku,
`pyproject.toml`.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)
- **A** — `timefold-solver` in `pyproject.toml` pinnen + doku-gestützter
  Python-API-Verifikationsspike + Smoke-Test.
- **B** — Solver-Domänenmodell `solver/domain.py` (Adapter über ORM).
- **C** — Mapping `solver/mapping.py` (ORM → Solver-Domäne, read-only).
- **D** — DOUBLE_BOOKED Constraint + ConstraintProvider + `tarif_rules.py`-
  Grundgerüst.
- **E** — `solver/solver_service.py` + additive read-only Route
  `POST /api/plans/{id}/solve` + `schemas/solve.py`.
- **F** — Doku (ADRs, `constraints.md`, ggf. `CLAUDE.md`), Briefing →
  `tasks/done/`, Merge.

## Akzeptanzkriterien
- [ ] `timefold-solver` gepinnt, Smoke-Test grün
- [ ] Solver-Domäne als Adapter, ORM bleibt unannotiert
- [ ] Mapping read-only, gepinnte Shift behält Arzt
- [ ] DOUBLE_BOOKED: positiver + negativer Test grün
- [ ] `POST /plans/{id}/solve` liefert Vorschlags-Diff; DB nachweislich
      unverändert
- [ ] Phase-A-Regression: gesamter Backend-`pytest` (Baseline 237) + 101
      vitest grün
- [ ] `git diff` nur additiv (Phase-A-Invariante)
- [ ] `ruff` clean; `enum.StrEnum`-Konvention im neuen Code
- [ ] ADRs + `constraints.md` aktualisiert
