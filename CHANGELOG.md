# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [Phase B — laufend] — ab 2026-05-19

### Added

- **M8-004** Solver-Constraint FAIR_DISTRIBUTION (soft, FTE-gewichtet) — Snapshot-Pattern, `group_by`-Constraint in timefold==1.24.0b0 (2026-05-26)
- **M8-003** Solver-Constraint ABSENT_DOCTOR (logisch-hart) — Availability-Snapshot als `frozenset[date]` auf `SolverDoctor` (2026-05-24)
- **M8-002** Solver-Apply-Endpoint `POST /api/plans/{id}/apply` — DB-Write ohne JVM, Pin-Guard (2026-05-19)
- **M8-001** Solver-Skeleton `POST /api/plans/{id}/solve` — read-only Vorschlags-Diff, timefold-Integration mit lazy JVM-Imports (2026-05-19)

## [Phase A — Abschluss] — 2026-05-22 bis 2026-05-27

### Added

- **M2-007** Unified Plan Grid — Dual-Tab durch einheitliches Grid ersetzt; Rotation, Schicht und Absence in einer Ansicht; `Department.color`-Feld (2026-05-27)
- **M1-012** Command Palette — ⌘K/Strg+K globaler Hotkey, Entity-Search (Ärzte, Pläne, Bereiche), Recents in localStorage (2026-05-25)
- **M7-002** Dashboard-Heute-Ansicht — `GET /api/plans/current` (204 statt 404), aggregierter Dashboard-Endpoint, KPI-Tiles, Coverage, Attention-Items (2026-05-24)
- **M7-001** Phase-A-Abschluss & Polish — LogoMark Sortier-D, Plan-Grid-Affordance (Dot-Grid/Crosshair/Hover), Arzt-Titel in DoctorCard, Backend-Lifecycle-Smoke-Test, Doku-Sweep (2026-05-22)
- **M6-001** Excel-Export — `GET /api/plans/{id}/export` via openpyxl, StreamingResponse, Browser-Direkt-Download (2026-05-22)
- **M5-001** Tarif-Soft-Validierung — TarifRule-Protocol, Plug-in-Pipeline, `GET /api/plans/{id}/tarif-warnings`, Sand-Dot im ShiftCell (2026-05-21)
- **M4-001** Verfügbarkeit & Rotation Management UI — Frontend-CRUD für RotationAssignment, INAExclusion, EmploymentPeriod, Absence; Amber-Verfügbarkeits-Hint (2026-05-21)
- **M3-001** Plan-Editor v2 mit Drag & Drop — dnd-kit Rotation-Zuweisung, RotationAssignPopover mit preselectedDoctorId (2026-05-21)

## [Phase A — Kern] — 2026-05-05 bis 2026-05-22

### Added

- **M2-006** Plan-Grid Polish — Surface-Tokens, Sticky-Spalten, Grid-Raster-Konventionen (2026-05-22)
- **M2-005** Konflikt-Engine — NOT_AVAILABLE und DOUBLE_BOOKED als read-only Warn-Dots; RFC 9457-Fehlerformat (2026-05-18)
- **M2-004** Schicht-Zuweisung — DoctorAssignPopover, `PATCH /api/shifts/{id}`, weiche Validierung (ADR-033) (2026-05-18)
- **M2-003** Plan-Frontend (Minimal-Grid) — PlanPage, PlanListPage, TanStack-Query-Hooks (2026-05-18)
- **M2-002b** INA-Verfügbarkeit — `get_ina_availability`, drei blockierende Quellen (Rotation, INAExclusion, Absence) (2026-05-18)
- **M2-002** Plan-Backend — CRUD-Endpunkte für Plan, Shift, RotationAssignment; INA-Verfügbarkeits-Service (2026-05-18)
- **M2-001** Plan-Datenmodell — Plan, Shift, RotationAssignment, INAExclusion, Absence, Wish (2026-05-18)
- **M1-011** Stammdaten-Migration — Atelier-Look auf alle Stammdaten-Seiten migriert (2026-05-21)
- **M1-009/010** Design-Foundation — Token-basiertes Design-System (tokens.ts, shift-palette.ts), AtelierShell, MiniRail, dp/-Primitives (2026-05-12/13)
- **M1-001 – M1-008** Stammdaten — Doctor, EmploymentPeriod, Department, ShiftType, Qualification, RuleOverride, AppSettings; Backend-CRUD + Frontend-Pages (2026-05-05 – 2026-05-12)
- **M0-003** API-Typgenerierung — OpenAPI → TypeScript-Types per `pnpm generate-api` (2026-05-07)
- **M0-001** Repo-Setup — FastAPI + React + SQLite + alembic + uv + pnpm + ruff (2026-05-05)
