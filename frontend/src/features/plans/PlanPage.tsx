import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'
import { eachDayOfInterval, format, parseISO, isWeekend, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, MoonStar } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core'


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PlanCommandBar } from './components/PlanCommandBar'
import { PlanModeBar } from './components/PlanModeBar'
import { useCommandPalette } from '@/features/command-palette/useCommandPalette'
import { usePlan, usePlans } from './usePlans'
import { planToSlug } from './planSlug'
import { usePlanShifts } from './usePlanShifts'
import { usePlanConflicts } from './usePlanConflicts'
import { usePlanRotations, useDeleteRotation, useCreateRotation } from './usePlanRotations'
import { useTarifWarnings } from './useTarifWarnings'
import { usePlanAbsences } from './usePlanAbsences'
import { usePlanWishes } from './useWishes'
import { useHolidays } from '@/features/holidays/useHolidays'
import { useAssignShift, useCreateShift, findShiftId } from './useAssignShift'
import { useUpdatePlan } from './useUpdatePlan'
import { useDeletePlan } from './useDeletePlan'
import { useSolvePlan, JvmUnavailableError } from './useSolvePlan'
import { useApplySolverResult } from './useApplySolverResult'
import {
  useConstraintOverrides,
  useCreateConstraintOverride,
  useDeleteConstraintOverride,
} from './useConstraintOverrides'
import { buildSolverDiff } from './solverUtils'
import { SolverResultPanel } from './components/SolverResultPanel'
import { PlanSettingsModal } from './components/PlanSettingsModal'
import { LockedWeekDialog } from './components/LockedWeekDialog'
import { ImportDialog } from './components/ImportDialog'
import { useDoctors } from '@/features/doctors/useDoctors'
import { useDepartments } from '@/features/departments/useDepartments'
import { useShiftTypes } from '@/features/shift-types/useShiftTypes'
import { UnifiedPlanGrid } from './components/UnifiedPlanGrid'
import { parseShiftTypeDragId, parseAbsenceDragId, NACHTWOCHE_DRAG_ID, SPRINGER_DRAG_ID } from './components/PlanModeBar'
import { SpringerPopover } from './components/SpringerPopover'
import { usePlanSpringerAssignments, useDeleteSpringerAssignment } from './useSpringerAssignments'
import { PlanSidebar } from './components/PlanSidebar'
import type { SidebarTab } from './components/PlanSidebar'
import { DoctorAssignPopover } from './components/DoctorAssignPopover'
import { ShiftBlockPopover } from './components/ShiftBlockPopover'
import { AbsenceAssignPopover } from './components/AbsenceAssignPopover'
import { useDeleteAbsence } from './useDeleteAbsence'
import type { AbsenceType } from '@/lib/types'
import { DoctorDragSource, DoctorDragOverlayToken, parseDoctorDragId } from './components/DoctorDragSource'
import { RotationAssignPopover } from './components/RotationAssignPopover'
import { WishFormDialog } from '@/features/doctors/WishFormDialog'
import { buildFairnessStats } from './fairnessUtils'
import { parseBereichHeaderDropId, parsePlaceholderDropId, parseRotationMemberDropId } from './components/BereichHeaderRow'
import { useAppSettings } from '@/stores/useAppSettings'
import { apiGet } from '@/lib/api'
import type { ShiftWithDetails, TarifWarning, RotationAssignmentWithDetails, INAExclusion, SolveResult } from '@/lib/types'
import { colorForShiftType } from '@/lib/design/shift-palette'
import { computeDragDimDays } from './dragUtils'

interface ActiveCell {
  rotationId: number
  doctorId: number
  day: string
  shiftId: number | null
}

interface SelectedCell {
  rotationId: number
  doctorId: number
  dayKey: string
}

