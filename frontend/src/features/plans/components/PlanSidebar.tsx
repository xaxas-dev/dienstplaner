import { useMemo, useState } from 'react'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { Star, ShieldCheck, ShieldOff, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConflictCard } from './ConflictCard'
import { REGULATORISCH_HART_IDS } from '@/lib/types'
import type { components } from '@/lib/api-types'
import type { TarifWarning, ConstraintOverride, Doctor, ShiftType, Wish, Department, RotationAssignmentWithDetails } from '@/lib/types'
import { getDepartmentColor } from '@/lib/bereichColors'
import type { FairnessStat } from '../fairnessUtils'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

export type SidebarTab = 'details' | 'wuensche' | 'fairness' | 'konflikte'

type PlanConflictSummary = {
  conflicts: Array<{ shift_id: number }>
  open_shifts: Array<{ shift_id: number }>
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'bg-sand text-ink',
  warning: 'bg-warn-bg text-warn-ink',
  critical: 'bg-warn text-paper',
}
const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info', warning: 'Warnung', critical: 'Kritisch',
}

const TABS_BESETZUNG: SidebarTab[] = ['details', 'konflikte']
const TABS_INA: SidebarTab[] = ['details', 'wuensche', 'fairness', 'konflikte']
const TAB_LABELS: Record<SidebarTab, string> = {
  details: 'Details', wuensche: 'Wünsche', fairness: 'Fairness', konflikte: 'Konflikte',
}

export interface PlanSidebarProps {
  // KPI
  shifts: ShiftWithDetails[]
  planFrom: string
  planTo: string
  openCount: number
  conflictCount: number
  onConflictBadgeClick: () => void
  // Tabs
  mode: 'besetzung' | 'ina'
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  // Details
  shift?: ShiftWithDetails | null
  onCloseShift?: () => void
  tarifWarnings?: TarifWarning[]
  shiftOverrides?: ConstraintOverride[]
  onCreateOverride?: (constraintId: string, reason: string | null) => void
  onDeleteOverride?: (overrideId: number) => void
  selectedDoctorId?: number | null
  doctors?: Doctor[]
  shiftTypes?: ShiftType[]
  wishes?: Wish[]
  planMonth?: string
  // Wünsche
  showWishes: boolean
  onToggleWishes: () => void
  // Fairness
  fairnessStats: FairnessStat[]
  fairnessGroups: string[]
  // Konflikte
  conflicts?: PlanConflictSummary | null
  onScrollToShift: (shiftId: number) => void
  // Department-Details
  selectedDepartmentId?: number | null
  departments?: Department[]
  rotations?: RotationAssignmentWithDetails[]
  onDepartmentDeselect?: () => void
  // Wunsch erstellen
  onNewWishClick: (doctorId: number) => void
}

