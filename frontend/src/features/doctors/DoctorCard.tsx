import { Link } from 'react-router-dom'
import { Avatar } from '@/components/dp/Avatar'
import { Chip } from '@/components/dp/Chip'
import { ShiftHeatmap14 } from '@/components/dp/ShiftHeatmap14'
import { getCurrentEmploymentPeriod } from './doctorHelpers'
import type { Doctor } from '@/lib/types'

function roleLabel(doctor: Doctor): string {
  if (doctor.doctor_type === 'EXTERNAL') return 'Extern'
  if (doctor.is_facharzt) return 'Facharzt'
  if (doctor.weiterbildungsjahr != null) return `WBA · WBJ ${doctor.weiterbildungsjahr}`
  return 'Assistenzarzt'
}

interface DoctorCardProps {
  doctor: Doctor
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  const currentPeriod = getCurrentEmploymentPeriod(doctor.employment_periods)
  const pct = currentPeriod ? `${currentPeriod.employment_percentage} %` : null
  const subLine = [roleLabel(doctor), pct].filter(Boolean).join(' · ')

  return (
    <div className="rounded-2xl bg-card border border-line p-5 flex flex-col gap-3 hover:-translate-y-px hover:shadow transition-all">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar name={doctor.name} shortName={doctor.short_name} id={doctor.id} size={44} />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-[19px] leading-tight text-ink truncate">
            {doctor.name}
          </p>
          <p className="text-xs text-ink-2 mt-0.5">{subLine}</p>
        </div>
        {!doctor.active && (
          <span className="shrink-0 rounded-full bg-line text-ink-3 border border-line-2 px-2 py-0.5 text-[10px] font-medium leading-none">
            Inaktiv
          </span>
        )}
      </div>

      {/* Quals */}
      {doctor.qualifications.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {doctor.qualifications.map((q) => (
            <Chip key={q.id} variant="soft" className="text-[11px] px-2 py-0.5">
              {q.name}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-ink-3">—</p>
      )}

      {/* Heatmap */}
      <div>
        <p className="text-[10px] text-ink-3 uppercase tracking-wide mb-1">Nächste 14 Tage</p>
        {/* shifts: leeres Array — Hook kommt nach Solver (M2-003) */}
        <ShiftHeatmap14 shifts={[]} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-line">
        <span className="text-xs text-ink-2">—</span>
        <Link
          to={`/doctors/${doctor.id}`}
          className="text-xs text-dp-accent hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          Details →
        </Link>
      </div>
    </div>
  )
}
