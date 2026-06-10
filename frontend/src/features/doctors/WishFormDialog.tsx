import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { useCreateWish, useUpdateWish } from './useWishes'
import { useShiftTypes } from '@/features/shift-types/useShiftTypes'
import type { Doctor, Wish, WishType } from '@/lib/types'

type SubType = 'date' | 'weekday' | 'general'

const WISH_TYPE_LABELS: Record<WishType, string> = {
  AVOID_DAY: 'Tag vermeiden',
  AVOID_SHIFT: 'Dienst vermeiden',
  REQUIRE_SHIFT: 'Dienst wünschen',
}

const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

const schema = z.object({
  subType: z.enum(['date', 'weekday', 'general']),
  wish_date: z.string().nullable().optional(),
  day_of_week: z.number().min(0).max(6).nullable().optional(),
  wish_type: z.enum(['AVOID_DAY', 'AVOID_SHIFT', 'REQUIRE_SHIFT']),
  shift_type_id: z.number().nullable().optional(),
  priority: z.number().min(1).max(3),
  notes: z.string().nullable().optional(),
}).refine(
  (d) => d.subType !== 'date' || !!d.wish_date,
  { message: 'Datum ist erforderlich', path: ['wish_date'] },
).refine(
  (d) => d.subType !== 'weekday' || d.day_of_week != null,
  { message: 'Wochentag ist erforderlich', path: ['day_of_week'] },
).refine(
  (d) => (d.wish_type !== 'AVOID_SHIFT' && d.wish_type !== 'REQUIRE_SHIFT') || !!d.shift_type_id,
  { message: 'Schichttyp ist erforderlich', path: ['shift_type_id'] },
)

type FormValues = z.infer<typeof schema>

interface WishFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctorId: number | null
  doctors?: Doctor[]
  wish?: Wish
  prefilledDate?: string
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function isFuzzyMatch(query: string, value: string) {
  const normalizedQuery = normalizeSearch(query).replace(/\s+/g, '')
  const normalizedValue = normalizeSearch(value)
  if (!normalizedQuery) return true
  if (normalizedValue.includes(normalizedQuery)) return true

  let queryIndex = 0
  for (const char of normalizedValue) {
    if (char === normalizedQuery[queryIndex]) queryIndex += 1
    if (queryIndex === normalizedQuery.length) return true
  }
  return false
}

