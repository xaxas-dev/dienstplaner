# Roadmap

Stand: 2026-05-31. Schließt die Lücke aus ADR-044 (M3–M7 nicht ausgearbeitet).

## Phasen-Modell

- **Phase A — Manueller Planungsassistent.** Manuelles Zuweisen mit
  read-only Konflikt-Erkennung. M0–M7 gehören vollständig in Phase A.
- **Phase B — Solver-Optimierung.** timefold-solver optimiert additiv,
  Phase-A-Schreibpfade bleiben unangetastet. M8+ und M9+ gehören in Phase B.

Konsequenzen siehe [CLAUDE.md](../CLAUDE.md) (Weiche Validierung,
Solver-ist-additiv).

## Phase A — abgeschlossen

| ID | Titel | Status |
|----|-------|--------|
| M0-001 | Repo-Setup | ✅ |
| M0-003 | API-Typgenerierung | ✅ |
| M1-001 – M1-011 | Stammdaten + Design-Foundation + Migration | ✅ |
| M2-001 | Plan-Datenmodell | ✅ |
| M2-002 | Plan-Backend (CRUD + INA-Verfügbarkeit) | ✅ |
| M2-003 | Plan-Frontend (Minimal-Grid) | ✅ |
| M2-004 | Shift-Assignment (Click-Popover) | ✅ |
| M2-005 | Konflikt-Engine (NOT_AVAILABLE, DOUBLE_BOOKED) | ✅ |
| M2-006 | Plan-Grid Polish (Surface, Tokens) | ✅ |
| M1-012 | Command Palette (⌘K / Strg+K, Entity-Search, Recents) | ✅ |
| M2-007 | Unified Plan Grid (Dual-Tab entfernt, Rotation+Schicht+Absence in einer Ansicht) | ✅ |

## Phase A — Lücke schließen (M3–M7, neu definiert)

Sequenz vom direkten Anwender-Nutzen (was im Plan-Editor heute nicht
geht) zurück zu Polish. Jeder Milestone ist eng geschnitten (eine
Kernfunktion pro Milestone). Briefings folgen der M8-002-Vorlage und
werden je nach Reihenfolge in `tasks/open/` ausgearbeitet.

### M3-001 — Plan-Editor v2 (Rotations-Zuweisung per Drag & Drop)

**Ziel.** Rotations-Zuweisungen (Arzt → Bereich) in der Bereiche-Ansicht
per Drag & Drop erfassen. Drop öffnet `RotationAssignPopover` mit
vorausgewähltem Arzt; Klick-Pfad bleibt als a11y-Fallback erhalten.
Dienste-Ansicht (Schicht-Zuweisung) bleibt unverändert.

**Kerndeliverable.** dnd-kit Drop-Target an RotationGrid-Zellen;
`RotationAssignPopover` mit `preselectedDoctorId`-Prop. Keine semantische
Validierung im Drop-Pfad (weiche Validierung, ADR-033).

**Abhängigkeiten.** Keine — RotationGrid + RotationAssignPopover sind
seit M2-006/feat/bereich-grid vollständig.

**Status.** ✅ Abgeschlossen (2026-05-21). dnd-kit Drop-Target an RotationGrid-Zellen; `RotationAssignPopover` mit `preselectedDoctorId`-Prop. Klick-Pfad als a11y-Fallback erhalten.

### M4-001 — Verfügbarkeit & Rotation Management UI

**Ziel.** Die drei INA-Verfügbarkeitsquellen (RotationAssignment,
INAExclusion, Absence) und die EmploymentPeriod werden im Frontend
verwaltbar. Backend-APIs existieren seit M2 — nur die UI fehlt.

**Kerndeliverable.** Frontend-CRUD für RotationAssignment, INAExclusion,
EmploymentPeriod, Absence; Verfügbarkeitsanzeige pro Arzt/Datum unter
Nutzung des bestehenden `get_ina_availability`-Services.

**Abhängigkeiten.** M3-001 (geteiltes Plan-UX-Vokabular: Popover-Pattern,
dp-Tokens, dnd-kit falls relevant).

**Status.** ✅ Abgeschlossen (2026-05-21). Frontend-CRUD für RotationAssignment, INAExclusion, EmploymentPeriod, Absence; Verfügbarkeitsanzeige mit Amber-Ring/-Dot in RotationGrid und DoctorAssignPopover.

