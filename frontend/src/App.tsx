import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DoctorListPage } from '@/features/doctors/DoctorListPage'
import { DoctorCreatePage } from '@/features/doctors/DoctorCreatePage'
import { DoctorDetailPage } from '@/features/doctors/DoctorDetailPage'
import { DepartmentListPage } from '@/features/departments/DepartmentListPage'
import { ShiftTypeListPage } from '@/features/shift-types/ShiftTypeListPage'
import { QualificationListPage } from '@/features/qualifications/QualificationListPage'
import { RuleOverrideListPage } from '@/features/rule-overrides/RuleOverrideListPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

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
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/doctors" replace />} />
        <Route path="/doctors" element={<DoctorListPage />} />
        <Route path="/doctors/new" element={<DoctorCreatePage />} />
        <Route path="/doctors/:doctorId" element={<DoctorDetailPage />} />
        <Route path="/departments" element={<DepartmentListPage />} />
        <Route path="/shift-types" element={<ShiftTypeListPage />} />
        <Route path="/qualifications" element={<QualificationListPage />} />
        <Route path="/rule-overrides" element={<RuleOverrideListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
