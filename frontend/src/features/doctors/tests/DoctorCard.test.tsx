import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DoctorCard } from '../DoctorCard'
import type { Doctor } from '@/lib/types'

const baseDoctor: Doctor = {
  id: 1,
  name: 'Lena Hartmann',
  short_name: 'LH',
  doctor_type: 'INTERNAL',
  is_facharzt: true,
  active: true,
  weiterbildungsjahr: null,
  entry_date: null,
  virtual_entry_date: null,
  notes: null,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  employment_periods: [
    {
      id: 1,
      doctor_id: 1,
      employment_percentage: 100,
      valid_from: '2024-01-01',
      valid_to: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
    },
  ],
  qualifications: [],
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('DoctorCard', () => {
  it('rendert den Arzt-Namen', () => {
    render(<Wrapper><DoctorCard doctor={baseDoctor} /></Wrapper>)
    expect(screen.getByText('Lena Hartmann')).toBeInTheDocument()
  })

  it('zeigt die Rolle Facharzt', () => {
    render(<Wrapper><DoctorCard doctor={baseDoctor} /></Wrapper>)
    expect(screen.getByText(/facharzt/i)).toBeInTheDocument()
  })

  it('zeigt Assistenzarzt-Label für Arzt mit Weiterbildungsjahr', () => {
    const wbaDoctor: Doctor = { ...baseDoctor, is_facharzt: false, weiterbildungsjahr: 3 }
    render(<Wrapper><DoctorCard doctor={wbaDoctor} /></Wrapper>)
    expect(screen.getByText(/assistenzarzt/i)).toBeInTheDocument()
  })

  it('zeigt Extern für externen Arzt', () => {
    const externDoctor: Doctor = { ...baseDoctor, doctor_type: 'EXTERNAL' }
    render(<Wrapper><DoctorCard doctor={externDoctor} /></Wrapper>)
    expect(screen.getByText(/extern/i)).toBeInTheDocument()
  })

  it('zeigt 14-Tage-Heatmap (leer bei leeren shifts)', () => {
    const { container } = render(<Wrapper><DoctorCard doctor={baseDoctor} /></Wrapper>)
    // ShiftHeatmap14 rendert 14 span-Boxen
    const boxes = container.querySelectorAll('.flex.gap-0\\.5 > span')
    expect(boxes).toHaveLength(14)
  })

  it('rendert Details-Link zur Doctor-Detail-Page', () => {
    render(<Wrapper><DoctorCard doctor={baseDoctor} /></Wrapper>)
    const link = screen.getByRole('link', { name: /details/i })
    expect(link).toHaveAttribute('href', '/doctors/1')
  })

  it('zeigt Qualifikationen als Chips', () => {
    const doctorWithQuals: Doctor = {
      ...baseDoctor,
      qualifications: [
        { id: 1, name: 'Notarzt', short_name: 'NA', description: null, active: true, created_at: '', updated_at: '' },
      ],
    }
    render(<Wrapper><DoctorCard doctor={doctorWithQuals} /></Wrapper>)
    expect(screen.getByText('Notarzt')).toBeInTheDocument()
  })

  it('zeigt Inaktiv-Badge bei inaktivem Arzt', () => {
    const inactiveDoctor: Doctor = { ...baseDoctor, active: false }
    render(<Wrapper><DoctorCard doctor={inactiveDoctor} /></Wrapper>)
    expect(screen.getByText('Inaktiv')).toBeInTheDocument()
  })

  it('zeigt Titel vor dem Namen wenn vorhanden', () => {
    const doctorWithTitle: Doctor = { ...baseDoctor, title: 'Dr. med.' }
    render(<Wrapper><DoctorCard doctor={doctorWithTitle} /></Wrapper>)
    expect(screen.getByText('Dr. med. Lena Hartmann')).toBeInTheDocument()
  })

  it('zeigt nur den Namen wenn kein Titel gesetzt', () => {
    render(<Wrapper><DoctorCard doctor={baseDoctor} /></Wrapper>)
    expect(screen.getByText('Lena Hartmann')).toBeInTheDocument()
    expect(screen.queryByText(/dr\./i)).not.toBeInTheDocument()
  })
})
