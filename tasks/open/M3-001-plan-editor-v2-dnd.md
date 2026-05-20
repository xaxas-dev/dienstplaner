# Task M3-001: Plan-Editor v2 — Drag & Drop

## Ziel

Schichten im Plan-Grid per Drag & Drop einem Arzt zuweisen. Eine
Doctor-Liste (sidebar/source) hält ziehbare Tokens; eine Zell-Drop-Zone
im Plan-Grid übernimmt die Zuweisung. Der bestehende
`DoctorAssignPopover` bleibt als a11y-Fallback erhalten (Klick öffnet
weiterhin den Popover; DnD ist additiv).

Backend bleibt unverändert. Der Drop-Handler ruft den bestehenden
`useAssignShift`-Hook (PATCH `/api/shifts/{id}`). Konflikte werden wie
bisher read-only über die Konflikt-Engine angezeigt — der Drop blockiert
nicht.

## Bindende Entscheidungen

1. **DnD-Library:** `dnd-kit` (im CLAUDE.md-Stack genannt). Kein
   alternativer Vorschlag ohne Rückfrage.
2. **Drop-Pfad ist weich:** Keine semantische Validierung im
   Drop-Handler. Nicht-verfügbare oder doppelt-buchende Drops gehen
   durch und werden anschließend durch die Konflikt-Engine markiert
   (ADR-033, ADR-038).
3. **Popover bleibt:** `DoctorAssignPopover` wird nicht entfernt;
   Klick öffnet ihn weiterhin. Tastatur-Nutzer haben damit einen
   vollständigen Fallback.
4. **Source = Doctor-Tokens:** Drag-Source ist eine Liste aktiver
   Ärzte (analog der Avatar-/Chip-Optik aus `components/dp/`); Drop ist
   die Schichtzelle. **Reassign per Zell-zu-Zell-Drag ist out of scope**
   (separates Folge-Milestone, kein M3-002 in diesem Briefing).
5. **Keine neuen Design-Tokens.** Hover-/Drop-Indicator nutzt
   bestehende dp-Tokens (`bg-card`, `border-line`, Accent für aktives
   Drop-Target). M2-006-Grid-Surface-Konvention bleibt unangetastet.
6. **useAssignShift unverändert.** Drop-Handler ruft den Hook 1:1 wie
   der bestehende Popover-Pfad — keine Änderung am Hook, keine
   optimistic update (ADR-043).
7. **Kein Backend-Change.** `git diff` zeigt nur Frontend-Änderungen
   (additiv) plus Doku.

## Kontext (Leseanleitung)

1. [CLAUDE.md](../../CLAUDE.md) — Phasenmodell, „Weiche Validierung",
   Frontend-Plan-Feature-Konventionen (M2-003 Abschnitt), M2-006
   Grid-Surface
2. [docs/decisions.md](../../docs/decisions.md) — ADR-033 (weiche
   Validierung), ADR-038 (PATCH ohne Konflikt-Response), ADR-040
   (Zeilen=Ärzte, Spalten=Tage), ADR-041 (Warn-Dot vs. Popover),
   ADR-043 (kein optimistic update), ADR-052 (M3-Cut)
3. [docs/roadmap.md](../../docs/roadmap.md) — Position M3-001 in M3–M7
4. [frontend/src/features/plans/components/PlanGrid.tsx](../../frontend/src/features/plans/components/PlanGrid.tsx) —
   Grid-Struktur, Zell-Klick-Handler
5. [frontend/src/features/plans/components/DoctorAssignPopover.tsx](../../frontend/src/features/plans/components/DoctorAssignPopover.tsx) —
   bestehender Zuweisungspfad (bleibt!)
6. [frontend/src/features/plans/useAssignShift.ts](../../frontend/src/features/plans/useAssignShift.ts) —
   wird vom Drop-Handler aufgerufen
7. [frontend/src/features/plans/planGridUtils.ts](../../frontend/src/features/plans/planGridUtils.ts) —
   pure Grid-Logik, **nicht anfassen**
