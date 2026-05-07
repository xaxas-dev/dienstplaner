import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { RuleOverrideFormDialog } from '../RuleOverrideFormDialog'

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
      <RuleOverrideFormDialog open={true} onOpenChange={vi.fn()} />
    </Wrapper>,
  )
}

describe('RuleOverrideFormDialog – Validierung', () => {
  it('zeigt Fehler bei scope=DOCTOR ohne Arzt', async () => {
    renderDialog()

    // Pflichtfelder füllen
    fireEvent.change(screen.getByPlaceholderText(/max_bereitschaft/i), {
      target: { value: 'max_bereitschaft_per_month' },
    })
    fireEvent.change(screen.getByPlaceholderText(/z\.B\. 4/i), {
      target: { value: '4' },
    })

    // Scope auf "Pro Arzt" setzen
    await userEvent.click(screen.getByRole('combobox'))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Pro Arzt' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('option', { name: 'Pro Arzt' }))

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(screen.getByText(/Arzt muss ausgewählt sein/i)).toBeInTheDocument()
    })
  })

  it('zeigt Fehler bei leerem Regelschlüssel', async () => {
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText(/z\.B\. 4/i), {
      target: { value: '4' },
    })

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(screen.getByText(/Regelschlüssel ist erforderlich/i)).toBeInTheDocument()
    })
  })

  it('zeigt Fehler bei leerem Wert', async () => {
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText(/max_bereitschaft/i), {
      target: { value: 'max_bereitschaft_per_month' },
    })

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(screen.getByText(/Wert ist erforderlich/i)).toBeInTheDocument()
    })
  })
})
