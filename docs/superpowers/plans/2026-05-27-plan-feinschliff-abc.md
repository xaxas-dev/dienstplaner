# Plan-Feinschliff A–C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 UX-Verbesserungen — Entwicklermodus-Toggle, volle Namen im Dashboard, Plan-Status/Löschen, Tile-Navigation, Konflikt-Highlight beim Drag, Doppelklick-Remove, Tastenkürzel 0–9, Hover-Buttons auf Rotationszeilen.

**Architecture:** Rein Frontend außer einem neuen Backend-Endpoint (`DELETE /api/plans/{id}`). CommandBar erhält `extras?: React.ReactNode` Prop für zusätzliche Rechts-Inhalte. Alle anderen Änderungen sind additiv (neue Props, neue Hooks, neuer Zustand-Store).

**Tech Stack:** React 18, TypeScript, Zustand + persist middleware, TanStack Query v5, dnd-kit, shadcn/ui (Switch, AlertDialog, Button), lucide-react, FastAPI, SQLAlchemy, pytest

---

## File Map

**Neue Dateien:**
- `frontend/src/stores/useAppSettings.ts` — Zustand-Store für App-Einstellungen, localStorage-persistiert
- `frontend/src/features/plans/useUpdatePlan.ts` — Mutation-Hook für PATCH /api/plans/{id}
- `frontend/src/features/plans/useDeletePlan.ts` — Mutation-Hook für DELETE /api/plans/{id}
- `backend/tests/api/test_plan_delete.py` — Backend-Tests für DELETE-Endpoint

**Modifizierte Dateien:**
- `frontend/src/App.tsx` — ReactQueryDevtools an devMode koppeln
- `frontend/src/components/dp/CommandBar.tsx` — `extras?: React.ReactNode` Prop
- `frontend/src/features/settings/SettingsPage.tsx` — Entwicklermodus-Toggle
- `frontend/src/features/today/TodayPage.tsx` — volle Namen, klickbare Tiles
- `frontend/src/features/today/DutyShiftRow.tsx` — volle Namen (falls dort gerendert)
- `frontend/src/features/plans/PlanListPage.tsx` — Kebab-Menü mit Plan-Löschen
- `frontend/src/features/plans/PlanPage.tsx` — Status-Toggle, Löschen, Summary-Bar, Drag-Konflikt-Map, Tastenkürzel
- `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` — isConflictTarget weitergeben, Hover-Buttons
- `frontend/src/features/plans/components/UnifiedShiftCell.tsx` — data-shift-id, isConflictTarget, 300ms-Doppelklick
- `frontend/src/features/plans/components/ShiftTypeDragBar.tsx` — selectedIndex Prop
- `backend/app/api/plans.py` — DELETE /api/plans/{id}
- `backend/app/repositories/plan_repository.py` — delete_plan (falls noch nicht vorhanden)
- `frontend/src/index.css` — dp-highlight-pulse Animation

---

### Task 1: useAppSettings Store

**Files:**
- Create: `frontend/src/stores/useAppSettings.ts`

- [ ] **Step 1: Prüfe ob stores/ Verzeichnis existiert**

```bash
ls frontend/src/stores/
```

Falls nicht vorhanden: `mkdir frontend/src/stores`

- [ ] **Step 2: Store erstellen**

```typescript
// frontend/src/stores/useAppSettings.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
    }),
    { name: 'dp-app-settings' }
  )
)
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useAppSettings.ts
git commit -m "feat(settings): add useAppSettings Zustand store (A1)"
```

---

### Task 2: SettingsPage Toggle + App.tsx Integration (A1)

**Files:**
- Modify: `frontend/src/features/settings/SettingsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx` (nur lesen, um QueryClientProvider-Position zu verstehen)

- [ ] **Step 1: Aktuelle SettingsPage lesen**

```bash
cat frontend/src/features/settings/SettingsPage.tsx
```

Notiere die Struktur (ob bereits shadcn-Form, einfache Divs, etc.).

- [ ] **Step 2: Switch-Komponente prüfen**

```bash
ls frontend/src/components/ui/ | grep switch
```

Falls `switch.tsx` fehlt: `pnpm dlx shadcn@latest add switch` im `frontend/`-Verzeichnis.

- [ ] **Step 3: Entwicklermodus-Toggle zur SettingsPage hinzufügen**

Füge hinzu:

```typescript
// Imports ergänzen:
import { Switch } from '@/components/ui/switch'
import { useAppSettings } from '@/stores/useAppSettings'

// In der Komponente:
const { devMode, setDevMode } = useAppSettings()

// In der JSX (in bestehende Einstellungs-Liste einfügen):
<div className="flex items-center justify-between py-3 border-b border-line">
  <div>
    <p className="text-sm font-medium text-ink">Entwicklermodus</p>
    <p className="text-xs text-ink-3 mt-0.5">Aktiviert Entwickler-Werkzeuge in der App</p>
  </div>
  <Switch
    checked={devMode}
    onCheckedChange={setDevMode}
    aria-label="Entwicklermodus aktivieren"
  />
</div>
```

- [ ] **Step 4: App.tsx lesen und QueryClientProvider-Kontext prüfen**

```bash
cat frontend/src/App.tsx
cat frontend/src/main.tsx
```

Stelle sicher, dass `ReactQueryDevtools` innerhalb des `QueryClientProvider` gerendert wird. Falls `App` direkt in `QueryClientProvider` eingebettet ist, ist das korrekt.

