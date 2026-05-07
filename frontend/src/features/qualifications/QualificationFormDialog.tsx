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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ApiError } from '@/lib/api'
import { useCreateQualification, useUpdateQualification } from './useQualifications'
import type { Qualification } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  short_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface QualificationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qualification?: Qualification
}

export function QualificationFormDialog({
  open,
  onOpenChange,
  qualification,
}: QualificationFormDialogProps) {
  const createMutation = useCreateQualification()
  const updateMutation = useUpdateQualification(qualification?.id ?? 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: qualification?.name ?? '',
      short_name: qualification?.short_name ?? null,
      description: qualification?.description ?? null,
      active: qualification?.active ?? true,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: qualification?.name ?? '',
        short_name: qualification?.short_name ?? null,
        description: qualification?.description ?? null,
        active: qualification?.active ?? true,
      })
    }
  }, [open, qualification, form])

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      short_name: values.short_name || null,
      description: values.description || null,
    }

    const handleError = (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Speichern fehlgeschlagen')
      }
    }

    if (qualification) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Qualifikation aktualisiert')
          onOpenChange(false)
        },
        onError: handleError,
      })
    } else {
      createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: () => {
          toast.success('Qualifikation hinzugefügt')
          onOpenChange(false)
        },
        onError: handleError,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const title = qualification ? 'Qualifikation bearbeiten' : 'Neue Qualifikation'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Notarzt" {...field} value={field.value ?? ''} />
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
                    <Input placeholder="z.B. NA" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
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
