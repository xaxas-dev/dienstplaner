# Design: 6 UI-Features (Solver-Toggle, Profil, Status-Button, Direktzuweisung, Hinzufügen-Zeile, Bereichs-Header)

**Datum:** 2026-05-31  
**Status:** Genehmigt  

---

## Scope

Sechs unabhängige UI-Features, die alle im Frontend leben — mit einem kleinen Backend-Endpoint für Feature 2. Kein Datenbankschema-Change, keine bestehende API-Änderung.

---

## Feature 1 — Solver-Toggle in Einstellungen

### Zweck

Kliniken ohne Java/Timefold-Setup sollen den Solver-Bereich komplett ausblenden können, damit er keine verwirrenden UI-Elemente zeigt.

### Implementierung

**Store (`frontend/src/stores/useAppSettings.ts`):**
- Neues Feld: `solverEnabled: boolean` (Default: `true`)
- Neuer Setter: `setSolverEnabled: (v: boolean) => void`
- Persistiert in `dp-app-settings` (bestehender persist-key)

**SettingsPage (`frontend/src/features/settings/SettingsPage.tsx`):**
- Neue Switch-Zeile im bestehenden oberen Card-Block
- Label: „Solver (Plan generieren)"
- Beschreibung: „Blendet den Plan-Generator ein. Erfordert Java 21 (Eclipse Temurin)."

**PlanPage (`frontend/src/features/plans/PlanPage.tsx`):**
- Liest `solverEnabled` aus `useAppSettings`
- Wenn `false`:
  - „Plan generieren"-Button (`<Zap>`) wird nicht gerendert
  - `SolverResultPanel` wird nicht gerendert (State `isSolverOpen` wird zurückgesetzt wenn Toggle deaktiviert)
  - `solvePlan`-Mutation wird nicht aufgerufen

### Constraints

- Toggle-Änderung wirkt sofort (kein Neustart nötig)
- Bestehender `isSolverOpen`-State wird beim Deaktivieren via `useEffect` auf `false` gesetzt

---

## Feature 2 — Profil (Name, Titel, Notiz, Hardware-ID)

### Zweck

Single-User-App braucht eine Identität für spätere Export-Metadaten und persönliche Konfiguration.

### Backend

**Neues Endpoint:** `GET /api/system/hardware-id`
- Route in `backend/app/api/system.py` (neue Datei)
- Registriert in `main.py` als `/api/system`
- Logik: `hashlib.md5((platform.node() + str(uuid.getnode())).encode()).hexdigest()[:12]`
- Response: `{"hardware_id": "abc123def456"}`
- Kein Auth, kein DB-Write, deterministisch auf gleicher Maschine

### Frontend-Store

**Neue Datei:** `frontend/src/stores/useUserProfile.ts`
- Zustand + persist, key: `dp-user-profile`
- Felder: `name: string` (Default: `"Planer"`), `title: string` (Default: `""`), `note: string` (Default: `""`)
- Setter: `setProfile(partial: Partial<{name, title, note}>)`

### UI

**MiniRail (`frontend/src/components/layout/MiniRail.tsx`):**
- Avatar-Div wird zu `<button type="button">` mit `onClick={() => setProfileOpen(true)}`
- `profileOpen`-State lokal im MiniRail
- Avatar zeigt Initialen aus `useUserProfile().name` (erste zwei Buchstaben, Leerzeichen-Split)

