import { Routes, Route, Navigate } from 'react-router-dom'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AtelierShell } from '@/components/layout/AtelierShell'
import { CommandPaletteProvider } from '@/features/command-palette'
import { DoctorListPage } from '@/features/doctors/DoctorListPage'
import { DoctorCreatePage } from '@/features/doctors/DoctorCreatePage'
import { DoctorDetailPage } from '@/features/doctors/DoctorDetailPage'
import { DepartmentListPage } from '@/features/departments/DepartmentListPage'
import { ShiftTypeListPage } from '@/features/shift-types/ShiftTypeListPage'
import { QualificationListPage } from '@/features/qualifications/QualificationListPage'
import { RuleOverrideListPage } from '@/features/rule-overrides/RuleOverrideListPage'
import { HolidayListPage } from '@/features/holidays/HolidayListPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TodayPage } from '@/features/today/TodayPage'
import { PlanListPage } from '@/features/plans/PlanListPage'
import { PlanPage } from '@/features/plans/PlanPage'
import { useAppSettings } from '@/stores/useAppSettings'


function AppDevTools() {
  const { devMode } = useAppSettings()
  return devMode ? <ReactQueryDevtools initialIsOpen={false} /> : null
}

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
      <h2 className="text-2xl font-semibold text-foreground">Seite nicht gefunden</h2>
      <p className="text-muted-foreground">Die angeforderte Seite existiert nicht.</p>
    </div>
  )
}

export default function App() {
  return (
    <CommandPaletteProvider>
    <Routes>
      <Route element={<AtelierShell />}>
        <Route index element={<Navigate to="/heute" replace />} />
        <Route path="/heute" element={<TodayPage />} />
        <Route path="/plans" element={<PlanListPage />} />
        <Route path="/plans/:planId" element={<PlanPage />} />
        <Route path="/doctors" element={<DoctorListPage />} />
        <Route path="/doctors/new" element={<DoctorCreatePage />} />
        <Route path="/doctors/:doctorId" element={<DoctorDetailPage />} />
        <Route path="/departments" element={<DepartmentListPage />} />
        <Route path="/shift-types" element={<ShiftTypeListPage />} />
        <Route path="/qualifications" element={<QualificationListPage />} />
        <Route path="/rule-overrides" element={<RuleOverrideListPage />} />
        <Route path="/holidays" element={<HolidayListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
<Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    <AppDevTools />
    </CommandPaletteProvider>
  )
}
