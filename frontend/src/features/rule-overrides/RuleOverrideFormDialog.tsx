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
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useDoctors } from '@/features/doctors/useDoctors'
import { useCreateRuleOverride, useUpdateRuleOverride } from './useRuleOverrides'
import type { RuleOverride } from '@/lib/types'

const schema = z
  .object({
    rule_key: z.string().min(1, 'Regelschlüssel ist erforderlich'),
    scope: z.enum(['GLOBAL', 'DOCTOR']),
    doctor_id: z.number({ error: 'Arzt ist erforderlich' }).nullable().optional(),
    valid_from: z.string().nullable().optional(),
    valid_to: z.string().nullable().optional(),
    override_value: z.string().min(1, 'Wert ist erforderlich'),
    reason: z.string().nullable().optional(),
  })
  .refine((d) => d.scope !== 'DOCTOR' || d.doctor_id != null, {
    message: 'Arzt muss ausgewählt sein',
    path: ['doctor_id'],
  })
  .refine(
    (d) => {
      if (d.valid_from && d.valid_to) return d.valid_from <= d.valid_to
      return true
    },
    {
      message: 'Enddatum muss nach dem Startdatum liegen',
      path: ['valid_to'],
    },
  )

type FormValues = z.infer<typeof schema>

interface RuleOverrideFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ruleOverride?: RuleOverride
}

export function RuleOverrideFormDialog({
  open,
  onOpenChange,
  ruleOverride,
}: RuleOverrideFormDialogProps) {
  const createMutation = useCreateRuleOverride()
  const updateMutation = useUpdateRuleOverride(ruleOverride?.id ?? 0)
  const { data: doctors } = useDoctors(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rule_key: ruleOverride?.rule_key ?? '',
      scope: ruleOverride?.scope ?? 'GLOBAL',
      doctor_id: ruleOverride?.doctor_id ?? null,
      valid_from: ruleOverride?.valid_from ?? null,
      valid_to: ruleOverride?.valid_to ?? null,
      override_value: ruleOverride?.override_value ?? '',
      reason: ruleOverride?.reason ?? null,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        rule_key: ruleOverride?.rule_key ?? '',
        scope: ruleOverride?.scope ?? 'GLOBAL',
        doctor_id: ruleOverride?.doctor_id ?? null,
        valid_from: ruleOverride?.valid_from ?? null,
        valid_to: ruleOverride?.valid_to ?? null,
        override_value: ruleOverride?.override_value ?? '',
        reason: ruleOverride?.reason ?? null,
      })
    }
  }, [open, ruleOverride, form])

  const watchScope = form.watch('scope')

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      doctor_id: values.scope === 'GLOBAL' ? null : (values.doctor_id ?? null),
      valid_from: values.valid_from || null,
      valid_to: values.valid_to || null,
      reason: values.reason || null,
    }

    const handleError = (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Speichern fehlgeschlagen')
      }
    }

    if (ruleOverride) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Sonderregelung aktualisiert')
          onOpenChange(false)
        },
        onError: handleError,
      })
    } else {
      createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: () => {
          toast.success('Sonderregelung gespeichert')
          onOpenChange(false)
        },
        onError: handleError,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const title = ruleOverride ? 'Sonderregelung bearbeiten' : 'Neue Sonderregelung'

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
            <FormField
              control={form.control}
              name="rule_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regelschlüssel *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. max_bereitschaft_per_month"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geltungsbereich *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val)
                        if (val === 'GLOBAL') {
                          form.setValue('doctor_id', null)
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GLOBAL">Global</SelectItem>
                        <SelectItem value="DOCTOR">Pro Arzt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchScope === 'DOCTOR' && (
                <FormField
                  control={form.control}
                  name="doctor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arzt *</FormLabel>
                      <Select
                        value={field.value != null ? String(field.value) : ''}
                        onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Arzt wählen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...(doctors ?? [])]
                            .sort((a, b) => a.name.localeCompare(b.name, 'de'))
                            .map((d) => (
                              <SelectItem key={d.id} value={String(d.id)}>
                                {d.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gültig ab</FormLabel>
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
              name="override_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wert *</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. 4" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Begründung</FormLabel>
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