export function PlanPage() {
  const { planId: planSlug } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: allPlans = [] } = usePlans()

  // Slug (z. B. "mai2026") oder numerische ID akzeptieren
  const id: number = (() => {
    const numeric = parseInt(planSlug ?? '', 10)
    if (!isNaN(numeric) && String(numeric) === planSlug) return numeric
    const matched = allPlans.find((p) => planToSlug(p) === planSlug)
    return matched?.id ?? NaN
  })()

  const [activeFilterGroups, setActiveFilterGroups] = useState<Set<string>>(new Set())

  function toggleFilterGroup(group: string) {
    setActiveFilterGroups((prev) => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      return next
    })
  }
  function clearFilterGroups() {
    setActiveFilterGroups(new Set())
  }
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [cellClickPosition, setCellClickPosition] = useState<{ x: number; y: number } | null>(null)
  const [contextShift, setContextShift] = useState<ShiftWithDetails | null>(null)
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null)
  const [activeRotationCell, setActiveRotationCell] = useState<{
    departmentId: number
    day: string
    assignmentId: number | null
  } | null>(null)
  const [activeDragDoctor, setActiveDragDoctor] = useState<{
    id: number
    name: string
    shortName?: string | null
  } | null>(null)
  const [activeDragShiftType, setActiveDragShiftType] = useState<{
    id: number
    shortName: string
    bg: string
    fg: string
  } | null>(null)
  const [activeDragAbsence, setActiveDragAbsence] = useState<{ label: string; color?: string } | null>(null)
  const [dragConflictMap, setDragConflictMap] = useState<Map<number, Set<string>> | null>(null)
  const [activeDragNachtwoche, setActiveDragNachtwoche] = useState(false)
  const [nachtwocheCellWidth, setNachtwocheCellWidth] = useState(36)
  const [lockedWeekInitialDate, setLockedWeekInitialDate] = useState('')
  const [lockedWeekInitialDoctorId, setLockedWeekInitialDoctorId] = useState<number | undefined>()
  const activeDragTypeRef = useRef<'doctor' | 'nachtwoche' | null>(null)
  const dropSucceededRef = useRef(false)
  const [pendingShiftAssign, setPendingShiftAssign] = useState<{
    shiftId: number
    doctorId: number
    prevDoctorName: string
    newDoctorName: string
  } | null>(null)
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([])
  const [multiPopoverOpen, setMultiPopoverOpen] = useState(false)
  const [highlightedDoctorId, setHighlightedDoctorId] = useState<number | null>(null)
  const [activeAbsenceCell, setActiveAbsenceCell] = useState<{
    type: AbsenceType
    doctorId: number
    doctorName: string
    dayKey: string
  } | null>(null)
  const [pendingDeleteAbsence, setPendingDeleteAbsence] = useState<{
    id: number
    label: string
    from: string
    to: string
  } | null>(null)
  const [showWishes, setShowWishes] = useState(true)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [springerPopover, setSpringerPopover] = useState<{
    doctorId: number
    dayKey: string
    currentDepartmentId: number
  } | null>(null)
  const rawMode = searchParams.get('mode')
  const mode: 'besetzung' | 'ina' = rawMode === 'ina' ? 'ina' : 'besetzung'
  function setMode(newMode: 'besetzung' | 'ina') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('mode', newMode)
      return next
    }, { replace: true })
  }
  const VALID_TABS: SidebarTab[] = ['details', 'wuensche', 'fairness', 'konflikte']
  const rawTab = searchParams.get('tab')
  const sidebarTab: SidebarTab = VALID_TABS.includes(rawTab as SidebarTab) ? (rawTab as SidebarTab) : 'details'
  function setSidebarTab(tab: SidebarTab) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }
  const [wishCreateTarget, setWishCreateTarget] = useState<{ doctorId: number | null; date?: string } | null>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null)

  const deleteAbsence = useDeleteAbsence(id)

  const { data: springerAssignments = [] } = usePlanSpringerAssignments(isNaN(id) ? null : id)
  const { mutate: deleteSpringer } = useDeleteSpringerAssignment(isNaN(id) ? 0 : id)

  const springerByKey = useMemo(() => {
    const map = new Map<string, typeof springerAssignments[0]>()
    for (const sa of springerAssignments) {
      map.set(`${sa.doctor_id}-${sa.shift_date}`, sa)
    }
    return map
  }, [springerAssignments])

  const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
    URLAUB:       'Urlaub',
    KRANKHEIT:    'Krankheit',
    FORTBILDUNG:  'Fortbildung',
    ELTERNZEIT:   'Elternzeit',
    MUTTERSCHUTZ: 'Mutterschutz',
    SONSTIGES:    'Sonstiges',
  }

  const { data: plan } = usePlan(id)
  const { data: shifts = [], isError: shiftsError } = usePlanShifts(id)
  const { data: conflicts } = usePlanConflicts(id)
  const { data: doctors = [] } = useDoctors()
  const { data: departments = [] } = useDepartments()
  const { data: rotations = [] } = usePlanRotations(id)
  const { data: absences = [] } = usePlanAbsences(id)
  const { data: shiftTypes = [] } = useShiftTypes()
  const { data: tarifWarningsData } = useTarifWarnings(id)
  const planYear = plan ? new Date(plan.valid_from).getFullYear() : null
  const { data: holidaysData } = useHolidays(planYear)
  const { data: wishes = [] } = usePlanWishes(isNaN(id) ? null : id)
  const holidayDates = useMemo(
    () => new Set((holidaysData ?? []).map((h) => h.date)),
    [holidaysData],
  )
  const assignShift = useAssignShift(id)
  const createShift = useCreateShift(id)
  const updatePlan = useUpdatePlan(id)
  const deletePlan = useDeletePlan()
  const deleteRotation = useDeleteRotation(id)
  const createRotation = useCreateRotation(id)
  const solvePlan = useSolvePlan(id)
  const applySolver = useApplySolverResult(id)
  const { solverEnabled, absenceColors } = useAppSettings()
  const { data: constraintOverrides = [] } = useConstraintOverrides(isNaN(id) ? null : id)
  const createOverrideMutation = useCreateConstraintOverride(isNaN(id) ? 0 : id)
  const deleteOverrideMutation = useDeleteConstraintOverride(isNaN(id) ? 0 : id)
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null)
  const [isSolverOpen, setIsSolverOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lockedWeekDialogOpen, setLockedWeekDialogOpen] = useState(false)
  const [pendingDeleteRotation, setPendingDeleteRotation] = useState<RotationAssignmentWithDetails | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cycleIdxRef = useRef({ open: 0, conflict: 0 })

  // INA-Exclusions für alle Rotationsärzte laden (für dragConflictMap)
  const rotationDoctorIds = useMemo(
    () => [...new Set(rotations.map((r) => r.doctor_id))],
    [rotations],
  )

  const inaExclusionQueries = useQueries({
    queries: rotationDoctorIds.map((doctorId) => ({
      queryKey: ['ina-exclusions', doctorId] as const,
      queryFn: () => apiGet<INAExclusion[]>(`/api/doctors/${doctorId}/ina-exclusions`),
    })),
  })

  const inaExclusionsByDoctor = useMemo(() => {
    const map = new Map<number, INAExclusion[]>()
    rotationDoctorIds.forEach((doctorId, i) => {
      map.set(doctorId, inaExclusionQueries[i]?.data ?? [])
    })
    return map
  }, [rotationDoctorIds, inaExclusionQueries])

  // Zugeteilt-Set für DoctorDragSource
  const assignedDoctorIds = useMemo(
    () => new Set(rotations.map((r) => r.doctor_id)),
    [rotations],
  )

  // Ausgewählte Zellen als Set-Key für schnelles Lookup
  const selectedCellKeys = useMemo(
    () => new Set(selectedCells.map((c) => `${c.rotationId}-${c.dayKey}`)),
    [selectedCells],
  )

  const dragDimDays = useMemo(
    () => activeDragShiftType ? computeDragDimDays(shifts, activeDragShiftType.id) : undefined,
    [activeDragShiftType, shifts],
  )

  const dragHighlightDays = useMemo(() => {
    if (!activeDragShiftType || !plan) return undefined
    const fullSt = shiftTypes.find((s) => s.id === activeDragShiftType.id)
    const coveredDays = new Set(
      shifts
        .filter((s) => s.shift_type_id === activeDragShiftType.id && s.doctor_id != null)
        .map((s) => s.shift_date),
    )
    const days = new Set<string>()
    for (const d of eachDayOfInterval({ start: parseISO(plan.valid_from), end: parseISO(plan.valid_to) })) {
      const dk = format(d, 'yyyy-MM-dd')
      const we = isWeekend(d)
      const applies = fullSt ? (we ? fullSt.applies_on_weekend : fullSt.applies_on_weekdays) : true
      if (applies && !coveredDays.has(dk)) {
        days.add(dk)
      }
    }
    return days
  }, [activeDragShiftType, shifts, plan, shiftTypes])

  function handleDeletePlan() {
    deletePlan.mutate(id, {
      onSuccess: () => {
        toast.success('Plan gelöscht')
        navigate('/plans')
      },
      onError: () => {
        toast.error('Löschen fehlgeschlagen')
      },
    })
  }

  function handleStatusChange(newStatus: 'DRAFT' | 'RELEASED' | 'ARCHIVED') {
    if (!plan) return
    updatePlan.mutate({ status: newStatus })
  }

  const tarifWarningsByShift: Record<number, TarifWarning[]> = {}
  for (const w of tarifWarningsData?.warnings ?? []) {
    if (w.shift_id != null) {
      ;(tarifWarningsByShift[w.shift_id] ??= []).push(w)
    }
  }

  const solverDiffRows = useMemo(
    () => (solveResult ? buildSolverDiff(shifts, doctors, solveResult.proposed_assignments) : []),
    [shifts, doctors, solveResult],
  )

  const { stats: fairnessStats, groups: fairnessGroups } = useMemo(
    () => buildFairnessStats(shifts, rotations, doctors),
    [shifts, rotations, doctors],
  )

  function handleSolve() {
    solvePlan.mutate(undefined, {
      onSuccess: (result) => {
        setSolveResult(result)
        setIsSolverOpen(true)
      },
      onError: (err) => {
        if (err instanceof JvmUnavailableError) {
          toast.error('Java-Runtime nicht verfügbar. Bitte JDK 21 (Eclipse Temurin) installieren.')
        } else {
          toast.error(err instanceof Error ? `Solver-Fehler: ${err.message}` : 'Solver-Fehler')
        }
      },
    })
  }

  function handleCreateCOverride(shiftId: number, constraintId: string, reason: string | null) {
    createOverrideMutation.mutate(
      { level: 'C', constraint_id: constraintId, shift_id: shiftId, reason },
      {
        onSuccess: () => toast.success('Override gespeichert'),
        onError: () => toast.error('Override konnte nicht gespeichert werden'),
      },
    )
  }

  function handleDeleteOverride(overrideId: number) {
    deleteOverrideMutation.mutate(overrideId, {
      onSuccess: () => toast.success('Override widerrufen'),
      onError: () => toast.error('Widerrufen fehlgeschlagen'),
    })
  }

  useEffect(() => {
    if (shiftsError) {
      toast.error('Plan nicht gefunden')
      navigate('/plans')
    }
  }, [shiftsError, navigate])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  // Cycle-Index zurücksetzen wenn sich Konflikte ändern
  useEffect(() => {
    cycleIdxRef.current = { open: 0, conflict: 0 }
  }, [conflicts])

  useEffect(() => {
    if (!solverEnabled) {
      setIsSolverOpen(false)
      setSolveResult(null)
    }
  }, [solverEnabled])

  // ESC-Taste: Mehrfach-Auswahl aufheben
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedCells.length > 0 && !multiPopoverOpen) {
        setSelectedCells([])
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedCells.length, multiPopoverOpen])

  const scrollToFirstMatch = useCallback((type: 'open' | 'conflict') => {
    const candidateIds: number[] =
      type === 'open'
        ? (conflicts?.open_shifts?.map((s) => s.shift_id).filter((id): id is number => id != null) ?? [])
        : (conflicts?.conflicts?.map((c) => c.shift_id) ?? [])

    if (!candidateIds.length) return

    const idx = cycleIdxRef.current[type] % candidateIds.length
    cycleIdxRef.current[type] = idx + 1

    const shiftId = candidateIds[idx]
    const el = document.querySelector(`[data-shift-id="${shiftId}"]`)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('dp-highlight-pulse')
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => {
      el.classList.remove('dp-highlight-pulse')
      highlightTimerRef.current = null
    }, 2000)
  }, [conflicts])

  const scrollToDate = useCallback((date: string) => {
    const el = document.querySelector(`[data-date="${date}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    el.classList.add('dp-highlight-pulse')
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => {
      el.classList.remove('dp-highlight-pulse')
      highlightTimerRef.current = null
    }, 2000)
  }, [])

  const scrollToShift = useCallback((shiftId: number) => {
    const found = shifts.find((s) => s.id === shiftId)
    if (found) {
      setContextShift(found)
      setSidebarTab('details')
    }
    const el = document.querySelector(`[data-shift-id="${shiftId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('dp-highlight-pulse')
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => {
      el.classList.remove('dp-highlight-pulse')
      highlightTimerRef.current = null
    }, 2000)
  }, [shifts])

  useEffect(() => {
    const highlight = searchParams.get('highlight')
    if (!highlight) return
    if (highlight !== 'open' && highlight !== 'conflict') return
    const t = setTimeout(() => {
      scrollToFirstMatch(highlight as 'open' | 'conflict')
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('highlight')
        return next
      }, { replace: true })
    }, 200)
    return () => clearTimeout(t)
  }, [searchParams, scrollToFirstMatch, setSearchParams])

  useEffect(() => {
    const deptParam = searchParams.get('department')
    if (!deptParam) return
    const deptId = parseInt(deptParam, 10)
    if (isNaN(deptId)) return
    setSelectedDepartmentId(deptId)
    setSelectedDoctorId(null)
    setContextShift(null)
    setSidebarTab('details')
    setRightOpen(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('department')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const validBesetzung: SidebarTab[] = ['details', 'konflikte']
    if (mode === 'besetzung' && !validBesetzung.includes(sidebarTab)) {
      setSidebarTab('details')
    }
  }, [mode, sidebarTab])

  const { open: openCommandPalette } = useCommandPalette()

  const planMonth = plan ? format(parseISO(plan.valid_from), 'MMMM', { locale: de }) : ''
  const planYearLabel = plan ? format(parseISO(plan.valid_from), 'yyyy') : ''
  const kwRange = useMemo(() => {
    if (!plan) return ''
    const kwFrom = format(parseISO(plan.valid_from), 'I', { locale: de })
    const kwTo = format(parseISO(plan.valid_to), 'I', { locale: de })
    return kwFrom === kwTo ? kwFrom : `${kwFrom}–${kwTo}`
  }, [plan])

  const sortedPlans = useMemo(
    () => [...allPlans].sort((a, b) => a.valid_from.localeCompare(b.valid_from)),
    [allPlans],
  )
  const currentPlanIdx = !isNaN(id) ? sortedPlans.findIndex((p) => p.id === id) : -1
  const prevPlan = currentPlanIdx > 0 ? sortedPlans[currentPlanIdx - 1] : null
  const nextPlan =
    currentPlanIdx >= 0 && currentPlanIdx < sortedPlans.length - 1
      ? sortedPlans[currentPlanIdx + 1]
      : null

  const openCount = conflicts?.open_shift_count ?? 0
  const conflictCount = conflicts?.conflict_count ?? 0

  function handleCellClick(
    rotationId: number,
    doctorId: number,
    day: string,
    shiftId: number | null,
    shiftKey: boolean,
    clickPos: { x: number; y: number },
  ) {
    if (shiftKey) {
      // Shift+Klick: Zelle zur Mehrfach-Auswahl hinzufügen / entfernen
      setSelectedCells((prev) => {
        const exists = prev.some((c) => c.rotationId === rotationId && c.dayKey === day)
        if (exists) return prev.filter((c) => !(c.rotationId === rotationId && c.dayKey === day))
        return [...prev, { rotationId, doctorId, dayKey: day }]
      })
      return
    }

    if (selectedCells.length > 0) {
      // Regulärer Klick während Auswahl aktiv → Dienstblock-Popup öffnen
      setMultiPopoverOpen(true)
      return
    }

    setContextShift(null)
    setSelectedDepartmentId(null)
    setActiveCell({ rotationId, doctorId, day, shiftId })
    setCellClickPosition(clickPos)
    setSelectedDoctorId(doctorId)
    setSidebarTab('details')
  }

  function handleDepartmentClick(departmentId: number) {
    setSelectedDepartmentId(departmentId)
    setSelectedDoctorId(null)
    setContextShift(null)
    setSidebarTab('details')
  }

  function handleMultiAssign(shiftTypeId: number) {
    let skipped = 0
    for (const cell of selectedCells) {
      const shiftId = findShiftId(shifts, cell.dayKey, shiftTypeId)
      if (shiftId === null) { skipped++; continue }
      assignShift.mutate(
        { shiftId, data: { doctor_id: cell.doctorId } },
        { onError: () => toast.error('Fehler beim Speichern einer Zuweisung') },
      )
    }
    if (skipped > 0) toast.info(`${skipped} Zelle(n) übersprungen — Schichttyp an diesem Tag nicht vorhanden`)
    setSelectedCells([])
    setMultiPopoverOpen(false)
  }

  function handleRangeSelected(rotationId: number, doctorId: number, days: string[]) {
    setSelectedCells(days.map((dk) => ({ rotationId, doctorId, dayKey: dk })))
    setMultiPopoverOpen(true)
  }

  function handleMultiRemove() {
    let skipped = 0
    for (const cell of selectedCells) {
      const shift = shifts.find((s) => s.doctor_id === cell.doctorId && s.shift_date === cell.dayKey)
      if (!shift) { skipped++; continue }
      if (shift.is_pinned) { skipped++; continue }
      assignShift.mutate(
        { shiftId: shift.id, data: { doctor_id: null } },
        { onError: () => toast.error('Fehler beim Entfernen einer Zuweisung') },
      )
    }
    if (skipped > 0) toast.info(`${skipped} Zelle(n) übersprungen — keine Zuweisung oder gepinnt`)
    setSelectedCells([])
    setMultiPopoverOpen(false)
  }

  function handleCloseMultiPopover() {
    setMultiPopoverOpen(false)
    setSelectedCells([])
  }

  function handleDoubleClickRemoveAbsence(absenceId: number) {
    const absence = absences.find((a) => a.id === absenceId)
    if (!absence) return
    const fromFmt = (() => {
      try { return format(parseISO(absence.valid_from), 'dd.MM.', { locale: de }) } catch { return absence.valid_from }
    })()
    const toFmt = (() => {
      try { return format(parseISO(absence.valid_to), 'dd.MM.yyyy', { locale: de }) } catch { return absence.valid_to }
    })()
    setPendingDeleteAbsence({
      id: absenceId,
      label: ABSENCE_TYPE_LABELS[absence.absence_type],
      from: fromFmt,
      to: toFmt,
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )

  // Cursor-Hotspot: Avatar-Drag → Mitte oben; Nachtwoche-Drag → linke Kante (erster Chip)
  const overlayModifier: Modifier = useCallback(({ activatorEvent, draggingNodeRect, transform }) => {
    if (!draggingNodeRect || !(activatorEvent instanceof MouseEvent)) return transform
    const offsetX = activatorEvent.clientX - draggingNodeRect.left
    const offsetY = activatorEvent.clientY - draggingNodeRect.top
    if (activeDragTypeRef.current === 'nachtwoche') {
      return { ...transform, x: transform.x + offsetX, y: transform.y + offsetY }
    }
    return { ...transform, x: transform.x + offsetX - 14, y: transform.y + offsetY }
  }, [])

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id)

    if (activeId === NACHTWOCHE_DRAG_ID) {
      activeDragTypeRef.current = 'nachtwoche'
      const cellEl = document.querySelector('[data-grid-cell]')
      const cellW = cellEl ? cellEl.getBoundingClientRect().width : 36
      setNachtwocheCellWidth(cellW)
      setActiveDragNachtwoche(true)
      return
    }

    const doctorId = parseDoctorDragId(activeId)
    if (doctorId !== null) {
      activeDragTypeRef.current = 'doctor'
      if (plan?.besetzung_locked) return
      const doctor = doctors.find((d) => d.id === doctorId)
      const name = (event.active.data.current as { doctorName?: string } | undefined)?.doctorName ?? doctor?.name ?? ''
      setActiveDragDoctor({ id: doctorId, name, shortName: doctor?.short_name })
      return
    }

    const shiftTypeId = parseShiftTypeDragId(activeId)
    if (shiftTypeId !== null) {
      const map = new Map<number, Set<string>>()
      const planFrom = plan?.valid_from
      const planTo = plan?.valid_to
      if (!planFrom || !planTo) { setDragConflictMap(map); return }

      function markDate(doctorId: number, dateStr: string) {
        if (!map.has(doctorId)) map.set(doctorId, new Set())
        map.get(doctorId)!.add(dateStr)
      }

      // 1. Abwesenheiten
      absences.forEach((absence) => {
        const from = absence.valid_from > planFrom ? absence.valid_from : planFrom
        const to = absence.valid_to < planTo ? absence.valid_to : planTo
        if (from > to) return
        eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).forEach((d) => {
          markDate(absence.doctor_id, format(d, 'yyyy-MM-dd'))
        })
      })

      // 2. INA-blockierende Rotationen (Werktage/Wochenenden)
      rotations.forEach((rotation) => {
        const dept = rotation.department
        if (!dept || (!dept.blocks_ina_weekdays && !dept.blocks_ina_weekends)) return
        const from = rotation.valid_from > planFrom ? rotation.valid_from : planFrom
        const to = rotation.valid_to < planTo ? rotation.valid_to : planTo
        if (from > to) return
        eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).forEach((d) => {
          const we = isWeekend(d)
          if ((we && dept.blocks_ina_weekends) || (!we && dept.blocks_ina_weekdays)) {
            markDate(rotation.doctor_id, format(d, 'yyyy-MM-dd'))
          }
        })
      })

      // 3. INA-Ausschlüsse (manuelle Sperren)
      inaExclusionsByDoctor.forEach((exclusions, doctorId) => {
        exclusions.forEach((excl) => {
          const exclTo = excl.valid_to ?? planTo
          const from = excl.valid_from > planFrom ? excl.valid_from : planFrom
          const to = exclTo < planTo ? exclTo : planTo
          if (from > to) return
          eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).forEach((d) => {
            markDate(doctorId, format(d, 'yyyy-MM-dd'))
          })
        })
      })

      const st = shiftTypes.find((s) => s.id === shiftTypeId)
      if (st) {
        const pal = colorForShiftType({ id: st.id, code: st.short_name })
        const bg = st.color ? st.color + '80' : pal.bg
        const fg = st.color ? '#1f2937' : pal.fg
        setActiveDragShiftType({ id: st.id, shortName: st.short_name, bg, fg })
      }
      setDragConflictMap(map)
      return
    }

    const absenceType = parseAbsenceDragId(activeId)
    if (absenceType !== null) {
      setActiveDragAbsence({ label: ABSENCE_TYPE_LABELS[absenceType], color: absenceColors[absenceType] })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    dropSucceededRef.current = false
    setActiveDragDoctor(null)
    setActiveDragShiftType(null)
    setActiveDragAbsence(null)
    setActiveDragNachtwoche(false)
    setDragConflictMap(null)
    activeDragTypeRef.current = null
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // ── Nachtwoche → Cell-Drop ────────────────────────────────────────────────
    if (activeId === NACHTWOCHE_DRAG_ID) {
      const cellMatch = overId.match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
      if (cellMatch) {
        const rotationId = Number(cellMatch[1])
        const dayKey = cellMatch[2]
        const rotation = rotations.find((r) => r.id === rotationId)
        const date = parseISO(dayKey)
        const sunday = addDays(date, -date.getDay())
        setLockedWeekInitialDate(format(sunday, 'yyyy-MM-dd'))
        setLockedWeekInitialDoctorId(rotation?.doctor_id)
      }
      dropSucceededRef.current = true
      setLockedWeekDialogOpen(true)
      return
    }

    // ── Springer → Cell-Drop ──────────────────────────────────────────────────
    if (activeId === SPRINGER_DRAG_ID) {
      const cellMatch = overId.match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
      if (cellMatch) {
        const rotationId = Number(cellMatch[1])
        const dayKey = cellMatch[2]
        const rotation = rotations.find((r) => r.id === rotationId)
        if (rotation) {
          setSpringerPopover({
            doctorId: rotation.doctor_id,
            dayKey,
            currentDepartmentId: rotation.department_id,
          })
        }
      }
      return
    }

    // ── Doctor → Bereich-Header-Drop ──────────────────────────────────────────
    const doctorId = parseDoctorDragId(activeId)
    if (doctorId !== null) {
      if (!plan) return
      if (plan.besetzung_locked) return
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

      dropSucceededRef.current = true
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

    // ── Absence → Cell-Drop ───────────────────────────────────────────────────
    const absenceType = parseAbsenceDragId(activeId)
    if (absenceType !== null) {
      const cellMatch = overId.match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
      if (!cellMatch) return
      const rotationId = Number(cellMatch[1])
      const dayKey = cellMatch[2]
      const rotation = rotations.find((r) => r.id === rotationId)
      if (!rotation) return
      const doctor = doctors.find((d) => d.id === rotation.doctor_id)
      dropSucceededRef.current = true
      setActiveAbsenceCell({
        type: absenceType,
        doctorId: rotation.doctor_id,
        doctorName: doctor?.name ?? '',
        dayKey,
      })
      return
    }

    // ── ShiftType → Cell-Drop ─────────────────────────────────────────────────
    const shiftTypeId = parseShiftTypeDragId(activeId)
    if (shiftTypeId === null) return

    const cellMatch = overId.match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
    if (!cellMatch) return
    const rotationId = Number(cellMatch[1])
    const dayKey = cellMatch[2]

    const rotation = rotations.find((r) => r.id === rotationId)
    if (!rotation) return
    const targetDoctorId = rotation.doctor_id

    const shiftId = findShiftId(shifts, dayKey, shiftTypeId)
    if (shiftId === null) {
      // Grüne Zelle = Shift-Typ gilt an diesem Tag, aber kein Record vorhanden → erstellen
      if (dragHighlightDays?.has(dayKey)) {
        dropSucceededRef.current = true
        createShift.mutate(
          { shift_type_id: shiftTypeId, shift_date: dayKey, doctor_id: targetDoctorId },
          { onError: () => toast.error('Fehler beim Erstellen der Zuweisung') },
        )
        return
      }
      const st = shiftTypes.find((s) => s.id === shiftTypeId)
      toast.error(`${st?.short_name ?? 'Dienst'} ist an diesem Tag nicht verfügbar`)
      return
    }

    const shift = shifts.find((s) => s.id === shiftId)!
    if (shift.is_pinned) {
      toast.error('Dienst ist gepinnt — Pin zuerst entfernen')
      return
    }

    if (shift.doctor_id != null && shift.doctor_id !== targetDoctorId) {
      const prevDoctor = doctors.find((d) => d.id === shift.doctor_id)
      const newDoctor = doctors.find((d) => d.id === targetDoctorId)
      dropSucceededRef.current = true
      setPendingShiftAssign({
        shiftId,
        doctorId: targetDoctorId,
        prevDoctorName: prevDoctor?.name ?? 'Anderer Arzt',
        newDoctorName: newDoctor?.name ?? 'Arzt',
      })
      return
    }

    dropSucceededRef.current = true
    assignShift.mutate(
      { shiftId, data: { doctor_id: targetDoctorId } },
      { onError: () => toast.error('Fehler beim Speichern der Zuweisung') },
    )
  }

  function handleDragCancel() {
    setActiveDragDoctor(null)
    setActiveDragShiftType(null)
    setActiveDragAbsence(null)
    setActiveDragNachtwoche(false)
    setDragConflictMap(null)
    activeDragTypeRef.current = null
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            return `${name} wird gezogen.`
          },
          onDragOver({ active, over }) {
            if (!over) return
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            const dept = (over.data.current as { departmentName?: string } | undefined)?.departmentName ?? 'Bereich'
            return `${name} über ${dept}.`
          },
          onDragEnd({ active, over }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            if (over) {
              const dept = (over.data.current as { departmentName?: string } | undefined)?.departmentName ?? 'Ziel'
              return `${name} auf ${dept} abgelegt.`
            }
            return `${name}-Drag abgebrochen.`
          },
          onDragCancel({ active }) {
            const name = (active.data.current as { doctorName?: string } | undefined)?.doctorName ?? 'Element'
            return `${name}-Drag abgebrochen.`
          },
        },
        screenReaderInstructions: {
          draggable: 'Zum Ziehen: Leertaste oder Enter. Pfeiltasten navigieren. Leertaste oder Enter legt ab. Escape bricht ab.',
        },
      }}
    >
    <div className="flex flex-col flex-1 overflow-hidden">
      <PlanCommandBar
        planMonth={planMonth}
        planYear={planYearLabel}
        kwRange={kwRange}
        planName={undefined}
        prevPlan={prevPlan}
        nextPlan={nextPlan}
        plan={plan}
        onNavigatePrev={() => prevPlan && navigate(`/plans/${planToSlug(prevPlan)}?mode=${mode}&tab=${sidebarTab}`)}
        onNavigateNext={() => nextPlan && navigate(`/plans/${planToSlug(nextPlan)}?mode=${mode}&tab=${sidebarTab}`)}
        onStatusChange={handleStatusChange}
        isUpdatingStatus={updatePlan.isPending}
        onExport={() => !isNaN(id) && window.location.assign(`/api/plans/${id}/export`)}
        onOpenCommandPalette={openCommandPalette}
      />
      {plan && (
        <PlanModeBar
          mode={mode}
          onModeChange={setMode}
          shiftTypes={shiftTypes}
          activeFilterGroups={activeFilterGroups}
          onFilterGroupToggle={toggleFilterGroup}
          onFilterGroupClear={clearFilterGroups}
          solverEnabled={solverEnabled}
          isSolving={solvePlan.isPending}
          onSolve={handleSolve}
          onNachtwocheClick={() => {
            setLockedWeekInitialDate('')
            setLockedWeekInitialDoctorId(undefined)
            setLockedWeekDialogOpen(true)
          }}
          onSettingsClick={() => setSettingsOpen(true)}
          onImportClick={() => setShowImportDialog(true)}
          absenceColors={absenceColors}
        />
      )}
      {/* Mehrfach-Auswahl-Indikator */}
      {selectedCells.length > 0 && (
        <div className="px-6 pb-2 flex items-center gap-2">
          <span className="text-xs text-ink-3">
            {selectedCells.length} {selectedCells.length === 1 ? 'Zelle' : 'Zellen'} ausgewählt
          </span>
          <button
            onClick={() => setMultiPopoverOpen(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-white border border-accent hover:bg-accent/90 transition"
          >
            Dienst zuweisen
          </button>
          <button
            onClick={() => setSelectedCells([])}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-paper text-ink-3 border border-line hover:bg-paper/80 transition"
          >
            Abbrechen
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden gap-0 pb-6">
        {mode === 'besetzung' && (
          <div className="flex shrink-0">
            {leftOpen && (
              <DoctorDragSource
                doctors={doctors}
                rotationDoctorIds={assignedDoctorIds}
                highlightedDoctorId={highlightedDoctorId}
                onHighlightDoctor={setHighlightedDoctorId}
                locked={plan?.besetzung_locked ?? false}
              />
            )}
            <button
              type="button"
              onClick={() => setLeftOpen((v) => !v)}
              className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-r border-line shrink-0"
              aria-label={leftOpen ? 'Arzt-Sidebar einklappen' : 'Arzt-Sidebar ausklappen'}
            >
              {leftOpen
                ? <ChevronLeft className="size-3 text-ink-3" />
                : <ChevronRight className="size-3 text-ink-3" />
              }
            </button>
          </div>
        )}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {plan && (
            <UnifiedPlanGrid
              departments={departments}
              doctors={doctors}
              rotations={rotations}
              shifts={shifts}
              absences={absences}
              validFrom={plan.valid_from}
              validTo={plan.valid_to}
              tarifWarningsByShift={tarifWarningsByShift}
              holidayDates={holidayDates}
              activeFilterGroups={activeFilterGroups}
              dragConflictMap={dragConflictMap}
              dragDimDays={dragDimDays}
              dragHighlightDays={dragHighlightDays}
              selectedCellKeys={selectedCellKeys}
              highlightedDoctorId={highlightedDoctorId}
              onCellClick={handleCellClick}
              onRangeSelected={handleRangeSelected}
              onDoubleClickRemove={(shiftId) => {
                assignShift.mutate({ shiftId, data: { doctor_id: null } })
              }}
              onDeleteRotation={(rotationId) => {
                const rotation = rotations.find((r) => r.id === rotationId)
                if (rotation) setPendingDeleteRotation(rotation)
              }}
              onEditRotation={(rotation) => {
                setActiveRotationCell({
                  departmentId: rotation.department_id,
                  day: rotation.valid_from,
                  assignmentId: rotation.id,
                })
              }}
              onConflictDotClick={(shiftId) => {
                const shift = shifts.find((s) => s.id === shiftId) ?? null
                setActiveCell(null)
                setContextShift(shift)
              }}
              onTarifDotClick={(shiftId) => {
                const shift = shifts.find((s) => s.id === shiftId) ?? null
                setActiveCell(null)
                setContextShift(shift)
              }}
              onDoubleClickRemoveAbsence={handleDoubleClickRemoveAbsence}
              onAddRotation={(departmentId) =>
                setActiveRotationCell({ departmentId, day: plan.valid_from, assignmentId: null })
              }
              wishes={wishes}
              showWishes={showWishes}
              shiftTypes={shiftTypes}
              onWishCreate={(doctorId, date) => setWishCreateTarget({ doctorId, date })}
              onDepartmentClick={handleDepartmentClick}
              onDoctorClick={(doctorId) => {
                setSelectedDoctorId(doctorId)
                setContextShift(null)
                setSelectedDepartmentId(null)
                setSidebarTab('details')
                if (!rightOpen) setRightOpen(true)
              }}
              absenceColors={absenceColors}
              springerByKey={springerByKey}
              onDoubleClickRemoveSpringer={(assignmentId) => deleteSpringer(assignmentId)}
            />
          )}
        </div>
        {plan && (
          <div className="flex shrink-0">
            <button
              type="button"
              onClick={() => setRightOpen((v) => !v)}
              className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-l border-line shrink-0"
              aria-label={rightOpen ? 'Detail-Sidebar einklappen' : 'Detail-Sidebar ausklappen'}
            >
              {rightOpen
                ? <ChevronRight className="size-3 text-ink-3" />
                : <ChevronLeft className="size-3 text-ink-3" />
              }
            </button>
            {rightOpen && (
              <PlanSidebar
                shifts={shifts}
                planFrom={plan.valid_from}
                planTo={plan.valid_to}
                openCount={openCount}
                conflictCount={conflictCount}
                onConflictBadgeClick={() => setSidebarTab('konflikte')}
                mode={mode}
                activeTab={sidebarTab}
                onTabChange={setSidebarTab}
                shift={contextShift ?? undefined}
                onCloseShift={contextShift ? () => setContextShift(null) : undefined}
                tarifWarnings={contextShift ? tarifWarningsByShift[contextShift.id] : undefined}
                shiftOverrides={
                  contextShift
                    ? constraintOverrides.filter((o) => o.level === 'C' && o.shift_id === contextShift.id)
                    : []
                }
                onCreateOverride={
                  contextShift
                    ? (constraintId, reason) => handleCreateCOverride(contextShift.id, constraintId, reason)
                    : undefined
                }
                onDeleteOverride={handleDeleteOverride}
                selectedDoctorId={selectedDoctorId}
                doctors={doctors}
                shiftTypes={shiftTypes}
                wishes={wishes}
                planMonth={planMonth}
                showWishes={showWishes}
                onToggleWishes={() => setShowWishes((v) => !v)}
                fairnessStats={fairnessStats}
                fairnessGroups={fairnessGroups}
                conflicts={conflicts ?? null}
                onScrollToShift={scrollToShift}
                onScrollToDate={scrollToDate}
                selectedDepartmentId={selectedDepartmentId}
                departments={departments}
                rotations={rotations}
                onDepartmentDeselect={() => setSelectedDepartmentId(null)}
                onAddDoctor={(departmentId) =>
                  setActiveRotationCell({ departmentId, day: plan?.valid_from ?? '', assignmentId: null })
                }
                onSelectDoctor={(doctorId) => {
                  setSelectedDoctorId(doctorId)
                  setSelectedDepartmentId(null)
                }}
                onNewWishClick={(doctorId) => setWishCreateTarget({ doctorId })}
              />
            )}
          </div>
        )}
      </div>

      {activeCell && (
        <DoctorAssignPopover
          planId={id}
          doctorId={activeCell.doctorId}
          day={activeCell.day}
          currentShift={shifts.find((s) => s.id === activeCell.shiftId) ?? null}
          openShiftsForDay={shifts.filter(
            (s) =>
              s.shift_date === activeCell.day &&
              (s.doctor_id === null || s.doctor_id === undefined),
          )}
          anchorPosition={cellClickPosition ?? undefined}
          onClose={() => { setActiveCell(null); setCellClickPosition(null) }}
        />
      )}

      {activeAbsenceCell && (
        <AbsenceAssignPopover
          doctorId={activeAbsenceCell.doctorId}
          doctorName={activeAbsenceCell.doctorName}
          absenceType={activeAbsenceCell.type}
          defaultFrom={activeAbsenceCell.dayKey}
          planId={id}
          onClose={() => setActiveAbsenceCell(null)}
        />
      )}

      {multiPopoverOpen && selectedCells.length > 0 && (
        <ShiftBlockPopover
          selectedCount={selectedCells.length}
          shiftTypes={shiftTypes}
          onSelectShiftType={handleMultiAssign}
          onRemoveAll={handleMultiRemove}
          onClose={handleCloseMultiPopover}
        />
      )}

      {activeRotationCell && (() => {
        const dept = departments.find(d => d.id === activeRotationCell.departmentId)
        const existing = activeRotationCell.assignmentId
          ? rotations.find(r => r.id === activeRotationCell.assignmentId) ?? null
          : null
        return dept ? (
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
        ) : null
      })()}
    </div>
      {springerPopover && (
        <SpringerPopover
          planId={id}
          doctorId={springerPopover.doctorId}
          dayKey={springerPopover.dayKey}
          currentDepartmentId={springerPopover.currentDepartmentId}
          departments={departments}
          onClose={() => setSpringerPopover(null)}
        />
      )}
      <DragOverlay modifiers={[overlayModifier]} dropAnimation={dropSucceededRef.current ? null : undefined}>
        {activeDragDoctor && (
          <DoctorDragOverlayToken
            name={activeDragDoctor.name}
            shortName={activeDragDoctor.shortName}
            id={activeDragDoctor.id}
          />
        )}
        {activeDragShiftType && (
          <ShiftTypeOverlayChip
            shortName={activeDragShiftType.shortName}
            bg={activeDragShiftType.bg}
            fg={activeDragShiftType.fg}
          />
        )}
        {activeDragAbsence && (
          <AbsenceOverlayChip label={activeDragAbsence.label} color={activeDragAbsence.color} />
        )}
        {activeDragNachtwoche && (
          <NachtwocheOverlayChip
            nachtShiftType={shiftTypes.find((s) => s.short_name === 'N')}
            cellWidth={nachtwocheCellWidth}
          />
        )}
      </DragOverlay>
    </DndContext>

    {isSolverOpen && solveResult && solverEnabled && (
      <SolverResultPanel
        result={solveResult}
        diffRows={solverDiffRows}
        isApplying={applySolver.isPending}
        onApply={() => {
          applySolver.mutate(solveResult.proposed_assignments, {
            onSuccess: (result) => {
              setIsSolverOpen(false)
              setSolveResult(null)
              const skipped = result.skipped_pinned.length
              if (skipped > 0) {
                toast.info(`${result.applied.length} Schichten angewendet, ${skipped} gepinnte übersprungen.`)
              } else {
                toast.success(`${result.applied.length} Schichten angewendet.`)
              }
            },
            onError: (err) => {
              toast.error(err instanceof Error ? err.message : 'Fehler beim Anwenden')
            },
          })
        }}
        onClose={() => {
          setIsSolverOpen(false)
          setSolveResult(null)
        }}
      />
    )}

    <AlertDialog open={pendingShiftAssign !== null} onOpenChange={(open) => { if (!open) setPendingShiftAssign(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zuweisung ersetzen?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{pendingShiftAssign?.prevDoctorName}</strong> wird durch{' '}
            <strong>{pendingShiftAssign?.newDoctorName}</strong> ersetzt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingShiftAssign(null)}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!pendingShiftAssign) return
              assignShift.mutate(
                { shiftId: pendingShiftAssign.shiftId, data: { doctor_id: pendingShiftAssign.doctorId } },
                { onError: () => toast.error('Fehler beim Speichern der Zuweisung') },
              )
              setPendingShiftAssign(null)
            }}
          >
            Ersetzen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={pendingDeleteRotation !== null} onOpenChange={(o) => !o && setPendingDeleteRotation(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arzt aus Bereich entfernen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alle Schichtzuweisungen des Arztes in diesem Zeitraum werden ebenfalls gelöscht.
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

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Plan löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dieser Plan wird unwiderruflich gelöscht — inklusive aller Schichten und Rotationen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleDeletePlan}
            disabled={deletePlan.isPending}
          >
            {deletePlan.isPending ? 'Wird gelöscht…' : 'Löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {!isNaN(id) && (
      <PlanSettingsModal
        planId={id}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    )}

    {!isNaN(id) && (
      <LockedWeekDialog
        open={lockedWeekDialogOpen}
        onClose={() => {
          setLockedWeekDialogOpen(false)
          setLockedWeekInitialDate('')
          setLockedWeekInitialDoctorId(undefined)
        }}
        planId={id}
        doctors={doctors}
        shiftTypes={shiftTypes}
        initialDate={lockedWeekInitialDate}
        initialDoctorId={lockedWeekInitialDoctorId}
      />
    )}

    {wishCreateTarget && (
      <WishFormDialog
        doctorId={wishCreateTarget.doctorId}
        open={true}
        onOpenChange={(open) => { if (!open) setWishCreateTarget(null) }}
        prefilledDate={wishCreateTarget.date}
        doctors={doctors}
      />
    )}

    <ImportDialog
      open={showImportDialog}
      onOpenChange={setShowImportDialog}
      planId={isNaN(id) ? undefined : id}
    />

    <AlertDialog
      open={pendingDeleteAbsence !== null}
      onOpenChange={(open) => { if (!open) setPendingDeleteAbsence(null) }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abwesenheit löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{pendingDeleteAbsence?.label}</strong>{' '}
            {pendingDeleteAbsence?.from}–{pendingDeleteAbsence?.to} wird vollständig gelöscht.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingDeleteAbsence(null)}>
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              if (!pendingDeleteAbsence) return
              deleteAbsence.mutate(pendingDeleteAbsence.id, {
                onSuccess: () => toast.success('Abwesenheit gelöscht'),
                onError: () => toast.error('Löschen fehlgeschlagen'),
              })
              setPendingDeleteAbsence(null)
            }}
            disabled={deleteAbsence.isPending}
          >
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

function ShiftTypeOverlayChip({ shortName, bg, fg }: { shortName: string; bg: string; fg: string }) {
  return (
    <div
      style={{ background: bg, color: fg }}
      className="rounded-md px-2.5 py-1 text-xs font-bold shadow-lg pointer-events-none select-none"
    >
      {shortName}
    </div>
  )
}

function AbsenceOverlayChip({ label, color }: { label: string; color?: string }) {
  return (
    <div
      className="rounded-md px-2.5 py-1 text-xs font-bold shadow-lg pointer-events-none select-none"
      style={color
        ? { background: color + '80', color: '#1f2937' }
        : { background: '#fef3c7', color: '#92400e' }
      }
    >
      {label}
    </div>
  )
}

function NachtwocheOverlayChip({ nachtShiftType, cellWidth }: { nachtShiftType: { color?: string | null } | undefined; cellWidth: number }) {
  const style: React.CSSProperties = nachtShiftType?.color
    ? { background: nachtShiftType.color + '80', color: '#1f2937', borderColor: nachtShiftType.color + 'a0', width: cellWidth * 5 }
    : { background: '#1e293bcc', color: '#f8fafc', width: cellWidth * 5 }
  return (
    <div
      style={style}
      className="rounded-md py-1 px-2 text-xs font-bold shadow-lg pointer-events-none select-none flex items-center gap-1.5 border whitespace-nowrap overflow-hidden"
    >
      <MoonStar className="size-3 shrink-0" />
      So–Do Nacht
    </div>
  )
}
