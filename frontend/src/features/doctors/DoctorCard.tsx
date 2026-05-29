import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { Avatar } from '@/components/dp/Avatar'
import { Chip } from '@/components/dp/Chip'
import { ShiftHeatmap14 } from '@/components/dp/ShiftHeatmap14'
import { getCurrentEmploymentPeriod } from './doctorHelpers'
import type { Doctor, ShiftWithDetails } from '@/lib/types'

function roleLabel(doctor: Doctor): string {
  if (doctor.doctor_type === 'EXTERNAL') return doctor.is_facharzt ? 'Facharzt (Extern)' : 'Extern'
  if (doctor.is_facharzt) return 'Facharzt'
  if (doctor.weiterbildungsjahr != null) return `Assistenzarzt ${doctor.weiterbildungsjahr}`
  return 'Assistenzarzt'
}

interface DoctorCardProps {
  doctor: Doctor
  doctorShifts?: ShiftWithDetails[]
}

export function DoctorCard({ doctor, doctorShifts }: DoctorCardProps) {
  const currentPeriod = getCurrentEmploymentPeriod(doctor.employment_periods)
  const pct = currentPeriod ? `${currentPeriod.employment_percentage} %` : null
  const subLine = [roleLabel(doctor), pct].filter(Boolean).join(' · ')

  const today = new Date().toISOString().slice(0, 10)
  const shiftMap = new Map((doctorShifts ?? []).map((s) => [s.shift_date, s]))
  const heatmapShifts = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const date = d.toISOString().slice(0, 10)
    const shift = shiftMap.get(date)
    return { date, shiftType: shift?.shift_type ?? undefined }
  })

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-line hover:shadow-sm transition-all">
      <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={30} />

      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-ink">
          {doctor.title ? `${doctor.title} ` : ''}{doctor.name}
        </span>
        <span className="text-xs text-ink-3 ml-2">{subLine}</span>
        {!doctor.active && (
          <span className="ml-2 rounded-full bg-line text-ink-3 border border-line-2 px-1.5 py-0.5 text-[10px] font-medium leading-none">
            Inaktiv
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {doctor.qualifications.slice(0, 2).map((q) => (
          <Chip key={q.id} variant="soft" className="text-[10px] px-1.5 py-0.5">
            {q.name}
          </Chip>
        ))}
        {doctor.qualifications.length > 2 && (
          <span className="text-[10px] text-ink-3">+{doctor.qualifications.length - 2}</span>
        )}
      </div>

      <div className="w-28 shrink-0">
        <ShiftHeatmap14 shifts={heatmapShifts} />
      </div>

      <Link
        to={`/doctors/${doctor.id}`}
        aria-label="Details"
        className="text-ink-3 hover:text-dp-accent transition-colors shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Pencil className="size-3.5" />
      </Link>
    </div>
  )
}
