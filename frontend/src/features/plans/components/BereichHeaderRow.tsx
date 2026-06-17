import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
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
  onDepartmentClick?: (departmentId: number) => void
  onAddRotation?: () => void
}

export function BereichHeaderRow({ department, rotationCount, onDepartmentClick, onAddRotation }: BereichHeaderRowProps) {
  const color = getDepartmentColor(department)
  const { setNodeRef, isOver } = useDroppable({
    id: makeBereichHeaderDropId(department.id),
    data: { departmentId: department.id, departmentName: department.name },
  })

  const bg = isOver ? `${color}35` : `${color}18`

  return (
    <div className="contents">
      <div
        ref={setNodeRef}
        className="group sticky left-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-line"
        onClick={() => onDepartmentClick?.(department.id)}
        style={{
          gridColumn: '1 / -1',
          borderLeft: `4px solid ${color}`,
          backgroundColor: bg,
          cursor: onDepartmentClick ? 'pointer' : undefined,
        }}
      >
        <span className="text-xs font-semibold text-ink leading-none flex-1">
          {department.name}{department.short_name ? ` (${department.short_name})` : ''}
        </span>
        {typeof rotationCount === 'number' && department.max_headcount != null && (
          <span className="text-[10px] text-ink-3 shrink-0 tabular-nums leading-none">
            {rotationCount}/{department.max_headcount}
          </span>
        )}
        {onAddRotation && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddRotation() }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 shrink-0"
            aria-label="Arzt hinzufügen"
            title="Arzt hinzufügen"
          >
            <Plus className="size-3 text-ink" />
          </button>
        )}
      </div>
    </div>
  )
}
