# Design: Plan-Feinschliff A–C

**Datum:** 2026-05-27  
**Status:** Approved  
**Scope:** Gruppe A (Quick Wins), B (Plan-Grid-Interaktion), C (Plan-Verwaltung)  
**Ausgeschlossen:** Gruppe D (Undo/Redo, Absence-DnD) — separater Milestone

---

## Gruppe A — Quick Wins

### A1: Entwicklermodus-Toggle in Einstellungen

**Ziel:** TanStack ReactQueryDevtools nur im Entwicklermodus anzeigen; Toggle später für weitere DevTools erweiterbar.

**Implementierung:**
- Neuer Zustand-Store `useAppSettings` (`frontend/src/stores/useAppSettings.ts`)
  - State: `{ devMode: boolean }`
  - Persistiert in `localStorage` unter Key `dp-app-settings`
- `SettingsPage` bekommt Toggle-Switch mit Label „Entwicklermodus" (kein Verweis auf TanStack)
- `App.tsx`: `{settings.devMode && <ReactQueryDevtools />}` ersetzt bisheriges `{isDev && ...}`

**Scope-Grenze:** Kein Backend-Einfluss. Rein frontend-lokal.

---

### A2: Volle Ärzte-Namen im Dashboard

**Ziel:** „Heute im Dienst"-Karte zeigt `first_name + ' ' + last_name` statt Kurzform.

**Implementierung:**
- `TodayPage` / Dashboard-Komponente: Überall wo `doctor`-Objekt gerendert wird, `doctor.first_name + ' ' + doctor.last_name` ausgeben
- Kein Backend-Change nötig (Daten schon vorhanden)

---

## Gruppe B — Plan-Grid-Interaktion

### B1: Konflikt-Highlight während Drag

**Ziel:** Beim Ziehen eines Schichttyp-Chips werden Zellen rot eingefärbt, deren Arzt an dem Tag bereits einen Konflikt hätte (Doppelbuchung oder Nicht-verfügbar).

**Datengrundlage:** Vorhandene Queries `usePlanConflicts` + `usePlanShifts` — kein Extra-Request.

**Implementierung:**
1. `PlanPage.handleDragStart`: Wenn gezogenes Element ein ShiftType-Chip ist, baue Map `conflictDoctorDates: Map<doctorId, Set<dateString>>` aus:
   - `shiftsData`: alle besetzten Shifts → `doctorId → Set<date>` (jede besetzte Zelle = potenzieller Konflikt wenn neue Schicht hinzukommt)
   - `conflictsData` (NOT_AVAILABLE): zusätzliche Dates markieren wo Arzt generell nicht verfügbar
   - Vereinigung beider Quellen → eine Map
2. Map wird als State in `PlanPage` gehalten (`dragConflictMap`), bei `onDragEnd`/`onDragCancel` geleert
3. `UnifiedShiftCell` erhält `isConflictTarget?: boolean` Prop
4. `UnifiedPlanGrid` berechnet per Zelle: `conflictMap.get(rotationDoctorId)?.has(cellDate)` → übergibt `isConflictTarget`
5. Visuell: rote Tint + Border (`border-red-400 bg-red-50`) auf Zellen mit `isConflictTarget && isDragging`

---

### B2: Doppelklick-Remove Schichtzuweisung

**Ziel:** Schnelle Entfernung einer Schichtzuweisung per Doppelklick.

**Implementierung:**
- `UnifiedShiftCell` mit Besetzung: 300ms-Delay-Pattern auf Single-Click (Timer in `useRef`, wird bei `onDoubleClick` gecancelt)
  - Single Click → startet Timer → nach 300ms öffnet Popover wie bisher
  - Double Click → cancelt Timer + `assignShift.mutate({ shiftId: shift.id, data: { doctor_id: null } })` — kein Bestätigungsdialog
  - Nur wenn `shift.is_pinned === false`; gepinnte Schicht → Toast „Gepinnte Schicht — erst entpinnen"
- Unbesetzte Zellen: Single-Click öffnet Popover direkt (kein Delay nötig)

---

### B3: Tastenkürzel 0–9 für Schichttyp-Auswahl

**Ziel:** Taste 1–9 wählt Schichttyp nach Anzeigeposition visuell aus; kein neuer Zuweisungsweg.

**Implementierung:**
- `selectedShiftTypeKey: number | null` State in `PlanPage`
- `useEffect`: globaler `keydown`-Listener, aktiv wenn Grid gerendert
  - Tasten `1`–`9` → `setSelectedShiftTypeKey(parseInt(key) - 1)` (0-basierter Index)
  - Taste `0` → `setSelectedShiftTypeKey(null)` (Deselect)
  - Nur wenn kein Input-Element fokussiert (`document.activeElement?.tagName !== 'INPUT'`)
- `ShiftTypeDragBar` erhält `selectedIndex?: number` Prop → ausgewählter Chip bekommt `ring-2 ring-accent` Highlight
- Keine Änderung an Drag-/Zuweisungslogik

---

### B4: Hover-Buttons auf Rotationszeilen (Löschen + Bearbeiten)

**Ziel:** Arzt aus Bereich schnell entfernen oder Zeitraum bearbeiten ohne Kontextmenü.

