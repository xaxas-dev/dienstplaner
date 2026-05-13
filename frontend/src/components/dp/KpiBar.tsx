import { KpiTile } from './KpiTile'

// Empfohlene Anzahl Tiles: 4–6. Bei N > 6 scrollt der Container horizontal.
interface KpiBarTile {
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'warn' | 'ok'
}

interface KpiBarProps {
  tiles: KpiBarTile[]
}

export function KpiBar({ tiles }: KpiBarProps) {
  return (
    <div className="bg-card border border-line rounded-2xl p-4 overflow-x-auto">
      <div className="flex gap-3">
        {tiles.map((tile, i) => (
          <div key={i} className="shrink-0">
            <KpiTile
              value={tile.value}
              label={tile.label}
              sub={tile.sub}
              tone={tile.tone}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
