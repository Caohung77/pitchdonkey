'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Save } from 'lucide-react'

interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: string
  content: string
  onSaved?: () => void
}

export function SaveTemplateDialog({ open, onOpenChange, subject, content, onSaved }: SaveTemplateDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'custom' as const,
  })

  useEffect(() => {
    if (open) {
      // Pre-fill a sensible default name from subject or first heading/text
      const defaultName = (subject || '').trim() || 'Saved Template'
      setForm(prev => ({ ...prev, name: defaultName.slice(0, 80) }))
      setError('')
    }
  }, [open, subject])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError('')
      const resp = await fetch('/api/ai/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          category: form.category,
          content,
          subject,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to save template')
      }
      onOpenChange(false)
      onSaved?.()
    } catch (e: any) {
      setError(e.message || 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>Store the current subject and HTML content as a reusable template.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Template Name</Label>
            <Input id="tpl-name" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-desc">Description</Label>
            <Input id="tpl-desc" value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-cat">Category</Label>
            <select
              id="tpl-cat"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={form.category}
              onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as any }))}
            >
              <option value="custom">Custom</option>
              <option value="cold_outreach">Cold Outreach</option>
              <option value="follow_up">Follow Up</option>
              <option value="introduction">Introduction</option>
              <option value="meeting_request">Meeting Request</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Saving...</>) : (<><Save className="h-4 w-4 mr-2"/>Save Template</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

