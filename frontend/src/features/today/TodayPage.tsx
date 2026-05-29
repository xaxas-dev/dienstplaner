import { CommandBar } from '@/components/dp/CommandBar'
import { KpiTile } from '@/components/dp/KpiTile'
import { planToSlug } from '@/features/plans/planSlug'
import { Link } from 'react-router-dom'
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
  const planSlug = currentPlan ? planToSlug(currentPlan) : null
  const openCount = hasPlan && kpis ? kpis.open_shifts : 0
  const conflictCount = hasPlan && kpis ? kpis.conflicts : 0

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
              sub="zugeteilte Schichten"
            />
            {planSlug && openCount > 0 ? (
              <Link to={`/plans/${planSlug}?highlight=open`} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <KpiTile
                  value={openCount}
                  label="Offen"
                  sub="unbesetzte Schichten"
                  tone="warn"
                />
              </Link>
            ) : (
              <KpiTile
                value={hasPlan && kpis ? kpis.open_shifts : '—'}
                label="Offen"
                sub="unbesetzte Schichten"
                tone={openCount > 0 ? 'warn' : 'default'}
              />
            )}
            {planSlug && conflictCount > 0 ? (
              <Link to={`/plans/${planSlug}?highlight=conflict`} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <KpiTile
                  value={conflictCount}
                  label="Konflikte"
                  sub="Regelkonflikte"
                  tone="warn"
                />
              </Link>
            ) : (
              <KpiTile
                value={hasPlan && kpis ? kpis.conflicts : '—'}
                label="Konflikte"
                sub="Regelkonflikte"
                tone={conflictCount > 0 ? 'warn' : 'default'}
              />
            )}
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
          <div className="rounded-2xl bg-card border border-line overflow-hidden">
            {/* Hinweise */}
            <div className="p-5">
              <h2 className="text-sm font-semibold text-ink mb-3">Hinweise</h2>
              {!hasPlan || !summary || summary.attention.length === 0 ? (
                <p className="text-sm text-ink-3 italic">Keine Hinweise</p>
              ) : (
                summary.attention.map((item, i) => (
                  <AttentionRow key={i} item={item} />
                ))
              )}
            </div>
            <div className="border-t border-line" />
            {/* Stationsbesetzung */}
            <div className="p-5">
              <h2 className="text-sm font-semibold text-ink mb-3">Stationsbesetzung</h2>
              {!hasPlan || !summary || summary.coverage_by_department.length === 0 ? (
                <p className="text-sm text-ink-3 italic">Keine Daten</p>
              ) : (
                summary.coverage_by_department.map(bar => (
                  <CoverageBar key={bar.department_name} bar={bar} />
                ))
              )}
            </div>
          </div>

          {/* CTA */}
          <CtaCard plan={currentPlan ?? null} />
        </div>
      </div>
    </div>
  )
}
