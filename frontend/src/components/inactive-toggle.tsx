import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface InactiveToggleProps {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function InactiveToggle({ id, checked, onCheckedChange }: InactiveToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm">
        Inaktive anzeigen
      </Label>
    </div>
  )
}
