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
import { useCreateDepartment, useUpdateDepartment } from './useDepartments'
import type { Department } from '@/lib/types'

const schema = z
  .object({
    name: z.string().min(1, 'Name ist erforderlich').max(200, 'Maximal 200 Zeichen'),
    short_name: z.string().max(50, 'Maximal 50 Zeichen').nullable().optional(),
    is_external: z.boolean(),
    is_shift_relevant: z.boolean(),
    display_order: z.number({ error: 'Zahl erforderlich' }).int(),
    requires_full_time: z.boolean(),
    min_headcount: z.number().int().min(0).nullable().optional(),
    max_headcount: z.number().int().min(0).nullable().optional(),
    active: z.boolean(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      const min = data.min_headcount
      const max = data.max_headcount
      if (min != null && max != null) return min <= max
      return true
    },
    {
      message: 'Mindestbesetzung darf nicht größer als Maximalbesetzung sein',
      path: ['min_headcount'],
    },
  )

type FormValues = z.infer<typeof schema>

interface DepartmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  department?: Department
}

export function DepartmentFormDialog({ open, onOpenChange, department }: DepartmentFormDialogProps) {
  const createMutation = useCreateDepartment()
  const updateMutation = useUpdateDepartment(department?.id ?? 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: department?.name ?? '',
      short_name: department?.short_name ?? null,
      is_external: department?.is_external ?? false,
      is_shift_relevant: department?.is_shift_relevant ?? true,
      display_order: department?.display_order ?? 0,
      requires_full_time: department?.requires_full_time ?? false,
      min_headcount: department?.min_headcount ?? null,
      max_headcount: department?.max_headcount ?? null,
      active: department?.active ?? true,
      notes: department?.notes ?? null,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: department?.name ?? '',
        short_name: department?.short_name ?? null,
        is_external: department?.is_external ?? false,
        is_shift_relevant: department?.is_shift_relevant ?? true,
        display_order: department?.display_order ?? 0,
        requires_full_time: department?.requires_full_time ?? false,
        min_headcount: department?.min_headcount ?? null,
        max_headcount: department?.max_headcount ?? null,
        active: department?.active ?? true,
        notes: department?.notes ?? null,
      })
    }
  }, [open, department, form])

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      short_name: values.short_name || null,
      notes: values.notes || null,
      min_headcount: values.min_headcount ?? null,
      max_headcount: values.max_headcount ?? null,
    }

    const handleError = (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Speichern fehlgeschlagen')
      }
    }

    if (department) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Station aktualisiert')
          onOpenChange(false)
        },
        onError: handleError,
      })
    } else {
      createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: () => {
          toast.success('Station hinzugefügt')
          onOpenChange(false)
        },
        onError: handleError,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const title = department ? 'Station bearbeiten' : 'Neue Station'

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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Intensivstation" {...field} value={field.value ?? ''} />
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
                  <FormLabel>Kurzname</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. ICU" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="is_external"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">Extern</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_shift_relevant"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">Dienst-relevant</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="requires_full_time"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel className="cursor-pointer font-normal">Vollzeit erforderlich</FormLabel>
                    <FormDescription className="text-xs">
                      Diese Rotation kann nur von Vollzeit-Mitarbeitern besetzt werden.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="min_headcount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mindestbesetzung</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value !== '' ? Number(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_headcount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximalbesetzung</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value !== '' ? Number(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Lassen Sie die Felder leer, wenn die Besetzung nicht definierbar ist.
            </p>

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
