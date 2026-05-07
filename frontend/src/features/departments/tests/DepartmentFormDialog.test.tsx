import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DepartmentFormDialog } from '../DepartmentFormDialog'

afterEach(cleanup)

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function renderDialog() {
  render(
    <Wrapper>
      <DepartmentFormDialog open={true} onOpenChange={vi.fn()} />
    </Wrapper>,
  )
}

describe('DepartmentFormDialog – Validierung', () => {
  it('zeigt Fehler bei leerem Namen', async () => {
    renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(screen.getByText('Name ist erforderlich')).toBeInTheDocument()
    })
  })

  it('zeigt Fehler bei zu langem Namen (> 200 Zeichen)', async () => {
    renderDialog()

    const nameInput = screen.getByPlaceholderText(/Intensivstation/i)
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(201) } })

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(screen.getByText('Maximal 200 Zeichen')).toBeInTheDocument()
    })
  })
})

describe('DepartmentFormDialog – requires_full_time', () => {
  it('rendert den Switch "Vollzeit erforderlich"', () => {
    renderDialog()
    expect(screen.getByText('Vollzeit erforderlich')).toBeInTheDocument()
  })

  it('Switch ist standardmäßig deaktiviert', () => {
    renderDialog()
    const switches = screen.getAllByRole('switch')
    const vollzeitSwitch = switches.find((s) =>
      s.closest('[class*="rounded-md"]')?.textContent?.includes('Vollzeit'),
    )
    expect(vollzeitSwitch).toBeDefined()
    expect(vollzeitSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('Switch kann aktiviert werden', async () => {
    const user = userEvent.setup()
    renderDialog()
    const switches = screen.getAllByRole('switch')
    const vollzeitSwitch = switches.find((s) =>
      s.closest('[class*="rounded-md"]')?.textContent?.includes('Vollzeit'),
    )!
    await user.click(vollzeitSwitch)
    expect(vollzeitSwitch).toHaveAttribute('aria-checked', 'true')
  })
})

describe('DepartmentFormDialog – Sollbesetzung', () => {
  it('zeigt Mindest- und Maximalbesetzung Felder', () => {
    renderDialog()
    expect(screen.getByLabelText(/Mindestbesetzung/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Maximalbesetzung/i)).toBeInTheDocument()
  })

  it('zeigt Fehler wenn min > max', async () => {
    const user = userEvent.setup()
    renderDialog()

    const nameInput = screen.getByPlaceholderText(/Intensivstation/i)
    await user.type(nameInput, 'Test')

    const minInput = screen.getByLabelText(/Mindestbesetzung/i)
    const maxInput = screen.getByLabelText(/Maximalbesetzung/i)
    await user.type(minInput, '5')
    await user.type(maxInput, '3')

    await user.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Mindestbesetzung darf nicht größer als Maximalbesetzung/i),
      ).toBeInTheDocument()
    })
  })

  it('erlaubt nur min ohne max', async () => {
    const user = userEvent.setup()
    renderDialog()

    const nameInput = screen.getByPlaceholderText(/Intensivstation/i)
    await user.type(nameInput, 'Test')

    const minInput = screen.getByLabelText(/Mindestbesetzung/i)
    await user.type(minInput, '2')

    // Kein Validierungsfehler nach Submit (andere Fehler könnten aus API-Call kommen)
    await user.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(
        screen.queryByText(/Mindestbesetzung darf nicht größer/i),
      ).not.toBeInTheDocument()
    })
  })
})
