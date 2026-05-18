# Design-Spec: M2-003 Plan-Frontend (PlanGrid)

**Datum:** 2026-05-18  
**Milestone:** M2-003  
**Status:** Approved

---

## Ziel

Die erste vollständige Plan-Ansicht der App: Nutzer kann Pläne anlegen,
den Monatsplan als Grid einsehen, Ärzte auf Schichten zuweisen und
Konflikte (aus M2-005) direkt im Grid erkennen und im ContextPanel
nachlesen.

Backend-Voraussetzungen sind erfüllt: Plandatenmodell (M2-001),
Schichtzuweisung (M2-004) und Konflikt-Engine (M2-005) sind in main.

---

## Scope

**In Scope:**
- Planliste (`/plans`) mit Plan-Anlage-Dialog
- Plan-Ansicht (`/plans/:id`) mit PlanGrid, KpiBar, ContextPanel
- Schicht-Zuweisung per Klick → Arzt-Popover → PATCH
- Konflikt-Visualisierung (Warn-Dot, ContextPanel mit ConflictCard)
- TanStack-Query-Hooks für alle Plan-API-Calls
- vitest-Tests für Kern-Komponenten

**Out of Scope:**
- Dashboard (`/heute`)
- ⌘K Command Palette
- 14-Tage- und 1-Tages-Views
- Drag-and-Drop (kommt später)
- Schicht-Slots erstellen/löschen (nur Arzt-Zuweisung)
- Qualifikations-Konflikt (kein Datenmodell)

---

## Architektur & Komponenten

```
frontend/src/features/plans/
  PlanListPage.tsx              # Route /plans
  PlanPage.tsx                  # Route /plans/:id — Shell
  components/
    PlanCreateDialog.tsx        # Modal, POST /api/plans
    PlanGrid.tsx                # CSS-Grid, Monatsansicht
    ShiftCell.tsx               # Einzelzelle (Code, Konflikt-Dot)
    DoctorAssignPopover.tsx     # Popover nach Zell-Klick
    ContextPanel.tsx            # Rechtes 290px-Panel
    ConflictCard.tsx            # Inhalt des ContextPanel

frontend/src/hooks/
  usePlans.ts                   # GET /api/plans, POST /api/plans
  usePlanShifts.ts              # GET /api/plans/:id/shifts
  usePlanConflicts.ts           # GET /api/plans/:id/conflicts
  useAssignShift.ts             # PATCH /api/shifts/:id (Mutation)
```

### Datenfluss

1. `usePlanShifts(planId)` → Shifts mit eingebetteten Konflikten (M2-005)
2. `usePlanConflicts(planId)` → Aggregat (conflict_count, open_shift_count) für KpiBar
3. Grid rendert Zeilen pro Arzt × Spalten pro Kalendertag
4. Klick auf Zelle → `DoctorAssignPopover` → PATCH → invalidate beide Queries

---

## Routes

| Route | Komponente | Beschreibung |
|---|---|---|
| `/plans` | `PlanListPage` | Kachel-Grid aller Pläne |
| `/plans/:id` | `PlanPage` | Grid + ContextPanel |

`/plans/new` ist kein eigener Route — Plan-Anlage erfolgt über ein
Modal (`PlanCreateDialog`) das per Button in der CommandBar geöffnet wird.

---

## PlanListPage

- **CommandBar:** Titel „Pläne" (Newsreader), Primärbutton „+ Neuer Plan"
- **Kacheln** (`grid-cols-3`, `rounded-2xl bg-card border border-line`):
  Monat/Jahr (Newsreader 19 px), Ärzte-Anzahl, Schichten-Anzahl, Erstellt-Datum
- Klick auf Kachel → navigiert zu `/plans/:id`

### PlanCreateDialog

- Felder: Monat (1–12 als Select), Jahr (Zahl-Input), optionaler Name
- Submit → `POST /api/plans` → bei Erfolg navigate zu `/plans/:id`
- Validierung: Monat + Jahr Pflicht, Jahr ≥ 2020

---

## PlanPage-Shell

```
┌─ CommandBar ──────────────────────────────────┐
│  ← Pläne   Mai 2026                           │
├─ KpiBar ──────────────────────────────────────┤
│  12 Ärzte  |  186 Schichten  |  14 offen  |  3 Konflikte (warn) │
├─ PlanGrid (flex-1) ─────┬─ ContextPanel ──────┤
│                          │  (290px, konditionell)│
└──────────────────────────┴────────────────────┘
```

- ContextPanel nur sichtbar wenn der Warn-Dot einer Konflikt-Zelle angeklickt wurde
- Breadcrumb „← Pläne" navigiert zurück zu `/plans`

---

## PlanGrid

### Layout

```css
grid-template-columns: 210px repeat(31, 36px);
```

