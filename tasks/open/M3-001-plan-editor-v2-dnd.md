# Task M3-001: Plan-Editor v2 — Rotations-Zuweisung per Drag & Drop

## Ziel

Rotations-Zuweisungen (Arzt → Bereich) in der **Bereiche-Ansicht** per
Drag & Drop erfassen. Eine Doctor-Liste (sidebar/source) hält ziehbare
Tokens; eine RotationGrid-Zelle (Bereich × Tag) ist Drop-Zone. Der Drop
öffnet den bestehenden `RotationAssignPopover` mit vorausgewähltem Arzt —
der User bestätigt `valid_from`/`valid_to` (Rotationszeitraum). Der
bestehende Klick-Pfad am RotationGrid bleibt als a11y-Fallback
vollständig erhalten.

Backend bleibt unverändert. Der Drop-Handler verwendet
`useCreateRotation`/`useUpdateRotation` aus `usePlanRotations` —
identisch zum bestehenden Popover-Pfad. Konflikte werden wie bisher
read-only über die Konflikt-Engine angezeigt; der Drop blockiert nicht.

**Dienste-Ansicht** (Schicht-Zuweisung per Klick-Popover) bleibt
unverändert. DnD in Dienste ist explizit out of scope (separater
Folge-Milestone).

## Bindende Entscheidungen

1. **DnD-Library:** `dnd-kit` (im CLAUDE.md-Stack genannt). Kein
   alternativer Vorschlag ohne Rückfrage.
2. **Drop-Pfad ist weich:** Keine semantische Validierung im
   Drop-Handler (ADR-033). Der Drop öffnet nur den `RotationAssignPopover`
   mit vorausgewähltem Arzt — die Validierung geschieht im Popover-Formular
   (identisch zum Klick-Pfad).
3. **RotationAssignPopover bleibt:** Klick auf eine RotationGrid-Zelle
   öffnet den Popover weiterhin ohne vorausgewählten Arzt (bestehender
   Pfad). DnD ist additiv — der Popover bekommt einen optionalen
   `preselectedDoctorId`-Prop, der im Drop-Pfad gesetzt wird.
