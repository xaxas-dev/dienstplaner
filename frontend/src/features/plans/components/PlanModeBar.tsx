import React from 'react'
import { ChevronRight, ChevronLeft, Star, BarChart2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'
import type { ShiftType } from '@/lib/types'

const ABSENCE_CODES = [
  { code: 'U', label: 'Urlaub' },
  { code: 'K', label: 'Krankheit' },
  { code: 'FB', label: 'Fortbildung' },
  { code: 'EZ', label: 'Elternzeit' },
  { code: 'MS', label: 'Mutterschutz' },
  { code: 'DIV', label: 'Sonstiges' },
]

const SEGMENTS = [
  {
    id: 'besetzung' as const,
    step: '1',
    label: 'Besetzung planen',
    sub: 'Stationen · Urlaub · Nachtwochen',
  },
  {
    id: 'ina' as const,
    step: '2',
    label: 'INA planen',
    sub: 'V · T · N-Dienste setzen',
  },
]

export interface PlanModeBarProps {
  mode: 'besetzung' | 'ina'
  onModeChange: (mode: 'besetzung' | 'ina') => void

  conflictCount: number
  onScrollToConflict: () => void

  shiftTypes: ShiftType[]
  activeFilterGroups: Set<string>
  onFilterGroupToggle: (group: string) => void
  onFilterGroupClear: () => void

  showWishes: boolean
  onToggleWishes: () => void
  wishCount: number

  showFairness: boolean
  onToggleFairness: () => void

  solverEnabled: boolean
  isSolving: boolean
  onSolve: () => void
}

export function PlanModeBar({
  mode,
  onModeChange,
  conflictCount,
  onScrollToConflict,
  shiftTypes,
  activeFilterGroups,
  showWishes,
  onToggleWishes,
  wishCount,
  showFairness,
  onToggleFairness,
  solverEnabled,
  isSolving,
  onSolve,
}: PlanModeBarProps) {
  const sortedShiftTypes = [...shiftTypes].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="flex items-center gap-3 px-5 py-2 border-b border-line bg-card flex-wrap shrink-0">
      {/* Segmented Switch */}
      <div className="inline-flex items-center bg-paper border border-line-2 rounded-[14px] p-[3px] gap-[3px] shrink-0">
        {SEGMENTS.map((seg, i) => {
          const active = mode === seg.id
          return (
            <React.Fragment key={seg.id}>
              <button
                type="button"
                onClick={() => onModeChange(seg.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-1.5 rounded-[11px] border-none transition-colors',
                  active ? 'bg-ink' : 'bg-transparent hover:bg-line/40',
                )}
              >
                <span
                  className={cn(
                    'w-[22px] h-[22px] rounded-full inline-flex items-center justify-center font-serif text-[13px] shrink-0',
                    active ? 'bg-dp-accent text-[#FFF8EF]' : 'bg-line text-ink-3',
                  )}
                >
                  {seg.step}
                </span>
                <span className="text-left">
                  <span
                    className={cn(
                      'block text-[12.5px] font-semibold leading-[1.2]',
                      active ? 'text-[#FBF6E8]' : 'text-ink-2',
                    )}
                  >
                    {seg.label}
                  </span>
                  <span
                    className={cn(
                      'block text-[9.5px] leading-[1.3]',
                      active ? 'text-[rgba(251,246,232,0.52)]' : 'text-ink-3',
                    )}
                  >
                    {seg.sub}
                  </span>
                </span>
              </button>
              {i === 0 && <ChevronRight className="size-3 text-ink-3 shrink-0" />}
            </React.Fragment>
          )
        })}
      </div>

      <div className="w-px h-[22px] bg-line mx-1 shrink-0" />

      {/* Context-Filter (mode-abhängig) */}
      {mode === 'besetzung' ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {sortedShiftTypes.map((st) => {
            const pal = colorForShiftType({ id: st.id, code: st.short_name })
            return (
              <span
                key={st.id}
                style={{ background: pal.bg, color: pal.fg }}
                className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-bold select-none"
              >
                {st.short_name}
              </span>
            )
          })}
          <span className="text-line-2 mx-0.5">|</span>
          <span className="text-[10px] text-ink-3 uppercase tracking-[0.07em]">Abwesenheiten</span>
          {ABSENCE_CODES.map((a) => (
            <span
              key={a.code}
              className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-card border border-line text-ink-2 select-none"
            >
              {a.code}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onToggleWishes}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
              showWishes
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-paper border-line text-ink-3 hover:bg-line/40',
            )}
          >
            <Star className="size-3" />
            Wünsche
            {wishCount > 0 && (
              <span className="text-[10px] font-bold px-[5px] rounded-full bg-amber-100 text-amber-700">
                {wishCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleFairness}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
              showFairness
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-paper border-line text-ink-3 hover:bg-line/40',
            )}
          >
            <BarChart2 className="size-3" />
            Fairness
          </button>
          {activeFilterGroups.size > 0 && (
            <>
              <span className="text-line-2 mx-0.5">|</span>
              <span className="text-[10px] text-ink-3 uppercase tracking-[0.07em]">Fokus</span>
              {[...activeFilterGroups].map((group) => (
                <span
                  key={group}
                  className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-ink text-[#FBF6E8] select-none"
                >
                  {group}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      {/* Konflikte-Badge */}
      {conflictCount > 0 && (
        <button
          type="button"
          onClick={onScrollToConflict}
          className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11.5px] font-medium bg-warn-bg text-warn-ink border border-warn-line hover:opacity-80 transition-opacity"
        >
          {conflictCount} Konflikte
        </button>
      )}

      <div className="flex-1" />

      {/* CTA */}
      {mode === 'besetzung' ? (
        <button
          type="button"
          onClick={() => onModeChange('ina')}
          className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-ink text-[#FBF6E8] text-[12.5px] font-semibold hover:opacity-90 transition-opacity"
        >
          Weiter zu INA planen
          <ChevronRight className="size-3.5" />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onModeChange('besetzung')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] border border-line-2 bg-paper text-ink-2 text-[12px] hover:bg-line/30 transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Besetzung
          </button>
          {solverEnabled && (
            <button
              type="button"
              onClick={onSolve}
              disabled={isSolving}
              className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-dp-accent text-[#FFF8EF] text-[12.5px] font-semibold hover:bg-dp-accent-hover disabled:opacity-60 transition-colors"
            >
              <Zap className="size-3.5" />
              {isSolving ? 'Berechne…' : 'Plan generieren'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