- **Header-Zeile:** Wochentag (10 px `text-ink3`) + Tageszahl (16 px Newsreader).
  Heute = `bg-warn-bg text-warn-ink`. Wochenende = `bg-[#F3ECD8]`.
  Tage außerhalb des Monats nicht gerendert (korrekte Spaltenanzahl pro Monat).
- **Body-Zeilen (42 px Höhe):**
  - Linke Spalte (210 px): `<Avatar>` (26 px) + Nachname, Vorname (13 px/500) + Rolle (10 px `text-ink3`)
  - Je Tag: `<ShiftCell>`
- Ärzte sortiert nach Nachnamen.

### ShiftCell-Zustände

| Zustand | Darstellung |
|---|---|
| Leer | `border border-dashed border-line` transparent |
| Besetzt | Pastell-BG aus `SHIFT_PALETTE`, Schichttyp-Code fett zentriert |
| Konflikt | `border-[1.5px] border-warn` + Warn-Dot 11×11 oben rechts mit `!` |
| Hover | `ring-1 ring-accent cursor-pointer` |

---

## DoctorAssignPopover

- Öffnet bei Klick auf **beliebige** ShiftCell (leer, besetzt oder Konflikt-Zelle — aber nicht auf den Warn-Dot)
- Inhalt: Suchfeld (filtert `useDoctors`-Liste) + scrollbare Arztliste
- Arzt wählen → `PATCH /api/shifts/:id { doctor_id }` → close + invalidate
- „Zuweisung entfernen" (nur wenn Zelle besetzt) → PATCH mit `{ doctor_id: null }`
- Schließen: Klick außerhalb oder Escape
- Ladezustand im Popover: Spinner während PATCH läuft

---

## ContextPanel

- Öffnet bei Klick auf den **Warn-Dot** (11×11 px, oben rechts in der Zelle)
- Schließen: ×-Button oben rechts oder Klick auf Grid-Hintergrund
- Inhalt: Eine `<ConflictCard>` pro Konflikt-Eintrag der Zelle

### ConflictCard

- Badge: `NOT_AVAILABLE` (warn) / `DOUBLE_BOOKED` (warn)
- Arztname + Datum + Schichttyp
- `message`-Text aus M2-005 (deutsch, UI-fertig, nicht reformulieren)

---

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| `GET /api/plans` fehlgeschlagen | Toast-Fehler, leere Liste mit Retry-Button |
| `GET /api/plans/:id/shifts` → 404 | Redirect zu `/plans` + Toast „Plan nicht gefunden" |
| `PATCH /api/shifts/:id` fehlgeschlagen | Toast-Fehler, Popover bleibt offen |
| Ladezeit | Skeleton-Zeilen (3 Platzhalter) im Grid; Spinner im Popover |

Kein optimistic update für PATCH (Konfliktberechnung braucht Server-Response).

---

## Tests (vitest)

| Datei | Abgedeckte Cases |
|---|---|
| `PlanGrid.test.tsx` | Header mit korrekten Tageszahlen, ShiftCell mit Code, Warn-Dot bei Konflikt |
| `ShiftCell.test.tsx` | Alle 4 Zustände (leer, besetzt, Konflikt, hover) |
| `DoctorAssignPopover.test.tsx` | Öffnet bei Klick, filtert Ärzte, ruft PATCH mit doctor_id auf, „Entfernen"-Pfad |
| `ContextPanel.test.tsx` | ConflictCard mit type + message, schließt bei ×-Klick |
| `usePlanShifts.test.ts` | Fetcht /plans/:id/shifts, gibt Shifts zurück |
| `useAssignShift.test.ts` | Ruft PATCH auf, invalidiert Queries |

---

## Sub-Schritte (Stop-Gates)

1. **Planliste + Plan anlegen** — `PlanListPage`, `PlanCreateDialog`, `usePlans`
2. **PlanGrid — Schichtanzeige** — `PlanPage`, `PlanGrid`, `ShiftCell`, `usePlanShifts`, `usePlanConflicts`, KpiBar-Anbindung
3. **Schicht zuweisen** — `DoctorAssignPopover`, `useAssignShift`, PATCH-Integration
4. **Konflikte anzeigen** — Warn-Dot in ShiftCell, `ContextPanel`, `ConflictCard`
5. **Tests** — vitest für alle Kern-Komponenten und Hooks
6. **Doku** — ADRs in `docs/decisions.md`

Jeder Sub-Schritt endet mit Commit und Review-Gate.

---

## Offene Annahmen

- `GET /api/plans` (Planliste) existiert aus M2-002 — vor Sub-Schritt 1 prüfen.
- `POST /api/plans` erstellt Plan inkl. Schicht-Slots für den gewählten Monat.
- `useDoctors`-Hook existiert bereits aus M1-002/M1-004.
- MSW oder `vi.mock` ist bereits für Hook-Tests konfiguriert — falls nicht, in Sub-Schritt 5 einrichten.