- [ ] **Step 5: ReactQueryDevtools-Paket prüfen**

```bash
cat frontend/package.json | grep react-query
```

Falls `@tanstack/react-query-devtools` fehlt:
```bash
cd frontend && pnpm add -D @tanstack/react-query-devtools
```

- [ ] **Step 6: App.tsx anpassen**

Ersetze das bestehende `isDev`-basierte DevTools-Rendering:

```typescript
// Imports ergänzen (am Ende der Import-Blöcke):
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useAppSettings } from '@/stores/useAppSettings'

// Neue Helper-Komponente vor `function App()` oder `function NavApp()`:
function AppDevTools() {
  const { devMode } = useAppSettings()
  return devMode ? <ReactQueryDevtools initialIsOpen={false} /> : null
}

// In der App-Return-JSX, am Ende (vor dem letzten Tag):
<AppDevTools />
```

Die Zeile `const isDev = import.meta.env.DEV` kann entfernt werden wenn sie nur für DevTools genutzt wird. Falls sie auch für Playground-Route genutzt wird, beibehalten.

- [ ] **Step 7: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/settings/SettingsPage.tsx frontend/src/App.tsx frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat(settings): Entwicklermodus-Toggle in SettingsPage, ReactQueryDevtools an devMode gekoppelt (A1)"
```

---

### Task 3: Dashboard — Volle Namen + klickbare Tiles (A2, C3-Dashboard)

**Files:**
- Modify: `frontend/src/features/today/TodayPage.tsx`
- Modify: `frontend/src/features/today/DutyShiftRow.tsx` (wenn Namen dort gerendert)

- [ ] **Step 1: DutyShiftRow lesen**

```bash
cat frontend/src/features/today/DutyShiftRow.tsx
```

Suche nach `short_name` oder abgekürzten Arzt-Namen. Wenn dort gerendert, Schritt 2 in DutyShiftRow anwenden. Wenn in TodayPage, dort.

- [ ] **Step 2: Abgekürzte Namen durch volle Namen ersetzen**

Überall wo `doctor.short_name` o.ä. für „Heute im Dienst" genutzt wird:

```typescript
// Vorher:
{doctor.short_name}

// Nachher:
{`${doctor.first_name} ${doctor.last_name}`}
```

- [ ] **Step 3: TodayPage lesen**

```bash
cat frontend/src/features/today/TodayPage.tsx
```

Identifiziere: wo sind die KpiTile-Komponenten für „Offen" und „Konflikte"? Wie heißen die Felder in `kpis`?

- [ ] **Step 4: planToSlug Import prüfen**

```bash
cat frontend/src/features/plans/planSlug.ts
```

Notiere den Export-Namen (wahrscheinlich `planToSlug`).

- [ ] **Step 5: Klickbare Open/Konflikt-Tiles in TodayPage**

```typescript
// Imports ergänzen:
import { Link } from 'react-router-dom'
import { planToSlug } from '@/features/plans/planSlug'

// In der Komponente — planSlug berechnen:
const planSlug = currentPlan ? planToSlug(currentPlan) : null
const openCount = hasPlan && kpis ? kpis.open_shifts : 0
const conflictCount = hasPlan && kpis ? kpis.conflicts : 0
```

Ersetze die „Offen"-KpiTile durch eine bedingte Link-Variante:

```typescript
{planSlug && openCount > 0 ? (
  <Link to={`/plans/${planSlug}?highlight=open`} className="block">
    <KpiTile
      value={openCount}
      label="Offen"
      sub="unbesetzte Schichten"
      tone="warn"
    />
  </Link>
) : (
  <KpiTile
    value={openCount}
    label="Offen"
    sub="unbesetzte Schichten"
    tone={openCount > 0 ? 'warn' : 'default'}
  />
)}
```

Gleich für die „Konflikte"-KpiTile mit `?highlight=conflict`.

- [ ] **Step 6: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/
git commit -m "feat(dashboard): volle Arzt-Namen, klickbare Open/Konflikt-Tiles (A2, C3)"
```

---

### Task 4: Backend DELETE /api/plans/{id} (C2 Backend)

**Files:**
- Modify: `backend/app/repositories/plan_repository.py`
- Modify: `backend/app/api/plans.py`
- Create: `backend/tests/api/test_plan_delete.py`

- [ ] **Step 1: Prüfe ob delete_plan im Repository existiert**

```bash
grep -n "def delete_plan" backend/app/repositories/plan_repository.py
```

Falls vorhanden: Schritt 2 überspringen. Falls nicht:

- [ ] **Step 2: delete_plan zum Repository hinzufügen**

```python
# In backend/app/repositories/plan_repository.py (am Ende einfügen):
def delete_plan(db: Session, plan_id: int) -> bool:
    """Löscht Plan und gibt True zurück wenn gefunden, False wenn nicht."""
    plan = db.get(Plan, plan_id)
    if plan is None:
        return False
    db.delete(plan)
    db.commit()
    return True
```

Stelle sicher, dass `Plan` und `Session` importiert sind (schau bestehende Funktionen für Muster).

- [ ] **Step 3: Test-Datei erstellen**

Prüfe zuerst wie bestehende API-Tests aufgebaut sind:

```bash
ls backend/tests/
ls backend/tests/api/ 2>/dev/null || ls backend/tests/
cat backend/tests/conftest.py | head -60
```

Schreibe Tests analog:

