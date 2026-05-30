# M9-002: BD-Opt-out — Per-Arzt Wochenstundenlimit

## Ziel
OQ-010 lösen: MAX_WEEKLY_HOURS-Constraint nutzt per-Arzt-Limit statt fixem 48h für alle Ärzte.
TV-Ärzte/TdL §7 Abs. 5 Opt-out-Stufen: BD-Stufe I (58h), BD-Stufe II (54h), Default (48h).

## Scope
- Backend: Doctor-Modell, Migration 0010, Schemas, SolverDoctor, Mapping, Constraint
- Tests: 3 neue Constraint-Tests (Opt-out) + 3 tarif_rules-Tests (Helper)
- Frontend: DoctorForm Select-Feld mit __none__-Sentinel
- Docs: ADR-088, OQ-010 geschlossen, constraints.md, CLAUDE.md

## Abschluss
Datum: 2026-05-30
Branch: main

## Commits
- 5a58e94 feat(solver): M9-002 BD-Opt-out-Konstanten und get_weekly_hours_limit() Helper
- 9748eae feat(db): M9-002 opt_out_bd_level Feld und Migration 0010
- ac432a6 feat(schema): M9-002 opt_out_bd_level in Doctor-Schemas
- 54dfd04 feat(solver): M9-002 max_weekly_hours_minutes Snapshot in SolverDoctor + Mapping
- 9f4544f feat(solver): M9-002 MAX_WEEKLY_HOURS nutzt doc.max_weekly_hours_minutes (per-Arzt)
- 1615247 test(solver): M9-002 3 Tests für MAX_WEEKLY_HOURS BD-Opt-out-Stufen
- d073bd0 feat(ui): M9-002 BD-Opt-out-Stufe im Arzt-Formular
- (dieser Docs-Commit)

## Testergebnis
Backend: 40 Constraint-Tests + 3 tarif_rules-Tests PASSED
Frontend: TypeScript-Check sauber (0 neue Fehler), manuell zu verifizieren

## Offene Punkte
- Keine. OQ-010 vollständig geschlossen.