4. **Source = Doctor-Tokens in Bereiche-Sidebar:** `DoctorDragSource`
   rendert in der Bereiche-Ansicht (seit Commit A/A'). Drop-Ziel ist die
   RotationGrid-Zelle (Bereich × Tag), nicht die ShiftCell.
5. **Keine neuen Design-Tokens.** Hover-/Drop-Indicator nutzt bestehende
   dp-Tokens (`bg-card`, `border-line`, Accent). Keine neuen Tokens.
6. **usePlanRotations unverändert.** Der Popover-Pfad (useCreateRotation,
   useUpdateRotation) wird über `preselectedDoctorId` ausgelöst — keine
   Änderung an den Hooks selbst, keine optimistic updates.
7. **Kein Backend-Change.** `git diff` zeigt nur Frontend-Änderungen
   (additiv) plus Doku.

## Kontext (Leseanleitung)

1. [CLAUDE.md](../../CLAUDE.md) — Phasenmodell, „Weiche Validierung",
   Frontend-Plan-Feature-Konventionen (M2-003 Abschnitt), M2-006
   Grid-Surface
2. [docs/decisions.md](../../docs/decisions.md) — ADR-033 (weiche
   Validierung), ADR-043 (kein optimistic update), ADR-052 (M3-Cut)
3. [docs/roadmap.md](../../docs/roadmap.md) — Position M3-001 in M3–M7
4. [frontend/src/features/plans/components/RotationGrid.tsx](../../frontend/src/features/plans/components/RotationGrid.tsx) —
   Drop-Target-Grid (Bereich × Tag), Zell-Klick-Handler
5. [frontend/src/features/plans/components/RotationAssignPopover.tsx](../../frontend/src/features/plans/components/RotationAssignPopover.tsx) —
   bestehender Zuweisungspfad; bekommt `preselectedDoctorId`-Prop
6. [frontend/src/features/plans/usePlanRotations.ts](../../frontend/src/features/plans/usePlanRotations.ts) —
   `useCreateRotation`, `useUpdateRotation` (Drop-Handler nutzt diesen Pfad)
7. [frontend/src/features/plans/components/DoctorDragSource.tsx](../../frontend/src/features/plans/components/DoctorDragSource.tsx) —
   `makeDoctorDragId`, `parseDoctorDragId` (generische Helpers)
8. [frontend/src/features/plans/PlanPage.tsx](../../frontend/src/features/plans/PlanPage.tsx) —
   Page-Wrapper mit DndContext, Tab-Routing, `activeRotationCell`-State
9. dnd-kit-Docs via `mcp__plugin_context7_context7__resolve-library-id`
   + `query-docs` (Stack-Konvention: Doku frisch holen, nicht aus dem
   Gedächtnis ergänzen)

## Phase-A-Invariante

Keine Backend-Änderung. Keine Änderung an `usePlanRotations`-Hooks selbst,
`rotationGridUtils.ts`, `planGridUtils.ts`. Kein neuer Design-Token.
`git diff` darf nur additiv im Frontend sein: neue `preselectedDoctorId`-Prop
an `RotationAssignPopover`, Drop-Target-Logik in `RotationGrid`,
`onDragEnd`-Handler in `PlanPage`. Dienste-Ansicht (`PlanGrid`,
`DoctorAssignPopover`, `useAssignShift`) bleibt vollständig unverändert.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — DnD-Setup + Doctor-Source ✅

**Commits:** `0ae69e6` (Setup + DoctorDragSource), `1ac6fdb` (A' Reparatur:
Tab-Reorder + Underline + DoctorDragSource nach Bereiche)

**Was wurde gemacht:**
- `@dnd-kit/core 6.3.1` installiert
- `DoctorDragSource.tsx` mit `useDraggable`, `makeDoctorDragId`,
  `parseDoctorDragId` erstellt
- `DndContext` + `PointerSensor` (distance: 4) + `KeyboardSensor` in
  `PlanPage.tsx` eingehängt
- Reparatur A': DoctorDragSource in Bereiche-Ansicht verschoben, Tab-Reihenfolge
  (Bereiche zuerst), aktiver Tab jetzt Underline-Style

**Akzeptanzkriterien:**
- [x] `@dnd-kit/core` in `package.json`, `pnpm install` lief grün
- [x] `DoctorDragSource` rendert aktive Ärzte in Bereiche-Ansicht
- [x] DndContext rendert ohne Konsolen-Warnung
- [x] `pnpm typecheck` clean, vitest 117 passed

---

### Sub-Schritt B — RotationGrid-Zelle als Drop-Target

**Dateien:**
- `frontend/src/features/plans/components/RotationGrid.tsx` —
  Zell-Wrapper erweitern um `useDroppable`; Drop-ID kodiert
  `rotation-${departmentId}-${day}`
- `frontend/src/features/plans/components/RotationAssignPopover.tsx` —
  neuer optionaler Prop `preselectedDoctorId?: number`; wenn gesetzt,
  wird der Arzt in der Doctor-Auswahl vorausgewählt
- `frontend/src/features/plans/PlanPage.tsx` — `onDragEnd` implementieren:
  `parseDoctorDragId` + Drop-Target-Parse → `setActiveRotationCell` mit
  vorausgewähltem `doctorId`

**Logik:**
- Drop-Zone-ID: `rotation-${departmentId}-${day}` (analog zu
  `makeDoctorDragId`-Pattern)
- `onDragEnd`: wenn `active.id` → `parseDoctorDragId` liefert `doctorId`
  und `over.id` matcht `rotation-${deptId}-${day}` → `setActiveRotationCell`
  mit `{ departmentId, day, assignmentId: null, preselectedDoctorId }`
- `RotationAssignPopover` öffnet sich wie beim Klick-Pfad; Doctor-Select
  ist mit `preselectedDoctorId` vorausgewählt (User kann überschreiben)
- Hover-State (`isOver`): leichter Accent-Border via dp-Token, kein neuer Token
- Klick-Pfad (bestehender `onCellClick`) bleibt unverändert

**Akzeptanzkriterien:**
- [ ] Doctor-Token → RotationGrid-Zelle: `RotationAssignPopover` öffnet
      sich mit vorausgewähltem Arzt
- [ ] Vorausgewählter Arzt kann im Popover überschrieben werden
- [ ] Klick-Pfad (ohne DnD) funktioniert weiterhin unverändert
- [ ] Drop-Hover-State sichtbar, kein Layout-Riss
- [ ] `pnpm typecheck` + vitest clean

**Stop-Gate:** Commit `feat(plan): M3-001/B RotationGrid Drop-Target + Popover-Preselect`,
auf Review warten.

---

### Sub-Schritt C — Tastatur-Pfad & a11y

**Dateien:**
- DndContext-Sensoren: `KeyboardSensor` aktiv halten
- `aria-*` Attribute an Draggable und Droppable
- Screenreader-Announcer (dnd-kit liefert `Announcements`-Slot)

**Logik:**
- Tab → Doctor-Token fokussierbar; Space hebt an, Pfeiltasten bewegen,
  Space lässt fallen (dnd-kit-Default)
- `aria-roledescription` für Tokens („ziehbarer Arzt") und Zellen
  („Schicht-Zielfeld")
- Popover bleibt 100% bedienbar; DnD ist additiv

**Akzeptanzkriterien:**
- [ ] Tastatur-Drag funktioniert (manueller Test, im Stop-Gate-Review
      protokolliert)
- [ ] `aria-roledescription` an Source und Target gesetzt
- [ ] Keine Konsolen-Warnung aus dnd-kit-Announcer

**Stop-Gate:** Commit `feat(plan): M3-001/C Tastatur + a11y`, auf
Review warten.

---

### Sub-Schritt D — Visuelle Verfeinerung

**Dateien:**
- `DragOverlay` für das geziehte Doctor-Token
- Cursor-States: `cursor-grab` / `cursor-grabbing` am Token
- Hover/Drop-Indicator passt zu M2-006-Surface

**Logik:**
- `DragOverlay` rendert ein Klon-Token zentriert am Cursor (kein
  Reflow des Source-Containers)
- Keine neuen Farben/Schatten — nur dp-Tokens

**Akzeptanzkriterien:**
- [ ] Drag-Overlay sichtbar, kein Layout-Sprung in der Doctor-Liste
- [ ] Cursor wechselt korrekt
- [ ] Grid-Surface (`rounded-2xl border border-line bg-card`) unverändert
- [ ] Keine neuen Tokens in `tokens.ts`

**Stop-Gate:** Commit `feat(plan): M3-001/D DragOverlay + Cursor-States`,
auf Review warten.

---

### Sub-Schritt E — Tests (vitest)

**Dateien:**
- `frontend/src/features/plans/tests/RotationGrid.dnd.test.tsx` (neu) —
  Drop-Handler-Logik für `onDragEnd` + `RotationAssignPopover`-Preselect

**Logik:**
- `onDragEnd`-Callback direkt invocieren (nicht via jsdom-DnD — brüchig);
  analog zum bestehenden Pattern in `RotationAssignPopover.test.tsx`
- Mock `useCreateRotation` und `useUpdateRotation` aus `usePlanRotations`
- Positive Tests:
  - Doctor→RotationGrid-Zelle: `setActiveRotationCell` wird mit
    korrektem `preselectedDoctorId` aufgerufen
  - Popover öffnet sich mit vorausgewähltem Arzt
- Negative Tests:
  - Drop auf Nicht-Rotation-Zone: nichts passiert
  - Drop mit ungültiger Doctor-ID: Handler wirft nicht

**Akzeptanzkriterien:**
- [ ] Mindestens ein positiver und ein negativer Test pro Drop-Pfad
      (CLAUDE.md-Konvention)
- [ ] Bestehende RotationAssignPopover-Tests bleiben grün (117 baseline)
- [ ] `pnpm test` (vitest) grün — erweitert

**Stop-Gate:** Commit `test(plan): M3-001/E DnD Drop-Handler-Tests`, auf
Review warten.

---

### Sub-Schritt F — Abschluss-Dokumentation

Pflichtschritte laut [CLAUDE.md](../../CLAUDE.md) Milestone-Abschluss-Checkliste:

1. **`tasks/open/M3-001-plan-editor-v2-dnd.md`** → `tasks/done/` verschieben;
   alle `[ ]` → `[x]`; Abschnitt „Abschluss" anhängen (Datum, Branch,
   Commits A–F, Testergebnis vitest + pytest).
2. **`docs/open-questions.md`** — beantwortete Fragen auf „Entschieden"
   setzen; neue offene Fragen aus M3-001 eintragen (z. B. Touch-/
   Mobile-Verhalten, falls auftaucht).
3. **`docs/decisions.md`** — ADR(s) für M3-001-Architektur:
   DnD-Library-Wahl, weicher Drop-Pfad bestätigt, Doctor-Source vs.
   Cell-to-Cell-Drag-Trennung, ggf. KeyboardSensor-Strategie.
4. **`docs/constraints.md`** — keine Änderung erwartet (keine neuen
   Constraints); explizit bestätigen, dass Drop-Handler keine
   Constraint-Prüfung erzwingt.
5. **`CLAUDE.md`** — Abschnitt „Frontend — Plan-Feature (M2-003)"
   um DnD-Pattern erweitern (Drop-ID-Konvention, `useAssignShift` als
   gemeinsamer Pfad, Popover bleibt a11y-Fallback).

**Stop-Gate:** Commit `docs: M3-001 Abschluss + ADRs + CLAUDE.md`, auf
Review warten.

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] `@dnd-kit/core` installiert und in `package.json` festgehalten
- [x] `DoctorDragSource` rendert ziehbare Tokens in Bereiche-Ansicht
- [ ] RotationGrid-Zelle als Drop-Target; Drop öffnet
      `RotationAssignPopover` mit vorausgewähltem Arzt
- [ ] Bestehender RotationGrid-Klick-Pfad (ohne Preselect) unverändert
- [ ] Tastatur-Pfad funktional; `aria-*` an Source und Target
- [ ] `DragOverlay` ohne Layout-Spring; nur dp-Tokens, keine neuen
      Tokens
- [ ] vitest grün (alte + neue Tests); pytest unverändert grün
      (Baseline 278)
- [ ] `pnpm typecheck`, `pnpm lint` clean; kein `any`, keine
      `ts-ignore`
- [ ] Backend-Quellcode unverändert (nur Frontend + Doku im Diff)
- [ ] Milestone-Abschluss-Checkliste (Sub-Schritt F) vollständig

## Out of Scope

- **DnD in Dienste-Ansicht** (Schicht-Zuweisung per Drag — separater
  Folge-Milestone)
- **Rotations-basierte Vorfilterung der Doctor-Auswahl im Schicht-Popover**
  (Folge-Milestone nach M3-001)
- Mehr-Tage-Drop (Drag über mehrere Tag-Spalten zur Zeitraum-Auswahl)
- Reassign per Zell-zu-Zell-Drag im RotationGrid
- Multi-Select-Drag (mehrere Ärzte gleichzeitig)
- Touch-/Mobile-Optimierung (lokale Desktop-App)
- Animationen über Hover-/Cursor-States hinaus
- Solver-Diff-Review-UI (M9-001, separat)
- Änderungen an Konflikt-Engine, `useAssignShift`, `planGridUtils.ts`

## Bekannte Stolperfallen

- **Click-outside vs. DnD-Sensor:** `RotationAssignPopover` schließt
  sich per `document.addEventListener('mousedown', ...)`. `PointerSensor`
  mit `activationConstraint: { distance: 4 }` (bereits gesetzt) verhindert
  ungewollte Drag-Starts aus dem Popover-Bereich.
- **preselectedDoctorId-Prop:** `RotationAssignPopover` muss den Prop
  optional akzeptieren; bestehende Aufrufe ohne Prop dürfen nicht brechen
  (Typprüfung: `preselectedDoctorId?: number`).
- **activeRotationCell-State:** PlanPage hat bereits
  `{ departmentId, day, assignmentId }` — für DnD muss `preselectedDoctorId`
  ergänzt werden, entweder als viertes Feld oder über separaten State.
  Einfachste Lösung: lokaler State `preselectedDragDoctorId` wird parallel
  zu `setActiveRotationCell` gesetzt und an den Popover übergeben.
- **RotationGrid-Surface:** `RotationGrid` lebt im gleichen
  `rounded-2xl border border-line bg-card`-Wrapper (M2-006) —
  Drop-Hover-Hervorhebung darf die `bg-card`-Naht nicht verletzen.
- **Fragments mit `key`:** Bei CSS-Grid-Zeilen weiterhin
  `<Fragment key="row-{id}">`, keine bare Fragments (CLAUDE.md).
- **Optimistic update verboten.** Popover-Formular schreibt via
  `useCreateRotation`/`useUpdateRotation`; kein lokales Vorschreiben.
- **dnd-kit-Doku frisch:** dnd-kit-API ändert sich zwischen Minor-Versions.
  Vor Implementierung: context7 MCP für aktuelle Doku konsultieren.

## Annahmen

- `@dnd-kit/core` ist installiert (seit Sub-Schritt A; keine Rückfrage nötig).
- Aktive Ärzte sind über bestehenden Doctor-Query erreichbar
  (kein neuer Backend-Endpoint).
- Tests dürfen `useCreateRotation`/`useUpdateRotation` mocken (analog
  bestehender `RotationAssignPopover.test.tsx`).
- Backend-Baseline: pytest 278 passed (nach M8-002); vitest 117 passed.

Bei Unklarheit: `tasks/done/M8-002-solver-apply-endpoint.md` als
Briefing-Referenz, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:

```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M3-001-plan-editor-v2-dnd
```

Briefing liegt in `tasks\open\M3-001-plan-editor-v2-dnd.md`.

`pnpm generate-api` wird in diesem Milestone **nicht** benötigt
(kein Backend-Change).

Nach Abschluss aller Sub-Schritte:

```powershell
git push origin task/M3-001-plan-editor-v2-dnd
# PR erstellen oder direkt mergen nach Review
git checkout main
git pull origin main
git merge task/M3-001-plan-editor-v2-dnd
git push origin main
```

## Abschluss

_(Wird beim Milestone-Abschluss in Sub-Schritt F befüllt: Datum,
Branch, Commits A–F, Testergebnis, Nebeneffekte.)_
