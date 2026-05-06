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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { ApiError } from '@/lib/api'
import { useCreateEmploymentPeriod, useUpdateEmploymentPeriod } from './useDoctors'
import type { EmploymentPeriod } from '@/lib/types'

const schema = z
  .object({
    valid_from: z.string().min(1, 'Beginn ist erforderlich'),
    valid_to: z.string().nullable().optional(),
    employment_percentage: z
      .number({ error: 'Zahl erforderlich' })
      .int()
      .min(1, 'Mindestens 1%')
      .max(100, 'Maximal 100%'),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.valid_to && data.valid_from) {
        return data.valid_from < data.valid_to
      }
      return true
    },
    {
      message: 'Enddatum muss nach dem Startdatum liegen',
      path: ['valid_to'],
    },
  )

type FormValues = z.infer<typeof schema>

interface EmploymentPeriodFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctorId: number
  period?: EmploymentPeriod
}

export function EmploymentPeriodForm({
  open,
  onOpenChange,
  doctorId,
  period,
}: EmploymentPeriodFormProps) {
  const createMutation = useCreateEmploymentPeriod(doctorId)
  const updateMutation = useUpdateEmploymentPeriod(doctorId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      valid_from: period?.valid_from ?? '',
      valid_to: period?.valid_to ?? null,
      employment_percentage: period?.employment_percentage ?? 100,
      notes: period?.notes ?? null,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        valid_from: period?.valid_from ?? '',
        valid_to: period?.valid_to ?? null,
        employment_percentage: period?.employment_percentage ?? 100,
        notes: period?.notes ?? null,
      })
    }
  }, [open, period, form])

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

    if (period) {
      updateMutation.mutate(
        { epId: period.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Beschäftigungszeitraum aktualisiert')
            onOpenChange(false)
          },
          onError: handleError,
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Beschäftigungszeitraum hinzugefügt')
          onOpenChange(false)
        },
        onError: handleError,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const title = period ? 'Beschäftigungszeitraum bearbeiten' : 'Beschäftigungszeitraum hinzufügen'

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
              name="employment_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschäftigung (%) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="100"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
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
