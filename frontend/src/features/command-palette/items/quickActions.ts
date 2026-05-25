import { useNavigate } from 'react-router-dom'
import { UserPlus, CalendarPlus, Building } from 'lucide-react'
import type { CommandItemDef } from './types'

export function useQuickActions(): CommandItemDef[] {
  const navigate = useNavigate()
  return [
    {
      id: 'action-new-doctor',
      label: 'Neuer Arzt',
      group: 'actions',
      icon: UserPlus,
      keywords: ['neu', 'arzt', 'anlegen', 'erstellen', 'new', 'doctor'],
      onSelect: () => navigate('/doctors/new'),
    },
    {
      id: 'action-new-plan',
      label: 'Neuer Plan',
      group: 'actions',
      icon: CalendarPlus,
      keywords: ['neu', 'plan', 'anlegen', 'erstellen', 'new'],
      onSelect: () => navigate('/plans'),
    },
    {
      id: 'action-new-department',
      label: 'Neue Station',
      group: 'actions',
      icon: Building,
      keywords: ['neu', 'station', 'bereich', 'anlegen', 'erstellen', 'new'],
      onSelect: () => navigate('/departments'),
    },
  ]
}
