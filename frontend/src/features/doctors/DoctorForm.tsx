import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import { useCreateDoctor, useUpdateDoctor } from './useDoctors'
import type { Doctor } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200, 'Maximal 200 Zeichen'),
  title: z.string().max(50, 'Maximal 50 Zeichen').nullable().optional(),
  short_name: z.string().max(50, 'Maximal 50 Zeichen').nullable().optional(),
  doctor_type: z.enum(['INTERNAL', 'EXTERNAL']),
  is_facharzt: z.boolean(),
  active: z.boolean(),
  entry_date: z.string().nullable().optional(),
  virtual_entry_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

interface DoctorFormProps {
  doctor?: Doctor
  onSuccess?: (id: number) => void
}

export function DoctorForm({ doctor, onSuccess }: DoctorFormProps) {
  const navigate = useNavigate()
  const createMutation = useCreateDoctor()
  const updateMutation = useUpdateDoctor(doctor?.id ?? 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: doctor?.name ?? '',
      title: doctor?.title ?? null,
      short_name: doctor?.short_name ?? null,
      doctor_type: doctor?.doctor_type ?? 'INTERNAL',
      is_facharzt: doctor?.is_facharzt ?? false,
      active: doctor?.active ?? true,
      entry_date: doctor?.entry_date ?? null,
      virtual_entry_date: doctor?.virtual_entry_date ?? null,
      notes: doctor?.notes ?? null,
    },
  })

  const doctorType = form.watch('doctor_type')

  // Reset when doctor prop changes (e.g. after save)
  useEffect(() => {
    if (doctor) {
      form.reset({
        name: doctor.name,
        title: doctor.title ?? null,
        short_name: doctor.short_name ?? null,
        doctor_type: doctor.doctor_type,
        is_facharzt: doctor.is_facharzt,
        active: doctor.active,
        entry_date: doctor.entry_date ?? null,
        virtual_entry_date: doctor.virtual_entry_date ?? null,
        notes: doctor.notes ?? null,
      })
    }
  }, [doctor, form])

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      title: values.title || null,
      short_name: values.short_name || null,
      notes: values.notes || null,
      entry_date: values.entry_date || null,
      virtual_entry_date: values.virtual_entry_date || null,
    }

    if (doctor) {
      updateMutation.mutate(payload, {
        onSuccess: (updated) => {
          toast.success('Arzt gespeichert')
          onSuccess?.(updated.id)
        },
        onError: (err) => handleError(err),
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => {
          toast.success('Arzt angelegt')
          onSuccess?.(created.id)
          void navigate(`/doctors/${created.id}`)
        },
        onError: (err) => handleError(err),
      })
    }
  }

  const handleError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status >= 500) {
        toast.error('Speichern fehlgeschlagen, bitte erneut versuchen', { duration: 7000 })
        return
      }
      toast.error(err.detail)
    } else {
      toast.error('Ein unerwarteter Fehler ist aufgetreten')
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Anna Berger" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Titel */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                value={field.value ?? '__none__'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Kein Titel" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">Kein Titel</SelectItem>
                  <SelectItem value="Dr.">Dr.</SelectItem>
                  <SelectItem value="Prof.">Prof.</SelectItem>
                  <SelectItem value="PD">PD</SelectItem>
                  <SelectItem value="Prof. Dr.">Prof. Dr.</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Kurzname */}
        <FormField
          control={form.control}
          name="short_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kurzname</FormLabel>
              <FormControl>
                <Input
                  placeholder="MM"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Typ */}
        <FormField
          control={form.control}
          name="doctor_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Typ</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="INTERNAL">Intern</SelectItem>
                  <SelectItem value="EXTERNAL">Extern</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Facharzt */}
        <FormField
          control={form.control}
          name="is_facharzt"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0 cursor-pointer">Facharzt</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Eintrittsdatum */}
        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Eintrittsdatum</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Virtuelles Eintrittsdatum */}
        <FormField
          control={form.control}
          name="virtual_entry_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Virtuelles Eintrittsdatum</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Aktiv */}
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0 cursor-pointer">Aktiv</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notizen */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notizen</FormLabel>
              <FormControl>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Optionale Notizen…"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Speichern…' : 'Speichern'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void navigate(-1)}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Form>
  )
}
