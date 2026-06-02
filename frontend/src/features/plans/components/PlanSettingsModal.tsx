import { toast } from 'sonner'
import { Settings } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  useConstraintOverrides,
  useCreateConstraintOverride,
  useDeleteConstraintOverride,
} from '../useConstraintOverrides'
import { usePlan } from '../usePlans'
import { useUpdatePlan } from '../useUpdatePlan'
import type { ConstraintOverride } from '@/lib/types'

const REGULATORISCH_HART = [
  { id: 'max-bd-per-month', label: 'Max. Bereitschaftsdienste/Monat' },
  { id: 'max-weekends-per-month', label: 'Max. Wochenenddienste/Monat' },
  { id: 'min-rest-time', label: 'Mindestruhezeit (ArbZG § 5)' },
  { id: 'max-weekly-hours', label: 'Max. Wochenstunden (ArbZG § 3)' },
] as const

interface Props {
  planId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlanSettingsModal({ planId, open, onOpenChange }: Props) {
  const { data: overrides = [] } = useConstraintOverrides(open ? planId : null)
  const createMutation = useCreateConstraintOverride(planId)
  const deleteMutation = useDeleteConstraintOverride(planId)

  const disabledSet = new Set(
    overrides.filter((o) => o.level === 'A').map((o) => o.constraint_id),
  )

  const findOverride = (constraintId: string): ConstraintOverride | undefined =>
    overrides.find((o) => o.level === 'A' && o.constraint_id === constraintId)

  const handleToggle = (constraintId: string, currentlyDisabled: boolean) => {
    if (currentlyDisabled) {
      const existing = findOverride(constraintId)
      if (!existing) return
      deleteMutation.mutate(existing.id, {
        onError: () => toast.error('Fehler beim Aktivieren'),
      })
    } else {
      createMutation.mutate(
        { level: 'A', constraint_id: constraintId, plan_id: planId },
        { onError: () => toast.error('Fehler beim Deaktivieren') },
      )
    }
  }

  const { data: plan } = usePlan(planId)
  const updatePlan = useUpdatePlan(planId)
  const besetzungLocked = plan?.besetzung_locked ?? false

  const isPending = createMutation.isPending || deleteMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={16} />
            Plan-Einstellungen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <Label className="text-sm cursor-pointer" htmlFor="toggle-besetzung-locked">
                Besetzung gesperrt
              </Label>
              <p className="text-[12px] text-muted-foreground">
                Rotations-Zuweisungen sind dann nur Kontext (read-only).
              </p>
            </div>
            <Switch
              id="toggle-besetzung-locked"
              checked={besetzungLocked}
              onCheckedChange={(checked) =>
                updatePlan.mutate({ besetzung_locked: checked })
              }
              disabled={updatePlan.isPending}
              aria-label={besetzungLocked ? 'Besetzung entsperren' : 'Besetzung sperren'}
            />
          </div>
          <p className="text-[13px] text-muted-foreground">
            Deaktivierte Constraints werden beim Solver und bei Tarif-Warnungen ignoriert.
          </p>
          <div className="space-y-3">
            {REGULATORISCH_HART.map(({ id, label }) => {
              const isDisabled = disabledSet.has(id)
              return (
                <div key={id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <Label className="text-sm cursor-pointer" htmlFor={`toggle-${id}`}>
                    {label}
                  </Label>
                  <Switch
                    id={`toggle-${id}`}
                    checked={!isDisabled}
                    onCheckedChange={() => handleToggle(id, isDisabled)}
                    disabled={isPending}
                    aria-label={`${label} ${isDisabled ? 'aktivieren' : 'deaktivieren'}`}
                  />
                </div>
              )
            })}
          </div>
          {disabledSet.size > 0 && (
            <p className="text-[12px] text-warn-ink bg-warn-bg rounded px-3 py-2">
              {disabledSet.size} Constraint{disabledSet.size > 1 ? 's' : ''} deaktiviert.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
