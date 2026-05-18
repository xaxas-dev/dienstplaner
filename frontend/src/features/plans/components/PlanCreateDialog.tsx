import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getDaysInMonth } from 'date-fns'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCreatePlan } from '../usePlans'

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

interface Props {
  open: boolean
  onClose: () => void
}

export function PlanCreateDialog({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { mutate, isPending } = useCreatePlan()
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseInt(month)
    const y = parseInt(year)
    const mm = String(m).padStart(2, '0')
    const lastDay = getDaysInMonth(new Date(y, m - 1))
    const validFrom = `${y}-${mm}-01`
    const validTo = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
    const planName = name.trim() || `${MONTHS[m - 1]} ${y}`

    mutate(
      { name: planName, valid_from: validFrom, valid_to: validTo, status: 'DRAFT' },
      {
        onSuccess: (plan) => {
          toast.success(`Plan "${planName}" erstellt`)
          onClose()
          navigate(`/plans/${plan.id}`)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Neuer Plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan-month">Monat</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger id="plan-month">
                <SelectValue placeholder="Monat wählen" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-year">Jahr</Label>
            <Input
              id="plan-year"
              type="number"
              min={2020}
              max={2099}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Name (optional)</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                month && year
                  ? `${MONTHS[parseInt(month) - 1]} ${year}`
                  : 'z.B. Mai 2026'
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={isPending || !month || parseInt(year) < 2020}
            >
              {isPending ? 'Erstelle…' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