```python
# backend/tests/api/test_plan_delete.py
import pytest
from fastapi.testclient import TestClient

# Importiere app und Fixtures wie in anderen Test-Dateien
# (schau in bestehende test_*.py für das korrekte Muster)
```

Nutze dieselben `db_session`- und Plan-Fixtures wie andere API-Tests. Falls es ein `make_plan`-Fixture gibt, nutze es. Ansonsten erstelle einen Plan direkt:

```python
def test_delete_plan_returns_204(client, db_session):
    # Plan erstellen:
    from app.repositories import plan_repository as plan_repo
    from datetime import date
    plan = plan_repo.create_plan(db_session, {
        "name": "Testplan",
        "valid_from": date(2026, 1, 1),
        "valid_to": date(2026, 1, 31),
        "status": "DRAFT",
    })
    
    response = client.delete(f"/api/plans/{plan.id}")
    assert response.status_code == 204

def test_delete_plan_removes_from_db(client, db_session):
    from app.repositories import plan_repository as plan_repo
    from datetime import date
    plan = plan_repo.create_plan(db_session, {
        "name": "Testplan Löschen",
        "valid_from": date(2026, 2, 1),
        "valid_to": date(2026, 2, 28),
        "status": "DRAFT",
    })
    plan_id = plan.id
    
    client.delete(f"/api/plans/{plan_id}")
    
    response = client.get(f"/api/plans/{plan_id}")
    assert response.status_code == 404

def test_delete_plan_not_found(client):
    response = client.delete("/api/plans/99999")
    assert response.status_code == 404
```

- [ ] **Step 4: Tests laufen lassen — erwarte Fehler**

```bash
cd backend && python -m pytest tests/api/test_plan_delete.py -v
```

Erwartet: FAIL (404 oder 405, Endpoint fehlt noch)

- [ ] **Step 5: DELETE-Endpoint zu plans.py hinzufügen**

In `backend/app/api/plans.py`, nach dem `update_plan`-Endpoint einfügen:

```python
@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    plan_repo.delete_plan(db, plan_id)
```

Stelle sicher, dass `PlanNotFoundError` bereits importiert ist (schau Import-Block am Anfang der Datei).

- [ ] **Step 6: Tests erneut laufen**

```bash
cd backend && python -m pytest tests/api/test_plan_delete.py -v
```

Erwartet: Alle 3 Tests PASS

- [ ] **Step 7: Gesamte Backend-Tests prüfen**

```bash
cd backend && python -m pytest -x -q
```

Erwartet: Alle Tests grün.

- [ ] **Step 8: Commit**

```bash
git add backend/app/repositories/plan_repository.py backend/app/api/plans.py backend/tests/api/test_plan_delete.py
git commit -m "feat(backend): DELETE /api/plans/{id} Endpoint (C2)"
```

---

### Task 5: useUpdatePlan + useDeletePlan + apiDelete (C1, C2 Hooks)

**Files:**
- Modify: `frontend/src/lib/api.ts` (apiDelete hinzufügen falls fehlend)
- Create: `frontend/src/features/plans/useUpdatePlan.ts`
- Create: `frontend/src/features/plans/useDeletePlan.ts`

- [ ] **Step 1: Prüfe ob apiDelete existiert**

```bash
grep -n "apiDelete\|export.*delete" frontend/src/lib/api.ts
```

Falls nicht vorhanden:

- [ ] **Step 2: apiDelete zu api.ts hinzufügen**

Lese die aktuelle `api.ts` um das Fehlerbehandlungs-Muster zu verstehen:

```bash
cat frontend/src/lib/api.ts
```

Füge `apiDelete` analog zu `apiGet`/`apiPatch` hinzu:

```typescript
export async function apiDelete(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    // Nutze dasselbe Error-Muster wie andere api-Funktionen in dieser Datei
    throw new Error(`DELETE ${url} failed: ${res.status}`)
  }
}
```

Passe den Error-Wurf an das bestehende Muster an (z.B. wenn `ApiError`-Klasse genutzt wird).

- [ ] **Step 3: useUpdatePlan erstellen**

Prüfe zuerst `types.ts` auf `PlanUpdate`:

```bash
grep -n "PlanUpdate" frontend/src/lib/types.ts
```

