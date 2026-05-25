import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { doctorKeys } from '@/features/doctors/useDoctors'
import { planKeys } from '@/features/plans/usePlans'
import { departmentKeys } from '@/features/departments/useDepartments'
import type { Doctor, Plan, Department } from '@/lib/types'
import type { CommandItemDef } from './types'

interface EntityItems {
  doctorItems: CommandItemDef[]
  planItems: CommandItemDef[]
  departmentItems: CommandItemDef[]
}

export function useEntityItems(enabled: boolean): EntityItems {
  const navigate = useNavigate()

  const { data: doctors = [] } = useQuery({
    queryKey: doctorKeys.list(false),
    queryFn: () => apiGet<Doctor[]>('/api/doctors?include_inactive=false'),
    enabled,
  })

  const { data: plans = [] } = useQuery({
    queryKey: planKeys.list(),
    queryFn: () => apiGet<Plan[]>('/api/plans'),
    enabled,
  })

  const { data: departments = [] } = useQuery({
    queryKey: departmentKeys.list(false),
    queryFn: () => apiGet<Department[]>('/api/departments?include_inactive=false'),
    enabled,
  })

  const doctorItems: CommandItemDef[] = doctors.slice(0, 10).map((d) => ({
    id: `doctor-${d.id}`,
    label: d.name,
    group: 'doctors',
    keywords: [d.short_name ?? '', String(d.id)].filter(Boolean),
    onSelect: () => navigate(`/doctors/${d.id}`),
  }))

  const planItems: CommandItemDef[] = plans.slice(0, 10).map((p) => ({
    id: `plan-${p.id}`,
    label: p.name,
    group: 'plans',
    keywords: [String(p.id), p.valid_from, p.valid_to],
    onSelect: () => navigate(`/plans/${p.id}`),
  }))

  const departmentItems: CommandItemDef[] = departments.slice(0, 10).map((dep) => ({
    id: `department-${dep.id}`,
    label: dep.name,
    group: 'departments',
    keywords: [dep.short_name ?? '', String(dep.id)].filter(Boolean),
    onSelect: () => navigate('/departments'),
  }))

  return { doctorItems, planItems, departmentItems }
}
