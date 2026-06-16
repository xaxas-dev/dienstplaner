import { useCallback, useRef, useState } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAnalyzeImport, useCommitImport } from '../useExcelImport'
import { usePlans } from '../usePlans'
import { useShiftTypes } from '@/features/shift-types/useShiftTypes'
import { useDepartments } from '@/features/departments/useDepartments'
import type {
  ImportAnalysis,
  DepartmentMatch,
  DoctorMatch,
  CodeEntry,
  EntityResolution,
  CodeResolution,
  CommitResolutions,
} from '@/lib/importTypes'
import type { Plan, ShiftType, Department } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId?: number
}

type Step = 'upload' | 'reconcile' | 'target' | 'result'
type ReconcileTab = 'bereiche' | 'aerzte' | 'codes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function statusBadge(status: string) {
  switch (status) {
    case 'exact':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">exakt</span>
    case 'fuzzy':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">fuzzy</span>
    case 'new':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">neu</span>
    case 'unmatched':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">unbekannt</span>
    default:
      return null
  }
}

function tabCountBadge(count: number, variant: 'amber' | 'blue') {
  if (count === 0) return null
  const cls = variant === 'amber'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ml-1 ${cls}`}>
      {count}
    </span>
  )
}

// ─── Department Row ────────────────────────────────────────────────────────────

interface DeptRowProps {
  item: DepartmentMatch
  resolution: EntityResolution
  allDepts: Department[]
  onChange: (res: EntityResolution) => void
}

function DeptRow({ item, resolution, allDepts, onChange }: DeptRowProps) {
  const isExact = item.match_status === 'exact'

  function handleChange(val: string) {
    if (val === '__create__') { onChange({ action: 'create' }); return }
    if (val === '__skip__') { onChange({ action: 'skip' }); return }
    const id = parseInt(val, 10)
    if (!isNaN(id)) onChange({ action: 'map', id })
  }

  const currentValue = (() => {
    if (resolution.action === 'create') return '__create__'
    if (resolution.action === 'skip') return '__skip__'
    if (resolution.action === 'map') return String(resolution.id)
    return '__skip__'
  })()

  const candidateIds = new Set(item.candidates.map((c) => c.id))
  const remainingDepts = allDepts
    .filter((d) => !candidateIds.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-0">
      <div className="w-20 shrink-0">{statusBadge(item.match_status)}</div>
      <div className="flex-1 text-sm text-ink font-medium truncate" title={item.raw}>{item.raw}</div>
      {isExact ? (
        <div className="text-xs text-ink-3 italic">Übernommen (exakt)</div>
      ) : (
        <Select value={currentValue} onValueChange={handleChange}>
          <SelectTrigger className="w-52 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {item.candidates.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                → {c.name} ({Math.round(c.score)}%)
              </SelectItem>
            ))}
            {remainingDepts.length > 0 && (
              <>
                <SelectSeparator />
                {remainingDepts.map((d) => (
                  <SelectItem key={`all-${d.id}`} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
              </>
            )}
            <SelectItem value="__create__">Neu anlegen</SelectItem>
            <SelectItem value="__skip__">Ignorieren</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

// ─── Doctor Row ───────────────────────────────────────────────────────────────

interface DoctorRowProps {
  item: DoctorMatch
  resolution: EntityResolution
  onChange: (res: EntityResolution) => void
}

function DoctorRow({ item, resolution, onChange }: DoctorRowProps) {
  const isExact = item.match_status === 'exact'

  function handleChange(val: string) {
    if (val === '__create__') { onChange({ action: 'create' }); return }
    if (val === '__skip__') { onChange({ action: 'skip' }); return }
    const id = parseInt(val, 10)
    if (!isNaN(id)) onChange({ action: 'map', id })
  }

  const currentValue = (() => {
    if (resolution.action === 'create') return '__create__'
    if (resolution.action === 'skip') return '__skip__'
    if (resolution.action === 'map') return String(resolution.id)
    return '__skip__'
  })()

  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-0">
      <div className="w-20 shrink-0">{statusBadge(item.match_status)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink font-medium truncate" title={item.raw}>{item.raw}</div>
        {item.parsed_name !== item.raw && (
          <div className="text-xs text-ink-3 truncate">{item.parsed_name}</div>
        )}
      </div>
      {item.percentage != null && (
        <span className="text-xs text-ink-3 shrink-0">{item.percentage}%</span>
      )}
      {isExact ? (
        <div className="text-xs text-ink-3 italic shrink-0">Übernommen (exakt)</div>
      ) : (
        <Select value={currentValue} onValueChange={handleChange}>
          <SelectTrigger className="w-52 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {item.candidates.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                → {c.name}
              </SelectItem>
            ))}
            <SelectItem value="__create__">Neu anlegen</SelectItem>
            <SelectItem value="__skip__">Ignorieren</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

// ─── Code Row ─────────────────────────────────────────────────────────────────

interface CodeRowProps {
  item: CodeEntry
  resolution: CodeResolution
  shiftTypes: ShiftType[]
  onChange: (res: CodeResolution) => void
}

const ABSENCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'URLAUB', label: 'Als Abwesenheit: URLAUB' },
  { value: 'KRANKHEIT', label: 'Als Abwesenheit: KRANKHEIT' },
  { value: 'FORTBILDUNG', label: 'Als Abwesenheit: FORTBILDUNG' },
  { value: 'ELTERNZEIT', label: 'Als Abwesenheit: ELTERNZEIT' },
  { value: 'MUTTERSCHUTZ', label: 'Als Abwesenheit: MUTTERSCHUTZ' },
  { value: 'EINARBEITUNG', label: 'Als Abwesenheit: EA (Einarbeitung)' },
  { value: 'EINARBEITUNG_INA', label: 'Als Abwesenheit: INA-EA (Einarbeitung INA)' },
  { value: 'UNBESETZT', label: 'Station unbesetzt' },
  { value: 'SONSTIGES', label: 'Als Abwesenheit: DIV (Sonstiges)' },
]

function CodeRow({ item, resolution, shiftTypes, onChange }: CodeRowProps) {
  const isCreateShift = resolution.action === 'create_shift'

  function handleChange(val: string) {
    if (val === '__ignore__') { onChange({ action: 'ignore' }); return }
    if (val === '__create_shift__') {
      // Vorbelegen mit dem Roh-Code als Kürzel; Name leer für User-Eingabe.
      const prevShort = isCreateShift ? resolution.short_name : item.raw
      const prevName = isCreateShift ? resolution.name : ''
      onChange({ action: 'create_shift', short_name: prevShort, name: prevName })
      return
    }
    if (val.startsWith('absence:')) {
      onChange({ action: 'absence', absence_type: val.slice('absence:'.length) })
      return
    }
    if (val.startsWith('shift:')) {
      const id = parseInt(val.slice('shift:'.length), 10)
      if (!isNaN(id)) onChange({ action: 'shift', shift_type_id: id })
      return
    }
    if (val.startsWith('springer:')) {
      const id = parseInt(val.slice('springer:'.length), 10)
      if (!isNaN(id)) onChange({ action: 'springer', department_id: id })
      return
    }
  }

  const currentValue = (() => {
    if (resolution.action === 'ignore') return '__ignore__'
    if (resolution.action === 'absence') return `absence:${resolution.absence_type}`
    if (resolution.action === 'shift') return `shift:${resolution.shift_type_id}`
    if (resolution.action === 'create_shift') return '__create_shift__'
    if (resolution.action === 'springer') return `springer:${resolution.department_id}`
    return '__ignore__'
  })()

  return (
    <div className="flex flex-col gap-2 py-2 border-b border-line last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-paper border border-line text-ink">
            {item.raw}
          </span>
        </div>
        <div className="flex-1" />
        <Select value={currentValue} onValueChange={handleChange}>
          <SelectTrigger className="w-60 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ignore__">Ignorieren</SelectItem>
            {item.department_id != null && (
              <SelectItem value={`springer:${item.department_id}`}>
                Als Springer: {item.department_short_name ?? item.raw}
              </SelectItem>
            )}
            {ABSENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={`absence:${opt.value}`}>
                {opt.label}
              </SelectItem>
            ))}
            {shiftTypes.map((st) => (
              <SelectItem key={st.id} value={`shift:${st.id}`}>
                Als Schicht: {st.name}
              </SelectItem>
            ))}
            <SelectItem value="__create_shift__">Neuen Schichttyp anlegen…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCreateShift && (
        <div className="flex items-center gap-2 pl-[4.75rem]">
          <input
            type="text"
            value={resolution.short_name}
            placeholder="Kürzel"
            onChange={(e) =>
              onChange({ action: 'create_shift', short_name: e.target.value, name: resolution.name })
            }
            className="w-24 h-7 px-2 text-xs rounded border border-line bg-card text-ink"
          />
          <input
            type="text"
            value={resolution.name}
            placeholder="Name"
            onChange={(e) =>
              onChange({ action: 'create_shift', short_name: resolution.short_name, name: e.target.value })
            }
            className="flex-1 h-7 px-2 text-xs rounded border border-line bg-card text-ink"
          />
        </div>
      )}

      {item.default_note && (
        <div className="pl-[4.75rem] text-[10px] text-ink-3">
          Notiz: <span className="font-mono">{item.default_note}</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function ImportDialog({ open, onOpenChange, planId }: ImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null)
  const [reconcileTab, setReconcileTab] = useState<ReconcileTab>('bereiche')
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new')
  const [targetPlanId, setTargetPlanId] = useState<string>('')
  const [deptResolutions, setDeptResolutions] = useState<Record<string, EntityResolution>>({})
  const [doctorResolutions, setDoctorResolutions] = useState<Record<string, EntityResolution>>({})
  const [codeResolutions, setCodeResolutions] = useState<Record<string, CodeResolution>>({})
  const [commitError, setCommitError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const analyzeImport = useAnalyzeImport()
  const commitImport = useCommitImport(planId)
  const { data: plans = [] } = usePlans()
  const { data: shiftTypes = [] } = useShiftTypes()
  const { data: allDepts = [] } = useDepartments()

  function reset() {
    setStep('upload')
    setFile(null)
    setAnalysis(null)
    setReconcileTab('bereiche')
    setTargetMode('new')
    setTargetPlanId('')
    setDeptResolutions({})
    setDoctorResolutions({})
    setCodeResolutions({})
    setCommitError(null)
    analyzeImport.reset()
    commitImport.reset()
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  // Build default resolutions from analysis
  function buildDefaultResolutions(a: ImportAnalysis) {
    const depts: Record<string, EntityResolution> = {}
    for (const d of a.departments) {
      if (d.default_action === 'map' && d.matched_id != null) {
        depts[d.raw] = { action: 'map', id: d.matched_id }
      } else if (d.default_action === 'create') {
        depts[d.raw] = { action: 'create' }
      } else {
        depts[d.raw] = { action: 'skip' }
      }
    }

    const doctors: Record<string, EntityResolution & { percentage?: number }> = {}
    for (const doc of a.doctors) {
      const pct = doc.percentage != null ? { percentage: doc.percentage } : {}
      if (doc.default_action === 'map' && doc.matched_id != null) {
        doctors[doc.raw] = { action: 'map', id: doc.matched_id, ...pct }
      } else if (doc.default_action === 'create') {
        doctors[doc.raw] = { action: 'create', ...pct }
      } else {
        doctors[doc.raw] = { action: 'skip' }
      }
    }

    const codes: Record<string, CodeResolution> = {}
    for (const c of a.codes) {
      if (c.default_action === 'absence' && c.absence_type) {
        codes[c.raw] = { action: 'absence', absence_type: c.absence_type }
      } else if (c.default_action === 'shift' && c.shift_type_id != null) {
        codes[c.raw] = { action: 'shift', shift_type_id: c.shift_type_id }
      } else if (c.default_action === 'springer' && c.department_id != null) {
        codes[c.raw] = { action: 'springer', department_id: c.department_id }
      } else {
        codes[c.raw] = { action: 'ignore' }
      }
    }

    return { depts, doctors, codes }
  }

  function handleFileSelect(selectedFile: File) {
    setFile(selectedFile)
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      handleFileSelect(f)
    }
  }, [])

  function handleAnalyze() {
    if (!file) return
    analyzeImport.mutate(file, {
      onSuccess: (result) => {
        setAnalysis(result)
        const { depts, doctors, codes } = buildDefaultResolutions(result)
        setDeptResolutions(depts)
        setDoctorResolutions(doctors)
        setCodeResolutions(codes)
        setStep('reconcile')
      },
    })
  }

  function handleCommit() {
    if (!file || !analysis) return
    setCommitError(null)

    const resolutions: CommitResolutions = {
      target_plan: targetMode === 'new'
        ? {
            mode: 'new',
            name: `${MONTH_NAMES[analysis.month.month - 1]} ${analysis.month.year}`,
            valid_from: analysis.month.valid_from,
            valid_to: analysis.month.valid_to,
          }
        : { mode: 'existing', plan_id: parseInt(targetPlanId, 10) },
      department_resolutions: deptResolutions,
      doctor_resolutions: doctorResolutions,
      code_resolutions: codeResolutions,
    }

    commitImport.mutate(
      { file, resolutions },
      {
        onSuccess: () => {
          setStep('result')
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
          setCommitError(msg)
        },
      },
    )
  }

  // Counts for tab badges
  const fuzzyDepts = analysis?.departments.filter((d) => d.match_status === 'fuzzy').length ?? 0
  const newDepts = analysis?.departments.filter((d) => d.match_status === 'new').length ?? 0
  const fuzzyDoctors = analysis?.doctors.filter((d) => d.match_status === 'fuzzy').length ?? 0
  const newDoctors = analysis?.doctors.filter((d) => d.match_status === 'new').length ?? 0
  const unmatchedCodes = analysis?.codes.filter((c) => c.default_action === 'unmatched').length ?? 0

  const monthLabel = analysis
    ? `${MONTH_NAMES[analysis.month.month - 1]} ${analysis.month.year}`
    : ''

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-ink-3" />
            Besetzungsplan importieren
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 text-xs text-ink-3 border-b border-line pb-3 shrink-0">
          {(['upload', 'reconcile', 'target', 'result'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = {
              upload: '1. Datei',
              reconcile: '2. Abgleich',
              target: '3. Zielplan',
              result: '4. Ergebnis',
            }
            const isActive = step === s
            const isDone = (['upload', 'reconcile', 'target', 'result'] as Step[]).indexOf(s) <
                           (['upload', 'reconcile', 'target', 'result'] as Step[]).indexOf(step)
            return (
              <div key={s} className="flex items-center">
                {i > 0 && <div className="w-6 h-px bg-line mx-1" />}
                <span className={cn(
                  'px-2 py-0.5 rounded',
                  isActive && 'text-ink font-semibold',
                  isDone && 'text-green-600',
                )}>
                  {labels[s]}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Step 1: Upload ─────────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="p-2 flex flex-col gap-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
                  isDragOver ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/50 hover:bg-paper',
                )}
              >
                <Upload className={cn('size-8', isDragOver ? 'text-accent' : 'text-ink-3')} />
                {file ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-ink">{file.name}</span>
                    <span className="text-xs text-ink-3">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-ink">Excel-Datei hier ablegen</span>
                    <span className="text-xs text-ink-3">oder klicken zum Auswählen (.xlsx)</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelect(f)
                  }}
                />
              </div>

              {analyzeImport.isError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{analyzeImport.error instanceof Error ? analyzeImport.error.message : 'Analyse fehlgeschlagen'}</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleAnalyze}
                  disabled={!file || analyzeImport.isPending}
                >
                  {analyzeImport.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analysiere…
                    </span>
                  ) : 'Analysieren'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Reconcile ──────────────────────────────────────── */}
          {step === 'reconcile' && analysis && (
            <div className="flex flex-col gap-0">
              {/* Tab bar */}
              <div className="flex gap-0 border-b border-line px-2 shrink-0">
                {(
                  [
                    { id: 'bereiche' as ReconcileTab, label: 'Bereiche', fuzzy: fuzzyDepts, neu: newDepts },
                    { id: 'aerzte' as ReconcileTab, label: 'Ärzte', fuzzy: fuzzyDoctors, neu: newDoctors },
                    { id: 'codes' as ReconcileTab, label: 'Codes', fuzzy: unmatchedCodes, neu: 0 },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReconcileTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-2 text-sm border-b-2 transition-colors',
                      reconcileTab === tab.id
                        ? 'border-accent text-ink font-medium'
                        : 'border-transparent text-ink-3 hover:text-ink',
                    )}
                  >
                    {tab.label}
                    {tabCountBadge(tab.fuzzy, 'amber')}
                    {tabCountBadge(tab.neu, 'blue')}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-4 flex flex-col gap-0">
                {reconcileTab === 'bereiche' && (
                  analysis.departments.length === 0 ? (
                    <div className="text-sm text-ink-3 py-4 text-center">Keine Bereiche gefunden</div>
                  ) : analysis.departments.map((dept) => (
                    <DeptRow
                      key={dept.raw}
                      item={dept}
                      resolution={deptResolutions[dept.raw] ?? { action: 'skip' }}
                      allDepts={allDepts}
                      onChange={(res) => setDeptResolutions((prev) => ({ ...prev, [dept.raw]: res }))}
                    />
                  ))
                )}

                {reconcileTab === 'aerzte' && (
                  analysis.doctors.length === 0 ? (
                    <div className="text-sm text-ink-3 py-4 text-center">Keine Ärzte gefunden</div>
                  ) : analysis.doctors.map((doc) => (
                    <DoctorRow
                      key={doc.raw}
                      item={doc}
                      resolution={doctorResolutions[doc.raw] ?? { action: 'skip' }}
                      onChange={(res) => setDoctorResolutions((prev) => ({ ...prev, [doc.raw]: res }))}
                    />
                  ))
                )}

                {reconcileTab === 'codes' && (
                  analysis.codes.length === 0 ? (
                    <div className="text-sm text-ink-3 py-4 text-center">Keine Codes gefunden</div>
                  ) : analysis.codes.map((code) => (
                    <CodeRow
                      key={code.raw}
                      item={code}
                      shiftTypes={shiftTypes}
                      resolution={codeResolutions[code.raw] ?? { action: 'ignore' }}
                      onChange={(res) => setCodeResolutions((prev) => ({ ...prev, [code.raw]: res }))}
                    />
                  ))
                )}
              </div>

              {/* Warnings */}
              {analysis.warnings.length > 0 && (
                <div className="mx-4 mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1.5">
                    <AlertTriangle className="size-3.5" />
                    Hinweise
                  </div>
                  <ul className="space-y-1">
                    {analysis.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-700">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between px-4 pb-4">
                <Button variant="outline" onClick={() => setStep('upload')}>Zurück</Button>
                <Button onClick={() => setStep('target')}>Weiter</Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Target Plan ────────────────────────────────────── */}
          {step === 'target' && analysis && (
            <div className="p-4 flex flex-col gap-4">
              <div className="text-sm text-ink-2">
                Wohin soll der Import geschrieben werden?
              </div>

              {/* Radio: Neuer Plan */}
              <label className={cn(
                'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                targetMode === 'new' ? 'border-accent bg-accent/5' : 'border-line hover:bg-paper',
              )}>
                <input
                  type="radio"
                  name="targetMode"
                  value="new"
                  checked={targetMode === 'new'}
                  onChange={() => setTargetMode('new')}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div>
                  <div className="text-sm font-medium text-ink">Neuer Plan</div>
                  <div className="text-xs text-ink-3 mt-0.5">
                    Erstellt „{monthLabel}" ({analysis.month.valid_from} – {analysis.month.valid_to})
                  </div>
                </div>
              </label>

              {/* Radio: Bestehender Plan */}
              <label className={cn(
                'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                targetMode === 'existing' ? 'border-accent bg-accent/5' : 'border-line hover:bg-paper',
              )}>
                <input
                  type="radio"
                  name="targetMode"
                  value="existing"
                  checked={targetMode === 'existing'}
                  onChange={() => setTargetMode('existing')}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink">Bestehender Plan</div>
                  <div className="text-xs text-ink-3 mt-0.5 mb-2">In einen vorhandenen Plan schreiben</div>
                  {targetMode === 'existing' && (
                    <Select
                      value={targetPlanId}
                      onValueChange={setTargetPlanId}
                    >
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue placeholder="Plan auswählen…" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p: Plan) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </label>

              {commitError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{commitError}</span>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('reconcile')}>Zurück</Button>
                <Button
                  onClick={handleCommit}
                  disabled={
                    commitImport.isPending ||
                    (targetMode === 'existing' && !targetPlanId)
                  }
                >
                  {commitImport.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Importiere…
                    </span>
                  ) : 'Importieren'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Result ─────────────────────────────────────────── */}
          {step === 'result' && (
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="size-12 text-green-500" />
              <div>
                <div className="text-lg font-semibold text-ink">Import erfolgreich</div>
                <div className="text-sm text-ink-3 mt-1">
                  Der Besetzungsplan wurde importiert.
                </div>
              </div>
              <Button onClick={() => handleOpenChange(false)}>Schließen</Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
