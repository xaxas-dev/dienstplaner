# 6-Pack UI-Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sechs unabhängige UI-Features: Solver-Toggle, bearbeitbares Profil mit Hardware-ID, Status-Button-Optik, Direktzuweisung ohne Popover, Hinzufügen-Zeile mit Fuzzy-Suche, durchgehende Bereichsname-Zeile.

**Architecture:** Rein Frontend-seitig außer einem kleinen Backend-Endpoint für die Hardware-ID. Alle Features sind unabhängig voneinander — Tasks 1–5 und 6–9 können parallel gestartet werden. Tasks 4 und 5 hängen von Task 3 ab; Task 5 hängt von Task 4 ab.

**Tech Stack:** React 18, TypeScript, Zustand (persist), TanStack Query, Tailwind CSS, shadcn/ui, FastAPI (Python), dnd-kit

---

## Datei-Übersicht

| Datei | Aktion |
|---|---|
| `frontend/src/stores/useAppSettings.ts` | Modify — `solverEnabled` Feld hinzufügen |
| `frontend/src/features/settings/SettingsPage.tsx` | Modify — Solver-Switch hinzufügen |
| `frontend/src/features/plans/PlanPage.tsx` | Modify — Solver-Guard, Status-Button, Direktzuweisung, onAddRotation |
| `backend/app/api/system.py` | Create — `GET /api/system/hardware-id` |
| `backend/app/main.py` | Modify — system router registrieren |
| `frontend/src/stores/useUserProfile.ts` | Create — Profil-Store |
| `frontend/src/components/dp/ProfileEditModal.tsx` | Create — Profil-Dialog |
| `frontend/src/components/layout/MiniRail.tsx` | Modify — Avatar → Button + ProfileEditModal |
| `frontend/src/features/plans/components/BereichHeaderRow.tsx` | Modify — colCount entfernen, spanning div |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | Modify — AddRotationRow + flatMap + onAddRotation |

---

## Task 1: Solver-Toggle

**Files:**
- Modify: `frontend/src/stores/useAppSettings.ts`
- Modify: `frontend/src/features/settings/SettingsPage.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Schritt 1: useAppSettings erweitern**

Ersetze den gesamten Inhalt von `frontend/src/stores/useAppSettings.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
  solverEnabled: boolean
  setSolverEnabled: (v: boolean) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
      solverEnabled: true,
      setSolverEnabled: (solverEnabled) => set({ solverEnabled }),
    }),
    { name: 'dp-app-settings' }
  )
)
```

- [ ] **Schritt 2: SettingsPage — Solver-Switch hinzufügen**

In `frontend/src/features/settings/SettingsPage.tsx`:

2a. Destructuring in `SettingsPage` ändern (Zeile ~52):
```tsx
// vorher:
const { devMode, setDevMode } = useAppSettings()

// nachher:
const { devMode, setDevMode, solverEnabled, setSolverEnabled } = useAppSettings()
```

2b. Nach dem bestehenden devMode-Block (dem `<div>` mit `border-b border-line`) einfügen:
```tsx
<div className="flex items-center justify-between py-3">
  <div>
    <p className="text-sm font-medium text-ink">Solver (Plan generieren)</p>
    <p className="text-xs text-ink-3 mt-0.5">
      Blendet den Plan-Generator ein. Erfordert Java 21 (Eclipse Temurin).
    </p>
  </div>
  <Switch
    checked={solverEnabled}
    onCheckedChange={setSolverEnabled}
    aria-label="Solver aktivieren"
  />
</div>
```

- [ ] **Schritt 3: PlanPage — solverEnabled lesen und anwenden**

In `frontend/src/features/plans/PlanPage.tsx`:

3a. Import hinzufügen (nach den anderen Store-Imports):
```tsx
import { useAppSettings } from '@/stores/useAppSettings'
```

3b. Im Komponent-Body (nach den Mutation-Hooks):
```tsx
const { solverEnabled } = useAppSettings()
```

3c. `useEffect` für State-Reset hinzufügen (nach dem bestehenden ESC-Key-Effect):
```tsx
useEffect(() => {
  if (!solverEnabled) {
    setIsSolverOpen(false)
    setSolveResult(null)
  }
}, [solverEnabled])
```

3d. „Plan generieren"-Button in der `extras`-Section einwickeln:
```tsx
// vorher:
<Button
  variant="outline"
  size="sm"
  onClick={handleSolve}
  disabled={solvePlan.isPending || isNaN(id)}
