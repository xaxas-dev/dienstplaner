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
import { useCreateINAExclusion, useUpdateINAExclusion } from './useINAExclusions'
import type { INAExclusion } from '@/lib/types'

const schema = z
  .object({
    valid_from: z.string().min(1, 'Startdatum ist erforderlich'),
    valid_to: z.string().nullable().optional(),
    reason: z.enum(['SCHWANGERSCHAFT', 'EINARBEITUNG', 'SONSTIGES'], {
      error: 'Grund ist erforderlich',
    }),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.valid_to && data.valid_from) {
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

const REASON_LABELS: Record<string, string> = {
  SCHWANGERSCHAFT: 'Schwangerschaft',
  EINARBEITUNG: 'Einarbeitung',
  SONSTIGES: 'Sonstiges',
}

interface INAExclusionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctorId: number
  exclusion?: INAExclusion
}

export function INAExclusionFormDialog({
  open,
  onOpenChange,
  doctorId,
  exclusion,
}: INAExclusionFormDialogProps) {
  const createMutation = useCreateINAExclusion(doctorId)
  const updateMutation = useUpdateINAExclusion(doctorId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      valid_from: exclusion?.valid_from ?? '',
      valid_to: exclusion?.valid_to ?? null,
      reason: exclusion?.reason ?? undefined,
      notes: exclusion?.notes ?? null,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        valid_from: exclusion?.valid_from ?? '',
        valid_to: exclusion?.valid_to ?? null,
        reason: exclusion?.reason ?? undefined,
        notes: exclusion?.notes ?? null,
      })
    }
  }, [open, exclusion, form])

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      valid_to: values.valid_to || null,
      notes: values.notes || null,
    }

    const handleError = (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Speichern fehlgeschlagen')
      }
    }

    if (exclusion) {
      updateMutation.mutate(
        { id: exclusion.id, data: payload },
        {
          onSuccess: () => {
            toast.success('INA-Ausschluss aktualisiert')
            onOpenChange(false)
          },
          onError: handleError,
        },
      )
    } else {
      createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: () => {
          toast.success('INA-Ausschluss hinzugefügt')
          onOpenChange(false)
        },
        onError: handleError,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const title = exclusion ? 'INA-Ausschluss bearbeiten' : 'Neuer INA-Ausschluss'

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
                  <FormLabel>Ende</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormDescription>Leer lassen = unbefristet</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grund *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Grund auswählen…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(REASON_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
