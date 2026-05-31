# Constraint-Override-Mechanismus A/B/C — Design-Dokument

**Datum:** 2026-05-31  
**Scope:** Phase B — Override-Mechanismus für regulatorisch-harte Constraints  
**Autor:** Henrik (Brainstorming mit Claude Code)

---

## Kontext

Alle regulatorisch-harten Constraints (`MAX_BD_PER_MONTH`, `MAX_WEEKENDS_PER_MONTH`, `MIN_REST_TIME`, `MAX_WEEKLY_HOURS`) sind durch TV-Ärzte/TdL oder ArbZG vorgegeben, erlauben aber Ausnahmen per Individualvereinbarung oder Einzelfallentscheidung. Logisch-harte Constraints (`DOUBLE_BOOKED`, `ABSENT_DOCTOR`) sind nie overridebar.

Der Override-Mechanismus hat drei Ebenen:
- **A** — Global/Plan: Constraint für gesamten Plan deaktiviert
- **B** — Arzt+Regel+Zeitraum: Constraint für bestimmten Arzt in bestimmtem Zeitraum deaktiviert (plan-unabhängig)
- **C** — Einzelverstoß: Konkrete Schicht-Zuweisung trotz Constraint-Verletzung freigegeben

Overrides wirken auf **beide** Systeme: Timefold-Solver (Hard-Score) und Phase-A-Tarif-Warnings (`GET /tarif-warnings`, §-Dot im Grid).

---

## Datenmodell

### ORM-Tabelle `constraint_overrides`

```python
class ConstraintOverride(Base):
    __tablename__ = "constraint_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    level: Mapped[str] = mapped_column(String(1))          # 'A' | 'B' | 'C'
    constraint_id: Mapped[str] = mapped_column(String(64)) # ConstraintId enum value
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("plans.id"), nullable=True)
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("doctors.id"), nullable=True)
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"), nullable=True)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)  # null = offen
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

**Felder je Ebene:**

| Feld | A | B | C |
|------|---|---|---|
| `plan_id` | ✓ Pflicht | — | — |
| `doctor_id` | — | ✓ Pflicht | ✓ Pflicht |
| `shift_id` | — | — | ✓ Pflicht |
| `valid_from` | — | ✓ Pflicht | — |
| `valid_to` | — | optional (null = offen) | — |
| `reason` | optional | optional | optional |

**Alembic-Migration:** `0011_constraint_overrides.py`

### Pydantic-Schemas

Discriminated Union auf `level` erzwingt Pflichtfelder pro Ebene:

```python
class OverrideCreateA(BaseModel):
    level: Literal['A']
    constraint_id: ConstraintId
    plan_id: int
    reason: str | None = None

class OverrideCreateB(BaseModel):
    level: Literal['B']
    constraint_id: ConstraintId
    doctor_id: int
    valid_from: date
    valid_to: date | None = None
    reason: str | None = None

class OverrideCreateC(BaseModel):
    level: Literal['C']
    constraint_id: ConstraintId
    shift_id: int
    reason: str | None = None

OverrideCreate = Annotated[
    OverrideCreateA | OverrideCreateB | OverrideCreateC,
    Field(discriminator='level')
]
```

---

## Backend

### API-Endpunkte

```
POST   /api/constraint-overrides                        → Override anlegen
GET    /api/constraint-overrides?plan_id={id}           → Alle Overrides für Plan (A + aktive B + C)
GET    /api/doctors/{id}/constraint-overrides           → Alle B-Overrides eines Arztes
DELETE /api/constraint-overrides/{id}                   → Override löschen
```

Kein `PATCH` — Override ist binär (aktiv/gelöscht). Ändern = Löschen + neu anlegen.

`GET /api/constraint-overrides?plan_id={id}` liefert:
- Alle A-Overrides mit `plan_id = id`
- Alle B-Overrides aller Ärzte, deren `valid_from`/`valid_to` den Plan-Zeitraum überschneidet
- Alle C-Overrides deren `shift_id` zum Plan gehört

### Service-Schicht

`constraint_override_service.py`:
- `get_overrides_for_plan(db, plan_id) -> list[ConstraintOverrideORM]` — Plan-Zeitraum laden, B-Overrides zeitlich filtern
- `create_override(db, data: OverrideCreate) -> ConstraintOverrideORM` — Validierung (Shift/Doctor/Plan existieren, constraint_id ist regulatorisch-hart)
- `delete_override(db, override_id) -> None`

Validierung in `create_override`: `constraint_id` muss in `tarif_rules.REGULATORISCH_HART` enthalten sein — logisch-harte Constraints können nicht overridet werden (HTTP 422 sonst).

### Solver-Snapshot-Integration (ADR-071-Pattern)

`to_solver()` in `mapping.py` lädt Overrides vor dem Solve und verteilt sie auf Problem-Facts:

**Ebene A** → `SolverSchedule.disabled_constraints: frozenset[str]`

```python
# in ShiftSchedule (planning_solution)
disabled_constraints: frozenset[str] = frozenset()
```

**Ebene B** → `SolverDoctor.overridden_constraints: frozenset[str]`  
Gültigkeitsprüfung (`valid_from`/`valid_to` vs. Plan-Zeitraum) in `to_solver()`, nicht im Constraint-Lambda.

**Ebene C** → `SolverShift.overridden_constraints: frozenset[str]`

Jeder regulatorisch-harte Constraint erhält Override-Filter. Beispiel `MAX_BD_PER_MONTH`:

```python
# Ebene C: Shifts ohne Override für diese Regel
cf.for_each(SolverShift)
  .filter(lambda s: s.doctor is not None
      and s.is_bereitschaftsdienst
      and ConstraintId.MAX_BD_PER_MONTH not in s.overridden_constraints)
  .group_by(lambda s: s.doctor, lambda s: s.shift_date.month, ConstraintCollectors.count())
  # Ebene B: Doctor hat keine aktive B-Override für diese Regel
  .filter(lambda doc, month, count:
      count > MAX_BD_PER_MONAT
      and ConstraintId.MAX_BD_PER_MONTH not in doc.overridden_constraints)
  .penalize(HardSoftScore.ONE_HARD, lambda doc, month, count: count - MAX_BD_PER_MONAT)
  .as_constraint(ConstraintId.MAX_BD_PER_MONTH)
