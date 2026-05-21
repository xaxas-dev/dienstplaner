import { hueFromId } from '@/lib/design/tokens'

export function Avatar({
  name,
  shortName,
  id,
  size = 32,
}: {
  name: string
  shortName?: string | null
  id: number | string
  size?: number
}) {
  const hue = hueFromId(id)
  const cleanShortName = shortName?.trim()
  const initials = cleanShortName
    ? cleanShortName.toUpperCase()
    : name
        .replace(/^(Prof\.?\s+Dr\.?|Prof\.?|Dr\.?|PD)\s+/i, '')
        .split(/\s+/)
        .filter(Boolean)
        .map(p => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
  return (
    <span
      className="inline-grid place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: `oklch(0.86 0.08 ${hue})`,
        color: `oklch(0.32 0.12 ${hue})`,
      }}
    >
      {initials}
    </span>
  )
}
