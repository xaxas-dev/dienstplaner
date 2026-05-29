import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SolveResult } from '@/lib/types'
import type { SolverDiffRow } from '../solverUtils'

interface Props {
  result: SolveResult
  diffRows: SolverDiffRow[]
  isApplying: boolean
  onApply: () => void
  onClose: () => void
}

export function SolverResultPanel({ result, diffRows, isApplying, onApply, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solver-Vorschlag</DialogTitle>
          <DialogDescription className="sr-only">
            Vorgeschlagene Änderungen durch den Optimierungs-Solver
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-1">
          {result.feasible ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <CheckCircle className="h-4 w-4" />
              Lösbar
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Nicht vollständig lösbar
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            Hard-Score: {result.hard_score} · Soft-Score: {result.soft_score}
          </span>
        </div>

        {diffRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Keine Änderungen vorgeschlagen
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-line text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Datum</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Schichttyp</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Aktuell</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Vorschlag</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map((row, i) => (
                  <tr
                    key={row.shift_id}
                    className={cn(
                      'border-b border-line last:border-0',
                      i % 2 === 0 ? 'bg-paper/30' : 'bg-card',
                    )}
                  >
                    <td className="px-3 py-2 tabular-nums">
                      {format(parseISO(row.shift_date), 'dd.MM. (EEE)', { locale: de })}
                    </td>
                    <td className="px-3 py-2">{row.shift_type_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.current_doctor_name ?? '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 font-medium',
                        row.is_unassign ? 'text-muted-foreground' : 'text-ink',
                      )}
                    >
                      {row.proposed_doctor_name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isApplying}>
            Schließen
          </Button>
          <Button
            onClick={onApply}
            disabled={diffRows.length === 0 || isApplying}
          >
            {isApplying ? 'Wird angewendet…' : `Alle anwenden (${diffRows.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
