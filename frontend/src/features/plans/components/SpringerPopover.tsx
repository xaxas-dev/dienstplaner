import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCreateSpringerAssignment } from '../useSpringerAssignments'
import type { Department } from '@/lib/types'

interface SpringerPopoverProps {
  planId: number
  doctorId: number
  dayKey: string
  currentDepartmentId: number
  departments: Department[]
  onClose: () => void
}

export function SpringerPopover({
  planId,
  doctorId,
  dayKey,
  currentDepartmentId,
  departments,
  onClose,
}: SpringerPopoverProps) {
  const { mutate, isPending } = useCreateSpringerAssignment()
  const cardRef = useRef<HTMLDivElement>(null)

  const availableDepts = departments.filter(
    (d) => d.active && d.id !== currentDepartmentId,
  )

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
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function assign(dept: Department) {
    mutate(
      { planId, shiftDate: dayKey, doctorId, targetDepartmentId: dept.id },
      {
        onSuccess: () => {
          toast.success(`Springer → ${dept.short_name ?? dept.name}`)
          onClose()
        },
        onError: () => {
          toast.error('Springer-Zuweisung fehlgeschlagen')
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        ref={cardRef}
        className="bg-card border border-line rounded-2xl shadow-xl p-5 min-w-[240px] max-w-xs"
      >
        <p className="text-[13px] font-semibold text-ink mb-1">Springer-Station wählen</p>
        <p className="text-[11px] text-ink-3 mb-3">{dayKey}</p>

        {availableDepts.length === 0 ? (
          <p className="text-[12px] text-ink-3">Keine weiteren Stationen verfügbar.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {availableDepts.map((dept) => (
              <button
                key={dept.id}
                type="button"
                disabled={isPending}
                onClick={() => assign(dept)}
                className="text-left px-3 py-2 rounded-xl text-[12.5px] font-medium text-ink hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-50"
              >
                <span className="font-bold">{dept.short_name ?? '—'}</span>
                <span className="text-ink-3 ml-2">{dept.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  )
}
