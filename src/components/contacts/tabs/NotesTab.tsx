'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import {
  FileText,
  Save,
  Plus,
  Search,
  Calendar,
  User,
  Edit3,
  Trash2,
  MessageSquare,
  Clock,
  Check
} from 'lucide-react'

interface Contact {
  id: string
  notes?: string
  first_name?: string
  last_name?: string
}

interface Note {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  created_by?: string
  tags?: string[]
}

interface NotesTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function NotesTab({ contact, onContactUpdate }: NotesTabProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contact'

  // Mock notes data - in production, this would come from API
  useEffect(() => {
    const mockNotes: Note[] = [
      {
        id: '1',
        title: 'Initial Outreach Discussion',
        content: `<h3>Phone call with ${contactName}</h3>
        <p>Had a great initial conversation about their current marketing challenges:</p>
        <ul>
          <li>Looking to scale their B2B lead generation</li>
          <li>Currently using manual processes</li>
          <li>Budget approved for Q2 implementation</li>
        </ul>
        <p><strong>Next steps:</strong> Send product demo and pricing information</p>
        <p><strong>Follow-up:</strong> Schedule product demo for next week</p>`,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        created_by: 'John Smith',
        tags: ['sales', 'demo', 'qualified']
      },
      {
        id: '2',
        title: 'Product Demo Follow-up',
        content: `<h3>Demo Session Results</h3>
        <p>Conducted 30-minute product demo focusing on:</p>
        <ol>
          <li>Email automation features</li>
          <li>Lead scoring capabilities</li>
          <li>Integration options</li>
        </ol>
        <p><strong>Feedback:</strong> Very positive, especially interested in the AI personalization features</p>
        <p><strong>Concerns:</strong> Implementation timeline and team training requirements</p>`,
        created_at: '2024-01-10T14:00:00Z',
        updated_at: '2024-01-10T15:00:00Z',
        created_by: 'Sarah Johnson',
        tags: ['demo', 'positive', 'implementation']
      },
      {
        id: '3',
        title: 'Meeting Notes - Strategy Discussion',
        content: `<h3>Strategy Planning Session</h3>
        <p>Discussed their current marketing stack and integration needs:</p>
        <ul>
          <li>Current CRM: Salesforce</li>
          <li>Marketing automation: Basic MailChimp setup</li>
          <li>Team size: 5 marketing professionals</li>
        </ul>
        <p><strong>Pain points:</strong></p>
        <ul>
          <li>Lack of personalization in current campaigns</li>
          <li>Manual lead qualification process</li>
          <li>No unified view of customer journey</li>
        </ul>`,
        created_at: '2024-01-05T09:00:00Z',
        updated_at: '2024-01-05T11:00:00Z',
        created_by: 'Mike Davis',
        tags: ['strategy', 'crm', 'integration']
      }
    ]
    setNotes(mockNotes)

    // Load the first note by default
    if (mockNotes.length > 0) {
      setActiveNote(mockNotes[0])
    }
  }, [contactName])

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateNote = () => {
    setIsCreating(true)
    setNewNoteTitle(`Meeting with ${contactName} - ${new Date().toLocaleDateString()}`)
    setNewNoteContent('')
    setActiveNote(null)
  }

  const handleSaveNewNote = async () => {
    if (!newNoteTitle.trim()) return

    setSaving(true)
    try {
      // TODO: Implement API call to save note
      const newNote: Note = {
        id: Date.now().toString(),
        title: newNoteTitle,
        content: newNoteContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'Current User', // TODO: Get from auth context
        tags: []
      }

      setNotes(prev => [newNote, ...prev])
      setActiveNote(newNote)
      setIsCreating(false)
      setNewNoteTitle('')
      setNewNoteContent('')
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelNew = () => {
    setIsCreating(false)
    setNewNoteTitle('')
    setNewNoteContent('')
    if (notes.length > 0) {
      setActiveNote(notes[0])
    }
  }

  const handleSaveNote = async (content: string) => {
    if (!activeNote) return

    setSaving(true)
    try {
      // TODO: Implement API call to update note
      const updatedNote = {
        ...activeNote,
        content,
        updated_at: new Date().toISOString()
      }

      setNotes(prev => prev.map(note =>
        note.id === activeNote.id ? updatedNote : note
      ))
      setActiveNote(updatedNote)
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save note:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      // TODO: Implement API call to delete note
      setNotes(prev => prev.filter(note => note.id !== noteId))

      if (activeNote?.id === noteId) {
        const remainingNotes = notes.filter(note => note.id !== noteId)
        setActiveNote(remainingNotes.length > 0 ? remainingNotes[0] : null)
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Notes List */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="h-full">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Notes</span>
              </CardTitle>
              <Button
                onClick={handleCreateNote}
                size="sm"
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>New</span>
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredNotes.length > 0 ? (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      setActiveNote(note)
                      setIsCreating(false)
                    }}
                    className={`p-4 cursor-pointer border-b hover:bg-gray-50 transition-colors ${
                      activeNote?.id === note.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {note.title}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(note.updated_at)}</span>
                          </div>
                          {note.created_by && (
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <User className="h-3 w-3" />
                              <span>{note.created_by}</span>
                            </div>
                          )}
                        </div>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {note.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNote(note.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-2"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No notes found</p>
                  <p className="text-sm mt-1">Create your first note to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Note Editor */}
      <div className="lg:col-span-2">
        <Card className="h-full">
          {isCreating ? (
            /* Create New Note */
            <>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Create New Note</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelNew}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNewNote}
                      disabled={!newNoteTitle.trim() || saving}
                      className="flex items-center space-x-2"
                    >
                      <Save className="h-4 w-4" />
                      <span>{saving ? 'Saving...' : 'Save Note'}</span>
                    </Button>
                  </div>
                </div>

                <Input
                  placeholder="Note title..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="font-medium"
                />
              </CardHeader>

              <CardContent className="flex-1">
                <RichTextEditor
                  value={newNoteContent}
                  onChange={setNewNoteContent}
                  placeholder={`Add notes about ${contactName}...`}
                  minHeight="300px"
                  autoSave={false}
                />
              </CardContent>
            </>
          ) : activeNote ? (
            /* Edit Existing Note */
            <>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Edit3 className="h-5 w-5" />
                      <span>{activeNote.title}</span>
                    </CardTitle>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>Created {formatDate(activeNote.created_at)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Updated {formatDate(activeNote.updated_at)}</span>
                      </div>
                      {activeNote.created_by && (
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>{activeNote.created_by}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {lastSaved && (
                    <div className="flex items-center space-x-2 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      <span>Saved {formatDate(lastSaved.toISOString())}</span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <RichTextEditor
                  value={activeNote.content}
                  onChange={() => {}} // Content changes handled by onSave
                  onSave={handleSaveNote}
                  placeholder={`Add notes about ${contactName}...`}
                  minHeight="300px"
                  autoSave={true}
                  autoSaveDelay={2000}
                />
              </CardContent>
            </>
          ) : (
            /* No Note Selected */
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Note Selected</h3>
                <p className="mb-6">Select a note from the list or create a new one to get started.</p>
                <Button
                  onClick={handleCreateNote}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Note</span>
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}