```typescript
// frontend/src/features/plans/useUpdatePlan.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api'
import type { PlanUpdate, PlanWithRelations } from '@/lib/types'
import { planKeys } from './usePlans'

export function useUpdatePlan(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlanUpdate) =>
      apiPatch<PlanWithRelations>(`/api/plans/${planId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.detail(planId) })
      void qc.invalidateQueries({ queryKey: planKeys.list() })
    },
  })
}
```

Falls `PlanUpdate` nicht in `types.ts` exportiert ist: `export type PlanUpdate = components['schemas']['PlanUpdate']` hinzufügen.

- [ ] **Step 4: useDeletePlan erstellen**

```typescript
// frontend/src/features/plans/useDeletePlan.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiDelete } from '@/lib/api'
import { planKeys } from './usePlans'

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: number) => apiDelete(`/api/plans/${planId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}
```

- [ ] **Step 5: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/features/plans/useUpdatePlan.ts frontend/src/features/plans/useDeletePlan.ts frontend/src/lib/types.ts
git commit -m "feat(plans): useUpdatePlan, useDeletePlan Hooks + apiDelete (C1, C2)"
```

---

### Task 6: CommandBar extras Prop

**Files:**
- Modify: `frontend/src/components/dp/CommandBar.tsx`

- [ ] **Step 1: CommandBar lesen**

```bash
cat frontend/src/components/dp/CommandBar.tsx
```

Identifiziere die `CommandBarProps`-Interface und den JSX-Bereich wo `primaryAction` gerendert wird.

- [ ] **Step 2: extras Prop hinzufügen**

In `CommandBarProps`:
```typescript
extras?: React.ReactNode
```

Im JSX-Render, in der rechten Aktions-Area (wo `primaryAction` gerendert wird), `extras` vor dem `primaryAction`-Button rendern:

```typescript
<div className="flex items-center gap-2 ml-auto">
  {extras}
  {primaryAction && (
    <Button ... onClick={primaryAction.onClick}>
      ...
    </Button>
  )}
</div>
```

Achte darauf, das bestehende Layout nicht zu brechen.

- [ ] **Step 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dp/CommandBar.tsx
git commit -m "feat(ui): CommandBar extras Prop für zusätzliche Rechts-Inhalte"
```

---

### Task 7: Plan-Status Toggle in PlanPage CommandBar (C1)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: PlanPage lesen (Anfang)**

```bash
head -80 frontend/src/features/plans/PlanPage.tsx
```

Notiere: Welche Imports sind schon vorhanden? Wie wird `plan` abgerufen?

- [ ] **Step 2: useUpdatePlan importieren und Status-Toggle-Logik hinzufügen**

```typescript
// Import ergänzen:
import { useUpdatePlan } from './useUpdatePlan'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// In der PlanPage-Komponente:
const updatePlan = useUpdatePlan(planId)

function handleStatusToggle() {
  if (!plan) return
  const newStatus = plan.status === 'DRAFT' ? 'RELEASED' : 'DRAFT'
  updatePlan.mutate({ status: newStatus })
}

const statusLabel = plan?.status === 'RELEASED' ? 'Freigegeben' : 'Entwurf'
const statusToggleLabel = plan?.status === 'RELEASED' ? 'Zurück zu Entwurf' : 'Freigeben'
```

- [ ] **Step 3: Status-Badge und Button in CommandBar extras**

Finde den `<CommandBar>`-Aufruf in PlanPage und ergänze `extras`:

```typescript
<CommandBar
  title={planTitle}
  breadcrumb={[{ label: 'Pläne', href: '/plans' }]}
  primaryAction={{ label: 'Export', onClick: () => window.location.assign(`/api/plans/${planId}/export`) }}
  extras={plan ? (
    <div className="flex items-center gap-2">
      <span className={cn(
        'text-xs px-2 py-0.5 rounded-full font-medium border',
        plan.status === 'RELEASED'
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-600 border-gray-200'
      )}>
        {statusLabel}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleStatusToggle}
        disabled={updatePlan.isPending}
      >
        {statusToggleLabel}
      </Button>
    </div>
  ) : undefined}
/>
```

Passe den Export-Button-Aufruf an den tatsächlichen Code in PlanPage an.

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plans): Plan-Status Toggle DRAFT<->RELEASED in CommandBar (C1)"
```

---

### Task 8: Plan löschen — PlanListPage (C2)

**Files:**
- Modify: `frontend/src/features/plans/PlanListPage.tsx`

- [ ] **Step 1: PlanListPage lesen**

```bash
cat frontend/src/features/plans/PlanListPage.tsx
```

Identifiziere die `PlanCard`-Komponente.

- [ ] **Step 2: Imports ergänzen**

```typescript
import { useState } from 'react'  // falls noch nicht vorhanden
import { useDeletePlan } from './useDeletePlan'
import { format } from 'date-fns'  // falls noch nicht vorhanden
import { MoreHorizontal, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
```

- [ ] **Step 3: PlanCard mit Kebab-Menü und AlertDialog ersetzen**

```typescript
function PlanCard({ plan, onClick }: { plan: Plan; onClick: () => void }) {
  const [showDelete, setShowDelete] = useState(false)
  const deletePlan = useDeletePlan()
  const title = format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })

  return (
    <>
      <div className="group relative rounded-2xl bg-card border border-line p-5 hover:border-accent transition">
        <button onClick={onClick} className="w-full text-left">
          <p className="font-serif text-xl capitalize">{title}</p>
          <p className="text-xs text-ink-3 mt-1 uppercase tracking-wide">{plan.status}</p>
        </button>
        <button
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-line"
          onClick={(e) => { e.stopPropagation(); setShowDelete(true) }}
          aria-label="Plan-Aktionen"
        >
          <MoreHorizontal className="size-4 text-ink-3" />
        </button>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{title}" wird unwiderruflich gelöscht — inklusive aller Schichten und Rotationen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deletePlan.mutate(plan.id)}
              disabled={deletePlan.isPending}
            >
              <Trash2 className="size-4 mr-1" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/PlanListPage.tsx
git commit -m "feat(plans): Plan-Löschen in PlanListPage Kebab-Menü (C2)"
```

---

### Task 9: Plan löschen — PlanPage CommandBar (C2)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: useDeletePlan importieren und State anlegen**

```typescript
// Import ergänzen:
import { useDeletePlan } from './useDeletePlan'
import { Trash2 } from 'lucide-react'
// AlertDialog-Imports falls noch nicht vorhanden

// In der Komponente:
const [showDeleteDialog, setShowDeleteDialog] = useState(false)
const deletePlan = useDeletePlan()

function handleDeletePlan() {
  deletePlan.mutate(planId, {
    onSuccess: () => navigate('/plans'),
  })
}
```

- [ ] **Step 2: Löschen-Button zu CommandBar extras hinzufügen**

Erweitere die `extras`-JSX aus Task 7:

```typescript
extras={plan ? (
  <div className="flex items-center gap-2">
    {/* Status-Badge und Toggle aus Task 7 */}
    <span className={cn(...)}>...</span>
    <Button variant="outline" size="sm" onClick={handleStatusToggle} ...>
      {statusToggleLabel}
    </Button>
    {/* Neu: Löschen-Button */}
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowDeleteDialog(true)}
      className="text-red-500 hover:text-red-700 hover:bg-red-50"
      aria-label="Plan löschen"
    >
      <Trash2 className="size-4" />
    </Button>
  </div>
) : undefined}
```

- [ ] **Step 3: AlertDialog für Löschen rendern**

Füge außerhalb des `<DndContext>` (oder in einem React.Fragment-Wrapper) hinzu:

```typescript
<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Plan löschen?</AlertDialogTitle>
      <AlertDialogDescription>
        „{planTitle}" wird unwiderruflich gelöscht — inklusive aller Schichten und Rotationen.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
      <AlertDialogAction
        className="bg-red-600 hover:bg-red-700 text-white"
        onClick={handleDeletePlan}
        disabled={deletePlan.isPending}
      >
        Löschen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plans): Plan-Löschen in PlanPage CommandBar (C2)"
