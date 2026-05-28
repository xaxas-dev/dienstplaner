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
  focusMode: 'alle' | 'vn'
  selectedIndex?: number | null
}

export function ShiftTypeDragBar({ shiftTypes, focusMode, selectedIndex }: ShiftTypeDragBarProps) {
  return (
    <div
      className="flex flex-wrap gap-2 p-3 rounded-xl border border-line bg-card"
      aria-label="Dienst-Chips zum Ziehen"
    >
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide self-center">
        Dienste
      </span>
      {shiftTypes.map((st, idx) => {
        const isVN = st.short_name === 'V' || st.short_name === 'N'
        return (
          <ShiftTypeChip
            key={st.id}
            shiftType={st}
            dimmed={focusMode === 'vn' && !isVN}
            isSelected={selectedIndex === idx}
          />
        )
      })}
    </div>
  )
}

interface ShiftTypeChipProps {
  shiftType: ShiftType
  dimmed: boolean
  isSelected?: boolean
}

function ShiftTypeChip({ shiftType, dimmed, isSelected }: ShiftTypeChipProps) {
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
        isSelected && 'ring-2 ring-accent ring-offset-1',
      )}
      title={shiftType.name}
    >
      {shiftType.short_name}
    </div>
  )
}
