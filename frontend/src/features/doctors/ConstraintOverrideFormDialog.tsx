import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useCreateDoctorConstraintOverride } from './useDoctorConstraintOverrides'

const CONSTRAINT_OPTIONS = [
  { value: 'max-bd-per-month', label: 'Max. Bereitschaftsdienste/Monat' },
  { value: 'max-weekends-per-month', label: 'Max. Wochenenddienste/Monat' },
  { value: 'min-rest-time', label: 'Mindestruhezeit (11 h)' },
  { value: 'max-weekly-hours', label: 'Max. Wochenstunden' },
] as const

const schema = z
  .object({
    constraint_id: z.string().min(1, 'Constraint wählen'),
    valid_from: z.string().min(1, 'Startdatum erforderlich'),
    valid_to: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
  })
  .refine(
    (d) => !d.valid_from || !d.valid_to || d.valid_from <= d.valid_to,
    { message: 'Enddatum muss nach Startdatum liegen', path: ['valid_to'] },
  )

type FormValues = z.infer<typeof schema>

interface Props {
  doctorId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConstraintOverrideFormDialog({ doctorId, open, onOpenChange }: Props) {
  const createMutation = useCreateDoctorConstraintOverride(doctorId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { constraint_id: '', valid_from: '', valid_to: null, reason: null },
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        level: 'B',
        constraint_id: values.constraint_id,
        doctor_id: doctorId,
        valid_from: values.valid_from,
        valid_to: values.valid_to || null,
        reason: values.reason || null,
      },
      {
        onSuccess: () => {
          toast.success('Override gespeichert')
          form.reset()
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.detail : 'Speichern fehlgeschlagen'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Constraint-Override hinzufügen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="constraint_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Constraint *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Constraint wählen" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONSTRAINT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gültig ab *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gültig bis</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Begründung</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional…"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Speichern…' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