**Neue Komponente:** `frontend/src/components/dp/ProfileEditModal.tsx`
- Shadcn `Dialog`
- Felder:
  - Hardware-ID (read-only, Mono-Font, `<code>`-Chip, Copy-Button)
  - Name (Input, Pflichtfeld, max 60 Zeichen)
  - Titel (Input, optional, max 80 Zeichen, Placeholder „z. B. Oberarzt")
  - Notiz (Textarea, optional, max 500 Zeichen)
- Hardware-ID wird via `useQuery` von `GET /api/system/hardware-id` geladen
- Speichern: schreibt in `useUserProfile`-Store (kein Server-Write)
- Kein separater „Speichern"-Button für jedes Feld — ein „Speichern"-Button unten

### Constraints

- Kein Backend-Write für Profil — rein lokal persistent
- Hardware-ID nur angezeigt, nicht editierbar
- Wenn Backend-Fetch der Hardware-ID fehlschlägt: Fallback-Text „—"

---

## Feature 3 — Planstatus-Button Optik

### Problem

Aktuell: Status als `<span className="rounded-full">` (Badge) + separater `<Button>` mit nur `<ChevronDown>`. Visuell inkonsistent zu den anderen Buttons in der CommandBar (Einstellungen, Plan generieren).

### Lösung

**PlanPage CommandBar `extras`:**
- Badge + ChevronDown-Button werden ersetzt durch **einen** `<DropdownMenu>` dessen Trigger ein `<Button variant="outline" size="sm">` ist
- Inhalt des Buttons: `[Dot] [StatusText] [ChevronDown]`
- Dot: 6×6px `rounded-full`, Farbe je Status:
  - `DRAFT` → `bg-gray-400`
  - `RELEASED` → `bg-green-500`
  - `ARCHIVED` → `bg-amber-400`
- DropdownMenu-Items bleiben unverändert

### Constraints

- Kein neuer Design-Token
- Button-Breite durch `min-w-[110px]` stabilisiert (verhindert Layoutsprung beim Status-Wechsel)

---

## Feature 4 — Arzt-Zuweisung direkt (ganzer Monat, kein Popover)

### Zweck

Schnellerer Workflow: Arzt auf Bereich ziehen → sofort im DB, ganzer Monat, kein Bestätigungs-Dialog.

### Implementierung

**PlanPage `handleDragEnd`:**
- Import `useCreateRotation` aus `usePlanRotations`
- Wenn Doctor-Drag auf `bereich-header` / `placeholder` / `rotation-member` Drop-Target:
  - Direkt `createRotation.mutate({plan_id: id, doctor_id, department_id: deptId, valid_from: plan.valid_from, valid_to: plan.valid_to, is_einarbeitung: false})`
  - `onSuccess`: `toast.success('${doctorName} → ${deptName} zugewiesen')`
  - `onError`: `toast.error('Zuweisung fehlgeschlagen')`
  - Kein `setActiveRotationCell`, kein `setPreselectedDragDoctorId` im Drag-Pfad

**State-Bereinigung:**
- `preselectedDragDoctorId`-State bleibt (wird für Hinzufügen-Zeile Feature 5 genutzt)
- `activeRotationCell`-State bleibt (wird für Edit-Flow via Stift-Button und Hinzufügen-Zeile genutzt)

### Constraints

- Nur für NEW assignments (zugewiesene Ärzte sind im Drag-Pool nicht mehr verfügbar — keine Konfliktbehandlung nötig)
- Nachträgliche Bearbeitung (Zeitraum, Einarbeitung) weiter über Stift-Button in Rotation-Zeile

---

## Feature 5 — Hinzufügen-Zeile unter jedem Arzt im Bereich

### Zweck

Alternative zum Drag für Maus/Tastatur-Nutzer: unter jeder Rotation-Zeile (und nach der Placeholder-Zeile) ein sichtbarer Add-Trigger.

### Rendering

**UnifiedPlanGrid:** Nach jeder `rotation`-Zeile UND nach der `placeholder`-Zeile eines Bereichs wird `AddRotationRow` gerendert.

**Neue Komponente `AddRotationRow`** (inline in UnifiedPlanGrid oder eigene Datei):
- Sticky Label-Cell: `+ Arzt hinzufügen` (Text-Button, `text-[10px] text-ink-3 italic hover:text-ink`)
- Rechter Teil: einzelne `<div style={{ gridColumn: "2 / -1" }}>` transparent (keine Trennlinien, kein Hintergrund)
- Klick auf Label-Cell → `onAddRotation(departmentId)`

**PlanPage:**
- Neuer Callback `onAddRotation: (departmentId: number) => void` an `UnifiedPlanGrid`
- Handler: `setActiveRotationCell({ departmentId, day: plan.valid_from, assignmentId: null })`
- Öffnet bestehenden `RotationAssignPopover` mit `preselectedDoctorId=undefined` → Doctor-Picker erscheint automatisch

### Fuzzy-Suche

Der bestehende `RotationAssignPopover` hat bereits ein Suchfeld mit `autoFocus`. Die Suche filtert `d.name.toLowerCase().includes(search.toLowerCase())`. Kein separates Fuzzy-Lib nötig — Substring-Match reicht für die Ärzte-Liste.

### Constraints

- AddRotationRow erscheint immer (auch wenn Bereich schon Ärzte hat) — ermöglicht mehrere Ärzte pro Bereich
- Keine eigene DnD-Interaktion in der Zeile

---

## Feature 6 — Bereichsname-Zeile durchgehend

### Problem

Aktuell rendert `BereichHeaderRow` eine Label-Cell + N separate Tag-Zellen. Durch die `border-r`-Linien der Tag-Zellen ist das Tagesgrid durch den Bereichs-Header sichtbar — wirkt visuell nicht wie ein Trenner.

### Lösung

**BereichHeaderRow:**
- N separate Tag-Zellen werden durch **eine** `<div style={{ gridColumn: "2 / -1" }}>` ersetzt
- Diese hat dieselbe Hintergrundfarbe wie die Label-Cell (`${color}18` / `${color}35`)
- Kein `border-r`, keine internen Trennlinien
- `colCount`-Prop entfällt komplett
- Drop-Target (`useDroppable`) bleibt auf der Label-Cell

**UnifiedPlanGrid:**
- `colCount`-Prop im `BereichHeaderRow`-Aufruf entfernen

### Constraints

- Der `border-b`-Effekt (untere Trennlinie zwischen Header und erster Rotation-Zeile) bleibt auf der Label-Cell
- Die Spanning-Div bekommt ebenfalls `border-b border-line` für horizontale Linie

---

## Komponentenübersicht (neue / geänderte Dateien)

| Datei | Änderung |
|---|---|
| `backend/app/api/system.py` | NEU — `GET /api/system/hardware-id` |
| `backend/app/main.py` | Router registrieren |
| `frontend/src/stores/useAppSettings.ts` | `solverEnabled` + Setter |
| `frontend/src/stores/useUserProfile.ts` | NEU — Profil-Store |
| `frontend/src/features/settings/SettingsPage.tsx` | Solver-Toggle Switch |
| `frontend/src/components/dp/ProfileEditModal.tsx` | NEU — Profil-Dialog |
| `frontend/src/components/layout/MiniRail.tsx` | Avatar → Button, ProfileEditModal einbinden |
| `frontend/src/features/plans/PlanPage.tsx` | Status-Button, Direktzuweisung, onAddRotation |
| `frontend/src/features/plans/components/BereichHeaderRow.tsx` | Spanning-Div, colCount entfällt |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | AddRotationRow, onAddRotation Callback |

---

## Nicht im Scope

- Fuzzy-Bibliothek (kein neues Paket — Substring-Match reicht)
- Backend-Persistenz für Profil
- Solver-bezogene Backend-Änderungen
- Tests (keine der Änderungen berührt getestete Services oder Solver-Constraints)
