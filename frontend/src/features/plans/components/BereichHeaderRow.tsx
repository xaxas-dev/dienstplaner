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

interface BereichHeaderRowProps {
  department: Department
  colCount: number
}

export function BereichHeaderRow({ department, colCount }: BereichHeaderRowProps) {
  const color = getDepartmentColor(department)
  const { setNodeRef, isOver } = useDroppable({
    id: makeBereichHeaderDropId(department.id),
    data: { departmentId: department.id, departmentName: department.name },
  })

  return (
    <div
      ref={setNodeRef}
      className="contents"
      style={{ '--bereich-color': color } as React.CSSProperties}
    >
      {/* Erste Spalte: Bereich-Name mit Farbleiste */}
      <div
        className="sticky left-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-card border-b border-line"
        style={{
          borderLeft: `4px solid ${color}`,
          backgroundColor: isOver ? `${color}30` : undefined,
        }}
      >
        <span className="text-xs font-semibold text-ink truncate leading-none">
          {department.short_name ?? department.name}
        </span>
      </div>
      {/* Tag-Spalten: volle Breite, Farbtönung */}
      {Array.from({ length: colCount }).map((_, i) => (
        <div
          key={i}
          className="border-b border-line"
          style={{ backgroundColor: isOver ? `${color}30` : `${color}18` }}
        />
      ))}
    </div>
  )
}