```

Ebene A wird beim Aufbau der Constraint-Liste berücksichtigt: `build_constraints(cf, disabled_constraints)` erhält `disabled_constraints: frozenset[str]` als Parameter und lässt entsprechende regulatorisch-harte Constraints aus der Rückgabeliste weg. Kein Zugriff auf die Planning Solution im Lambda nötig.

### Tarif-Warnings-Integration

`tarif_validation_service.compute_tarif_warnings(db, plan_id)`:
1. Overrides für Plan laden (`get_overrides_for_plan`)
2. Disabled-Set aus A-Overrides bilden
3. Pro Warning prüfen: constraint_id in disabled_constraints (A) → Warning droppen
4. Doctor-Override-Set (B) — Warning für diesen Arzt droppen
5. Shift-Override-Set (C) — Warning für diesen Shift droppen

---

## Frontend

### Ebene A — Plan-Settings-Dialog, Tab „Constraint-Overrides"

- Neues Modal „Plan-Einstellungen" — Einstieg via CommandBar-Button (neuer Button, noch nicht vorhanden). Das Modal hat einen Tab „Constraint-Overrides".
- Liste aller 4 regulatorisch-harten Constraints mit Toggle + optionalem Reason-Feld
- Toggle-An → `POST /api/constraint-overrides` (level=A), Toggle-Aus → `DELETE /api/constraint-overrides/{id}`
- Hook `useConstraintOverrides(planId)` — Query-Key `overrideKeys.byPlan(planId)`

### Ebene B — Arzt-Detailseite, neuer Tab „Overrides"

1:1-Muster des INAExclusion-Tabs:
- Liste bestehender B-Overrides (Constraint, Zeitraum, Reason) + Löschen-Button
- „Override hinzufügen"-Button öffnet FormDialog
- FormDialog-Felder: Constraint-Dropdown (nur `REGULATORISCH_HART`), `valid_from` (`<input type="date">`), `valid_to` (optional), Reason (optional)
- Hook `useDoctorConstraintOverrides(doctorId)`

### Ebene C — ContextPanel via §-Dot

ContextPanel zeigt bereits `TarifWarnings` je Shift (M5-001). Erweiterung:

Pro Warning-Eintrag:
- **Kein Override:** Button „Freigeben" → kleiner Inline-Dialog mit optionalem Reason → `POST /api/constraint-overrides` (level=C)
- **Override aktiv:** Badge „Override aktiv" (Farbe: `bg-sand border border-warn-line`) + Button „Widerrufen" → `DELETE /api/constraint-overrides/{id}`

Logisch-harte Constraints (`DOUBLE_BOOKED`, `ABSENT_DOCTOR`) erhalten keinen „Freigeben"-Button. Unterscheidung: Backend gibt in der Warning-Response ein Flag `overridable: bool` mit — oder Frontend prüft anhand einer statischen Liste der logisch-harten ConstraintIds.

### Cache-Invalidierung

Alle Override-Mutationen invalidieren nach `onSuccess`:
- `overrideKeys.byPlan(planId)` — Plan-Override-Liste
- `tarifWarningKeys.byPlan(planId)` — Warnings neu berechnen

---

## Nicht im Scope dieses Milestones

- Override-History / Audit-Log
- Override-Import/-Export
- Overrides für Soft-Constraints (FAIR_DISTRIBUTION, MAX_CONSECUTIVE_DAYS)
- Bulk-Override (mehrere Shifts auf einmal freigeben)

---

## Offene Fragen

Keine. Alle Entscheidungen im Brainstorming getroffen.
