const MONTHS = [
  'januar', 'februar', 'maerz', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'dezember',
]

export function planToSlug(plan: { valid_from: string }): string {
  const d = new Date(plan.valid_from)
  return `${MONTHS[d.getMonth()]}${d.getFullYear()}`
}
