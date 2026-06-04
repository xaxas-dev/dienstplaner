# M12-006 + M12-007 — Fairness-Zähler-Sidebar & WE-vor/nach-Urlaub-Hinweis

**Datum:** 2026-06-04  
**Milestones:** M12-006, M12-007  
**Status:** Approved

Beide Milestones in einem Implementierungsdurchlauf. Kein Schema-Change erforderlich.

---

## M12-006 — Fairness-Zähler-Sidebar

### Ziel

Die Planerin sieht live, wie viele Dienste jeder Arzt im aktuellen Plan hat — gesamt und aufgeschlüsselt nach Schichtgruppe (filter_group). Hilfreich bei der Vergabe von V-Diensten (Fairness-Schritt des Workflows).

### Entscheidungen

| Frage | Entscheidung |
|---|---|
| Sichtbarkeit | Toggle (Button in Toolbar) |
| Aufschlüsselung | Gesamt + pro filter_group (dynamisch) |
| Arzt-Auswahl | Nur Ärzte mit aktiver Rotation im Plan |
| Sortierung | Alphabetisch nach Arzt-Name |
| Kein neuer API-Endpoint | Aggregation über bereits geladene Daten |
| Koexistenz mit ContextPanel | Beide gleichzeitig sichtbar; Grid scrollt |

### Datenfluss

Keine neuen API-Calls. PlanPage hat bereits alle Daten:

- `shifts` (via `usePlanShifts`) — enthält `doctor_id`, `shift_date`, `shift_type` mit `filter_group`
- `rotations` (via `usePlanRotations`) — enthält `doctor_id` (für Arzt-Auswahl)
- `doctors` (via `useDoctors`) — enthält Namen

### Neue Datei: `fairnessUtils.ts`

Pure Hilfsfunktion — keine React-Abhängigkeit, voll testbar.

```ts
export interface FairnessStat {
  doctorId: number
  doctorName: string
  shortName: string | null
  total: number
  byGroup: Record<string, number>  // filter_group-Label → Anzahl
}

export function buildFairnessStats(
  shifts: ShiftWithDetails[],
  rotations: RotationAssignmentWithDetails[],
  doctors: Doctor[],
): FairnessStat[]
```

Logik:
1. Arzt-IDs aus `rotations` deduplizieren (Set) → nur Ärzte mit Rotation
2. Pro Arzt: alle Shifts mit `shift.doctor_id === arzt.id` zählen
3. Aufschlüsselung: `shift.shift_type?.filter_group` → Gruppe; null → nur im Gesamt
4. Gruppen-Spalten: alle `filter_group`-Werte über alle Shifts (nicht-null) → `Set → sort()`
5. Sortierung: Ergebnis alphabetisch nach `doctorName`

### State in PlanPage

```ts
const [showFairness, setShowFairness] = useState(false)
```

Session-only. Kein localStorage.

### Toggle-Button

In der bestehenden Tool-Zeile (dort wo `showWishes` Toggle ist), direkt daneben:

```tsx
<button
  type="button"
  onClick={() => setShowFairness((v) => !v)}
  className={cn(
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
    showFairness
      ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
      : 'bg-paper border-line text-ink-3 hover:bg-line',
  )}
  aria-pressed={showFairness}
>
  <BarChart2 className="size-3" />
  Fairness
</button>
```

### Neue Komponente: `FairnessSidebar.tsx`

```tsx
interface FairnessSidebarProps {
  stats: FairnessStat[]
  groups: string[]           // Gruppen-Labels für Header-Spalten
  onClose: () => void
}
```

Layout:
- Breite: `w-60 shrink-0`
- Header: „Arzt" + dynamische Gruppen-Spalten + „∑"
- Eine Zeile pro Arzt: `shortName` (nicht voller Name — Platzmangel), Gruppen-Zahlen, Gesamt
- Scrollbar vertikal wenn Liste lang
- Schließen-Button (X) oben rechts

Farbgebung: keine neuen Tokens. Zahlen > 0 in `text-ink`, 0 in `text-ink-3`. Kein Highlighting für Ausreißer (Phase A: keine Grenzwerte konfiguriert).

### Einbindung in PlanPage

```tsx
<div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
  <DoctorDragSource ... />
  <div className="flex flex-1 min-w-0 overflow-hidden">
    {plan && <UnifiedPlanGrid ... />}
  </div>
  {showFairness && (
    <FairnessSidebar
      stats={fairnessStats}
      groups={fairnessGroups}
      onClose={() => setShowFairness(false)}
    />
  )}
  {contextShift && (
    <ContextPanel ... />
  )}
</div>
```

`fairnessStats` und `fairnessGroups` werden mit `useMemo` aus `shifts`, `rotations`, `doctors` berechnet.

### Tests (vitest)

- `fairnessUtils.test.ts`: Unit-Tests für `buildFairnessStats`
  - Positiv: 2 Ärzte mit je verschiedenen Schicht-Gruppen → korrekte Zählung
  - Edge: Shift ohne doctor_id → nicht gezählt
  - Edge: Shift ohne filter_group → nur im Gesamt
  - Edge: Arzt mit Rotation aber 0 Shifts → row mit Nullen vorhanden
