import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import { ApiError } from '@/lib/api'
import { useCreateShiftType, useUpdateShiftType } from './useShiftTypes'
import type { ShiftType } from '@/lib/types'

const schema = z
  .object({
    name: z.string().min(1, 'Name ist erforderlich'),
    short_name: z
      .string()
      .min(1, 'Kurzname ist erforderlich')
      .max(20, 'Maximal 20 Zeichen'),
    applies_on_weekdays: z.boolean(),
    applies_on_weekend: z.boolean(),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    display_order: z.number({ error: 'Zahl erforderlich' }).int(),
    active: z.boolean(),
    notes: z.string().nullable().optional(),
  })
  .refine((d) => d.applies_on_weekdays || d.applies_on_weekend, {
    message: 'Mindestens ein Tag-Typ muss aktiv sein (Werktag oder Wochenende)',
    path: ['applies_on_weekend'],
  })
  .refine(
    (d) => {
      const hasStart = !!d.start_time
      const hasEnd = !!d.end_time
      return hasStart === hasEnd
    },
    {
      message: 'Beide Zeiten angeben oder beide leer lassen',
      path: ['end_time'],
    },
  )
  .refine(
    (d) => {
      if (d.start_time && d.end_time) return d.start_time !== d.end_time
      return true
    },
    {
      message: 'Start- und Endzeit dürfen nicht identisch sein',
      path: ['end_time'],
    },
  )

type FormValues = z.infer<typeof schema>

interface ShiftTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftType?: ShiftType
}

export function ShiftTypeFormDialog({ open, onOpenChange, shiftType }: ShiftTypeFormDialogProps) {
  const createMutation = useCreateShiftType()
  const updateMutation = useUpdateShiftType(shiftType?.id ?? 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: shiftType?.name ?? '',
      short_name: shiftType?.short_name ?? '',
      applies_on_weekdays: shiftType?.applies_on_weekdays ?? true,
      applies_on_weekend: shiftType?.applies_on_weekend ?? false,
      start_time: shiftType?.start_time ?? null,
      end_time: shiftType?.end_time ?? null,
      display_order: shiftType?.display_order ?? 0,
      active: shiftType?.active ?? true,
      notes: shiftType?.notes ?? null,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: shiftType?.name ?? '',
        short_name: shiftType?.short_name ?? '',
        applies_on_weekdays: shiftType?.applies_on_weekdays ?? true,
        applies_on_weekend: shiftType?.applies_on_weekend ?? false,
        start_time: shiftType?.start_time ?? null,
        end_time: shiftType?.end_time ?? null,
        display_order: shiftType?.display_order ?? 0,
        active: shiftType?.active ?? true,
        notes: shiftType?.notes ?? null,
      })
    }
  }, [open, shiftType, form])

  const watchStartTime = form.watch('start_time')
  const watchEndTime = form.watch('end_time')
  const isMidnightShift =
    !!watchStartTime && !!watchEndTime && watchStartTime > watchEndTime

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      notes: values.notes || null,
    }

    const handleError = (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Speichern fehlgeschlagen')
      }
    }

    if (shiftType) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Schichttyp aktualisiert')
          onOpenChange(false)
        },
        onError: handleError,
      })
    } else {
      createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: () => {
          toast.success('Schichttyp hinzugefügt')
          onOpenChange(false)
        },
        onError: handleError,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const title = shiftType ? 'Schichttyp bearbeiten' : 'Neuer Schichttyp'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. Tagdienst" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="short_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kurzname *</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. T" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="applies_on_weekdays"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">Werktag</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="applies_on_weekend"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">Wochenende</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beginn</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ende</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    {isMidnightShift && (
                      <FormDescription className="text-xs text-ink-2">
                        Schicht über Mitternacht, z.B. 21:00 bis 07:00
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reihenfolge</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">Aktiv</FormLabel>
                  </FormItem>
                )}
              />
            </div>

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
