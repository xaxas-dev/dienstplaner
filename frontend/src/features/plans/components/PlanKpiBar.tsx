import { useMemo } from 'react'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { ShiftWithDetails } from '@/lib/types'

export interface PlanKpiBarProps {
  shifts: ShiftWithDetails[]
  planFrom: string
  planTo: string
  openCount: number
  conflictCount: number
}

export function PlanKpiBar({ shifts, planFrom, planTo, openCount, conflictCount }: PlanKpiBarProps) {
  const coverage = useMemo(() => {
    if (shifts.length === 0) return 0
    return Math.round(shifts.filter((s) => s.doctor_id != null).length / shifts.length * 100)
  }, [shifts])

  const sparkline = useMemo(() => {
    try {
      const days = eachDayOfInterval({ start: parseISO(planFrom), end: parseISO(planTo) }).slice(0, 14)
      return days.map((day) => {
        const dk = format(day, 'yyyy-MM-dd')
        const dayShifts = shifts.filter((s) => s.shift_date === dk)
        if (dayShifts.length === 0) return 0
        return Math.round(dayShifts.filter((s) => s.doctor_id != null).length / dayShifts.length * 100)
      })
    } catch {
      return []
    }
  }, [shifts, planFrom, planTo])

  return (
    <div className="flex items-center gap-6 px-6 py-1.5 border-b border-line bg-card text-[12px] text-ink-2 shrink-0 flex-wrap">
      {/* Abdeckung + Sparkline */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-[22px] text-ink tabular-nums leading-none">{coverage}%</span>
          <span>Abdeckung</span>
        </div>
        {sparkline.length > 0 && (
          <div className="flex items-end gap-0.5 h-[22px]">
            {sparkline.map((v, i) => (
              <div
                key={i}
                className={cn('w-[5px] rounded-sm', v < 80 ? 'bg-warn' : 'bg-dp-accent-2')}
                style={{ height: `${Math.max(4, (v / 100) * 22)}px` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-[18px] bg-line shrink-0" />

      <div className="flex items-baseline gap-1.5">
        <span className="font-serif text-[18px] text-ink tabular-nums leading-none">{openCount}</span>
        <span>offen</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-serif text-[18px] tabular-nums leading-none', conflictCount > 0 ? 'text-warn' : 'text-ink')}>
          {conflictCount}
        </span>
        <span>Konflikte</span>
      </div>
    </div>
  )
}