**Implementierung:**
- Rotationszeilen in `UnifiedPlanGrid` nutzen Tailwind `group/row` + `group-hover/row:flex` für Hover — kein React-State nötig
- Bei Hover: zwei Icon-Buttons erscheinen im linken Zeilenkopf (Arzt-Name-Bereich):
  - **✕-Button** (rot, `size-4`): AlertDialog-Bestätigung → `deleteMutate({ rotationId })`
  - **Bleistift-Button** (neutral): öffnet `RotationAssignPopover` mit `existingAssignment` vorbelegt
- Buttons überlagern keinen Grid-Inhalt (innerhalb der linken Sticky-Spalte)
- Existing: `useDeleteRotation`, `RotationAssignPopover` mit `existingAssignment` Prop — beides bereits vorhanden

---

## Gruppe C — Plan-Verwaltung

### C1: Plan-Status-Toggle (DRAFT ↔ RELEASED)

**Ziel:** Plan-Status direkt aus der Planansicht ändern.

**Implementierung:**
- `PlanPage` CommandBar: Status-Badge + Aktion-Button
  - Badge: grau „Entwurf" (DRAFT) | grün „Freigegeben" (RELEASED)
  - DRAFT → Button „Freigeben" → `PATCH /api/plans/{id} { status: 'RELEASED' }`
  - RELEASED → Button „Zurück zu Entwurf" → `PATCH /api/plans/{id} { status: 'DRAFT' }`
- Backend: `PATCH /api/plans/{id}` + `PlanUpdate.status` bereits implementiert → kein Backend-Change
- Hook `useUpdatePlan` anlegen (oder bestehenden `usePlanMutation` erweitern) → invalidiert `planKeys.byId(id)` + `planKeys.all`

---

### C2: Plan löschen

**Ziel:** Plan mit Bestätigung an zwei Stellen löschen können.

**Backend (neu):**
- `DELETE /api/plans/{id}` Endpoint in `backend/app/api/plans.py`
- Service: Plan laden (404 wenn nicht existent) → löschen; DB-Cascade auf Shifts/Rotations via bestehende FKs
- Response: 204 No Content

**Frontend:**
- Hook `useDeletePlan` (`frontend/src/features/plans/useDeletePlan.ts`): Mutation → `DELETE /api/plans/{id}` → invalidiert `planKeys.all`
- **PlanListPage:** Hover auf Plan-Karte → Kebab-Icon (drei Punkte) → Dropdown mit „Plan löschen" → AlertDialog Bestätigung
- **PlanPage CommandBar:** Sekundäraktion (Dropdown-Menü) mit „Plan löschen" → selber AlertDialog
- Nach erfolgreichem Löschen: `navigate('/plans')`

---

### C3: Tile-Klick → Navigation zum ersten Treffer

**Ziel:** Von Dashboard oder Planansicht direkt zum ersten problematischen Shift springen.

**UnifiedShiftCell:**
- Erhält `data-shift-id={shift.id}` HTML-Attribut (für DOM-Query)

**PlanPage:**
- Neue Zusammenfassungs-Leiste unterhalb CommandBar: „X offene Schichten" + „Y Konflikte" (aus vorhandenen `usePlanShifts` + `usePlanConflicts`)
- Counts > 0 sind klickbar → `scrollToFirstMatch('open' | 'conflict')`
- `scrollToFirstMatch(type)`: findet erste passende Shift-ID → `document.querySelector('[data-shift-id="X"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })` + 2s CSS-Highlight-Puls (gelber Ring)
- Query-Param `?highlight=open` / `?highlight=conflict`: `useEffect` nach Grid-Render → liest Param → ruft `scrollToFirstMatch` → param aus URL entfernen (replace, kein History-Eintrag)

**Dashboard (TodayPage):**
- Tiles „Offene Schichten" + „Konflikte": wenn Count > 0, als `<Link>` zu `/plans/{slug}?highlight=open` bzw. `?highlight=conflict`
- Setzt voraus, dass `currentPlan` bekannt ist (bereits via `useCurrentPlan`)

---

## Technische Abhängigkeiten

| Feature | Backend-Change | Frontend-Change |
|---------|---------------|-----------------|
| A1 Dev-Toggle | – | useAppSettings Store + SettingsPage |
| A2 Volle Namen | – | TodayPage |
| B1 Konflikt-Drag | – | PlanPage + UnifiedPlanGrid + UnifiedShiftCell |
| B2 Doppelklick | – | UnifiedShiftCell |
| B3 Tastenkürzel | – | PlanPage + ShiftTypeDragBar |
| B4 Hover-Buttons | – | UnifiedPlanGrid (neue Row-Hover-Logik) |
| C1 Status-Toggle | – | PlanPage CommandBar + useUpdatePlan |
| C2 Plan löschen | DELETE /api/plans/{id} | PlanListPage + PlanPage + useDeletePlan |
| C3 Tile-Navigation | – | TodayPage + PlanPage (Summaryleiste + scroll) |

**Einzige Backend-Änderung:** `DELETE /api/plans/{id}`

---

## Nicht im Scope

- Gruppe D (Undo/Redo, Absence-DnD) — separater Milestone
- ARCHIVED-Status — kein UI geplant
- Harte Constraint-Prüfung im Schreibpfad (Phase A bleibt soft)
