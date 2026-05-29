import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { CommandBar } from '@/components/dp/CommandBar'
import { useDoctors } from '@/features/doctors/useDoctors'
import { useRuleOverrides, useDeleteRuleOverride } from './useRuleOverrides'
import { RuleOverrideFormDialog } from './RuleOverrideFormDialog'
import type { RuleOverride, OverrideScope } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

function formatDate(d: string | null | undefined): string {
  if (!d) return '–'
  try { return format(parseISO(d), 'd.M.yyyy', { locale: de }) }
  catch { return d }
}

function formatValidity(from: string | null | undefined, to: string | null | undefined): string {
  const f = formatDate(from)
  const t = to ? formatDate(to) : 'unbefristet'
  if (!from && !to) return 'unbefristet'
  return `${f} – ${t}`
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '–'
  return text.length > max ? text.slice(0, max) + '…' : text
}

type ScopeFilter = 'ALL' | OverrideScope

export function RuleOverrideListPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editOverride, setEditOverride] = useState<RuleOverride | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<RuleOverride | null>(null)

  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL')
  const [doctorFilter, setDoctorFilter] = useState<number | undefined>()
  const [ruleKeyFilter, setRuleKeyFilter] = useState('')
  const [activeDateFilter, setActiveDateFilter] = useState('')

  const { data: doctors } = useDoctors(true)

  const filters = {
    scope: scopeFilter !== 'ALL' ? scopeFilter : undefined,
    doctor_id: scopeFilter === 'DOCTOR' ? doctorFilter : undefined,
    rule_key: ruleKeyFilter || undefined,
    active_on_date: activeDateFilter || undefined,
  }

  const { data: overrides, isLoading, isError, refetch } = useRuleOverrides(filters)
  const deleteMutation = useDeleteRuleOverride()

  const handleEdit = (o: RuleOverride) => { setEditOverride(o); setFormOpen(true) }
  const handleNewClick = () => { setEditOverride(undefined); setFormOpen(true) }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { toast.success('Sonderregelung gelöscht'); setDeleteTarget(null) },
      onError: (err) => { toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen'); setDeleteTarget(null) },
    })
  }

  const doctorName = (id: number | null | undefined): string => {
    if (id == null) return '–'
    return doctors?.find((d) => d.id === id)?.name ?? `ID ${id}`
  }

  return (
    <div className="flex flex-col h-full">
      <CommandBar
        titleAccent="Sonderregelungen"
        title={(overrides?.length ?? 0) > 0 ? `· ${overrides!.length} Sonderregelungen` : ''}
        showSearch={false}
        primaryAction={{ label: '+ Neue Sonderregelung', onClick: handleNewClick }}
      />

      {/* Filter-Toolbar */}
      <div className="px-10 py-3 border-b border-line bg-paper flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-ink-3">Bereich</Label>
          <Select
            value={scopeFilter}
            onValueChange={(val) => { setScopeFilter(val as ScopeFilter); if (val !== 'DOCTOR') setDoctorFilter(undefined) }}
          >
            <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle</SelectItem>
              <SelectItem value="GLOBAL">Global</SelectItem>
              <SelectItem value="DOCTOR">Pro Arzt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scopeFilter === 'DOCTOR' && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-ink-3">Arzt</Label>
            <Select
              value={doctorFilter != null ? String(doctorFilter) : ''}
              onValueChange={(val) => setDoctorFilter(val ? Number(val) : undefined)}
            >
              <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Alle Ärzte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Ärzte</SelectItem>
                {[...(doctors ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-ink-3">Regelschlüssel</Label>
          <Input className="h-8 w-48" placeholder="Filter…" value={ruleKeyFilter} onChange={(e) => setRuleKeyFilter(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-ink-3">Aktiv am</Label>
          <Input type="date" className="h-8 w-36" value={activeDateFilter} onChange={(e) => setActiveDateFilter(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 px-10 py-6 overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center py-16 text-ink-3">Laden…</div>}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive">Daten konnten nicht geladen werden.</p>
            <Button variant="outline" onClick={() => void refetch()}>Erneut versuchen</Button>
          </div>
        )}

        {!isLoading && !isError && (overrides ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-3">
            <p className="text-sm">Noch keine Sonderregelungen angelegt.</p>
            <Button variant="accent" size="sm" onClick={handleNewClick}>+ Neue Sonderregelung</Button>
          </div>
        )}

        {!isLoading && !isError && (overrides ?? []).length > 0 && (
          <div className="rounded-2xl border border-line bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regel</TableHead>
                  <TableHead>Bereich</TableHead>
                  <TableHead>Arzt</TableHead>
                  <TableHead>Gültigkeit</TableHead>
                  <TableHead>Wert</TableHead>
                  <TableHead>Begründung</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(overrides ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm text-ink">{o.rule_key}</TableCell>
                    <TableCell>
                      <Badge variant={o.scope === 'GLOBAL' ? 'muted' : 'ok'}>
                        {o.scope === 'GLOBAL' ? 'Global' : 'Pro Arzt'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-ink-2">{doctorName(o.doctor_id)}</TableCell>
                    <TableCell className="text-sm text-ink-2 whitespace-nowrap">{formatValidity(o.valid_from, o.valid_to)}</TableCell>
                    <TableCell className="font-medium text-ink">{o.override_value}</TableCell>
                    <TableCell className="text-sm text-ink-2 max-w-xs">{truncate(o.reason, 60)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label="Bearbeiten" onClick={() => handleEdit(o)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Löschen" onClick={() => setDeleteTarget(o)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <RuleOverrideFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditOverride(undefined) }}
        ruleOverride={editOverride}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Sonderregelung löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