8. [frontend/src/features/plans/PlanPage.tsx](../../frontend/src/features/plans/PlanPage.tsx) —
   Page-Wrapper, hier Doctor-Source einhängen
9. dnd-kit-Docs via `mcp__plugin_context7_context7__resolve-library-id`
   + `query-docs` (Stack-Konvention: Doku frisch holen, nicht aus dem
   Gedächtnis ergänzen)

## Phase-A-Invariante

Keine Backend-Änderung. Keine Änderung an `useAssignShift`,
`usePlanShifts`, `usePlanConflicts`, `planGridUtils.ts`. Kein neuer
Design-Token. `git diff` darf nur additiv im Frontend sein
(neue Komponenten + Anpassungen an PlanGrid/PlanPage zur Einbettung).

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — DnD-Setup + Doctor-Source

**Dateien:**
- `frontend/package.json` — `@dnd-kit/core` (+ ggf. `@dnd-kit/sortable`
  falls nötig) hinzufügen, `pnpm install`
- `frontend/src/features/plans/components/DoctorDragSource.tsx` (neu) —
  Liste aktiver Ärzte als ziehbare Tokens
- `frontend/src/features/plans/PlanPage.tsx` — `DndContext` als Wrapper
  über Grid + Source einhängen

**Logik:**
- `DndContext` mit `PointerSensor` und `KeyboardSensor`
- Doctor-Tokens nutzen `useDraggable({ id: \`doctor-${doctor.id}\` })`
- Optik: nutzt bestehende `Avatar`/`Chip` aus `components/dp/`

**Akzeptanzkriterien:**
- [ ] `@dnd-kit/core` in `package.json`, `pnpm install` lief grün
- [ ] `DoctorDragSource` rendert aktive Ärzte
- [ ] DndContext rendert ohne Konsolen-Warnung
- [ ] `pnpm typecheck` + `pnpm lint` clean

**Stop-Gate:** Commit `feat(plan): M3-001/A DnD-Setup + Doctor-Source`,
auf Review warten.

---

### Sub-Schritt B — ShiftCell als Drop-Target

**Dateien:**
- `frontend/src/features/plans/components/PlanGrid.tsx` —
  Zell-Wrapper erweitern um `useDroppable`
- ggf. neue Hilfskomponente `frontend/src/features/plans/components/ShiftDropCell.tsx`,
  falls die ShiftCell-Komponente sonst zu komplex wird

**Logik:**
- Drop-Zone-ID kodiert `shift-${shift.id}` oder
  `open-${plan_id}-${date}-${shift_type_id}` für unbesetzte Zellen
- `onDragEnd` im `DndContext`: parse Source (Doctor) + Target (Shift) →
  `useAssignShift.mutate({ shiftId, doctorId })`
- Hover-State (`isOver`): leichter Accent-Border, **keine** neuen Tokens
- Klick-Pfad (Popover) bleibt unverändert

**Akzeptanzkriterien:**
- [ ] Doctor-Token → besetzte Zelle: doctor_id wird per
      `useAssignShift` geschrieben (Netzwerk-Tab zeigt PATCH)
- [ ] Doctor-Token → leere Zelle: identisches Verhalten
- [ ] Popover-Klick funktioniert weiterhin
- [ ] Drop-Hover-State sichtbar, ohne dass `bg-card`-Surface bricht
- [ ] `pnpm typecheck` + `pnpm lint` clean

**Stop-Gate:** Commit `feat(plan): M3-001/B Drop-Target + useAssignShift-Bindung`,
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
- `frontend/src/features/plans/tests/PlanGrid.dnd.test.tsx` (neu) —
  oder Ergänzung der bestehenden `PlanGrid.test.tsx`

**Logik:**
- Drop-Handler direkt invocieren (nicht via jsdom-DnD, da
  Pointer-Events-Simulation brüchig) — analog zum bestehenden Pattern,
  wo Popover-Klicks per `mousedown`-Handler getestet werden
