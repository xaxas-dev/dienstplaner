import { DoctorForm } from './DoctorForm'

export function DoctorCreatePage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Neuer Arzt</h1>
      </div>
      <div className="flex-1 px-6 py-6 max-w-lg">
        <DoctorForm />
      </div>
    </div>
  )
}