```

---

### Task 10: Summary Bar + Scroll-Navigation + Query-Param Handling (C3)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: data-shift-id Prop zu UnifiedShiftCell hinzufügen**

In `UnifiedShiftCell.tsx`:

```typescript
// Interface ergänzen:
shiftId?: number

// In der JSX des Haupt-Divs (zusätzliches Attribut):
// Spread-Operator für optionales Attribut:
{...(shiftId !== undefined ? { 'data-shift-id': String(shiftId) } : {})}
```

- [ ] **Step 2: shiftId aus UnifiedPlanGrid weitergeben**

Lese `unifiedGridUtils.ts`:

```bash
cat frontend/src/features/plans/unifiedGridUtils.ts
```

Verstehe was `resolveCell` zurückgibt — enthält es eine `shiftId`? Falls nicht, muss `shiftId` aus den `shifts` props direkt berechnet werden.

In `UnifiedPlanGrid.tsx` beim Rendern von `UnifiedShiftCell`:

```typescript
// Finde den Shift für diese Zelle (falls resolveCell keine shiftId liefert):
const matchingShift = shifts.find(
  s => s.shift_date === dayKey && /* doctor_id passt zur rotation */
)

<UnifiedShiftCell
  ...
  shiftId={matchingShift?.id}
/>
```

- [ ] **Step 3: Highlight-Animation in index.css**

```css
/* In frontend/src/index.css hinzufügen: */
@keyframes dp-highlight-pulse {
  0%, 100% { outline: 3px solid transparent; }
  50% { outline: 3px solid rgba(234, 179, 8, 0.7); }
}

.dp-highlight-pulse {
  animation: dp-highlight-pulse 0.5s ease-in-out 3;
  animation-fill-mode: forwards;
}
```

- [ ] **Step 4: scrollToFirstMatch-Funktion in PlanPage**

```typescript
// Import:
import { useSearchParams } from 'react-router-dom'

// In der Komponente:
const [searchParams, setSearchParams] = useSearchParams()

function scrollToFirstMatch(type: 'open' | 'conflict') {
  const candidateIds: number[] =
    type === 'open'
      ? (conflicts?.open_shifts.map(s => s.shift_id) ?? [])
      : (conflicts?.conflicts.map(s => s.shift_id) ?? [])

  const firstId = candidateIds[0]
  if (firstId == null) return

  const el = document.querySelector(`[data-shift-id="${firstId}"]`)
  if (!el) return

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('dp-highlight-pulse')
  setTimeout(() => el.classList.remove('dp-highlight-pulse'), 2000)
}

// Query-Param lesen nach Grid-Render:
useEffect(() => {
  const highlight = searchParams.get('highlight')
  if (!highlight || !conflicts) return
  if (highlight === 'open' || highlight === 'conflict') {
    // Kurze Verzögerung damit Grid gerendert ist:
    const t = setTimeout(() => {
      scrollToFirstMatch(highlight as 'open' | 'conflict')
      setSearchParams({}, { replace: true })
    }, 100)
    return () => clearTimeout(t)
  }
}, [searchParams, conflicts])
```

- [ ] **Step 5: Summary Bar in PlanPage JSX hinzufügen**

Nach dem `<CommandBar>`-Block:

```typescript
{/* Summary Bar — nur anzeigen wenn Probleme vorhanden */}
{(openCount > 0 || conflictCount > 0) && (
  <div className="flex gap-4 px-10 py-1.5 bg-paper border-b border-line text-xs">
    {openCount > 0 && (
      <button
        className="font-medium text-warn-ink hover:underline"
        onClick={() => scrollToFirstMatch('open')}
      >
        {openCount} offen
      </button>
    )}
    {conflictCount > 0 && (
      <button
        className="font-medium text-red-600 hover:underline"
        onClick={() => scrollToFirstMatch('conflict')}
      >
        {conflictCount} Konflikte
      </button>
    )}
  </div>
)}
```

Stelle sicher dass `openCount` und `conflictCount` schon aus `conflicts` berechnet sind (wahrscheinlich schon vorhanden in `kpiTiles`).

- [ ] **Step 6: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx frontend/src/features/plans/components/UnifiedShiftCell.tsx frontend/src/features/plans/components/UnifiedPlanGrid.tsx frontend/src/index.css
git commit -m "feat(plans): Summary-Bar, Scroll-Navigation, Query-Param Highlight (C3)"
```

