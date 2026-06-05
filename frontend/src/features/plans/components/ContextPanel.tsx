import { useState } from 'react'
import { X, ShieldCheck, ShieldOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConflictCard } from './ConflictCard'
import type { components } from '@/lib/api-types'
import type { ConstraintOverride, TarifWarning, Doctor, ShiftType, Wish } from '@/lib/types'
import { REGULATORISCH_HART_IDS } from '@/lib/types'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info',
  warning: 'Warnung',
  critical: 'Kritisch',
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'bg-sand text-ink',
  warning: 'bg-warn-bg text-warn-ink',
  critical: 'bg-warn text-paper',
}

interface Props {
  shift?: ShiftWithDetails | null
  onClose?: () => void
  tarifWarnings?: TarifWarning[]
  shiftOverrides?: ConstraintOverride[]
  onCreateOverride?: (constraintId: string, reason: string | null) => void
  onDeleteOverride?: (overrideId: number) => void
  selectedDoctorId?: number | null
  doctors?: Doctor[]
  shifts?: ShiftWithDetails[]
  shiftTypes?: ShiftType[]
  wishes?: Wish[]
  planMonth?: string
}

export function ContextPanel({
  shift,
  onClose,
  tarifWarnings,
  shiftOverrides = [],
  onCreateOverride,
  onDeleteOverride,
  selectedDoctorId,
  doctors,
  shifts,
  shiftTypes,
  wishes,
  planMonth,
}: Props) {
  const [pendingReason, setPendingReason] = useState<Record<string, string>>({})

  const overrideMap = new Map(shiftOverrides.map((o) => [o.constraint_id, o]))
  const isOverridable = (ruleId: string) => (REGULATORISCH_HART_IDS as readonly string[]).includes(ruleId)

  const selectedDoctor = (doctors ?? []).find((d) => d.id === selectedDoctorId) ?? null
  const doctorShiftsInPlan = (shifts ?? []).filter((s) => s.doctor_id === selectedDoctorId)
  const totalShifts = (shifts ?? []).length

  const employmentPct = selectedDoctor
    ? (selectedDoctor.employment_periods?.find(
        (ep) => ep.valid_to == null || ep.valid_to >= new Date().toISOString().slice(0, 10),
      )?.employment_percentage ?? null)
    : null

  const shiftTypeBreakdown = (shiftTypes ?? [])
    .map((st) => ({
      st,
      count: doctorShiftsInPlan.filter((s) => s.shift_type?.id === st.id).length,
    }))
    .filter(({ count }) => count > 0)

  const doctorWishes = (wishes ?? []).filter((w) => w.doctor_id === selectedDoctorId)

  return (
    <div className="w-[290px] shrink-0 flex flex-col bg-paper border-l border-line overflow-hidden">
      {/* ── Sektion 1: Ausgewählt ── */}
      <div className="px-5 pt-4 pb-3 border-b border-line">
        <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
          Ausgewählt
        </p>
        {selectedDoctor ? (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0"
              style={{ background: '#E8DCC4', color: '#26221C' }}
            >
              {selectedDoctor.short_name ?? selectedDoctor.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-serif text-[19px] leading-[1.15] text-ink">
                {selectedDoctor.name}
              </p>
              <p className="text-[12px] text-ink-3 mt-0.5">
                {employmentPct != null ? `${employmentPct}%` : ''}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-ink-3">Zelle klicken zum Auswählen</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── Sektion 2: Konflikt-Card ── */}
        {shift && (shift.conflicts.length > 0 || (tarifWarnings && tarifWarnings.length > 0)) && (
          <div>
            {shift.conflicts.length > 0 && (
              <div className="rounded-tile border border-warn-line bg-warn-bg p-[12px_14px] space-y-2">
                <div className="flex items-center gap-2 text-[12px] font-medium text-warn-ink">
                  <span className="w-4 h-4 rounded-full bg-warn text-white flex items-center justify-center text-[10px] font-bold shrink-0">!</span>
                  {shift.conflicts.length === 1 ? 'Regelkonflikt' : `${shift.conflicts.length} Konflikte`}
                  {shift.shift_date ? ` · ${shift.shift_date}` : ''}
                </div>
                {shift.conflicts.map((conflict, i) => (
                  <ConflictCard key={i} conflict={conflict} />
                ))}
              </div>
            )}
            {tarifWarnings && tarifWarnings.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Tarif-Warnungen</p>
                {tarifWarnings.map((w, i) => {
                  const override = overrideMap.get(w.rule_id)
                  const canOverride = isOverridable(w.rule_id)
                  return (
                    <div key={i} className="rounded-lg border border-line bg-paper p-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={['rounded-full px-2 py-0.5 text-[10px] font-semibold', SEVERITY_CLASS[w.severity] ?? 'bg-sand text-ink'].join(' ')}>
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
                              {override.reason && <span className="text-[11px] text-ink-3 truncate">{override.reason}</span>}
                              <button className="text-[11px] text-ink-3 underline hover:text-ink" onClick={() => onDeleteOverride?.(override.id)}>
                                Widerrufen
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Input
                                className="h-6 text-[11px]"
                                placeholder="Begründung (optional)"
                                value={pendingReason[w.rule_id] ?? ''}
                                onChange={(e) => setPendingReason((r) => ({ ...r, [w.rule_id]: e.target.value }))}
                              />
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] flex-1"
                                  onClick={() => {
                                    onCreateOverride?.(w.rule_id, pendingReason[w.rule_id] ?? null)
                                    setPendingReason((r) => { const n = { ...r }; delete n[w.rule_id]; return n })
                                  }}
                                >
                                  <ShieldOff size={11} className="mr-1" />
                                  Freigeben
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[11px]"
                                  onClick={() => setPendingReason((r) => { const n = { ...r }; delete n[w.rule_id]; return n })}
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

        {/* ── Sektion 3: Schichten ── */}
        {selectedDoctor && doctorShiftsInPlan.length > 0 && (
          <div>
            <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-1.5">
              Schichten {planMonth ?? ''}
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-[30px] text-ink tabular-nums leading-none">
                {doctorShiftsInPlan.length}
              </span>
              <span className="text-[13px] text-ink-3">Dienste</span>
            </div>
            <div className="h-1 bg-line rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-ok rounded-full"
                style={{ width: `${Math.min(100, (doctorShiftsInPlan.length / Math.max(1, totalShifts)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Sektion 4: Schichttypen ── */}
        {selectedDoctor && shiftTypeBreakdown.length > 0 && (
          <div>
            <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Schichttypen</p>
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

        {/* ── Sektion 5: Wünsche ── */}
        {selectedDoctor && doctorWishes.length > 0 && (
          <div>
            <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Wünsche</p>
            <div className="bg-card border border-line rounded-[10px] p-[10px_12px] text-[12px] text-ink-2 space-y-1">
              {doctorWishes.slice(0, 5).map((w) => (
                <div key={w.id}>
                  {w.wish_date ? (
                    <span>{w.wish_date} → <strong>{w.wish_type === 'AVOID_DAY' ? 'frei' : w.wish_type === 'REQUIRE_SHIFT' ? 'Dienst' : 'kein N'}</strong></span>
                  ) : (
                    <span className="text-ink-3">{w.wish_type}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leer-Zustand */}
        {!selectedDoctor && !shift && (
          <div className="flex flex-col items-center justify-center h-40 text-center text-[12px] text-ink-3 gap-2">
            <span>Zelle im Grid klicken</span>
            <span>um Details anzuzeigen</span>
          </div>
        )}
      </div>

      {shift && onClose && (
        <div className="px-4 py-2 border-t border-line flex items-center justify-between shrink-0">
          <span className="text-[12px] text-ink-2">
            {shift.shift_type?.short_name} · {shift.shift_date}
          </span>
          <button aria-label="Schließen" onClick={onClose} className="text-ink-3 hover:text-ink transition">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
