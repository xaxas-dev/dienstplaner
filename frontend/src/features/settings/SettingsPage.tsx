import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CommandBar } from '@/components/dp/CommandBar'
import { useSettings, useUpdateSetting, type AppSettingResponse } from '@/lib/useSettings'
import { useAppSettings } from '@/stores/useAppSettings'

function SettingRow({ setting }: { setting: AppSettingResponse }) {
  const [value, setValue] = useState(setting.value)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateSetting(setting.key)

  function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) { setError('Wert darf nicht leer sein.'); return }
    if (trimmed.length > 1000) { setError('Wert darf maximal 1000 Zeichen lang sein.'); return }
    setError(null)
    update.mutate(trimmed, {
      onSuccess: () => toast.success('Einstellung gespeichert'),
      onError: () => toast.error('Fehler beim Speichern'),
    })
  }

  const label = setting.description ?? setting.key

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`setting-${setting.key}`} className="text-sm font-medium text-ink">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={`setting-${setting.key}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleSave} disabled={update.isPending} variant="outline" size="sm">
          {update.isPending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function SettingsPage() {
  const { data: settings, isLoading, isError } = useSettings()
  const { devMode, setDevMode, solverEnabled, setSolverEnabled } = useAppSettings()

  return (
    <div className="flex flex-col h-full">
      <CommandBar title="Einstellungen" />

      <div className="flex-1 px-10 py-6 overflow-y-auto">
        <div className="max-w-xl space-y-6">
          <div className="rounded-2xl bg-card border border-line p-5">
            <div className="flex items-center justify-between py-3 border-b border-line">
              <div>
                <p className="text-sm font-medium text-ink">Entwicklermodus</p>
                <p className="text-xs text-ink-3 mt-0.5">Aktiviert Entwickler-Werkzeuge in der App</p>
              </div>
              <Switch
                checked={devMode}
                onCheckedChange={setDevMode}
                aria-label="Entwicklermodus aktivieren"
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-ink">Solver (Plan generieren)</p>
                <p className="text-xs text-ink-3 mt-0.5">
                  Blendet den Plan-Generator ein. Erfordert Java 21 (Eclipse Temurin).
                </p>
              </div>
              <Switch
                checked={solverEnabled}
                onCheckedChange={setSolverEnabled}
                aria-label="Solver aktivieren"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-line p-5">
            {isLoading && <p className="text-sm text-ink-3">Lade Einstellungen…</p>}
            {isError && <p className="text-sm text-destructive">Fehler beim Laden der Einstellungen.</p>}
            {settings && (
              <div className="space-y-5">
                {settings.map((setting) => (
                  <SettingRow key={setting.key} setting={setting} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
