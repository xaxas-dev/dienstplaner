import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DoctorListPage } from '@/features/doctors/DoctorListPage'
import { DoctorCreatePage } from '@/features/doctors/DoctorCreatePage'
import { DoctorDetailPage } from '@/features/doctors/DoctorDetailPage'

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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
