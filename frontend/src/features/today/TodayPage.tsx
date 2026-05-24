import { CommandBar } from '@/components/dp/CommandBar'
import { KpiTile } from '@/components/dp/KpiTile'
import { AttentionRow } from './AttentionRow'
import { CoverageBar } from './CoverageBar'
import { CtaCard } from './CtaCard'
import { DutyShiftRow } from './DutyShiftRow'
import { GreetingBlock } from './GreetingBlock'
import { useCurrentPlan } from './useCurrentPlan'
import { useDashboardSummary } from './useDashboardSummary'

export function TodayPage() {
  const now = new Date()

  const { data: currentPlan } = useCurrentPlan()
  const { data: summary } = useDashboardSummary(currentPlan?.id ?? null)

  const hasPlan = currentPlan != null
  const kpis = summary?.kpis

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <CommandBar titleAccent="Heute" title="Dashboard" showSearch />

      <div className="grid grid-cols-[1.4fr_1fr] gap-7 px-10 py-6">
        {/* LINKE SPALTE */}
        <div className="flex flex-col gap-5">
          <GreetingBlock date={now} />

          {/* KPI-Strip */}
          <div className="grid grid-cols-4 gap-3">
            <KpiTile
              value={hasPlan && kpis ? `${Math.round(kpis.coverage_pct * 100)}%` : '—'}
              label="Abdeckung"
              sub="gefüllte Schichten"
            />
            <KpiTile
              value={hasPlan && kpis ? kpis.open_shifts : '—'}
              label="Offen"
              sub="unbesetzte Schichten"
              tone={hasPlan && kpis && kpis.open_shifts > 0 ? 'warn' : 'default'}
            />
            <KpiTile
              value={hasPlan && kpis ? kpis.conflicts : '—'}
              label="Konflikte"
              sub="Regelkonflikte"
              tone={hasPlan && kpis && kpis.conflicts > 0 ? 'warn' : 'default'}
            />
            <KpiTile
              value={hasPlan && kpis ? kpis.on_leave : '—'}
              label="Im Urlaub"
              sub="heute abwesend"
            />
          </div>

          {/* Heute im Dienst */}
          <div className="rounded-2xl bg-card border border-line p-5">
            <h2 className="text-sm font-semibold text-ink mb-3">Heute im Dienst</h2>
            {!hasPlan || !summary ? (
              <p className="text-sm text-ink-3 italic">Kein Plan für diesen Monat</p>
            ) : summary.today_shifts.length === 0 ? (
              <p className="text-sm text-ink-3 italic">Keine Schichten heute</p>
            ) : (
              summary.today_shifts.map(shift => (
                <DutyShiftRow key={shift.shift_type_short_name} shift={shift} />
              ))
            )}
          </div>
        </div>

        {/* RECHTE SPALTE */}
        <div className="flex flex-col gap-5">
          {/* Aufmerksamkeit */}
          <div className="rounded-2xl bg-card border border-line p-5">
            <h2 className="text-sm font-semibold text-ink mb-3">Aufmerksamkeit</h2>
            {!hasPlan || !summary || summary.attention.length === 0 ? (
              <p className="text-sm text-ink-3 italic">Keine Hinweise</p>
            ) : (
              summary.attention.map((item, i) => (
                <AttentionRow key={i} item={item} />
              ))
            )}
          </div>

          {/* Coverage per Department */}
          <div className="rounded-2xl bg-card border border-line p-5">
            <h2 className="text-sm font-semibold text-ink mb-3">Rotationen</h2>
            {!hasPlan || !summary || summary.coverage_by_department.length === 0 ? (
              <p className="text-sm text-ink-3 italic">Keine Rotationsdaten</p>
            ) : (
              summary.coverage_by_department.map(bar => (
                <CoverageBar key={bar.department_name} bar={bar} />
              ))
            )}
          </div>

          {/* CTA */}
          <CtaCard plan={currentPlan ?? null} />
        </div>
      </div>
    </div>
  )
}
