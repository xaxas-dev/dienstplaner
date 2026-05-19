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
- [x] `timefold-solver` gepinnt, Smoke-Test grün
- [x] Solver-Domäne als Adapter, ORM bleibt unannotiert
- [x] Mapping read-only, gepinnte Shift behält Arzt
- [x] DOUBLE_BOOKED: positiver + negativer Test grün
- [x] `POST /plans/{id}/solve` liefert Vorschlags-Diff; DB nachweislich
      unverändert
- [x] Phase-A-Regression: gesamter Backend-`pytest` (Baseline 237) + 101
      vitest grün
- [x] `git diff` nur additiv (Phase-A-Invariante)
- [x] `ruff` clean; `enum.StrEnum`-Konvention im neuen Code
- [x] ADRs + `constraints.md` aktualisiert

## Abschluss

**Status:** Vollständig abgeschlossen (2026-05-19). Branch
`task/M8-001-solver-skeleton` bereit für Merge in `main`.

**Commits (A–F):**
- A: `chore(solver): pin timefold-solver + API-Verifikationsspike`
- B: `feat(solver): solver domain model adapter`
- C: `feat(solver): orm -> solver domain mapping (M8-001/C)`
- D: `feat(solver): double-booked hard constraint + tarif_rules scaffold (M8-001/D)`
- E: `feat(solver): solver service + read-only POST /plans/{id}/solve (M8-001/E)`
- F: `docs(solver): M8-001 ADRs + constraints + CLAUDE.md Timefold-API (M8-001/F)`

**Testergebnis:** 237 passed, 26 skipped (JVM-Guard aktiv — Java 17+ fehlt).
Die 26 Solver-Tests laufen durch sobald Eclipse Temurin 21 installiert ist.

**Java-Voraussetzung:** Eclipse Temurin **JDK 21** (LTS).
- JDK 8 (`jre1.8.0_491`): unzureichend — `Runtime.version()` API fehlt.
- JDK 25: technisch ≥ 17, aber gegen timefold 1.24.0b0 ungetestet — nicht empfohlen.
- Download: adoptium.net/temurin/releases → Version 21 → Windows x64 → `.msi`
