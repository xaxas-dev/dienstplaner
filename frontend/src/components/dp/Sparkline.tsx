import { COLORS } from '@/lib/design/tokens'

export function Sparkline({
  values,
  threshold = 0.8,
  height = 28,
}: {
  values: number[]   // each 0..1
  threshold?: number
  height?: number
}) {
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${Math.max(v, 0.05) * 100}%`,
            backgroundColor: v < threshold ? COLORS.warn : COLORS.accent2,
            opacity: v < threshold ? 0.9 : 0.7,
          }}
        />
      ))}
    </div>
  )
}
