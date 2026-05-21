import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useCreateAbsence, useUpdateAbsence } from './useAbsences'
import type { Absence, AbsenceType } from '@/lib/types'

const ABSENCE_TYPE_VALUES = [
  'URLAUB',
  'KRANKHEIT',
  'FORTBILDUNG',
  'ELTERNZEIT',
  'MUTTERSCHUTZ',
  'SONSTIGES',
] as const

const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  URLAUB: 'Urlaub',
  KRANKHEIT: 'Krankheit',
  FORTBILDUNG: 'Fortbildung',
  ELTERNZEIT: 'Elternzeit',
  MUTTERSCHUTZ: 'Mutterschutz',
  SONSTIGES: 'Sonstiges',
}

const schema = z
  .object({
    absence_type: z.enum(ABSENCE_TYPE_VALUES, {
      error: 'Abwesenheitstyp ist erforderlich',
    }),
    valid_from: z.string().min(1, 'Startdatum ist erforderlich'),
    valid_to: z.string().min(1, 'Enddatum ist erforderlich'),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.valid_from && data.valid_to) {
        return data.valid_from <= data.valid_to
      }
      return true
    },
    {
      message: 'Enddatum muss nach dem Startdatum liegen',
      path: ['valid_to'],
    },
  )

type FormValues = z.infer<typeof schema>

interface AbsenceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctorId: number
  absence?: Absence
}

export function AbsenceFormDialog({
  open,
  onOpenChange,
  doctorId,
  absence,
}: AbsenceFormDialogProps) {
  const createMutation = useCreateAbsence(doctorId)
  const updateMutation = useUpdateAbsence(doctorId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      absence_type: absence?.absence_type ?? undefined,
      valid_from: absence?.valid_from ?? '',
      valid_to: absence?.valid_to ?? '',
      notes: absence?.notes ?? null,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        absence_type: absence?.absence_type ?? undefined,
        valid_from: absence?.valid_from ?? '',
        valid_to: absence?.valid_to ?? '',
        notes: absence?.notes ?? null,
      })
    }
  }, [open, absence, form])

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      notes: values.notes || null,
    }

    const handleError = (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Speichern fehlgeschlagen')
      }
    }

    if (absence) {
      updateMutation.mutate(
        { id: absence.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Abwesenheit aktualisiert')
            onOpenChange(false)
          },
          onError: handleError,
        },
      )
    } else {
      createMutation.mutate(
        { ...payload, doctor_id: doctorId },
        {
          onSuccess: () => {
            toast.success('Abwesenheit hinzugefügt')
            onOpenChange(false)
          },
          onError: handleError,
        },
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const title = absence ? 'Abwesenheit bearbeiten' : 'Neue Abwesenheit'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="absence_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ auswählen…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ABSENCE_TYPE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {ABSENCE_TYPE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valid_from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beginn *</FormLabel>
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
                  <FormLabel>Ende *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Enddatum darf nicht vor dem Startdatum liegen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Optional…"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Speichern…' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