---

### Task 11: Konflikt-Highlight während Drag (B1)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

- [ ] **Step 1: parseShiftTypeDragId Import prüfen**

```bash
grep -n "parseShiftTypeDragId\|SHIFT_TYPE_DRAG_ID_PREFIX" frontend/src/features/plans/components/ShiftTypeDragBar.tsx
```

Stelle sicher, dass `parseShiftTypeDragId` exportiert wird.

- [ ] **Step 2: dragConflictMap State und handleDragStart-Erweiterung in PlanPage**

```typescript
// Import ergänzen:
import { parseShiftTypeDragId } from './components/ShiftTypeDragBar'
import type { DragStartEvent } from '@dnd-kit/core'

// State:
const [dragConflictMap, setDragConflictMap] = useState<Map<number, Set<string>> | null>(null)

// handleDragStart erweitern (Shift-Type-Drag-Zweig ergänzen):
function handleDragStart(event: DragStartEvent) {
  // Bestehender Doctor-Drag-Zweig (unverändert lassen):
  const doctorId = parseDoctorDragId(String(event.active.id))
  if (doctorId !== null) {
    const name = (event.active.data.current as { doctorName?: string } | undefined)?.doctorName ?? ''
    setActiveDragDoctor({ id: doctorId, name })
    return
  }

  // Neuer Shift-Type-Drag-Zweig:
  const shiftTypeId = parseShiftTypeDragId(String(event.active.id))
  if (shiftTypeId !== null) {
    const map = new Map<number, Set<string>>()

    // Alle besetzten Schichten → (doctorId, date) als potenzielle Konflikt-Dates
    shifts.forEach(shift => {
      if (shift.doctor_id == null) return
      const dates = map.get(shift.doctor_id) ?? new Set<string>()
      dates.add(shift.shift_date)
      map.set(shift.doctor_id, dates)
    })

    // NOT_AVAILABLE Konflikte → zusätzliche Dates markieren
    conflicts?.conflicts.forEach(conflict => {
      if (conflict.conflict_type === 'not_available') {
        const dates = map.get(conflict.doctor_id) ?? new Set<string>()
        dates.add(String(conflict.shift_date))
        map.set(conflict.doctor_id, dates)
      }
    })

    setDragConflictMap(map)
  }
}
```

- [ ] **Step 3: dragConflictMap in handleDragEnd und handleDragCancel leeren**

Füge `setDragConflictMap(null)` am Anfang beider Handler hinzu.

- [ ] **Step 4: dragConflictMap zu UnifiedPlanGrid weitergeben**

Interface ergänzen:
```typescript
// UnifiedPlanGridProps:
dragConflictMap?: Map<number, Set<string>> | null
```

In PlanPage beim UnifiedPlanGrid-Aufruf:
```typescript
<UnifiedPlanGrid
  ...
  dragConflictMap={dragConflictMap}
/>
```

- [ ] **Step 5: isConflictTarget pro Zelle in UnifiedPlanGrid berechnen**

Lese den Grid-Render-Code:
```bash
grep -n "UnifiedShiftCell\|row\.type\|rotation\." frontend/src/features/plans/components/UnifiedPlanGrid.tsx | head -30
```

Verstehe wie `doctorId` einer Rotation-Zeile zugänglich ist. Dann:

```typescript
// Beim Rendern jeder Shift-Zelle:
const rotationDoctorId = rotation.doctor_id  // Feldname aus RotationAssignmentWithDetails prüfen
const isConflictTarget =
  dragConflictMap != null &&
  !!dragConflictMap.get(rotationDoctorId)?.has(dayKey)

<UnifiedShiftCell
  ...
  isConflictTarget={isConflictTarget}
/>
```

- [ ] **Step 6: isConflictTarget in UnifiedShiftCell rendern**

```typescript
// UnifiedShiftCellProps ergänzen:
isConflictTarget?: boolean

// In cn()-Aufruf hinzufügen (nur bei aktivem Drag, d.h. isConflictTarget gesetzt):
isConflictTarget && 'border-red-400 bg-red-50 ring-1 ring-inset ring-red-300',
```

- [ ] **Step 7: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx frontend/src/features/plans/components/UnifiedPlanGrid.tsx frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "feat(plans): Konflikt-Highlight während ShiftType-Drag (B1)"
```

---

### Task 12: Doppelklick-Remove mit 300ms-Delay (B2)

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

Hintergrund: Browser feuert `click → click → dblclick`. Ohne Delay würde Single-Click-Popover beim Doppelklick aufgehen. Lösung: Single-Click auf besetzte Zellen um 300ms verzögern; Doppelklick cancelt den Timer.

- [ ] **Step 1: Props und Timer-Logik in UnifiedShiftCell**

```typescript
// Imports ergänzen:
import { useRef } from 'react'
import { toast } from 'sonner'

// Interface ergänzen:
isPinned?: boolean
shiftAssigned?: boolean   // true wenn Zelle eine Schicht hat (nicht Abwesenheit, nicht leer)
onDoubleClickRemove?: () => void

// In der Komponente:
const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function handleClick() {
  if (onDoubleClickRemove && shiftAssigned) {
    // 300ms warten bevor Popover öffnet (gibt Doppelklick Zeit zum Canceln)
    clickTimerRef.current = setTimeout(() => {
      onClick?.()
    }, 300)
  } else {
    onClick?.()
  }
}