>
  <Zap className="size-3.5 mr-1.5" />
  {solvePlan.isPending ? 'Berechne…' : 'Plan generieren'}
</Button>

// nachher:
{solverEnabled && (
  <Button
    variant="outline"
    size="sm"
    onClick={handleSolve}
    disabled={solvePlan.isPending || isNaN(id)}
  >
    <Zap className="size-3.5 mr-1.5" />
    {solvePlan.isPending ? 'Berechne…' : 'Plan generieren'}
  </Button>
)}
```

3e. `SolverResultPanel`-Block (nach dem letzten `AlertDialog`) ändern:
```tsx
// vorher:
{isSolverOpen && solveResult && (

// nachher:
{isSolverOpen && solveResult && solverEnabled && (
```

- [ ] **Schritt 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Schritt 5: Commit**

```bash
git add frontend/src/stores/useAppSettings.ts frontend/src/features/settings/SettingsPage.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(ui): Solver-Toggle in Einstellungen"
```

---

## Task 2: Backend Hardware-ID Endpoint

**Files:**
- Create: `backend/app/api/system.py`
- Modify: `backend/app/main.py`

- [ ] **Schritt 1: system.py erstellen**

Neue Datei `backend/app/api/system.py`:

```python
import hashlib
import platform
import uuid

from fastapi import APIRouter

router = APIRouter()


@router.get("/hardware-id")
def get_hardware_id() -> dict:
    raw = platform.node() + str(uuid.getnode())
    hardware_id = hashlib.md5(raw.encode()).hexdigest()[:12]
    return {"hardware_id": hardware_id}
```

- [ ] **Schritt 2: Router in main.py registrieren**

In `backend/app/main.py`:

2a. Import hinzufügen (alphabetisch einsortieren, nach `app_settings`):
```python
from app.api.system import router as system_router
```

2b. `include_router` vor `register_error_handlers` hinzufügen (Zeile 62, nach `doctor_overrides_router`):
```python
app.include_router(system_router, prefix="/api/system")
```

- [ ] **Schritt 3: Endpoint testen**

Backend starten und prüfen:
```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000
```
In einem anderen Terminal:
```bash
curl http://localhost:8000/api/system/hardware-id
```
Erwartung: `{"hardware_id":"<12-Zeichen-Hex-String>"}` — gleicher Wert bei Wiederholung.

- [ ] **Schritt 4: Commit**

```bash
git add backend/app/api/system.py backend/app/main.py
git commit -m "feat(backend): GET /api/system/hardware-id endpoint"
```

---

## Task 3: Profil-Store

**Files:**
- Create: `frontend/src/stores/useUserProfile.ts`

- [ ] **Schritt 1: Store erstellen**

Neue Datei `frontend/src/stores/useUserProfile.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserProfile {
  name: string
  title: string
  note: string
  setProfile: (partial: Partial<{ name: string; title: string; note: string }>) => void
}

export const useUserProfile = create<UserProfile>()(
  persist(
    (set) => ({
      name: 'Planer',
      title: '',
      note: '',
      setProfile: (partial) => set((state) => ({ ...state, ...partial })),
    }),
    { name: 'dp-user-profile' }
  )
)
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/stores/useUserProfile.ts
git commit -m "feat(ui): useUserProfile Zustand-Store"
```

---

## Task 4: ProfileEditModal

**Files:**
- Create: `frontend/src/components/dp/ProfileEditModal.tsx`

Voraussetzung: `textarea.tsx` in shadcn/ui noch nicht vorhanden. Zuerst installieren:

- [ ] **Schritt 1: shadcn Textarea installieren**

```bash
cd frontend && pnpm dlx shadcn@latest add textarea
```

Erwartung: `src/components/ui/textarea.tsx` erscheint.

- [ ] **Schritt 2: ProfileEditModal erstellen**

Neue Datei `frontend/src/components/dp/ProfileEditModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiGet } from '@/lib/api'
import { useUserProfile } from '@/stores/useUserProfile'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileEditModal({ open, onOpenChange }: Props) {
  const { name, title, note, setProfile } = useUserProfile()
  const [localName, setLocalName] = useState(name)
  const [localTitle, setLocalTitle] = useState(title)
  const [localNote, setLocalNote] = useState(note)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalName(name)
      setLocalTitle(title)
      setLocalNote(note)
    }
  }, [open, name, title, note])

  const { data: hwData } = useQuery({
    queryKey: ['hardware-id'],
    queryFn: () => apiGet<{ hardware_id: string }>('/api/system/hardware-id'),
    staleTime: Infinity,
  })

  function handleSave() {
    setProfile({
      name: localName.trim() || 'Planer',
      title: localTitle.trim(),
      note: localNote.trim(),
    })
    onOpenChange(false)
  }

  function handleCopy() {
    if (!hwData?.hardware_id) return
    void navigator.clipboard.writeText(hwData.hardware_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-80">
        <DialogHeader>
          <DialogTitle>Profil</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-ink-3">Geräte-ID</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs px-2 py-1 bg-paper rounded border border-line font-mono text-ink-2 truncate">
                {hwData?.hardware_id ?? '—'}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!hwData?.hardware_id}
                aria-label="Geräte-ID kopieren"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs">Name</Label>
            <Input
              id="profile-name"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              maxLength={60}
              placeholder="Planer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-title" className="text-xs">Titel</Label>
            <Input
              id="profile-title"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              maxLength={80}
              placeholder="z. B. Oberarzt"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-note" className="text-xs">Notiz</Label>
            <Textarea
              id="profile-note"
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Persönliche Notiz…"
            />
          </div>

          <Button className="w-full" onClick={handleSave}>
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Schritt 4: Commit**

```bash
git add frontend/src/components/ui/textarea.tsx frontend/src/components/dp/ProfileEditModal.tsx
git commit -m "feat(ui): ProfileEditModal mit Hardware-ID und Profilfeldern"
```

---

## Task 5: MiniRail — Avatar zu Profil-Button

**Files:**
- Modify: `frontend/src/components/layout/MiniRail.tsx`

- [ ] **Schritt 1: Imports ergänzen**

In `frontend/src/components/layout/MiniRail.tsx` — folgende Imports hinzufügen:

```tsx
import { useState } from 'react'
import { useUserProfile } from '@/stores/useUserProfile'
import { ProfileEditModal } from '@/components/dp/ProfileEditModal'
```

- [ ] **Schritt 2: Store und State im Komponent**

Direkt am Anfang von `MiniRail()` (nach der `useLocation`-Zeile) hinzufügen:

```tsx
const [profileOpen, setProfileOpen] = useState(false)
const { name } = useUserProfile()
```

- [ ] **Schritt 3: Avatar-Div zu Button ändern**

Bestehenden Avatar-Block (die letzten Zeilen vor `</aside>`):

```tsx
{/* Avatar */}
<div className="mt-1">
  <Avatar name="Planer" id="planer" size={32} />
</div>
```

Ersetzen durch:

```tsx
{/* Avatar / Profil */}
<button
  type="button"
  onClick={() => setProfileOpen(true)}
  className="mt-1 rounded-full hover:opacity-80 transition-opacity"
  aria-label="Profil bearbeiten"
>
  <Avatar name={name} id="profile" size={32} />
</button>
<ProfileEditModal open={profileOpen} onOpenChange={setProfileOpen} />
```

- [ ] **Schritt 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Schritt 5: Commit**

```bash
git add frontend/src/components/layout/MiniRail.tsx
git commit -m "feat(ui): Avatar in MiniRail öffnet bearbeitbares Profil"
```

---

## Task 6: Planstatus-Button — einheitliche Optik

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Schritt 1: Status-Badge und separaten Chevron-Button ersetzen**

In `PlanPage.tsx`, in der `extras`-Section des `CommandBar`, diesen Block:

```tsx
<span className={cn(
  'text-xs px-2 py-0.5 rounded-full font-medium border',
  plan.status === 'RELEASED' ? 'bg-green-50 text-green-700 border-green-200'
  : plan.status === 'ARCHIVED' ? 'bg-amber-50 text-amber-700 border-amber-200'
  : 'bg-gray-50 text-gray-600 border-gray-200'
)}>
  {statusLabel}
</span>
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" disabled={updatePlan.isPending}>
      <ChevronDown className="size-3.5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {plan.status !== 'RELEASED' && (
      <DropdownMenuItem onClick={() => handleStatusChange('RELEASED')}>
        Freigeben
      </DropdownMenuItem>
    )}
    {plan.status !== 'ARCHIVED' && (
      <DropdownMenuItem onClick={() => handleStatusChange('ARCHIVED')}>
        Archivieren
      </DropdownMenuItem>
    )}
    {plan.status !== 'DRAFT' && (
      <DropdownMenuItem onClick={() => handleStatusChange('DRAFT')}>
        Zurück zu Entwurf
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

Ersetzen durch:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      disabled={updatePlan.isPending}
      className="min-w-[110px] gap-1.5"
    >
      <span className={cn(
        'size-1.5 rounded-full shrink-0',
        plan.status === 'RELEASED' ? 'bg-green-500'
        : plan.status === 'ARCHIVED' ? 'bg-amber-400'
        : 'bg-gray-400'
      )} />
      {statusLabel}
      <ChevronDown className="size-3.5 ml-auto" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {plan.status !== 'RELEASED' && (
      <DropdownMenuItem onClick={() => handleStatusChange('RELEASED')}>
        Freigeben
      </DropdownMenuItem>
    )}
    {plan.status !== 'ARCHIVED' && (
      <DropdownMenuItem onClick={() => handleStatusChange('ARCHIVED')}>
        Archivieren
      </DropdownMenuItem>
    )}
    {plan.status !== 'DRAFT' && (
      <DropdownMenuItem onClick={() => handleStatusChange('DRAFT')}>
        Zurück zu Entwurf
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(ui): Planstatus-Button einheitliche Optik wie Einstellungen/Solver"
```

---

## Task 7: Bereichsname-Zeile durchgehend

**Files:**
- Modify: `frontend/src/features/plans/components/BereichHeaderRow.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`

- [ ] **Schritt 1: BereichHeaderRow umbauen**

Gesamten Inhalt von `frontend/src/features/plans/components/BereichHeaderRow.tsx` ersetzen:

```tsx
import { useDroppable } from '@dnd-kit/core'
import { getDepartmentColor } from '@/lib/bereichColors'
import type { Department } from '@/lib/types'

export function makeBereichHeaderDropId(departmentId: number): string {
  return `rotation-header-${departmentId}`
}
export function parseBereichHeaderDropId(id: string): number | null {
  if (!id.startsWith('rotation-header-')) return null
  const n = Number(id.slice('rotation-header-'.length))
  return Number.isFinite(n) ? n : null
}

export function makePlaceholderDropId(departmentId: number): string {
  return `rotation-placeholder-${departmentId}`
}
export function parsePlaceholderDropId(id: string): number | null {
  if (!id.startsWith('rotation-placeholder-')) return null
  const n = Number(id.slice('rotation-placeholder-'.length))
  return Number.isFinite(n) ? n : null
}

export function makeRotationMemberDropId(rotationId: number): string {
  return `rotation-member-${rotationId}`
}
export function parseRotationMemberDropId(id: string): number | null {
  if (!id.startsWith('rotation-member-')) return null
  const n = Number(id.slice('rotation-member-'.length))
  return Number.isFinite(n) ? n : null
}

interface BereichHeaderRowProps {
  department: Department
  rotationCount?: number
}

export function BereichHeaderRow({ department, rotationCount }: BereichHeaderRowProps) {
  const color = getDepartmentColor(department)
  const { setNodeRef, isOver } = useDroppable({
    id: makeBereichHeaderDropId(department.id),
    data: { departmentId: department.id, departmentName: department.name },
  })

  const bg = isOver ? `${color}35` : `${color}18`

  return (
    <div className="contents">
      {/* Label-Cell: sticky, Drop-Target */}
      <div
        ref={setNodeRef}
        className="sticky left-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-line"
        style={{
          borderLeft: `4px solid ${color}`,
          backgroundColor: bg,
        }}
      >
        <span className="text-xs font-semibold text-ink truncate leading-none flex-1">
          {department.short_name ?? department.name}
        </span>
        {typeof rotationCount === 'number' && department.max_headcount != null && (
          <span className="text-[10px] text-ink-3 shrink-0 tabular-nums leading-none">
            {rotationCount}/{department.max_headcount}
          </span>
        )}
      </div>
      {/* Spanning cell: füllt alle Tag-Spalten ohne interne Trennlinien */}
      <div
        className="border-b border-line"
        style={{ gridColumn: '2 / -1', backgroundColor: bg }}
      />
    </div>
  )
}
```

- [ ] **Schritt 2: colCount aus UnifiedPlanGrid entfernen**

In `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`, den `BereichHeaderRow`-Aufruf (ca. Zeile 297–303) ändern:

```tsx
// vorher:
<BereichHeaderRow
  key={row.rowKey}
  department={row.department}
  colCount={colCount}
  rotationCount={rotationCount}
/>

// nachher:
<BereichHeaderRow
  key={row.rowKey}
  department={row.department}
  rotationCount={rotationCount}
/>
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler. Insbesondere: TypeScript meldet keinen unbekannten `colCount`-Prop mehr.

- [ ] **Schritt 4: Commit**

```bash
git add frontend/src/features/plans/components/BereichHeaderRow.tsx frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat(ui): Bereichsname-Zeile durchgehend (kein Tagesgrid)"
```

---

## Task 8: Direktzuweisung ohne Popover

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Schritt 1: useCreateRotation importieren**

In `PlanPage.tsx`, den Rotations-Import ändern:

```tsx
// vorher:
import { usePlanRotations, useDeleteRotation } from './usePlanRotations'

// nachher:
import { usePlanRotations, useDeleteRotation, useCreateRotation } from './usePlanRotations'
```

- [ ] **Schritt 2: createRotation Mutation im Komponent anlegen**

Nach `const deleteRotation = useDeleteRotation(id)` einfügen:

```tsx
const createRotation = useCreateRotation(id)
```

- [ ] **Schritt 3: preselectedDragDoctorId State entfernen**

Diese Zeile löschen:
```tsx
const [preselectedDragDoctorId, setPreselectedDragDoctorId] = useState<number | null>(null)
```

- [ ] **Schritt 4: Doctor-Drag-Block in handleDragEnd ersetzen**

Den kompletten Block ab `const doctorId = parseDoctorDragId(activeId)` bis zum abschließenden `return` (ca. Zeile 552–576) ersetzen:

```tsx
const doctorId = parseDoctorDragId(activeId)
if (doctorId !== null) {
  if (!plan) return
  const doctor = doctors.find((d) => d.id === doctorId)
  const doctorName = doctor?.name ?? 'Arzt'

  let deptId: number | null = null
  let deptName = ''

  const headerDeptId = parseBereichHeaderDropId(overId)
  if (headerDeptId !== null) {
    deptId = headerDeptId
    deptName = departments.find((d) => d.id === headerDeptId)?.name ?? ''
  }
  if (deptId === null) {
    const placeholderDeptId = parsePlaceholderDropId(overId)
    if (placeholderDeptId !== null) {
      deptId = placeholderDeptId
      deptName = departments.find((d) => d.id === placeholderDeptId)?.name ?? ''
    }
  }
  if (deptId === null) {
    const memberRotId = parseRotationMemberDropId(overId)
    if (memberRotId !== null) {
      const rot = rotations.find((r) => r.id === memberRotId)
      if (rot) {
        deptId = rot.department_id
        deptName = departments.find((d) => d.id === rot.department_id)?.name ?? ''
      }
    }
  }

  if (deptId === null) return

  createRotation.mutate(
    {
      plan_id: id,
      doctor_id: doctorId,
      department_id: deptId,
      valid_from: plan.valid_from,
      valid_to: plan.valid_to,
      is_einarbeitung: false,
    },
    {
      onSuccess: () => toast.success(`${doctorName} → ${deptName} zugewiesen`),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Zuweisung fehlgeschlagen'),
    },
  )
  return
}
```

- [ ] **Schritt 5: RotationAssignPopover — preselectedDoctorId und onClose bereinigen**

Den `RotationAssignPopover`-Render-Block (ca. Zeile 928–949) ändern:

```tsx
// vorher:
<RotationAssignPopover
  planId={id}
  departmentId={activeRotationCell.departmentId}
  departmentName={dept.name}
  day={activeRotationCell.day}
  validTo={plan!.valid_to}
  existingAssignment={existing}
  blocksIna={dept.blocks_ina_weekdays || dept.blocks_ina_weekends}
  preselectedDoctorId={preselectedDragDoctorId ?? undefined}
  onClose={() => {
    setActiveRotationCell(null)
    setPreselectedDragDoctorId(null)
  }}
/>

// nachher:
<RotationAssignPopover
  planId={id}
  departmentId={activeRotationCell.departmentId}
  departmentName={dept.name}
  day={activeRotationCell.day}
  validTo={plan!.valid_to}
  existingAssignment={existing}
  blocksIna={dept.blocks_ina_weekdays || dept.blocks_ina_weekends}
  onClose={() => setActiveRotationCell(null)}
/>
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler. Kein `preselectedDragDoctorId` wird noch referenziert.

- [ ] **Schritt 7: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(ui): Arzt-Drag weist direkt ganzen Monat zu (kein Popover)"
```

---

## Task 9: Hinzufügen-Zeile mit Fuzzy-Suche

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Schritt 1: AddRotationRow-Komponente in UnifiedPlanGrid einfügen**

In `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`, direkt **vor** `export function UnifiedPlanGrid(` die neue Komponente einfügen:

```tsx
function AddRotationRow({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="contents">
      <button
        type="button"
        onClick={onAdd}
        className="sticky left-0 z-10 flex items-center px-3 py-1 border-b border-line bg-card hover:bg-paper transition-colors group text-left w-full"
      >
        <span className="text-[10px] italic text-ink-3 group-hover:text-ink transition-colors">
          + Arzt hinzufügen
        </span>
      </button>
      <div
        className="border-b border-line bg-card"
        style={{ gridColumn: '2 / -1' }}
      />
    </div>
  )
}
```

- [ ] **Schritt 2: onAddRotation zum Props-Interface hinzufügen**

In `UnifiedPlanGridProps` (ca. Zeile 17) am Ende einfügen:

```tsx
onAddRotation?: (departmentId: number) => void
```

- [ ] **Schritt 3: onAddRotation in der Komponent-Destrukturierung ergänzen**

In `export function UnifiedPlanGrid({` die Destrukturierung um `onAddRotation` erweitern:

```tsx
  onTarifDotClick,
  onAddRotation,         // ← neu
}: UnifiedPlanGridProps) {
```

- [ ] **Schritt 4: rows.map zu rows.flatMap umbauen**

Den gesamten `{rows.map((row) => {` Block (ca. Zeile 291–419) durch folgende `flatMap`-Version ersetzen:

```tsx
{rows.flatMap((row) => {
  if (row.kind === 'header') {
    const rotationCount = rows.filter(
      (r) => r.kind === 'rotation' && r.department.id === row.department.id,
    ).length
    return [
      <BereichHeaderRow
        key={row.rowKey}
        department={row.department}
        rotationCount={rotationCount}
      />,
    ]
  }

  if (row.kind === 'placeholder') {
    const color = getDepartmentColor(row.department)
    return [
      <div key={row.rowKey} className="contents">
        <PlaceholderLabelCell department={row.department} />
        {dayKeys.map((dk) => (
          <div
            key={dk}
            className="border-b border-r border-line"
            style={{ backgroundColor: `${color}10` }}
          />
        ))}
      </div>,
      ...(onAddRotation
        ? [
            <AddRotationRow
              key={`add-placeholder-${row.department.id}`}
              onAdd={() => onAddRotation(row.department.id)}
            />,
          ]
        : []),
    ]
  }

  // kind === 'rotation'
  const isRowHovered = effectiveHoverRow === row.rowKey
  const isRowHighlighted = highlightedDoctorId != null && row.doctor.id === highlightedDoctorId
  const employmentPct = isRowHovered
    ? (() => {
        const fullDoc = doctors.find((d) => d.id === row.doctor.id)
        if (!fullDoc) return null
        return getCurrentEmploymentPeriod(fullDoc.employment_periods)?.employment_percentage ?? null
      })()
    : null

  const rotationEl = (
    <div key={row.rowKey} className="contents">
      <RotationLabelCell
        row={row}
        isHovered={isRowHovered}
        isHighlighted={isRowHighlighted}
        employmentPct={employmentPct}
        onMouseEnter={() => { setHoverRow(row.rowKey); setHoverDay(null) }}
        onDelete={() => onDeleteRotation?.(row.rotation.id)}
        onEdit={() => onEditRotation?.(row.rotation)}
      />

      {dayKeys.map((dk) => {
        const cell = resolveCell(row, dk, shifts, absences)
        const shift = shiftIndex.get(`${row.doctor.id}-${dk}`)
        const hasConflict = (shift?.conflicts.length ?? 0) > 0
        const hasTarifWarning = shift ? (tarifWarningsByShift[shift.id]?.length ?? 0) > 0 : false
        const day = days[dayKeys.indexOf(dk)]

        const cellShiftId = shift?.id ?? unassignedShiftByDate.get(dk)?.id

        const isConflictTarget =
          dragConflictMap != null &&
          !!(dragConflictMap.get(row.doctor.id)?.has(dk)) &&
          cell.text === ''

        const cellKey = `${row.rotation.id}-${dk}`
        const isSelected = selectedCellKeys?.has(cellKey) ?? false

        return (
          <UnifiedShiftCell
            key={dk}
            rotationId={row.rotation.id}
            dayKey={dk}
            department={row.department}
            inRotation={cell.inRotation}
            text={cell.text}
            isWeekend={isWeekend(day)}
            isToday={isToday(day)}
            hasConflict={hasConflict}
            hasTarifWarning={hasTarifWarning}
            focusMode={focusMode}
            isHoveredRow={isRowHovered}
            isHoveredCol={effectiveHoverDay === dk}
            shiftId={cellShiftId}
            isConflictTarget={isConflictTarget}
            shiftAssigned={shift != null && shift.doctor_id != null}
            isPinned={shift?.is_pinned ?? false}
            isSelected={isSelected || mouseSelectKeys.has(cellKey)}
            isHighlightedRow={isRowHighlighted}
            onMouseDown={() => {
              setMouseSelectState({
                rotationId: row.rotation.id,
                doctorId: row.doctor.id,
                anchorDayKey: dk,
                currentDayKey: dk,
              })
            }}
            onMouseEnter={() => {
              setHoverRow(row.rowKey)
              setHoverDay(dk)
              if (mouseSelectState?.rotationId === row.rotation.id) {
                setMouseSelectState((prev) => prev ? { ...prev, currentDayKey: dk } : null)
              }
            }}
            onClick={(shiftKey) => {
              if (dragSelectFiredRef.current) {
                dragSelectFiredRef.current = false
                return
              }
              onCellClick?.(row.rotation.id, row.doctor.id, dk, shift?.id ?? null, shiftKey)
            }}
            absenceId={cell.absenceId ?? undefined}
            onDoubleClickRemove={
              shift?.id != null
                ? () => onDoubleClickRemove?.(shift.id)
                : undefined
            }
            onDoubleClickRemoveAbsence={onDoubleClickRemoveAbsence}
            onConflictDotClick={() => shift && onConflictDotClick?.(shift.id)}
            onTarifDotClick={() => shift && onTarifDotClick?.(shift.id)}
          />
        )
      })}
    </div>
  )

  return [
    rotationEl,
    ...(onAddRotation
      ? [
          <AddRotationRow
            key={`add-${row.rotation.id}`}
            onAdd={() => onAddRotation(row.department.id)}
          />,
        ]
      : []),
  ]
})}
```

- [ ] **Schritt 5: onAddRotation in PlanPage verdrahten**

In `frontend/src/features/plans/PlanPage.tsx`, dem `<UnifiedPlanGrid>`-Aufruf das Prop hinzufügen (nach `onDoubleClickRemoveAbsence`):

```tsx
onAddRotation={(departmentId) =>
  setActiveRotationCell({ departmentId, day: plan.valid_from, assignmentId: null })
}
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Schritt 7: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedPlanGrid.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(ui): Hinzufügen-Zeile unter jedem Arzt mit Popover-Arztauswahl"
```

---

## Abschluss-Verifikation

- [ ] Frontend build prüfen:

```bash
cd frontend && pnpm build
```

Erwartung: Keine TypeScript- oder Build-Fehler.

- [ ] Backend Lint:

```bash
cd backend && uv run ruff check app/ && uv run ruff format --check app/
```

Erwartung: Keine Befunde.

- [ ] Manuelle Smoke-Tests:
  - Einstellungen → Solver-Toggle deaktivieren → „Plan generieren" in Plan verschwindet
  - Avatar unten links klicken → Profil-Dialog öffnet → Geräte-ID sichtbar → Name/Titel/Notiz speichern → Avatar zeigt neue Initialen
  - Plan öffnen → Status-Dropdown sieht aus wie Einstellungen/Solver-Button
  - Arzt aus linker Liste auf Bereich ziehen → sofort zugewiesen, kein Popover
  - „+ Arzt hinzufügen" klicken → Popover mit Suchfeld öffnet sich, Focus im Suchfeld
  - Bereichsname-Zeile ist durchgehend farbig (kein Tagesgitter sichtbar)
