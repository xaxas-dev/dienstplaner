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
  rotationDoctorIds?: Set<number>
  highlightedDoctorId?: number | null
  onHighlightDoctor?: (doctorId: number | null) => void
  locked?: boolean
}

export function DoctorDragSource({
  doctors,
  rotationDoctorIds = new Set(),
  highlightedDoctorId,
  onHighlightDoctor,
  locked = false,
}: DoctorDragSourceProps) {
  const activeDoctors = doctors.filter((d) => d.active)
  const assigned = activeDoctors.filter((d) => rotationDoctorIds.has(d.id))
  const available = activeDoctors.filter((d) => !rotationDoctorIds.has(d.id))

  return (
    <aside
      aria-label="Ärzte"
      className="w-48 shrink-0 flex flex-col gap-3 p-3 rounded-2xl border border-line bg-card overflow-y-auto"
    >
      {locked && (
        <p className="text-[11px] text-ink-3 italic px-1">
          Besetzung gesperrt — nur Kontext
        </p>
      )}
      {available.length > 0 && (
        <section>
          <div className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">
            Verfügbar
          </div>
          <ul className="flex flex-col gap-1">
            {available.map((doctor) => (
              <li key={doctor.id}>
                <DoctorToken doctor={doctor} locked={locked} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {assigned.length > 0 && (
        <section>
          <div className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-1">
            Zugeteilt
          </div>
          <ul className="flex flex-col gap-0.5">
            {assigned.map((doctor) => (
              <li key={doctor.id}>
                <AssignedDoctorToken
                  doctor={doctor}
                  isHighlighted={highlightedDoctorId === doctor.id}
                  onHighlight={() =>
                    onHighlightDoctor?.(
                      highlightedDoctorId === doctor.id ? null : doctor.id,
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {assigned.length === 0 && available.length === 0 && (
        <p className="text-xs text-ink-3 italic">Keine aktiven Ärzte.</p>
      )}
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

interface AssignedDoctorTokenProps {
  doctor: Doctor
  isHighlighted: boolean
  onHighlight: () => void
}

function AssignedDoctorToken({ doctor, isHighlighted, onHighlight }: AssignedDoctorTokenProps) {
  return (
    <button
      type="button"
      onClick={onHighlight}
      title="Im Grid markieren"
      className={[
        'w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left transition',
        'focus:outline-none focus:ring-2 focus:ring-accent',
        isHighlighted
          ? 'bg-accent/10 ring-1 ring-accent/40'
          : 'hover:bg-paper',
      ].join(' ')}
    >
      <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={24} />
      <span className="text-sm text-ink truncate">{doctor.name}</span>
    </button>
  )
}

interface DoctorTokenProps {
  doctor: Doctor
  locked?: boolean
}

function DoctorToken({ doctor, locked = false }: DoctorTokenProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeDoctorDragId(doctor.id),
    data: { doctorId: doctor.id, doctorName: doctor.name },
    disabled: locked,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(locked ? {} : attributes)}
      {...(locked ? {} : listeners)}
      {...(locked ? {} : { 'aria-roledescription': 'ziehbarer Arzt' })}
      className={[
        'w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left',
        'transition hover:bg-paper',
        'focus:outline-none focus:ring-2 focus:ring-accent',
        locked ? 'cursor-default opacity-70' : 'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={24} />
      <span className="text-sm text-ink truncate">{doctor.name}</span>
    </button>
  )
}
