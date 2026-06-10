import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanSidebar } from '../components/PlanSidebar'
import type { components } from '@/lib/api-types'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

function makeShift(overrides: Partial<ShiftWithDetails> = {}): ShiftWithDetails {
  return {
    id: 1, plan_id: 1, shift_date: '2026-05-15', shift_type_id: 1,
    doctor_id: 1, is_pinned: false, is_locked: false, notes: null,
    created_at: '', updated_at: '',
    shift_type: { id: 1, name: 'Nachtdienst', short_name: 'N', applies_on_weekdays: true,
      applies_on_weekend: true, start_time: null, end_time: null,
      display_order: 0, active: true, notes: null, is_bereitschaftsdienst: false,
      created_at: '', updated_at: '' },
    doctor: null,
    conflicts: [],
    ...overrides,
  }
}

const baseProps = {
  shifts: [makeShift(), makeShift({ id: 2, shift_date: '2026-05-16', doctor_id: null })],
  planFrom: '2026-05-01',
  planTo: '2026-05-31',
  openCount: 1,
  conflictCount: 0,
  onConflictBadgeClick: vi.fn(),
  mode: 'besetzung' as const,
  activeTab: 'details' as const,
  onTabChange: vi.fn(),
  shift: null,
  onCloseShift: vi.fn(),
  tarifWarnings: [],
  shiftOverrides: [],
  onCreateOverride: vi.fn(),
  onDeleteOverride: vi.fn(),
  selectedDoctorId: null,
  doctors: [],
  shiftTypes: [],
  wishes: [],
  planMonth: 'Mai',
  showWishes: false,
  onToggleWishes: vi.fn(),
  fairnessStats: [],
  fairnessGroups: [],
  conflicts: null,
  onScrollToShift: vi.fn(),
  onNewWishClick: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('KPI-Strip', () => {
  it('zeigt Abdeckungs-Prozent', () => {
    render(<PlanSidebar {...baseProps} />)
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })

  it('zeigt openCount', () => {
    render(<PlanSidebar {...baseProps} />)
    // openCount=1 is the only '1' in the KPI strip (conflictCount=0, coverage=50%)
    const strip = screen.getByText('offen').closest('div')!
    expect(strip).toHaveTextContent('1')
  })

  it('Klick auf Konflikte-Badge ruft onConflictBadgeClick auf', async () => {
    const user = userEvent.setup()
    render(<PlanSidebar {...baseProps} conflictCount={3} />)
    await user.click(screen.getByText('3'))
    expect(baseProps.onConflictBadgeClick).toHaveBeenCalledOnce()
  })
})

describe('Tab-Navigation — Besetzungs-Modus', () => {
  it('zeigt Details und Konflikte Tabs', () => {
    render(<PlanSidebar {...baseProps} mode="besetzung" />)
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Konflikte' })).toBeInTheDocument()
  })

  it('zeigt KEINE Wünsche/Fairness Tabs im Besetzungs-Modus', () => {
    render(<PlanSidebar {...baseProps} mode="besetzung" />)
    expect(screen.queryByRole('tab', { name: 'Wünsche' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Fairness' })).not.toBeInTheDocument()
  })

  it('Klick auf Konflikte-Tab → onTabChange("konflikte")', async () => {
    const user = userEvent.setup()
    render(<PlanSidebar {...baseProps} mode="besetzung" />)
    await user.click(screen.getByRole('tab', { name: 'Konflikte' }))
    expect(baseProps.onTabChange).toHaveBeenCalledWith('konflikte')
  })
})

describe('Tab-Navigation — INA-Modus', () => {
  it('zeigt alle vier Tabs', () => {
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="details" />)
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Wünsche' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Fairness' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Konflikte' })).toBeInTheDocument()
  })
})

describe('Details Tab', () => {
  it('zeigt Leer-Zustand wenn kein Arzt ausgewählt', () => {
    render(<PlanSidebar {...baseProps} activeTab="details" />)
    expect(screen.getByText(/Zelle klicken/i)).toBeInTheDocument()
  })

  it('zeigt Konflikt-Nachricht wenn Shift mit Konflikten übergeben', () => {
    const shift = makeShift({
      conflicts: [{ shift_id: 1, conflict_type: 'not_available', message: 'Test-Konflikt',
        doctor_id: 1, doctor_name: 'Dr. Test', shift_date: '2026-05-15', shift_type_short_name: 'N' }],
    })
    render(<PlanSidebar {...baseProps} activeTab="details" shift={shift} />)
    expect(screen.getByText('Test-Konflikt')).toBeInTheDocument()
  })
})

describe('Konflikte Tab', () => {
  it('zeigt "Keine Konflikte" wenn leer', () => {
    render(<PlanSidebar {...baseProps} activeTab="konflikte" conflicts={null} />)
    expect(screen.getByText(/Keine Konflikte/i)).toBeInTheDocument()
  })

  it('zeigt Konflikt-Einträge und löst Scroll bei Klick aus', async () => {
    const user = userEvent.setup()
    const conflicts = { conflicts: [{ shift_id: 1 }], open_shifts: [] }
    render(<PlanSidebar {...baseProps} activeTab="konflikte" conflicts={conflicts} />)
    const btn = screen.getByRole('button', { name: /2026-05-15/i })
    await user.click(btn)
    expect(baseProps.onScrollToShift).toHaveBeenCalledWith(1)
  })
})

describe('Wünsche Tab (INA)', () => {
  it('zeigt Toggle-Button', () => {
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="wuensche" />)
    expect(screen.getByText(/Wunsch-Hinweise/i)).toBeInTheDocument()
  })

  it('Toggle-Button ruft onToggleWishes auf', async () => {
    const user = userEvent.setup()
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="wuensche" />)
    await user.click(screen.getByText(/Wunsch-Hinweise/i))
    expect(baseProps.onToggleWishes).toHaveBeenCalledOnce()
  })
})

describe('Fairness Tab (INA)', () => {
  it('zeigt Arzt-Tabelle', () => {
    const stats = [{ doctorId: 1, doctorName: 'Müller, Anna', shortName: 'AM', total: 5, byGroup: { INA: 3 } }]
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="fairness"
      fairnessStats={stats} fairnessGroups={['INA']} />)
    expect(screen.getByText('Müller, Anna')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})

describe('Fairness-Tab — volle Namen', () => {
  const fairnessProps = {
    ...baseProps,
    mode: 'ina' as const,
    activeTab: 'fairness' as const,
    fairnessStats: [
      { doctorId: 1, doctorName: 'Dr. Anna Müller', shortName: 'AMü', total: 5, byGroup: { INA: 5 } },
    ],
    fairnessGroups: ['INA'],
  }

  it('zeigt vollen Namen statt Abkürzung', () => {
    render(<PlanSidebar {...fairnessProps} />)
    expect(screen.getByText('Dr. Anna Müller')).toBeInTheDocument()
    expect(screen.queryByText('AMü')).not.toBeInTheDocument()
  })
})

describe('Wünsche-Tab — Wunsch erfassen Button', () => {
  const wuenscheProps = {
    ...baseProps,
    mode: 'ina' as const,
    activeTab: 'wuensche' as const,
    doctors: [
      { id: 1, name: 'Dr. Anna Müller', short_name: 'AMü', active: true,
        doctor_type: 'INTERNAL' as const, is_facharzt: false, weiterbildungsjahr: null,
        employment_periods: [], qualifications: [], created_at: '', updated_at: '' },
    ],
  }

  it('zeigt "Neu"-Button im Wünsche-Tab', () => {
    render(<PlanSidebar {...wuenscheProps} />)
    expect(screen.getByText('Neu')).toBeInTheDocument()
  })

  it('"Neu" ruft onNewWishClick ohne vorausgewählten Arzt auf', async () => {
    const user = userEvent.setup()
    const onNewWishClick = vi.fn()
    render(<PlanSidebar {...wuenscheProps} onNewWishClick={onNewWishClick} />)
    await user.click(screen.getByText('Neu'))
    expect(onNewWishClick).toHaveBeenCalledWith(null)
    expect(screen.queryByText('Wunsch für Arzt:')).not.toBeInTheDocument()
  })
})

describe('Details-Tab — Department-Details', () => {
  const dept = {
    id: 10, name: 'Neurologie', short_name: 'NEU', display_order: 1,
    color: null, max_headcount: null, blocks_ina_weekdays: false, blocks_ina_weekends: false,
    is_external: false, is_shift_relevant: true, active: true, requires_full_time: false,
    created_at: '', updated_at: '',
  }
  const rotation = {
    id: 100, plan_id: 1, doctor_id: 1, department_id: 10,
    valid_from: '2026-05-01', valid_to: '2026-05-31', is_einarbeitung: false,
    doctor: null, department: dept, created_at: '', updated_at: '',
  }
  const doctor = {
    id: 1, name: 'Dr. Anna Müller', short_name: 'AMü', active: true,
    doctor_type: 'INTERNAL' as const, is_facharzt: false, weiterbildungsjahr: null,
    employment_periods: [{ id: 1, doctor_id: 1, employment_percentage: 75, valid_from: '2026-01-01', valid_to: null, created_at: '', updated_at: '' }],
    qualifications: [], created_at: '', updated_at: '',
  }

  const deptProps = {
    ...baseProps,
    selectedDepartmentId: 10,
    departments: [dept],
    rotations: [rotation],
    doctors: [doctor],
    onDepartmentDeselect: vi.fn(),
  }

  it('zeigt Stationsnamen', () => {
    render(<PlanSidebar {...deptProps} />)
    expect(screen.getByText('Neurologie')).toBeInTheDocument()
  })

  it('zeigt zugewiesenen Arzt', () => {
    render(<PlanSidebar {...deptProps} />)
    expect(screen.getByText('Dr. Anna Müller')).toBeInTheDocument()
  })

  it('zeigt FTE des Arztes', () => {
    render(<PlanSidebar {...deptProps} />)
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })
})
