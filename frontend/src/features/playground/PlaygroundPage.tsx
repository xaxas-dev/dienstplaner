import { Chip } from '@/components/dp/Chip'
import { ShiftChip } from '@/components/dp/ShiftChip'
import { ShiftCell } from '@/components/dp/ShiftCell'
import { Avatar } from '@/components/dp/Avatar'
import { KpiTile } from '@/components/dp/KpiTile'
import { Sparkline } from '@/components/dp/Sparkline'
import { MOCK_COVERAGE_14D } from '@/lib/mock/dp-mock'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-3">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  )
}

export function PlaygroundPage() {
  return (
    <div className="p-10 space-y-10 max-w-4xl">
      <div>
        <h1 className="dp-h1 text-[28px] text-ink">Playground</h1>
        <p className="text-sm text-ink-3 mt-1">Komponentenvorschau — nur in dev erreichbar</p>
      </div>

      {/* Chip */}
      <Section title="Chip">
        <Chip variant="default">Standard</Chip>
        <Chip variant="active">Aktiv</Chip>
        <Chip variant="accent">Akzent</Chip>
        <Chip variant="muted">Gedämpft</Chip>
        <Chip variant="ok">OK</Chip>
        <Chip variant="default" dot>Mit Dot</Chip>
        <Chip variant="active" dot>Aktiv + Dot</Chip>
        <Chip variant="accent" dot>Akzent + Dot</Chip>
        <Chip variant="muted" dot>Gedämpft + Dot</Chip>
        <Chip variant="ok" dot>OK + Dot</Chip>
      </Section>

      {/* ShiftChip */}
      <Section title="ShiftChip">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col gap-2 items-start">
            <span className="text-[10px] text-ink-3 font-medium">md (default)</span>
            <ShiftChip code="V"  shiftTypeId={1} />
            <ShiftChip code="T"  shiftTypeId={2} />
            <ShiftChip code="N"  shiftTypeId={3} />
            <ShiftChip code="T1" shiftTypeId={4} />
            <ShiftChip code="X"  />
          </div>
          <div className="flex flex-col gap-2 items-start ml-6">
            <span className="text-[10px] text-ink-3 font-medium">sm</span>
            <ShiftChip code="V"  shiftTypeId={1} size="sm" />
            <ShiftChip code="T"  shiftTypeId={2} size="sm" />
            <ShiftChip code="N"  shiftTypeId={3} size="sm" />
            <ShiftChip code="T1" shiftTypeId={4} size="sm" />
            <ShiftChip code="X"  size="sm" />
          </div>
        </div>
      </Section>

      {/* ShiftCell */}
      <Section title="ShiftCell">
        <div className="grid grid-cols-5 gap-2" style={{ width: 240 }}>
          <div className="flex flex-col items-center gap-1">
            <div style={{ width: 44, height: 44 }}>
              <ShiftCell />
            </div>
            <span className="text-[9px] text-ink-3">Leer</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div style={{ width: 44, height: 44 }}>
              <ShiftCell code="V" shiftTypeId={1} />
            </div>
            <span className="text-[9px] text-ink-3">V</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div style={{ width: 44, height: 44 }}>
              <ShiftCell code="N" shiftTypeId={3} conflict />
            </div>
            <span className="text-[9px] text-ink-3">Konflikt</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div style={{ width: 44, height: 44 }}>
              <ShiftCell code="T" shiftTypeId={2} weekend />
            </div>
            <span className="text-[9px] text-ink-3">WE</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div style={{ width: 44, height: 44 }}>
              <ShiftCell code="T1" shiftTypeId={4} today />
            </div>
            <span className="text-[9px] text-ink-3">Heute</span>
          </div>
        </div>
      </Section>

      {/* Avatar */}
      <Section title="Avatar">
        {[
          { name: 'Lena Hartmann', id: 1, size: 44 },
          { name: 'Jonas Krüger',  id: 2, size: 44 },
          { name: 'Mira Sahin',    id: 3, size: 44 },
          { name: 'David Brand',   id: 4, size: 32 },
          { name: 'Aylin Yıldız',  id: 5, size: 32 },
          { name: 'Paul Reichardt',id: 6, size: 24 },
        ].map(({ name, id, size }) => (
          <div key={id} className="flex flex-col items-center gap-1">
            <Avatar name={name} id={id} size={size} />
            <span className="text-[9px] text-ink-3">{size}px</span>
          </div>
        ))}
      </Section>

      {/* KpiTile */}
      <Section title="KpiTile">
        <KpiTile value="87%" label="Abdeckung" sub="Mai 2026" />
        <KpiTile value="3"   label="Konflikte" sub="Regelverstoß" tone="warn" />
        <KpiTile value="12"  label="Dienste geplant" sub="diese Woche" tone="ok" />
      </Section>

      {/* Sparkline */}
      <Section title="Sparkline">
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-[10px] text-ink-3 block mb-1">14-Tage-Abdeckung (height 28)</span>
            <Sparkline values={MOCK_COVERAGE_14D} height={28} />
          </div>
          <div>
            <span className="text-[10px] text-ink-3 block mb-1">Niedrige Werte rot (height 44)</span>
            <Sparkline values={[0.5, 0.6, 0.75, 0.82, 0.9, 0.7, 0.65, 0.95, 1.0, 0.88, 0.72, 0.6, 0.55, 0.8]} height={44} />
          </div>
        </div>
      </Section>
    </div>
  )
}