### M5-001 — Tarif-Soft-Validierung (Framework, ohne konkrete Werte)

**Ziel.** Read-only Validation-Service für Tarif-Regeln + Frontend-Anzeige
als weiche Warnungen im Plan-Grid. Konkrete Tarif-Werte
(max-weekly-hours, min-rest-time, ArbZG-Schwellen) werden in diesem
Milestone **nicht** erfunden — sie kommen separat nach Klärung mit
Domänenexperten.

**Kerndeliverable.** Erweiterung von `tarif_rules.py` um eine
Tarif-Validations-Pipeline (Plug-in-Architektur, leerer
Regelsatz-Default); Read-only API-Endpoint `GET /plans/{id}/tarif-warnings`;
Frontend-Marker (analog Konflikt-Dot). Keine Schreibpfad-Blockade.

**Abhängigkeiten.** M2-005 (Konflikt-Pattern als Vorlage), M3-001
(Grid-Marker-Konvention).

**Status.** ✅ Abgeschlossen (2026-05-21). `TarifRule`-Protocol, leerer `REGISTERED_RULES`-Prod-Regelsatz, `GET /api/plans/{id}/tarif-warnings`, Sand-Dot (§) im ShiftCell als weicher Hint.

### M6-001 — Excel-Export

**Ziel.** Einen Plan als `.xlsx`-Datei für das klinikinterne Tool
exportieren.

**Kerndeliverable.** `GET /api/plans/{id}/export` mit openpyxl (Stack-Bestandteil, ADR-063); Frontend-Download-Button via `window.location.assign` in der CommandBar.

**Abhängigkeiten.** Excel-Spaltenschema muss vor Start mit dem
Klinik-Tool abgeglichen werden (siehe offene Domänen-Frage zum Schema).

**Status.** ✅ Abgeschlossen (2026-05-22). Default-Schema (ein Sheet `Dienste`, eine Zeile pro Shift). Klinik-tool-spezifisches Schema folgt als Folge-Milestone (OQ-007).

### M7-001 — Phase-A-Abschluss & Polish

**Ziel.** Phase A formal abschließen.

**Kerndeliverable.** End-to-End-Smoke-Tests (Backend + Frontend);
README-/Doku-Sweep (Architektur, Datenmodell, Constraints);
Aufräumen verbleibender TODO-Marker aus M3–M6; offene Stolperfallen
schließen.

**Abhängigkeiten.** M3–M6 abgeschlossen.

**Status.** ✅ Abgeschlossen (2026-05-22). Logo (Sortier-D), Grid-Affordance (3 Ebenen), Arzt-Titel in DoctorCard, Backend-Lifecycle-Smoke-Test, vollständiger Doku-Sweep.

## Phase B — laufend

| ID | Titel | Status |
|----|-------|--------|
| M8-001 | Solver-Skeleton (`/solve`, read-only Diff) | ✅ |
| M8-002 | Solver-Apply (`/apply`, DB-Write ohne JVM) | ✅ |
| M8-003 | Solver-Constraint ABSENT_DOCTOR (logisch-hart) | ✅ Abgeschlossen (2026-05-24). Availability-Snapshot-Pattern; `get_ina_availability_for_period` wiederverwendet. |
| M8-004 | Solver-Constraint FAIR_DISTRIBUTION (soft, FTE-gewichtet) | ✅ Abgeschlossen (2026-05-26). Snapshot-Pattern (ADR-076); `get_fte_for_period` neu. `group_by(key1, key2, count())` + 3-arg Lambda verifiziert (timefold==1.24.0b0). |
| M8-005 | Solver-Constraint MAX_BD_PER_MONTH (§ 7 Abs. 5a TV-Ärzte/TdL, max. 4 BD/Monat) | ✅ Abgeschlossen (2026-05-29). ShiftType-Flag `is_bereitschaftsdienst`; Snapshot in `to_solver()`; regulatorisch-harter Hard-Score. |
| M8-006 | Solver-Constraints MAX_WEEKENDS_PER_MONTH + MIN_REST_TIME (ArbZG §5, TV-Ärzte/TdL) | ✅ Abgeschlossen (2026-05-29). Snapshot-Extension `shift_start/end_minutes` in SolverShift; `for_each_unique_pair`-Pattern für MIN_REST_TIME; Wochenend-Zählung per `weekday() in (5, 6)`. |
| M8-007 | Solver-Constraint MAX_WEEKLY_HOURS (ArbZG §3, 48 h/Woche) | ✅ Abgeschlossen (2026-05-30). ISO-Wochengruppierung; `ConstraintCollectors.sum()` verifiziert; JPy-Index-Zugriff (ADR-086). Per-Arzt-Opt-out via M9-002. |
| M8-008 | Solver-Constraint MAX_CONSECUTIVE_DAYS (soft) | ✅ Abgeschlossen (2026-05-30). Pair-Ansatz (`for_each_unique_pair`, Ordinal-Diff == 5); `SolverShift.shift_date_ordinal` (ADR-087). Wert=5 ist Platzhalter (Domänenexperte ausstehend). |

