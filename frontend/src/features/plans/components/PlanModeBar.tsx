import React from 'react'
import { ChevronRight, MoonStar, Settings, Zap } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'
import type { ShiftType, AbsenceType } from '@/lib/types'

// ─── DnD Helpers ──────────────────────────────────────────────────────────────
export const SHIFT_TYPE_DRAG_ID_PREFIX = 'shift-'

export function makeShiftTypeDragId(shiftTypeId: number): string {
  return `${SHIFT_TYPE_DRAG_ID_PREFIX}${shiftTypeId}`
}

export function parseShiftTypeDragId(id: string): number | null {
  if (!id.startsWith(SHIFT_TYPE_DRAG_ID_PREFIX)) return null
  const n = Number(id.slice(SHIFT_TYPE_DRAG_ID_PREFIX.length))
  return Number.isFinite(n) ? n : null
}

export const ABSENCE_DRAG_ID_PREFIX = 'absence-'

const VALID_ABSENCE_TYPES: AbsenceType[] = [
  'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES',
]

export function makeAbsenceDragId(type: AbsenceType): string {
  return `${ABSENCE_DRAG_ID_PREFIX}${type}`
}

export function parseAbsenceDragId(id: string): AbsenceType | null {
  if (!id.startsWith(ABSENCE_DRAG_ID_PREFIX)) return null
  const type = id.slice(ABSENCE_DRAG_ID_PREFIX.length) as AbsenceType
  return VALID_ABSENCE_TYPES.includes(type) ? type : null
}

const ABSENCE_CHIP_META: Record<AbsenceType, { short: string; full: string }> = {
  URLAUB:       { short: 'U',      full: 'Urlaub' },
  KRANKHEIT:    { short: 'K',      full: 'Krankheit' },
  FORTBILDUNG:  { short: 'FB',     full: 'Fortbildung' },
  ELTERNZEIT:   { short: 'EZ',     full: 'Elternzeit' },
  MUTTERSCHUTZ: { short: 'MuSchu', full: 'Mutterschutz' },
  SONSTIGES:    { short: 'DIV',    full: 'Sonstiges' },
}

// ─── Segments ─────────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 'besetzung' as const, step: '1', label: 'Besetzung planen', sub: 'Stationen · Urlaub · Nachtwochen' },
  { id: 'ina' as const, step: '2', label: 'INA planen', sub: 'V · T · N-Dienste setzen' },
]

export interface PlanModeBarProps {
  mode: 'besetzung' | 'ina'
  onModeChange: (mode: 'besetzung' | 'ina') => void
  shiftTypes: ShiftType[]
  activeFilterGroups: Set<string>
  onFilterGroupToggle: (group: string) => void
  onFilterGroupClear: () => void
  solverEnabled: boolean
  isSolving: boolean
  onSolve: () => void
  onNachtwocheClick: () => void
  onSettingsClick: () => void
}

export function PlanModeBar({
  mode, onModeChange, shiftTypes,
  activeFilterGroups, onFilterGroupToggle, onFilterGroupClear,
  solverEnabled, isSolving, onSolve,
  onNachtwocheClick, onSettingsClick,
}: PlanModeBarProps) {
  const sortedShiftTypes = [...shiftTypes].sort((a, b) => a.display_order - b.display_order)
  const filterGroups = [
    ...new Set(shiftTypes.map((st) => st.filter_group).filter((g): g is string => g != null)),
  ].sort()

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
                <span className={cn(
                  'w-[22px] h-[22px] rounded-full inline-flex items-center justify-center font-serif text-[13px] shrink-0',
                  active ? 'bg-dp-accent text-[#FFF8EF]' : 'bg-line text-ink-3',
                )}>
                  {seg.step}
                </span>
                <span className="text-left">
                  <span className={cn('block text-[12.5px] font-semibold leading-[1.2]', active ? 'text-[#FBF6E8]' : 'text-ink-2')}>
                    {seg.label}
                  </span>
                  <span className={cn('block text-[9.5px] leading-[1.3]', active ? 'text-[rgba(251,246,232,0.52)]' : 'text-ink-3')}>
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

      {/* Chips + Nachtwoche */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sortedShiftTypes.map((st) => (
          <ShiftTypeDraggableChip
            key={st.id}
            shiftType={st}
            dimmed={activeFilterGroups.size > 0 && st.filter_group != null && !activeFilterGroups.has(st.filter_group)}
          />
        ))}

        <span className="text-line-2 mx-0.5">|</span>
        <span className="text-[10px] text-ink-3 uppercase tracking-[0.07em]">Abwesenheiten</span>

        {VALID_ABSENCE_TYPES.map((type) => (
          <AbsenceDraggableChip key={type} absenceType={type} />
        ))}

        {mode === 'besetzung' && (
          <>
            <span className="text-line-2 mx-0.5">|</span>
            <button
              type="button"
              onClick={onNachtwocheClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-card border border-line text-ink-2 hover:bg-line/20 transition-colors"
            >
              <MoonStar className="size-3" />
              Nachtwoche
            </button>
          </>
        )}

        {filterGroups.length > 0 && (
          <>
            <span className="text-line-2 mx-0.5">|</span>
            <button
              onClick={onFilterGroupClear}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium border transition',
                activeFilterGroups.size === 0
                  ? 'bg-accent text-white border-accent'
                  : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
              )}
            >
              Alle
            </button>
            {filterGroups.map((group) => (
              <button
                key={group}
                onClick={() => onFilterGroupToggle(group)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium border transition',
                  activeFilterGroups.has(group)
                    ? 'bg-accent text-white border-accent'
                    : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
                )}
              >
                {group}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Rechts: Settings + Plan generieren */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Plan-Einstellungen"
          className="w-[30px] h-[30px] rounded-[8px] border border-line bg-card text-ink-2 flex items-center justify-center hover:bg-paper transition-colors"
        >
          <Settings className="size-3.5" />
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
    </div>
  )
}

// ─── Sub-Components ────────────────────────────────────────────────────────────
function ShiftTypeDraggableChip({ shiftType, dimmed }: { shiftType: ShiftType; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeShiftTypeDragId(shiftType.id),
    data: { shiftTypeId: shiftType.id, shortName: shiftType.short_name },
  })
  const pal = colorForShiftType({ id: shiftType.id, code: shiftType.short_name })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={shiftType.name}
      className={cn(
        'inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-bold cursor-grab select-none active:cursor-grabbing',
        isDragging && 'opacity-40 cursor-grabbing',
        dimmed && 'opacity-40',
      )}
      style={{ background: pal.bg, color: pal.fg }}
    >
      {shiftType.short_name}
    </div>
  )
}

function AbsenceDraggableChip({ absenceType }: { absenceType: AbsenceType }) {
  const { short, full } = ABSENCE_CHIP_META[absenceType]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeAbsenceDragId(absenceType),
    data: { absenceType },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={full}
      className={cn(
        'inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium cursor-grab select-none',
        'bg-card border border-line text-ink-2 hover:bg-line/20 active:cursor-grabbing',
        isDragging && 'opacity-40 cursor-grabbing',
      )}
    >
      {short}
    </div>
  )
}