export function PlanSidebar({
  shifts, planFrom, planTo, openCount, conflictCount, onConflictBadgeClick,
  mode, activeTab, onTabChange,
  shift, onCloseShift, tarifWarnings, shiftOverrides = [], onCreateOverride, onDeleteOverride,
  selectedDoctorId, doctors = [], shiftTypes = [], wishes = [], planMonth,
  showWishes, onToggleWishes,
  fairnessStats, fairnessGroups,
  conflicts, onScrollToShift,
  selectedDepartmentId, departments, rotations, onDepartmentDeselect,
  onNewWishClick,
}: PlanSidebarProps) {
  const [pendingReason, setPendingReason] = useState<Record<string, string>>({})
  const [wishPickerOpen, setWishPickerOpen] = useState(false)
  const [wishPickerDoctorId, setWishPickerDoctorId] = useState<string>('')

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const overrideMap = new Map(shiftOverrides.map((o) => [o.constraint_id, o]))
  const isOverridable = (ruleId: string) =>
    (REGULATORISCH_HART_IDS as readonly string[]).includes(ruleId)

  const coverage = useMemo(() => {
    if (shifts.length === 0) return 0
    return Math.round(shifts.filter((s) => s.doctor_id != null).length / shifts.length * 100)
  }, [shifts])

  const sparkline = useMemo(() => {
    try {
      const days = eachDayOfInterval({ start: parseISO(planFrom), end: parseISO(planTo) }).slice(0, 14)
      return days.map((day) => {
        const dk = format(day, 'yyyy-MM-dd')
        const ds = shifts.filter((s) => s.shift_date === dk)
        if (ds.length === 0) return 0
        return Math.round(ds.filter((s) => s.doctor_id != null).length / ds.length * 100)
      })
    } catch {
      return []
    }
  }, [shifts, planFrom, planTo])

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) ?? null
  const doctorShifts = shifts.filter((s) => s.doctor_id === selectedDoctorId)
  const employmentPct = selectedDoctor
    ? (selectedDoctor.employment_periods?.find(
        (ep) => ep.valid_to == null || ep.valid_to >= today,
      )?.employment_percentage ?? null)
    : null

  const shiftTypeBreakdown = shiftTypes
    .map((st) => ({ st, count: doctorShifts.filter((s) => s.shift_type?.id === st.id).length }))
    .filter(({ count }) => count > 0)

  const doctorWishes = wishes.filter((w) => w.doctor_id === selectedDoctorId)

  const selectedDepartment = (departments ?? []).find(d => d.id === selectedDepartmentId) ?? null
  const deptRotations = useMemo(
    () => (rotations ?? []).filter(r => r.department_id === selectedDepartmentId),
    [rotations, selectedDepartmentId],
  )
  const deptDoctors = useMemo(
    () => deptRotations
      .map(r => doctors.find(d => d.id === r.doctor_id))
      .filter((d): d is Doctor => d != null),
    [deptRotations, doctors],
  )

  const tabs = mode === 'besetzung' ? TABS_BESETZUNG : TABS_INA
  const fairnessColTemplate = `1fr ${fairnessGroups.map(() => '2.25rem').join(' ')} 2.25rem`

  return (
    <div className="w-[290px] shrink-0 flex flex-col bg-paper border-l border-line overflow-hidden">
      {/* KPI Strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-line bg-card text-[12px] text-ink-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-serif text-[18px] text-ink tabular-nums leading-none">{coverage}%</span>
          {sparkline.length > 0 && (
            <div className="flex items-end gap-0.5 h-[16px]">
              {sparkline.map((v, i) => (
                <div
                  key={i}
                  className={cn('w-[3px] rounded-sm', v < 80 ? 'bg-warn' : 'bg-dp-accent-2')}
                  style={{ height: `${Math.max(3, (v / 100) * 16)}px` }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-[16px] text-ink tabular-nums leading-none">{openCount}</span>
          <span className="text-[11px]">offen</span>
        </div>
        <button
          type="button"
          onClick={onConflictBadgeClick}
          className={cn(
            'flex items-baseline gap-1 transition-opacity',
            conflictCount > 0 ? 'hover:opacity-70' : 'cursor-default',
          )}
        >
          <span className={cn(
            'font-serif text-[16px] tabular-nums leading-none',
            conflictCount > 0 ? 'text-warn' : 'text-ink',
          )}>
            {conflictCount}
          </span>
          <span className="text-[11px]">Konflikte</span>
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-line bg-card shrink-0" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'flex-1 px-1 py-2 text-[11px] font-medium transition-colors',
              activeTab === tab
                ? 'text-ink border-b-2 border-accent'
                : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Details ── */}
        {activeTab === 'details' && (
          <div className="p-4 space-y-4">
            {/* Station ausgewählt */}
            {selectedDepartment && !shift && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium">Station</p>
                  {onDepartmentDeselect && (
                    <button
                      type="button"
                      onClick={onDepartmentDeselect}
                      className="text-[11px] text-ink-3 hover:text-ink transition"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-10 rounded-sm shrink-0"
                    style={{ background: getDepartmentColor(selectedDepartment) }}
                  />
                  <div>
                    <p className="font-serif text-[19px] leading-[1.15] text-ink">{selectedDepartment.name}</p>
                    <p className="text-[12px] text-ink-3">{deptDoctors.length} {deptDoctors.length === 1 ? 'Arzt' : 'Ärzte'}</p>
                  </div>
                </div>
                {deptDoctors.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-1">Besetzung</p>
                    {deptDoctors.map((doc) => {
                      const ep = doc.employment_periods?.find(
                        (ep) => ep.valid_to == null || ep.valid_to >= today,
                      )
                      const fte = ep?.employment_percentage ?? null
                      const shiftCount = shifts.filter((s) => s.doctor_id === doc.id).length
                      return (
                        <div key={doc.id} className="flex items-center gap-2 text-[12px]">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                            style={{ background: '#E8DCC4', color: '#26221C' }}
                          >
                            {doc.short_name ?? doc.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="flex-1 text-ink truncate">{doc.name}</span>
                          <span className="text-ink-3 tabular-nums text-[11px] shrink-0">
                            {fte != null ? `${fte}%` : ''}{fte != null && shiftCount > 0 ? ' · ' : ''}{shiftCount > 0 ? `${shiftCount} D` : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-3 mt-2">Keine Ärzte zugewiesen</p>
                )}
              </div>
            )}

            {/* Ausgewählt */}
            <div>
              <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Ausgewählt</p>
              {selectedDoctor ? (
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0"
                    style={{ background: '#E8DCC4', color: '#26221C' }}
                  >
                    {selectedDoctor.short_name ?? selectedDoctor.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-serif text-[19px] leading-[1.15] text-ink">{selectedDoctor.name}</p>
                    <p className="text-[12px] text-ink-3 mt-0.5">
                      {employmentPct != null ? `${employmentPct}%` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-ink-3">Zelle klicken zum Auswählen</p>
              )}
            </div>

            {/* Konflikte & Tarif für gewählten Shift */}
            {shift && (shift.conflicts.length > 0 || (tarifWarnings && tarifWarnings.length > 0)) && (
              <div>
                {shift.conflicts.length > 0 && (
                  <div className="rounded-tile border border-warn-line bg-warn-bg p-[12px_14px] space-y-2">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-warn-ink">
                      <span className="w-4 h-4 rounded-full bg-warn text-white flex items-center justify-center text-[10px] font-bold shrink-0">!</span>
                      {shift.conflicts.length === 1 ? 'Regelkonflikt' : `${shift.conflicts.length} Konflikte`}
                      {shift.shift_date ? ` · ${shift.shift_date}` : ''}
                    </div>
                    {shift.conflicts.map((c, i) => <ConflictCard key={c.shift_id ?? i} conflict={c} />)}
                  </div>
                )}
                {tarifWarnings && tarifWarnings.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Tarif-Warnungen</p>
                    {tarifWarnings.map((w, i) => {
                      const override = overrideMap.get(w.rule_id)
                      const canOverride = isOverridable(w.rule_id)
                      return (
                        <div key={w.rule_id ?? i} className="rounded-lg border border-line bg-paper p-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              SEVERITY_CLASS[w.severity] ?? 'bg-sand text-ink',
                            )}>
                              {SEVERITY_LABEL[w.severity] ?? w.severity}
                            </span>
                            <span className="text-[11px] text-ink-3">{w.rule_id}</span>
                          </div>
                          <p className="text-[12px] text-ink leading-snug">{w.message}</p>
                          {canOverride && (
                            <div className="pt-1">
                              {override ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] bg-sand border border-warn-line rounded px-2 py-0.5 flex items-center gap-1">
                                    <ShieldCheck size={11} /> Override aktiv
                                  </span>
                                  {override.reason && (
                                    <span className="text-[11px] text-ink-3 truncate">{override.reason}</span>
                                  )}
                                  <button
                                    className="text-[11px] text-ink-3 underline hover:text-ink"
                                    onClick={() => onDeleteOverride?.(override.id)}
                                  >
                                    Widerrufen
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Input
                                    className="h-6 text-[11px]"
                                    placeholder="Begründung (optional)"
                                    value={pendingReason[w.rule_id] ?? ''}
                                    onChange={(e) =>
                                      setPendingReason((r) => ({ ...r, [w.rule_id]: e.target.value }))
                                    }
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[11px] flex-1"
                                      onClick={() => {
                                        onCreateOverride?.(w.rule_id, pendingReason[w.rule_id] ?? null)
                                        setPendingReason((r) => {
                                          const n = { ...r }
                                          delete n[w.rule_id]
                                          return n
                                        })
                                      }}
                                    >
                                      <ShieldOff size={11} className="mr-1" /> Freigeben
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[11px]"
                                      onClick={() =>
                                        setPendingReason((r) => {
                                          const n = { ...r }
                                          delete n[w.rule_id]
                                          return n
                                        })
                                      }
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Schichten */}
            {selectedDoctor && doctorShifts.length > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-1.5">
                  Schichten {planMonth ?? ''}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-[30px] text-ink tabular-nums leading-none">
                    {doctorShifts.length}
                  </span>
                  <span className="text-[13px] text-ink-3">Dienste</span>
                </div>
                <div className="h-1 bg-line rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-ok rounded-full"
                    style={{
                      width: `${Math.min(100, (doctorShifts.length / Math.max(1, shifts.length)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Schichttypen */}
            {selectedDoctor && shiftTypeBreakdown.length > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
                  Schichttypen
                </p>
                <div className="space-y-1">
                  {shiftTypeBreakdown.map(({ st, count }) => (
                    <div key={st.id} className="flex items-center gap-2 text-[12px]">
                      <span
                        className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center font-semibold text-[11px] shrink-0"
                        style={{ background: '#E8DCC4', color: '#26221C' }}
                      >
                        {st.short_name}
                      </span>
                      <span className="flex-1 text-ink-2">{st.name}</span>
                      <span className="font-serif text-[16px] text-ink tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wünsche Preview */}
            {selectedDoctor && doctorWishes.length > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
                  Wünsche
                </p>
                <div className="bg-card border border-line rounded-[10px] p-[10px_12px] text-[12px] text-ink-2 space-y-1">
                  {doctorWishes.slice(0, 5).map((w) => (
                    <div key={w.id}>
                      {w.wish_date ? (
                        <span>
                          {w.wish_date} →{' '}
                          <strong>
                            {w.wish_type === 'AVOID_DAY'
                              ? 'frei'
                              : w.wish_type === 'REQUIRE_SHIFT'
                                ? 'Dienst'
                                : 'kein N'}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-ink-3">{w.wish_type}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}


            {shift && onCloseShift && (
              <button
                type="button"
                onClick={onCloseShift}
                className="text-[11px] text-ink-3 underline hover:text-ink transition w-full text-left"
              >
                Schicht-Auswahl aufheben ({shift.shift_type?.short_name} · {shift.shift_date})
              </button>
            )}
          </div>
        )}

        {/* ── Konflikte ── */}
        {activeTab === 'konflikte' && (
          <div className="p-4 space-y-4">
            {(conflicts?.conflicts.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
                  Konflikte
                </p>
                <div className="space-y-1">
                  {conflicts?.conflicts.map((c) => {
                    const s = shifts.find((sh) => sh.id === c.shift_id)
                    return (
                      <button
                        key={c.shift_id}
                        type="button"
                        aria-label={s?.shift_date ?? `Schicht ${c.shift_id}`}
                        onClick={() => onScrollToShift(c.shift_id)}
                        className="w-full text-left px-3 py-1.5 rounded-lg border border-warn-line bg-warn-bg text-[12px] text-warn-ink hover:opacity-80 transition-opacity"
                      >
                        {s?.shift_date ?? `#${c.shift_id}`}
                        {s?.shift_type && (
                          <span className="ml-2 font-semibold">{s.shift_type.short_name}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {(conflicts?.open_shifts.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
                  Offene Dienste
                </p>
                <div className="space-y-1">
                  {conflicts?.open_shifts.map((c) => {
                    const s = shifts.find((sh) => sh.id === c.shift_id)
                    return (
                      <button
                        key={c.shift_id}
                        type="button"
                        aria-label={s?.shift_date ?? `Schicht ${c.shift_id}`}
                        onClick={() => onScrollToShift(c.shift_id)}
                        className="w-full text-left px-3 py-1.5 rounded-lg border border-line bg-paper text-[12px] text-ink-2 hover:bg-line/30 transition-colors"
                      >
                        {s?.shift_date ?? `#${c.shift_id}`}
                        {s?.shift_type && (
                          <span className="ml-2 font-semibold">{s.shift_type.short_name}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {!conflicts?.conflicts.length && !conflicts?.open_shifts.length && (
              <div className="flex flex-col items-center justify-center h-32 text-center text-[12px] text-ink-3">
                <span>Keine Konflikte</span>
              </div>
            )}
          </div>
        )}

        {/* ── Wünsche (INA only) ── */}
        {activeTab === 'wuensche' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium">Wünsche im Plan</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setWishPickerOpen((o) => !o)
                    if (wishPickerOpen) setWishPickerDoctorId('')
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-ink-2 border border-line rounded-lg px-2 py-1 hover:bg-line/30 transition-colors"
                >
                  <Plus className="size-3" /> Neu
                </button>
                {wishPickerOpen && (
                  <div className="absolute right-0 top-full mt-1 w-[220px] bg-card border border-line rounded-lg shadow-md p-3 space-y-2 z-10">
                    <p className="text-[11px] font-medium text-ink-3">Wunsch für Arzt:</p>
                    <select
                      className="w-full h-8 text-xs border border-line rounded-md px-2 bg-paper text-ink"
                      value={wishPickerDoctorId}
                      onChange={(e) => setWishPickerDoctorId(e.target.value)}
                    >
                      <option value="">Arzt auswählen…</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!wishPickerDoctorId}
                      onClick={() => {
                        if (wishPickerDoctorId) {
                          onNewWishClick(Number(wishPickerDoctorId))
                          setWishPickerOpen(false)
                          setWishPickerDoctorId('')
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 transition-opacity"
                    >
                      Weiter
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleWishes}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors w-full',
                showWishes
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-paper border-line text-ink-3 hover:bg-line/40',
              )}
            >
              <Star className="size-3" />
              Wunsch-Hinweise im Grid {showWishes ? 'ausblenden' : 'einblenden'}
            </button>
            {wishes.length > 0 ? (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
                  Wünsche ({wishes.length})
                </p>
                <div className="space-y-1">
                  {wishes.map((w) => (
                    <div
                      key={w.id}
                      className="px-3 py-1.5 rounded-lg border border-line bg-paper text-[12px] text-ink-2"
                    >
                      {w.wish_date ? (
                        <span>
                          {w.wish_date} →{' '}
                          <strong>
                            {w.wish_type === 'AVOID_DAY'
                              ? 'frei'
                              : w.wish_type === 'REQUIRE_SHIFT'
                                ? 'Dienst'
                                : 'kein Dienst'}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-ink-3">{w.wish_type}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-ink-3">Keine Wünsche erfasst</p>
            )}
          </div>
        )}

        {/* ── Fairness (INA only) ── */}
        {activeTab === 'fairness' && (
          <div className="flex flex-col overflow-hidden h-full">
            <div
              className="grid border-b border-line text-[10px] text-ink-3 font-medium bg-paper/40 shrink-0"
              style={{ gridTemplateColumns: fairnessColTemplate }}
            >
              <div className="px-2 py-1.5">Arzt</div>
              {fairnessGroups.map((g) => (
                <div key={g} className="px-1 py-1.5 text-center truncate" title={g}>
                  {g}
                </div>
              ))}
              <div className="px-1 py-1.5 text-center">∑</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {fairnessStats.length === 0 ? (
                <div className="px-3 py-4 text-xs text-ink-3 text-center">
                  Keine Ärzte im Plan
                </div>
              ) : (
                fairnessStats.map((stat) => (
                  <div
                    key={stat.doctorId}
                    className="grid border-b border-line last:border-0 text-xs hover:bg-paper/60 transition-colors"
                    style={{ gridTemplateColumns: fairnessColTemplate }}
                  >
                    <div
                      className="px-2 py-1.5 truncate text-ink"
                      title={stat.doctorName}
                    >
                      {stat.doctorName}
                    </div>
                    {fairnessGroups.map((g) => (
                      <div
                        key={g}
                        className={cn(
                          'px-1 py-1.5 text-center tabular-nums',
                          (stat.byGroup[g] ?? 0) > 0 ? 'text-ink' : 'text-ink-3',
                        )}
                      >
                        {stat.byGroup[g] ?? 0}
                      </div>
                    ))}
                    <div
                      className={cn(
                        'px-1 py-1.5 text-center font-medium tabular-nums',
                        stat.total > 0 ? 'text-ink' : 'text-ink-3',
                      )}
                    >
                      {stat.total}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
