import { useEffect, useRef } from 'react'
import type { Department, ShiftType } from '@/lib/types'

interface ShiftBlockPopoverProps {
  selectedCount: number
  shiftTypes: ShiftType[]
  onSelectShiftType: (shiftTypeId: number) => void
  onRemoveAll: () => void
  onClose: () => void
  departments: Department[]
  onAssignSpringer: (departmentId: number) => void
}

export function ShiftBlockPopover({
  selectedCount,
  shiftTypes,
  onSelectShiftType,
  onRemoveAll,
  onClose,
  departments,
  onAssignSpringer,
}: ShiftBlockPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 9) {
        const st = shiftTypes[digit - 1]
        if (st) onSelectShiftType(st.id)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, shiftTypes, onSelectShiftType])

  const activeDepts = departments.filter((d) => d.active)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={cardRef}
        className="bg-card border border-line rounded-2xl shadow-lg w-72 p-4 space-y-3"
      >
        <div className="space-y-1.5">
          <p className="text-xs text-ink-3 font-medium">
            {selectedCount} {selectedCount === 1 ? 'Zelle' : 'Zellen'} — Schicht wählen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shiftTypes.map((st, i) => (
              <button
                key={st.id}
                onClick={() => onSelectShiftType(st.id)}
                title={i < 9 ? `Taste ${i + 1}` : undefined}
                className="relative px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
              >
                {i < 9 && (
                  <span className="absolute -top-1.5 -right-1 text-[8px] font-normal text-ink-3 leading-none bg-card border border-line rounded px-0.5">
                    {i + 1}
                  </span>
                )}
                {st.short_name}
              </button>
            ))}
          </div>
          {shiftTypes.length === 0 && (
            <p className="text-xs text-ink-3">Keine Schichttypen verfügbar.</p>
          )}
        </div>

        {activeDepts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-3 font-medium">Als Springer einteilen</p>
            <div className="flex flex-wrap gap-1.5">
              {activeDepts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onAssignSpringer(d.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
                >
                  {d.short_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onRemoveAll}
          className="w-full text-xs text-warn-ink hover:bg-warn-bg py-1 rounded-md transition"
        >
          Alle Zuweisungen entfernen
        </button>
        <button
          onClick={onClose}
          className="w-full text-xs text-ink-3 hover:text-ink py-1 transition"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