function handleDoubleClick() {
  if (clickTimerRef.current) {
    clearTimeout(clickTimerRef.current)
    clickTimerRef.current = null
  }
  if (!shiftAssigned) return
  if (isPinned) {
    toast.info('Gepinnte Schicht — erst entpinnen')
    return
  }
  onDoubleClickRemove?.()
}
```

- [ ] **Step 2: Handler in JSX verdrahten**

Im Haupt-Div von UnifiedShiftCell:
```typescript
onClick={handleClick}
onDoubleClick={handleDoubleClick}
```

Entferne das bisherige `onClick={onClick}` aus dem Div.

- [ ] **Step 3: onDoubleClickRemove und isPinned in UnifiedPlanGrid übergeben**

Interface ergänzen:
```typescript
// UnifiedPlanGridProps:
onDoubleClickRemove?: (shiftId: number) => void
```

Beim Rendern von UnifiedShiftCell:
```typescript
// shift ist der Shift dieser Zelle (aus resolveCell oder direktem Lookup):
shiftAssigned={shift != null && shift.doctor_id != null}
isPinned={shift?.is_pinned ?? false}
onDoubleClickRemove={
  shift?.id != null
    ? () => onDoubleClickRemove?.(shift.id)
    : undefined
}
```

- [ ] **Step 4: onDoubleClickRemove in PlanPage verdrahten**

```typescript
// assignShift ist bereits vorhanden:
<UnifiedPlanGrid
  ...
  onDoubleClickRemove={(shiftId) => {
    assignShift.mutate({ shiftId, data: { doctor_id: null } })
  }}
/>
```

- [ ] **Step 5: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx frontend/src/features/plans/components/UnifiedPlanGrid.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plans): Doppelklick-Remove Schichtzuweisung mit 300ms-Delay (B2)"
```

---

### Task 13: Tastenkürzel 0–9 für Schichttyp-Auswahl (B3)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`
- Modify: `frontend/src/features/plans/components/ShiftTypeDragBar.tsx`

- [ ] **Step 1: selectedShiftTypeIndex State + keydown-Listener in PlanPage**

```typescript
// State:
const [selectedShiftTypeIndex, setSelectedShiftTypeIndex] = useState<number | null>(null)

// useEffect mit keydown-Listener:
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Nicht feuern wenn Input, Textarea oder Select fokussiert
    const tag = (document.activeElement as HTMLElement | null)?.tagName?.toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    const digit = parseInt(e.key, 10)
    if (isNaN(digit)) return

    if (digit === 0) {
      setSelectedShiftTypeIndex(null)
    } else {
      setSelectedShiftTypeIndex(digit - 1) // 1→Index 0, 2→Index 1, ...
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [])
```

- [ ] **Step 2: selectedIndex an ShiftTypeDragBar weitergeben**

Finde den `<ShiftTypeDragBar>`-Aufruf in PlanPage JSX:
```typescript
<ShiftTypeDragBar
  shiftTypes={shiftTypes}
  focusMode={focusMode}
  selectedIndex={selectedShiftTypeIndex}
/>
```

- [ ] **Step 3: selectedIndex Prop und Chip-Highlight in ShiftTypeDragBar**

```typescript
// ShiftTypeDragBarProps ergänzen:
selectedIndex?: number | null

// ShiftTypeChip-Komponente (innerhalb ShiftTypeDragBar.tsx):
// Prop hinzufügen:
isSelected?: boolean

// Im className des Chip-Divs (im useDraggable-Block):
cn(
  // ... bestehende Klassen ...
  isSelected && 'ring-2 ring-accent ring-offset-1',
)

// Beim Rendern der Chips:
<ShiftTypeChip
  key={st.id}
  shiftType={st}
  isVN={isVN}
  dimmed={focusMode === 'vn' && !isVN}
  isSelected={selectedIndex === idx}
/>

// Im .map() den Index mitführen:
{shiftTypes.map((st, idx) => {
  const isVN = st.short_name === 'V' || st.short_name === 'N'
  return (
    <ShiftTypeChip
      key={st.id}
      shiftType={st}
      isVN={isVN}
      dimmed={focusMode === 'vn' && !isVN}
      isSelected={selectedIndex === idx}
    />
  )
})}
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx frontend/src/features/plans/components/ShiftTypeDragBar.tsx
git commit -m "feat(plans): Tastenkürzel 0-9 für Schichttyp-Auswahl in DragBar (B3)"
```

---

### Task 14: Hover-Buttons auf Rotationszeilen — Löschen + Bearbeiten (B4)

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: UnifiedPlanGrid Rotation-Row-Rendering verstehen**

```bash
grep -n "rotation\|doctor_id\|sticky left" frontend/src/features/plans/components/UnifiedPlanGrid.tsx | head -40
```

Finde den Block wo Rotation-Zeilen ihren linken Label-Cell rendern (mit `sticky left-0`).

- [ ] **Step 2: Imports in UnifiedPlanGrid ergänzen**

```typescript
import { Pencil, X } from 'lucide-react'
import type { RotationAssignmentWithDetails } from '@/lib/types'
```

- [ ] **Step 3: Props in UnifiedPlanGridProps ergänzen**

```typescript
onDeleteRotation?: (rotationId: number) => void
onEditRotation?: (rotation: RotationAssignmentWithDetails) => void
```

