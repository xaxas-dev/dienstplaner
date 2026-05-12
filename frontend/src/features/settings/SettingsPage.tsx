import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSettings, useUpdateSetting, type AppSettingResponse } from '@/lib/useSettings'

function SettingCard({ setting }: { setting: AppSettingResponse }) {
  const [value, setValue] = useState(setting.value)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateSetting(setting.key)

  function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Wert darf nicht leer sein.')
      return
    }
    if (trimmed.length > 1000) {
      setError('Wert darf maximal 1000 Zeichen lang sein.')
      return
    }
    setError(null)
    update.mutate(trimmed, {
      onSuccess: () => {
        toast.success('Einstellung gespeichert')
      },
      onError: () => {
        toast.error('Fehler beim Speichern')
      },
    })
  }

  const label = setting.description ?? setting.key

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor={`setting-${setting.key}`} className="sr-only">
          {label}
        </Label>
        <div className="flex gap-2">
          <Input
            id={`setting-${setting.key}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleSave} disabled={update.isPending}>
            Speichern
          </Button>
        </div>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const { data: settings, isLoading, isError } = useSettings()

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-semibold mb-6">Einstellungen</h2>
      {isLoading && <p className="text-muted-foreground">Lade Einstellungen…</p>}
      {isError && <p className="text-destructive">Fehler beim Laden der Einstellungen.</p>}
      {settings && (
        <div className="space-y-4">
          {settings.map((setting) => (
            <SettingCard key={setting.key} setting={setting} />
          ))}
        </div>
      )}
    </div>
  )
}