export function WishFormDialog({ open, onOpenChange, doctorId, doctors, wish, prefilledDate }: WishFormDialogProps) {
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(doctorId)
  const [doctorSearch, setDoctorSearch] = useState('')
  const createMutation = useCreateWish(selectedDoctorId ?? 0)
  const updateMutation = useUpdateWish(selectedDoctorId ?? 0)
  const { data: shiftTypes = [] } = useShiftTypes()

  const defaultSubType = (): SubType => {
    if (prefilledDate) return 'date'
    if (wish?.wish_date) return 'date'
    if (wish?.day_of_week != null) return 'weekday'
    if (wish) return 'general'
    return 'date'
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subType: defaultSubType(),
      wish_date: wish?.wish_date ?? prefilledDate ?? '',
      day_of_week: wish?.day_of_week ?? null,
      wish_type: wish?.wish_type ?? 'AVOID_DAY',
      shift_type_id: wish?.shift_type_id ?? null,
      priority: wish?.priority ?? 1,
      notes: wish?.notes ?? null,
    },
  })

  const subType = form.watch('subType')
  const wishType = form.watch('wish_type')
  const needsShiftType = wishType === 'AVOID_SHIFT' || wishType === 'REQUIRE_SHIFT'
  const showDoctorPicker = selectedDoctorId == null && doctors != null
  const filteredDoctors = useMemo(() => {
    if (!doctors) return []
    const query = doctorSearch.trim()
    return doctors.filter((doctor) => {
      const searchValue = `${doctor.name} ${doctor.short_name ?? ''}`
      return isFuzzyMatch(query, searchValue)
    })
  }, [doctors, doctorSearch])

  useEffect(() => {
    if (open) {
      setSelectedDoctorId(doctorId)
      setDoctorSearch('')
      form.reset({
        subType: defaultSubType(),
        wish_date: wish?.wish_date ?? prefilledDate ?? '',
        day_of_week: wish?.day_of_week ?? null,
        wish_type: wish?.wish_type ?? 'AVOID_DAY',
        shift_type_id: wish?.shift_type_id ?? null,
        priority: wish?.priority ?? 1,
        notes: wish?.notes ?? null,
      })
    }
  }, [open, wish, prefilledDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (values: FormValues) => {
    if (selectedDoctorId == null) return
    const payload = {
      wish_date: values.subType === 'date' ? (values.wish_date || null) : null,
      day_of_week: values.subType === 'weekday' ? values.day_of_week : null,
      wish_type: values.wish_type,
      shift_type_id: needsShiftType ? values.shift_type_id : null,
      priority: values.priority,
      notes: values.notes || null,
    }
    const handleError = (err: unknown) => {
      if (err instanceof ApiError) toast.error(err.detail)
      else toast.error('Speichern fehlgeschlagen')
    }
    if (wish) {
      updateMutation.mutate({ id: wish.id, data: payload }, {
        onSuccess: () => { toast.success('Wunsch aktualisiert'); onOpenChange(false) },
        onError: handleError,
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast.success('Wunsch gespeichert'); onOpenChange(false) },
        onError: handleError,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedDoctorId == null ? 'Arzt auswählen' : wish ? 'Wunsch bearbeiten' : 'Neuer Wunsch'}
          </DialogTitle>
        </DialogHeader>
        {showDoctorPicker ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="wish-doctor-search">Arzt suchen</label>
              <Input
                id="wish-doctor-search"
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Name oder Kürzel"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-line">
              {filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    type="button"
                    className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-line/30"
                    onClick={() => setSelectedDoctorId(doctor.id)}
                  >
                    <span className="text-ink">{doctor.name}</span>
                    {doctor.short_name && (
                      <span className="text-xs text-ink-3">{doctor.short_name}</span>
                    )}
                  </button>
                ))
              ) : (
                <p className="px-3 py-6 text-center text-sm text-ink-3">Keine Ärzte gefunden</p>
              )}
            </div>
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>

            {!prefilledDate && (
              <FormField
                control={form.control}
                name="subType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Art</FormLabel>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          id="sub-date"
                          value="date"
                          checked={field.value === 'date'}
                          onChange={() => field.onChange('date')}
                          className="accent-primary"
                          aria-label="Einzeltermin"
                        />
                        <span
                          className="text-sm font-medium cursor-pointer"
                          onClick={() => field.onChange('date')}
                        >
                          Konkretes Datum
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          id="sub-weekday"
                          value="weekday"
                          checked={field.value === 'weekday'}
                          onChange={() => field.onChange('weekday')}
                          className="accent-primary"
                          aria-label="Wochentag"
                        />
                        <span
                          className="text-sm font-medium cursor-pointer"
                          onClick={() => field.onChange('weekday')}
                        >
                          Wochentag
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          id="sub-general"
                          value="general"
                          checked={field.value === 'general'}
                          onChange={() => field.onChange('general')}
                          className="accent-primary"
                          aria-label="Allgemein"
                        />
                        <span
                          className="text-sm font-medium cursor-pointer"
                          onClick={() => field.onChange('general')}
                        >
                          Allgemein
                        </span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {subType === 'date' && (
              <FormField
                control={form.control}
                name="wish_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ''}
                        readOnly={!!prefilledDate}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {subType === 'weekday' && (
              <FormField
                control={form.control}
                name="day_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wochentag *</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Wochentag">
                          <SelectValue placeholder="Wochentag wählen…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEKDAY_LABELS.map((label, idx) => (
                          <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="wish_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(WISH_TYPE_LABELS).map(([v, label]) => (
                        <SelectItem key={v} value={v}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsShiftType && (
              <FormField
                control={form.control}
                name="shift_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schichttyp *</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Schichttyp"><SelectValue placeholder="Schichttyp wählen…" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {shiftTypes.map((st) => (
                          <SelectItem key={st.id} value={String(st.id)}>
                            {st.short_name} — {st.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorität</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1 — Normal</SelectItem>
                      <SelectItem value="2">2 — Wichtig</SelectItem>
                      <SelectItem value="3">3 — Dringend</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Textarea
                      placeholder="Optional…"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Speichern…' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
