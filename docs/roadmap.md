# Roadmap

Stand: 2026-05-20. Schließt die Lücke aus ADR-044 (M3–M7 nicht ausgearbeitet).

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

**Status.** 🚧 In Arbeit (Sub-Schritt A/A' committed, B–F ausstehend):
`tasks/open/M3-001-plan-editor-v2-dnd.md`.

### M4-001 — Verfügbarkeit & Rotation Management UI

**Ziel.** Die drei INA-Verfügbarkeitsquellen (RotationAssignment,
INAExclusion, Absence) und die EmploymentPeriod werden im Frontend
verwaltbar. Backend-APIs existieren seit M2 — nur die UI fehlt.

**Kerndeliverable.** Frontend-CRUD für RotationAssignment, INAExclusion,
EmploymentPeriod, Absence; Verfügbarkeitsanzeige pro Arzt/Datum unter
Nutzung des bestehenden `get_ina_availability`-Services.

**Abhängigkeiten.** M3-001 (geteiltes Plan-UX-Vokabular: Popover-Pattern,
dp-Tokens, dnd-kit falls relevant).

**Status.** ⏳ Geplant.

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

**Status.** ⏳ Geplant.

### M6-001 — Excel-Export

**Ziel.** Einen Plan als `.xlsx`-Datei für das klinikinterne Tool
exportieren.

**Kerndeliverable.** `POST /api/plans/{id}/export` mit openpyxl
(Stack-Bestandteil); Frontend-Download-Button in der CommandBar.

**Abhängigkeiten.** Excel-Spaltenschema muss vor Start mit dem
Klinik-Tool abgeglichen werden (siehe offene Domänen-Frage zum Schema).

**Status.** ⏳ Geplant; vor Start: Schema-Klärung.

### M7-001 — Phase-A-Abschluss & Polish

**Ziel.** Phase A formal abschließen.

**Kerndeliverable.** End-to-End-Smoke-Tests (Backend + Frontend);
README-/Doku-Sweep (Architektur, Datenmodell, Constraints);
Aufräumen verbleibender TODO-Marker aus M3–M6; offene Stolperfallen
schließen.

**Abhängigkeiten.** M3–M6 abgeschlossen.

**Status.** ⏳ Geplant.

## Phase B — laufend

| ID | Titel | Status |
|----|-------|--------|
| M8-001 | Solver-Skeleton (`/solve`, read-only Diff) | ✅ |
| M8-002 | Solver-Apply (`/apply`, DB-Write ohne JVM) | ✅ |
| M8-003 | Solver-Constraint ABSENT_DOCTOR (logisch-hart) | ⏳ |
| M8-004+ | Weitere Solver-Constraints (regulatorisch, soft) | ⏳ Tarif-Werte nötig |

## Phase B — Frontend (separater Strang)

| ID | Titel | Status |
|----|-------|--------|
| M9-001 | Solver Review-&-Apply UI (Diff anzeigen, anwenden) | ⏳ Geplant |

Erläuterung: Die Solver-Frontend-Arbeit wird bewusst von der
Phase-A-Roadmap (M3–M7) getrennt geführt, damit M3–M7 thematisch
„Phase-A-Abschluss" bleibt und nicht durch Solver-UX-Entscheidungen
blockiert wird.

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
