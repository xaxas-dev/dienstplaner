const STORAGE_KEY = 'dp-command-palette-recents'
const MAX_RECENTS = 5

export interface RecentItem {
  id: string
  label: string
  group: string
}

export function getRecents(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecentItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        typeof item.group === 'string'
    )
  } catch {
    return []
  }
}

export function pushRecent(item: RecentItem): void {
  const existing = getRecents().filter((r) => r.id !== item.id)
  const updated = [item, ...existing].slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function clearRecents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // silently ignore
  }
}
