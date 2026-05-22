/**
 * Prüft das Export-Button-Verhalten im CommandBar der PlanPage.
 * CommandBar wird isoliert mit der relevanten primaryAction getestet,
 * um das Rendern aller PlanPage-Hooks zu vermeiden.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileDown } from 'lucide-react'
import { MemoryRouter } from 'react-router-dom'
import { CommandBar } from '@/components/dp/CommandBar'

afterEach(cleanup)

function renderExportBar(onClick: () => void) {
  render(
    <MemoryRouter>
      <CommandBar
        title="Juni 2026"
        primaryAction={{
          label: 'Exportieren',
          icon: FileDown,
          onClick,
        }}
      />
    </MemoryRouter>,
  )
}

describe('PlanPage – Export-Button', () => {
  it('zeigt den Exportieren-Button wenn primaryAction gesetzt ist', () => {
    renderExportBar(vi.fn())
    expect(screen.getByRole('button', { name: /exportieren/i })).toBeInTheDocument()
  })

  it('ruft onClick auf wenn der Button geklickt wird', async () => {
    const handler = vi.fn()
    renderExportBar(handler)
    await userEvent.click(screen.getByRole('button', { name: /exportieren/i }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('zeigt keinen Exportieren-Button ohne primaryAction', () => {
    render(
      <MemoryRouter>
        <CommandBar title="Juni 2026" />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: /exportieren/i })).not.toBeInTheDocument()
  })
})
