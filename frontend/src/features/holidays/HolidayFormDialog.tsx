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
import { ApiError } from '@/lib/api'
import { useCreateHoliday } from './useHolidays'

const schema = z.object({
  date: z.string().min(1, 'Datum ist erforderlich'),
  name: z.string().min(1, 'Name ist erforderlich').max(200),
})

type FormValues = z.infer<typeof schema>

interface HolidayFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HolidayFormDialog({ open, onOpenChange }: HolidayFormDialogProps) {
  const createMutation = useCreateHoliday()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: '', name: '' },
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast.success('Feiertag hinzugefügt')
        form.reset()
        onOpenChange(false)
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          toast.error(err.detail)
        } else {
          toast.error('Speichern fehlgeschlagen')
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feiertag hinzufügen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Datum *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Brückentag" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
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
