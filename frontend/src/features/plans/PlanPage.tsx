import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'
import { eachDayOfInterval, format, parseISO, isWeekend } from 'date-fns'
import { de } from 'date-fns/locale'
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

// Cursor-Hotspot am Avatar-Top: x zentriert (14 = half of 28px), y = 0
const avatarTopModifier: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !(activatorEvent instanceof MouseEvent)) return transform
  const offsetX = activatorEvent.clientX - draggingNodeRect.left
  const offsetY = activatorEvent.clientY - draggingNodeRect.top
  return { ...transform, x: transform.x + offsetX - 14, y: transform.y + offsetY }
}
import { FileDown, Trash2, ChevronDown, ChevronLeft, ChevronRight, Zap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CommandBar } from '@/components/dp/CommandBar'
import { KpiBar } from '@/components/dp/KpiBar'
import { usePlan, usePlans } from './usePlans'
import { planToSlug } from './planSlug'
import { usePlanShifts } from './usePlanShifts'
import { usePlanConflicts } from './usePlanConflicts'
import { usePlanRotations, useDeleteRotation, useCreateRotation } from './usePlanRotations'
import { useTarifWarnings } from './useTarifWarnings'
import { usePlanAbsences } from './usePlanAbsences'
import { useAssignShift, findShiftId } from './useAssignShift'
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
import { useDoctors } from '@/features/doctors/useDoctors'
import { useDepartments } from '@/features/departments/useDepartments'
import { useShiftTypes } from '@/features/shift-types/useShiftTypes'
import { UnifiedPlanGrid } from './components/UnifiedPlanGrid'
import { ShiftTypeDragBar, parseShiftTypeDragId } from './components/ShiftTypeDragBar'
import { ContextPanel } from './components/ContextPanel'
import { DoctorAssignPopover } from './components/DoctorAssignPopover'
import { ShiftBlockPopover } from './components/ShiftBlockPopover'
import { AbsenceTypeDragBar, parseAbsenceDragId } from './components/AbsenceTypeDragBar'
import { AbsenceAssignPopover } from './components/AbsenceAssignPopover'
import { useDeleteAbsence } from './useDeleteAbsence'
import type { AbsenceType } from '@/lib/types'
import { DoctorDragSource, DoctorDragOverlayToken, parseDoctorDragId } from './components/DoctorDragSource'
import { RotationAssignPopover } from './components/RotationAssignPopover'
import { parseBereichHeaderDropId, parsePlaceholderDropId, parseRotationMemberDropId } from './components/BereichHeaderRow'
import { useAppSettings } from '@/stores/useAppSettings'
import { apiGet } from '@/lib/api'
import type { ShiftWithDetails, TarifWarning, RotationAssignmentWithDetails, INAExclusion, SolveResult } from '@/lib/types'

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
  const { data: allPlans = [] } = usePlans()

  // Slug (z. B. "mai2026") oder numerische ID akzeptieren
  const id: number = (() => {
    const numeric = parseInt(planSlug ?? '', 10)
    if (!isNaN(numeric) && String(numeric) === planSlug) return numeric
    const matched = allPlans.find((p) => planToSlug(p) === planSlug)
    return matched?.id ?? NaN
  })()

  const [focusMode, setFocusMode] = useState<'alle' | 'vn'>('alle')
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [contextShift, setContextShift] = useState<ShiftWithDetails | null>(null)
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
  const [dragConflictMap, setDragConflictMap] = useState<Map<number, Set<string>> | null>(null)
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

  const deleteAbsence = useDeleteAbsence(id)

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
  const assignShift = useAssignShift(id)
  const updatePlan = useUpdatePlan(id)
  const deletePlan = useDeletePlan()
  const deleteRotation = useDeleteRotation(id)
  const createRotation = useCreateRotation(id)
  const solvePlan = useSolvePlan(id)
  const applySolver = useApplySolverResult(id)
  const { solverEnabled } = useAppSettings()
  const { data: constraintOverrides = [] } = useConstraintOverrides(isNaN(id) ? null : id)
  const createOverrideMutation = useCreateConstraintOverride(isNaN(id) ? 0 : id)
  const deleteOverrideMutation = useDeleteConstraintOverride(isNaN(id) ? 0 : id)
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null)
  const [isSolverOpen, setIsSolverOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDeleteRotation, setPendingDeleteRotation] = useState<RotationAssignmentWithDetails | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
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

  const statusLabel =
    plan?.status === 'RELEASED' ? 'Freigegeben'
    : plan?.status === 'ARCHIVED' ? 'Archiviert'
    : 'Entwurf'

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
        ? (conflicts?.open_shifts?.map((s) => s.shift_id) ?? [])
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

  useEffect(() => {
    const highlight = searchParams.get('highlight')
    if (!highlight) return
    if (highlight !== 'open' && highlight !== 'conflict') return
    const t = setTimeout(() => {
      scrollToFirstMatch(highlight as 'open' | 'conflict')
      setSearchParams({}, { replace: true })
    }, 200)
    return () => clearTimeout(t)
  }, [searchParams, scrollToFirstMatch, setSearchParams])

  const planTitle = plan
    ? format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })
    : '…'

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

  const kpiTiles = [
    { label: 'Ärzte', value: doctors.length },
    { label: 'Schichten', value: shifts.length },
    {
      label: 'Offen',
      value: openCount,
      tone: openCount > 0 ? ('warn' as const) : ('default' as const),
      onClick: openCount > 0 ? () => scrollToFirstMatch('open') : undefined,
    },
    {
      label: 'Konflikte',
      value: conflictCount,
      tone: conflictCount > 0 ? ('warn' as const) : ('default' as const),
      onClick: conflictCount > 0 ? () => scrollToFirstMatch('conflict') : undefined,
    },
  ]

  function handleCellClick(
    rotationId: number,
    doctorId: number,
    day: string,
    shiftId: number | null,
    shiftKey: boolean,
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
    setActiveCell({ rotationId, doctorId, day, shiftId })
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

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id)

    const doctorId = parseDoctorDragId(activeId)
    if (doctorId !== null) {
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

      setDragConflictMap(map)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragDoctor(null)
    setDragConflictMap(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

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
      setPendingShiftAssign({
        shiftId,
        doctorId: targetDoctorId,
        prevDoctorName: prevDoctor?.name ?? 'Anderer Arzt',
        newDoctorName: newDoctor?.name ?? 'Arzt',
      })
      return
    }

    assignShift.mutate(
      { shiftId, data: { doctor_id: targetDoctorId } },
      { onError: () => toast.error('Fehler beim Speichern der Zuweisung') },
    )
  }

  function handleDragCancel() {
    setActiveDragDoctor(null)
    setDragConflictMap(null)
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
      <CommandBar
        title={planTitle}
        titleNode={
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => prevPlan && navigate(`/plans/${planToSlug(prevPlan)}`)}
              disabled={!prevPlan}
              title={prevPlan ? format(new Date(prevPlan.valid_from), 'MMMM yyyy', { locale: de }) : undefined}
              className="p-0.5 rounded text-ink-3 hover:text-ink hover:bg-line disabled:opacity-20 transition"
              aria-label="Vorheriger Plan"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span>{planTitle}</span>
            <button
              type="button"
              onClick={() => nextPlan && navigate(`/plans/${planToSlug(nextPlan)}`)}
              disabled={!nextPlan}
              title={nextPlan ? format(new Date(nextPlan.valid_from), 'MMMM yyyy', { locale: de }) : undefined}
              className="p-0.5 rounded text-ink-3 hover:text-ink hover:bg-line disabled:opacity-20 transition"
              aria-label="Nächster Plan"
            >
              <ChevronRight className="size-4" />
            </button>
          </span>
        }
        breadcrumb={[{ label: 'Pläne', href: '/plans' }]}
        primaryAction={
          !isNaN(id)
            ? {
                label: 'Exportieren',
                icon: FileDown,
                onClick: () => window.location.assign(`/api/plans/${id}/export`),
              }
            : undefined
        }
        extras={plan ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={14} className="mr-1.5" />
              Einstellungen
            </Button>
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
      />
      <div className="px-6 py-3">
        <KpiBar tiles={kpiTiles} />
      </div>

      {/* DnD-Bars: Dienste + Abwesenheiten */}
      <div className="px-6 pb-2 flex items-stretch gap-3">
        <div className="flex-1 min-w-0">
          <ShiftTypeDragBar
            shiftTypes={shiftTypes}
            focusMode={focusMode}
            onFocusToggle={() => setFocusMode((m) => (m === 'alle' ? 'vn' : 'alle'))}
          />
        </div>
        <div className="flex-1 min-w-0">
          <AbsenceTypeDragBar />
        </div>
      </div>

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

      <div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
        <DoctorDragSource
          doctors={doctors}
          rotationDoctorIds={assignedDoctorIds}
          highlightedDoctorId={highlightedDoctorId}
          onHighlightDoctor={setHighlightedDoctorId}
          locked={plan?.besetzung_locked ?? false}
        />
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
              focusMode={focusMode}
              dragConflictMap={dragConflictMap}
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
            />
          )}
        </div>
        {contextShift && (
          <ContextPanel
            shift={contextShift}
            onClose={() => setContextShift(null)}
            tarifWarnings={tarifWarningsByShift[contextShift.id]}
            shiftOverrides={constraintOverrides.filter(
              (o) => o.level === 'C' && o.shift_id === contextShift.id,
            )}
            onCreateOverride={(constraintId, reason) =>
              handleCreateCOverride(contextShift.id, constraintId, reason)
            }
            onDeleteOverride={handleDeleteOverride}
          />
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
          onClose={() => setActiveCell(null)}
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
      <DragOverlay modifiers={[avatarTopModifier]}>
        {activeDragDoctor && (
          <DoctorDragOverlayToken
            name={activeDragDoctor.name}
            shortName={activeDragDoctor.shortName}
            id={activeDragDoctor.id}
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
