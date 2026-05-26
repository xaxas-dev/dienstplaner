import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, Building2,
  Clock, Award, Shield, Settings
} from 'lucide-react'
import type { CommandItemDef } from './types'

export function useNavigationItems(): CommandItemDef[] {
  const navigate = useNavigate()
  return [
    { id: 'nav-heute', label: 'Heute', group: 'navigation', icon: LayoutDashboard, keywords: ['dashboard', 'heute', 'start'], onSelect: () => navigate('/heute') },
    { id: 'nav-plans', label: 'Pläne', group: 'navigation', icon: Calendar, keywords: ['plan', 'pläne', 'schichtplan'], onSelect: () => navigate('/plans') },
    { id: 'nav-doctors', label: 'Ärzte', group: 'navigation', icon: Users, keywords: ['arzt', 'ärzte', 'doctor'], onSelect: () => navigate('/doctors') },
    { id: 'nav-departments', label: 'Stationen', group: 'navigation', icon: Building2, keywords: ['station', 'stationen', 'bereich', 'department'], onSelect: () => navigate('/departments') },
    { id: 'nav-shift-types', label: 'Schichttypen', group: 'navigation', icon: Clock, keywords: ['schicht', 'schichttyp', 'dienst'], onSelect: () => navigate('/shift-types') },
    { id: 'nav-qualifications', label: 'Qualifikationen', group: 'navigation', icon: Award, keywords: ['qualifikation', 'qual'], onSelect: () => navigate('/qualifications') },
    { id: 'nav-rule-overrides', label: 'Sonderregelungen', group: 'navigation', icon: Shield, keywords: ['regel', 'sonderregel', 'override'], onSelect: () => navigate('/rule-overrides') },
    { id: 'nav-settings', label: 'Einstellungen', group: 'navigation', icon: Settings, keywords: ['settings', 'einstellung', 'konfiguration'], onSelect: () => navigate('/settings') },
  ]
}
