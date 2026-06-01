import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiGet } from '@/lib/api'
import { useUserProfile } from '@/stores/useUserProfile'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileEditModal({ open, onOpenChange }: Props) {
  const { name, title, note, setProfile } = useUserProfile()
  const [localName, setLocalName] = useState(name)
  const [localTitle, setLocalTitle] = useState(title)
  const [localNote, setLocalNote] = useState(note)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalName(name)
      setLocalTitle(title)
      setLocalNote(note)
    }
  }, [open, name, title, note])

  const { data: hwData } = useQuery({
    queryKey: ['hardware-id'],
    queryFn: () => apiGet<{ hardware_id: string }>('/api/system/hardware-id'),
    staleTime: Infinity,
  })

  function handleSave() {
    setProfile({
      name: localName.trim() || 'Planer',
      title: localTitle.trim(),
      note: localNote.trim(),
    })
    onOpenChange(false)
  }

  function handleCopy() {
    if (!hwData?.hardware_id) return
    void navigator.clipboard.writeText(hwData.hardware_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-80">
        <DialogHeader>
          <DialogTitle>Profil</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-ink-3">Geräte-ID</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs px-2 py-1 bg-paper rounded border border-line font-mono text-ink-2 truncate">
                {hwData?.hardware_id ?? '—'}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!hwData?.hardware_id}
                aria-label="Geräte-ID kopieren"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs">Name</Label>
            <Input
              id="profile-name"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              maxLength={60}
              placeholder="Planer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-title" className="text-xs">Titel</Label>
            <Input
              id="profile-title"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              maxLength={80}
              placeholder="z. B. Oberarzt"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-note" className="text-xs">Notiz</Label>
            <Textarea
              id="profile-note"
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Persönliche Notiz…"
            />
          </div>

          <Button className="w-full" onClick={handleSave}>
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
