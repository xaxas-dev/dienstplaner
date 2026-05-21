import { useDraggable } from '@dnd-kit/core'
import { Avatar } from '@/components/dp/Avatar'
import type { Doctor } from '@/lib/types'

export const DOCTOR_DRAG_ID_PREFIX = 'doctor-'

export function makeDoctorDragId(doctorId: number): string {
  return `${DOCTOR_DRAG_ID_PREFIX}${doctorId}`
}

export function parseDoctorDragId(id: string): number | null {
  if (!id.startsWith(DOCTOR_DRAG_ID_PREFIX)) return null
  const raw = id.slice(DOCTOR_DRAG_ID_PREFIX.length)
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

interface DoctorDragSourceProps {
  doctors: Doctor[]
}

export function DoctorDragSource({ doctors }: DoctorDragSourceProps) {
  return (
    <aside
      aria-label="Ärzte zum Ziehen"
      className="w-48 shrink-0 flex flex-col gap-2 p-3 rounded-2xl border border-line bg-card overflow-y-auto"
    >
      <div className="text-xs font-medium text-ink-3 uppercase tracking-wide">
        Ärzte
      </div>
      <ul className="flex flex-col gap-1">
        {doctors.map((doctor) => (
          <li key={doctor.id}>
            <DoctorToken doctor={doctor} />
          </li>
        ))}
      </ul>
    </aside>
  )
}

interface DoctorDragOverlayTokenProps {
  name: string
  shortName?: string | null
  id: number
}

export function DoctorDragOverlayToken({ name, shortName, id }: DoctorDragOverlayTokenProps) {
  return <Avatar name={name} shortName={shortName} id={id} size={28} />
}

interface DoctorTokenProps {
  doctor: Doctor
}

function DoctorToken({ doctor }: DoctorTokenProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeDoctorDragId(doctor.id),
    data: { doctorId: doctor.id, doctorName: doctor.name },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription="ziehbarer Arzt"
      className={[
        'w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left',
        'transition hover:bg-paper',
        'focus:outline-none focus:ring-2 focus:ring-accent',
        'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={24} />
      <span className="text-sm text-ink truncate">{doctor.name}</span>
    </button>
  )
}
