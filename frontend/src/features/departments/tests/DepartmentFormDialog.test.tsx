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