- [ ] **Step 4: Hover-Buttons zur Rotation-Label-Cell hinzufügen**

Ersetze den linken Label-Cell der Rotation-Zeile. Der Block hat wahrscheinlich die Form:

```typescript
// Vorher (vereinfacht):
<div className="sticky left-0 z-10 ...">
  <span>{doctorShortName}</span>
</div>

// Nachher — wrapper mit hover-gesteuerten Buttons:
<div
  className="group/rotrow sticky left-0 z-10 flex items-center gap-1 pr-2 pl-8 py-1 bg-card border-b border-line min-w-0"
  style={{ borderLeft: `4px solid ${color}` }}
>
  <span className="flex-1 truncate text-[11px] font-medium">
    {doctorShortName}
  </span>
  <div className="hidden group-hover/rotrow:flex items-center gap-0.5 shrink-0">
    <button
      className="p-0.5 rounded hover:bg-blue-50 text-ink-3 hover:text-blue-600 transition-colors"
      title="Zeitraum bearbeiten"
      onClick={(e) => { e.stopPropagation(); onEditRotation?.(rotation) }}
      aria-label="Rotationszeitraum bearbeiten"
    >
      <Pencil className="size-3" />
    </button>
    <button
      className="p-0.5 rounded hover:bg-red-50 text-ink-3 hover:text-red-600 transition-colors"
      title="Arzt aus Bereich entfernen"
      onClick={(e) => { e.stopPropagation(); onDeleteRotation?.(rotation.id) }}
      aria-label="Rotation löschen"
    >
      <X className="size-3" />
    </button>
  </div>
</div>
```

**Hinweis Tailwind group/rotrow:** Falls `group/rotrow` nicht über Grid-Spalten funktioniert (da Grid-Zellen unabhängige Elemente sind), nutze React-State als Fallback:

```typescript
// Oben in UnifiedPlanGrid (innerhalb der Render-Funktion für Rotation-Rows):
const [hoveredRotId, setHoveredRotId] = useState<number | null>(null)

// Am Label-Cell:
onMouseEnter={() => setHoveredRotId(rotation.id)}
onMouseLeave={() => setHoveredRotId(null)}

// Buttons statt hidden/group-hover:
<div className={cn('flex items-center gap-0.5 shrink-0', hoveredRotId !== rotation.id && 'invisible')}>
  ...
</div>
```

- [ ] **Step 5: PlanPage — onDeleteRotation und onEditRotation verdrahten**

```typescript
// Import:
import { useDeleteRotation } from './usePlanRotations'
import type { RotationAssignmentWithDetails } from '@/lib/types'

const deleteRotation = useDeleteRotation(planId)

// State für Löschen-Bestätigung:
const [pendingDeleteRotation, setPendingDeleteRotation] = useState<RotationAssignmentWithDetails | null>(null)
```

```typescript
<UnifiedPlanGrid
  ...
  onDeleteRotation={(rotationId) => {
    const rotation = rotations.find(r => r.id === rotationId)
    if (rotation) setPendingDeleteRotation(rotation)
  }}
  onEditRotation={(rotation) => {
    setActiveRotationCell({
      departmentId: rotation.department_id,
      day: rotation.valid_from,
      assignmentId: rotation.id,
    })
  }}
/>

{/* AlertDialog für Rotations-Löschung: */}
<AlertDialog
  open={pendingDeleteRotation !== null}
  onOpenChange={(o) => !o && setPendingDeleteRotation(null)}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Arzt aus Bereich entfernen?</AlertDialogTitle>
      <AlertDialogDescription>
        Nicht-gepinnte Schichtzuweisungen im Zeitraum werden ebenfalls gelöscht.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
      <AlertDialogAction
        className="bg-red-600 hover:bg-red-700 text-white"
        onClick={() => {
          if (pendingDeleteRotation) {
            deleteRotation.mutate(pendingDeleteRotation.id)
            setPendingDeleteRotation(null)
          }
        }}
      >
        Entfernen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Wichtig:** Prüfe den genauen Typ von `activeRotationCell` in PlanPage. Falls er kein `assignmentId`-Feld hat, muss es ergänzt werden damit RotationAssignPopover `existingAssignment` korrekt bekommt.

- [ ] **Step 6: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 7: Gesamte Frontend-Tests laufen**

```bash
cd frontend && pnpm test run
```

Erwartet: Alle Tests grün (oder nur vorher existierende Fehler).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedPlanGrid.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plans): Hover-Buttons auf Rotationszeilen (Löschen + Bearbeiten) (B4)"
```

---

## Selbstreview-Checkliste (nach Implementierung)

- [ ] Alle 9 Features (A1, A2, B1–B4, C1–C3) manuell im Browser getestet
- [ ] TypeScript `pnpm tsc --noEmit` — keine Fehler
- [ ] Frontend-Tests `pnpm test run` — alle grün
- [ ] Backend-Tests `pytest -x -q` — alle grün
- [ ] Dev-Toggle in Einstellungen speichert und steuert ReactQueryDevtools
- [ ] Doppelklick entfernt Schicht; Single-Click öffnet Popover (kein Flackern)
- [ ] Taste 1–9 highlightet korrekten Chip; Taste 0 deselektiert
- [ ] Plan-Status-Toggle ändert Badge und Label korrekt
- [ ] Plan-Löschen aus PlanListPage und PlanPage navigiert zu /plans
- [ ] Tile-Klick im Dashboard navigiert zu Plan und scrollt zur Zelle