## Phase B — Frontend (separater Strang)

| ID | Titel | Status |
|----|-------|--------|
| M9-001 | Solver Review-&-Apply UI (Diff anzeigen, anwenden) | ✅ Abgeschlossen (2026-05-29). Modal-Panel mit Diff-Tabelle, Apply-Button, JVM-Toast (ADR-084/085). |
| M9-002 | BD-Opt-out — Per-Arzt Wochenstundenlimit (§ 7 Abs. 5 TV-Ärzte/TdL) | ✅ Abgeschlossen (2026-05-30). `Doctor.opt_out_bd_level` + Migration 0010; `SolverDoctor.max_weekly_hours_minutes` Snapshot; `get_weekly_hours_limit()` Helper (ADR-088); Frontend-Select im Arztformular. |

Erläuterung: Die Solver-Frontend-Arbeit wird bewusst von der
Phase-A-Roadmap (M3–M7) getrennt geführt, damit M3–M7 thematisch
„Phase-A-Abschluss" bleibt und nicht durch Solver-UX-Entscheidungen
blockiert wird.

## Phase B — Constraint-Override-System

| ID | Titel | Status |
|----|-------|--------|
| M10-001 | Constraint-Override-Mechanismus A/B/C | ✅ Abgeschlossen (2026-05-31). Dreistufiges Override-System: Ebene A (Plan-global, PlanSettingsModal), Ebene B (Arzt+Regel+Zeitraum, Arzt-Detailseite), Ebene C (Einzelverstoß, ContextPanel §-Dot). DB: `constraint_overrides` (Migration 0011). Backend: ORM, Schemas, Repository, Service mit `OverrideSnapshot`-Pattern, REST-API (POST/GET/DELETE). Solver: 4 regulatorisch-harte Constraints respektieren Override-Flags (`disabled_*` auf `SolverShift`). Tarif-Validierung filtert Warnungen per Override. |

## Phase A — Workflow-Konzept (M12, neu)

Basis: docs/superpowers/specs/2026-06-02-ina-dienstplanung-workflow-design.md

| ID | Titel | Status |
|----|-------|--------|
| M12-001 | Besetzungs-Layer read-only (`Plan.besetzung_locked`, Rotation-DnD-Sperre) | ✅ Abgeschlossen (2026-06-02) |
| M12-002 | INA-Nachtdienstwochen als Input (`Shift.is_locked`) | ✅ Abgeschlossen (2026-06-02) |
| M12-003 | Feiertagskalender (`Holiday`, SH-Auto + manuell) | ✅ Abgeschlossen (2026-06-03) |
| M12-004 | Wünsche-Erfassung UI (`Wish`-CRUD) | ✅ Abgeschlossen (2026-06-03) |
| M12-005 | Fokus-Filter Dienst-Phasen (Nacht/Tag/V) | offen |
| M12-006 | Fairness-Zähler-Sidebar | offen |
| M12-007 | Hinweis WE vor/nach Urlaub | offen |
| M13-001 | Excel-Import Besetzung (blockiert durch OQ-012) | offen |

## Cross-cutting

- **Konventionen.** Alle Milestones folgen den Konventionen aus
  [CLAUDE.md](../CLAUDE.md) (weiche Validierung, Pin-Konzept,
  Briefing-Format, Milestone-Abschluss-Checkliste).
- **ADR-Pflege.** Neue bindende Entscheidungen pro Milestone in
  [docs/decisions.md](decisions.md).
- **Constraints.** Neue Validierungen / Constraints in
  [docs/constraints.md](constraints.md).
- **Offene Fragen.** Domänenfragen in
  [docs/open-questions.md](open-questions.md) vor Milestone-Start klären.
