import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { ShiftType } from '@/lib/types'

export const SHIFT_TYPE_DRAG_ID_PREFIX = 'shift-'

export function makeShiftTypeDragId(shiftTypeId: number): string {
  return `${SHIFT_TYPE_DRAG_ID_PREFIX}${shiftTypeId}`
}

export function parseShiftTypeDragId(id: string): number | null {
  if (!id.startsWith(SHIFT_TYPE_DRAG_ID_PREFIX)) return null
  const raw = id.slice(SHIFT_TYPE_DRAG_ID_PREFIX.length)
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

interface ShiftTypeDragBarProps {
  shiftTypes: ShiftType[]
  activeFilterGroups: Set<string>
  onFilterGroupToggle: (group: string) => void
  onFilterGroupClear: () => void
}

export function ShiftTypeDragBar({
  shiftTypes,
  activeFilterGroups,
  onFilterGroupToggle,
  onFilterGroupClear,
}: ShiftTypeDragBarProps) {
  const groups = [
    ...new Set(
      shiftTypes
        .map((st) => st.filter_group)
        .filter((g): g is string => g != null),
    ),
  ].sort()

  return (
    <div
      className="flex flex-wrap gap-2 p-3 rounded-xl border border-line bg-card"
      aria-label="Dienst-Chips zum Ziehen"
    >
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide self-center">
        Dienste
      </span>
      {shiftTypes.map((st) => (
        <ShiftTypeChip
          key={st.id}
          shiftType={st}
          dimmed={
            activeFilterGroups.size > 0 &&
            st.filter_group != null &&
            !activeFilterGroups.has(st.filter_group)
          }
        />
      ))}
      {groups.length > 0 && (
        <div className="ml-auto flex gap-1 self-center flex-wrap">
          <button
            onClick={onFilterGroupClear}
            className={[
              'px-3 py-1 rounded-lg text-xs font-medium border transition',
              activeFilterGroups.size === 0
                ? 'bg-accent text-white border-accent'
                : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
            ].join(' ')}
          >
            Alle
          </button>
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => onFilterGroupToggle(group)}
              className={[
                'px-3 py-1 rounded-lg text-xs font-medium border transition',
                activeFilterGroups.has(group)
                  ? 'bg-accent text-white border-accent'
                  : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
              ].join(' ')}
            >
              {group}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ShiftTypeChipProps {
  shiftType: ShiftType
  dimmed: boolean
}

function ShiftTypeChip({ shiftType, dimmed }: ShiftTypeChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeShiftTypeDragId(shiftType.id),
    data: { shiftTypeId: shiftType.id, shiftTypeName: shiftType.name, shortName: shiftType.short_name },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'px-2.5 py-1 rounded-md border border-line text-[11px] font-semibold cursor-grab select-none',
        'bg-paper text-ink hover:bg-accent/10 active:cursor-grabbing',
        isDragging && 'opacity-40 cursor-grabbing',
        dimmed && 'opacity-40',
      )}
      title={shiftType.name}
    >
      {shiftType.short_name}
    </div>
  )
}
