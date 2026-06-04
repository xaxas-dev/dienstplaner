import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FairnessSidebar } from '../components/FairnessSidebar'
import type { FairnessStat } from '../fairnessUtils'

const STATS: FairnessStat[] = [
  {
    doctorId: 1,
    doctorName: 'Müller, Anna',
    shortName: 'AM',
    total: 3,
    byGroup: { Nacht: 2, Tag: 1 },
  },
  {
    doctorId: 2,
    doctorName: 'Schmidt, Bert',
    shortName: 'BS',
    total: 1,
    byGroup: { Nacht: 1, Tag: 0 },
  },
]
const GROUPS = ['Nacht', 'Tag']

describe('FairnessSidebar', () => {
  it('renders group headers and sum column', () => {
    render(<FairnessSidebar stats={STATS} groups={GROUPS} onClose={vi.fn()} />)

    expect(screen.getByText('Nacht')).toBeInTheDocument()
    expect(screen.getByText('Tag')).toBeInTheDocument()
    expect(screen.getByText('∑')).toBeInTheDocument()
  })

  it('renders short names for each doctor', () => {
    render(<FairnessSidebar stats={STATS} groups={GROUPS} onClose={vi.fn()} />)

    expect(screen.getByText('AM')).toBeInTheDocument()
    expect(screen.getByText('BS')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FairnessSidebar stats={STATS} groups={GROUPS} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /schließen/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows empty-state message when stats is empty', () => {
    render(<FairnessSidebar stats={[]} groups={[]} onClose={vi.fn()} />)

    expect(screen.getByText(/keine ärzte/i)).toBeInTheDocument()
  })
})
