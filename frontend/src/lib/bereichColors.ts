import type { Department } from './types'

// Excel-nahe Fallback-Palette; greift wenn Department.color null ist
const FALLBACK_PALETTE = [
  '#FBE5D6', // Sand/Hellbraun (5N, LBEST)
  '#DBEAFE', // Hellblau (ITS)
  '#FFEDD5', // Orange (SU)
  '#FEF9C3', // Gelb (Poli)
  '#CCFBF1', // Türkis (EMG)
  '#EDE9FE', // Lila (Springer)
  '#DCFCE7', // Grün (Forschung)
  '#FCE7F3', // Rosa (CK)
] as const

export function getDepartmentColor(department: Pick<Department, 'color' | 'display_order'>): string {
  if (department.color) return department.color
  const idx = Math.abs(department.display_order) % FALLBACK_PALETTE.length
  return FALLBACK_PALETTE[idx]
}

export function getDepartmentColorMuted(
  department: Pick<Department, 'color' | 'display_order'>,
): string {
  return getDepartmentColor(department) + '40' // 25% opacity via hex alpha
}
