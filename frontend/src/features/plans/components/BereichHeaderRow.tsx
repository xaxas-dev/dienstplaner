import { useDroppable } from '@dnd-kit/core'
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
}

export function BereichHeaderRow({ department, rotationCount, onDepartmentClick }: BereichHeaderRowProps) {
  const color = getDepartmentColor(department)
  const { setNodeRef, isOver } = useDroppable({
    id: makeBereichHeaderDropId(department.id),
    data: { departmentId: department.id, departmentName: department.name },
  })

  const bg = isOver ? `${color}35` : `${color}18`

  return (
    <div className="contents">
      {/* Label-Cell: sticky, Drop-Target */}
      <div
        ref={setNodeRef}
        className="sticky left-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-line"
        onClick={() => onDepartmentClick?.(department.id)}
        style={{
          borderLeft: `4px solid ${color}`,
          backgroundColor: bg,
          cursor: onDepartmentClick ? 'pointer' : undefined,
        }}
      >
        <span className="text-xs font-semibold text-ink truncate leading-none flex-1">
          {department.short_name ?? department.name}
        </span>
        {typeof rotationCount === 'number' && department.max_headcount != null && (
          <span className="text-[10px] text-ink-3 shrink-0 tabular-nums leading-none">
            {rotationCount}/{department.max_headcount}
          </span>
        )}
      </div>
      {/* Spanning cell: füllt alle Tag-Spalten ohne interne Trennlinien */}
      <div
        className="border-b border-line"
        style={{ gridColumn: '2 / -1', backgroundColor: bg }}
      />
    </div>
  )
}