- Positive Tests: Doctor→Shift triggert `useAssignShift`-Mock mit
  korrekten Argumenten
- Negative Tests: Doctor→nicht-Schicht-Drop-Zone tut nichts; Drop ohne
  aktive Drag-Source (Edge-Case) wirft nicht

**Akzeptanzkriterien:**
- [ ] Mindestens ein positiver und ein negativer Test pro
      Drop-Constraint (CLAUDE.md-Konvention)
- [ ] Bestehende PlanGrid-Tests bleiben grün (Popover-Pfad)
- [ ] `pnpm test` (vitest) grün — Baseline nach M8-002: 101 → erweitert

**Stop-Gate:** Commit `test(plan): M3-001/E DnD-Tests`, auf Review warten.

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

- [ ] `@dnd-kit/core` installiert und in `package.json` festgehalten
- [ ] `DoctorDragSource` rendert ziehbare Tokens für aktive Ärzte
- [ ] ShiftCell als Drop-Target verdrahtet; Drop ruft
      `useAssignShift`
- [ ] Bestehender `DoctorAssignPopover`-Pfad funktioniert unverändert
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

- Reassign per Zell-zu-Zell-Drag (separater Folge-Milestone, falls
  benötigt)
- Multi-Select-Drag (mehrere Schichten gleichzeitig zuweisen)
- Touch-/Mobile-Optimierung (lokale Desktop-App, kein primärer Mobile-Pfad)
- Animationen über Hover-/Cursor-States hinaus
- Solver-Diff-Review-UI (M9-001, separat)
- Änderungen an Konflikt-Engine, Konflikt-Marker oder
  `useAssignShift`-Verhalten
- Anpassungen an `planGridUtils.ts` (pure Logik, bleibt)

## Bekannte Stolperfallen

- **Click-outside vs. DnD-Sensor:** Der bestehende
  `DoctorAssignPopover` schließt sich per
  `document.addEventListener('mousedown', ...)` (CLAUDE.md-Konvention).
  Beim DnD-PointerSensor kann ein `mousedown` auf einem Doctor-Token
  fälschlich den Popover schließen, obwohl gar keine Zelle offen ist.
  Sensoren so konfigurieren, dass kein ungewollter Drag-Start aus
  Popover-Bereichen entsteht (dnd-kit `activationConstraint`,
  z. B. `distance: 4`).
- **Sticky-Spalten-Hintergrund:** Bei Horizontal-Scroll dürfen
  Drop-Hover-Hervorhebungen die `bg-card`-Naht aus M2-006 nicht
  verletzen.
- **Fragments mit `key`:** Bei CSS-Grid-Zeilen weiterhin
  `<Fragment key="row-{id}">`, keine bare Fragments (CLAUDE.md).
- **`e.stopPropagation()` am Warn-Dot:** ContextPanel-Klick-Pfad
  weiterhin trennen — Drop darf den Warn-Dot nicht überlagern
  (ADR-041).
- **Optimistic update verboten.** `useAssignShift` invalidiert
  `shifts`+`conflicts` nach onSuccess; kein lokales Vorschreiben
  (ADR-043).
- **dnd-kit-Doku frisch:** dnd-kit-API ändert sich zwischen Minor-Versions.
  Vor Implementierung: context7 MCP für aktuelle Doku konsultieren
  statt aus dem Gedächtnis.

## Annahmen

- `@dnd-kit/core` darf installiert werden, da dnd-kit explizit im
  CLAUDE.md-Stack genannt ist (keine Rückfrage nötig).
- Aktive Ärzte sind bereits über bestehenden Doctor-Query erreichbar
  (kein neuer Backend-Endpoint).
- Tests dürfen den `useAssignShift`-Mutation-Hook mocken (analog
  bestehender PlanGrid-Tests).
- Backend-Baseline: pytest 278 passed (nach M8-002); vitest 101.

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
