'use client'

import { useState, useEffect } from 'react'
import { Contact } from '@/lib/contacts'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Button } from '@/components/ui/button'
import { FileText, Save, Clock, User } from 'lucide-react'

interface NotesTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function NotesTab({
  contact,
  onContactUpdate
}: NotesTabProps) {
  const [notes, setNotes] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Fetch notes when component mounts
  useEffect(() => {
    const fetchNotes = async () => {
      if (!contact.id) return

      setLoading(true)
      try {
        const response = await fetch(`/api/contacts/${contact.id}/notes`)
        const result = await response.json()

        if (result.success) {
          setNotes(result.data.notes || '')
        } else {
          console.error('Failed to fetch notes:', result.error)
        }
      } catch (error) {
        console.error('Error fetching notes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotes()
  }, [contact.id])

  const saveNotes = async (content: string) => {
    if (!contact.id) return

    setSaving(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: content })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to save notes')
      }

      setLastSaved(new Date())
    } catch (error) {
      console.error('Error saving notes:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const formatLastSaved = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffSeconds < 60) {
      return 'just now'
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            Contact Notes
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Keep track of important information, conversation history, and insights about this contact.
          </p>
        </div>

        {/* Save Status */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {saving && (
            <>
              <Save className="h-4 w-4 animate-pulse" />
              <span>Saving...</span>
            </>
          )}
          {lastSaved && !saving && (
            <>
              <Clock className="h-4 w-4" />
              <span>Saved {formatLastSaved(lastSaved)}</span>
            </>
          )}
        </div>
      </div>

      {/* Notes Editor */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Notes for {contact.email}</span>
            </div>
            <div className="text-xs text-gray-500">
              Rich text editing • Auto-save enabled
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading notes...</div>
            </div>
          ) : (
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              onSave={saveNotes}
              placeholder="Start typing your notes about this contact...

You can include:
• Meeting notes and conversation history
• Contact preferences and communication style
• Business context and background information
• Relationship insights and personal details
• Follow-up reminders and next steps

Use the toolbar above to format your text, add links, lists, and more."
              autoSave={true}
              minHeight="400px"
              className="w-full"
            />
          )}
        </div>

        {!loading && (
          <div className="px-6 pb-4 text-xs text-gray-500 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span>💡</span>
                <span>Tip: Notes are automatically saved as you type</span>
              </div>
              <div className="flex items-center gap-1">
                <span>⌨️</span>
                <span>Use Ctrl+S (Cmd+S) to force save</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🔍</span>
                <span>Notes are searchable from the contacts list</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Notes Best Practices</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p>• Include date and context when adding new information</p>
          <p>• Note communication preferences (email vs. phone, best times to contact)</p>
          <p>• Record personal details that can help with relationship building</p>
          <p>• Track business needs, pain points, and opportunities</p>
          <p>• Add follow-up reminders and next steps</p>
          <p>• Use formatting to organize information clearly</p>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Quick Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const template = `## Meeting Notes - ${new Date().toLocaleDateString()}

**Attendees:**
**Purpose:**
**Key Points:**
-
-
-

**Action Items:**
- [ ]
- [ ]

**Follow-up:** `
              setNotes(prev => prev + (prev ? '\n\n' : '') + template)
            }}
            className="text-left justify-start"
          >
            📝 Meeting Notes Template
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const template = `## Contact Summary - ${new Date().toLocaleDateString()}

**Role & Company:**
**Background:**
**Communication Style:**
**Business Needs:**
**Personal Interests:**
**Next Steps:** `
              setNotes(prev => prev + (prev ? '\n\n' : '') + template)
            }}
            className="text-left justify-start"
          >
            👤 Contact Summary Template
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const template = `## Follow-up Reminder - ${new Date().toLocaleDateString()}

**Context:**
**Promised Action:**
**Timeline:**
**Next Contact Date:**
**Notes:** `
              setNotes(prev => prev + (prev ? '\n\n' : '') + template)
            }}
            className="text-left justify-start"
          >
            ⏰ Follow-up Template
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const template = `## Opportunity Notes - ${new Date().toLocaleDateString()}

**Opportunity:**
**Budget/Timeline:**
**Decision Makers:**
**Competition:**
**Challenges:**
**Proposal Status:** `
              setNotes(prev => prev + (prev ? '\n\n' : '') + template)
            }}
            className="text-left justify-start"
          >
            💼 Opportunity Template
          </Button>
        </div>
      </div>
    </div>
  )
}