- `FairnessSidebar.test.tsx`: Render-Test (Spalten-Header + Arzt-Zeilen korrekt)

---

## M12-007 — Hinweis WE vor/nach Urlaub

### Ziel

Wenn ein Arzt einen Dienst am Wochenende direkt vor oder nach seinem Urlaub hat, erscheint ein weicher Hinweis (gelber §-Dot) in der Zelle. Kein Schreibpfad-Block.

### Entscheidungen

| Frage | Entscheidung |
|---|---|
| Kanal | Tarif-Warning (§-Dot, `TarifSeverity.INFO`) |
| Relevant | Nur `Absence.absence_type == URLAUB` |
| WE-Definition | Sa+So im 7-Tage-Fenster vor `valid_from` bzw. nach `valid_to` |
| Schema-Change | Keiner |
| Frontend | Kein neuer Code (§-Dot bereits vorhanden) |

### Backend: neue TarifRule

**Datei:** `backend/app/solver/tarif_rules.py` — Klasse `WeekendAroundVacationRule` dort direkt definieren, analog zu CLAUDE.md-Konvention „Zentral in solver/tarif_rules.py, nie verstreut".

```python
from app.solver.tarif_rules import TarifRule, ConstraintId
from app.schemas.tarif_warning import TarifSeverity, TarifWarning

class WeekendAroundVacationRule:
    id = ConstraintId.WE_URLAUB        # neu in tarif_rules.py eintragen
    severity = TarifSeverity.INFO

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        ...
```

### Algorithmus

```python
def _vacation_weekend_dates(valid_from: date, valid_to: date) -> set[date]:
    """Sa+So im 7-Tage-Fenster vor valid_from und nach valid_to."""
    result: set[date] = set()
    for delta in range(1, 8):
        d_before = valid_from - timedelta(days=delta)
        if d_before.weekday() in (5, 6):
            result.add(d_before)
        d_after = valid_to + timedelta(days=delta)
        if d_after.weekday() in (5, 6):
            result.add(d_after)
    return result
```

Evaluate-Schritt:
1. Plan laden, bei fehlendem Plan `PlanNotFoundError`
2. Alle Shifts des Plans mit `doctor_id is not None` laden
3. Für jeden betroffenen Arzt: alle URLAUB-Abwesenheiten im Plan-Zeitraum laden
4. Für jede Abwesenheit: `_vacation_weekend_dates(valid_from, valid_to)` berechnen
5. Für jeden Shift: `shift.shift_date in weekend_dates[doctor_id]` → `TarifWarning` generieren

```python
TarifWarning(
    shift_id=shift.id,
    doctor_id=shift.doctor_id,
    shift_date=shift.shift_date,
    rule_id=ConstraintId.WE_URLAUB,
    severity=TarifSeverity.INFO,
    message="Dienst am WE direkt vor/nach Urlaub",
)
```

### ConstraintId-Erweiterung

In `backend/app/solver/tarif_rules.py`:

```python
class ConstraintId(enum.StrEnum):
    ...
    WE_URLAUB = "WE_URLAUB"
```

### REGISTERED_RULES

`WeekendAroundVacationRule` in `REGISTERED_RULES` eintragen — diese Regel hat keine ungeklärten Tarif-Werte (rein planerisch).

### Frontend

Kein neuer Code. §-Dot und ContextPanel-Detail funktionieren bereits für `TarifSeverity.INFO`.

### Tests (pytest)

- Positiv: Shift am Sa direkt vor Montagsurlaub → Warning generiert
- Positiv: Shift am So direkt nach Freitagsurlaub → Warning generiert
- Positiv: Shift am Sa/So im 7-Tage-Fenster (Urlaub ab Do) → Warning generiert
- Negativ: Shift am Mo direkt vor Urlaub → keine Warning
- Negativ: Abwesenheit KRANKHEIT (kein URLAUB) → keine Warning
- Negativ: Shift ohne doctor_id → keine Warning
- Negativ: Shift außerhalb des 7-Tage-Fensters → keine Warning

---

## Implementierungs-Reihenfolge

Beide Milestones sind unabhängig. Empfehlung für Subagent-Driven-Development:

| Task | Milestone | Scope |
|---|---|---|
| A | M12-007 | Backend: `ConstraintId.WE_URLAUB` + `WeekendAroundVacationRule` + Tests |
| B | M12-006 | Frontend: `fairnessUtils.ts` + Tests |
| C | M12-006 | Frontend: `FairnessSidebar.tsx` + Tests + PlanPage-Integration |
| D (Abschluss) | beide | Milestone-Checkliste: Roadmap, ADRs, CLAUDE.md, Commit |

Tasks A und B sind unabhängig (Subagents parallel ausführbar).

## Out of Scope

- Fairness-Grenzwerte (z.B. max 3 V-Dienste) — konfigurierbar erst nach Domänen-Klärung
- WE-Hinweis für andere Abwesenheitstypen (KRANKHEIT etc.)
- Persistent gespeicherter Fairness-Zähler-State
