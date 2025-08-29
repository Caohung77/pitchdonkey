'use client'

import { useState, useEffect } from 'react'
import { Users, AlertCircle, Edit, Trash2, Tag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EditContactModal } from './EditContactModal'
import { BulkActionsBar } from './BulkActionsBar'
import { BulkEnrichmentModal } from './BulkEnrichmentModal'
import { BulkEnrichmentProgressModal } from './BulkEnrichmentProgressModal'

// Simple Contact interface to avoid import issues
interface Contact {
  id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
  company?: string
  position?: string
  website?: string
  enrichment_status?: 'completed' | 'pending' | 'failed' | null
  enrichment_updated_at?: string
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  tags: string[]
  created_at: string
  updated_at: string
}

interface ContactsListProps {
  userId: string
  searchTerm?: string
  statusFilter?: string
}

interface ContactsListState {
  contacts: Contact[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function ContactsList({ userId, searchTerm = '', statusFilter = 'all' }: ContactsListProps) {
  const [state, setState] = useState<ContactsListState>({
    contacts: [],
    loading: true,
    error: null,
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      pages: 0
    }
  })

  // Modal states
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isBulkEnrichModalOpen, setIsBulkEnrichModalOpen] = useState(false)
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  // Selection states
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])

  // Contact action handlers
  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setIsEditModalOpen(true)
  }

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return
    }

    try {
      console.log('ContactsList: Deleting contact:', contactId)
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      console.log('ContactsList: Contact deleted successfully')
      
      // Remove contact from local state
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.filter(c => c.id !== contactId)
      }))

    } catch (error) {
      console.error('ContactsList: Error deleting contact:', error)
      alert('Failed to delete contact. Please try again.')
    }
  }

  const handleAddTag = (contactId: string) => {
    const tag = prompt('Enter tag to add:')
    if (!tag) return

    console.log('ContactsList: Adding tag to contact:', contactId, tag)
    // TODO: Implement tag addition API call
    alert(`Tag "${tag}" would be added to contact (not implemented yet)`)
  }

  const handleContactUpdated = () => {
    console.log('ContactsList: Contact updated, refreshing list')
    fetchContacts(state.pagination.page)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setEditingContact(null)
  }

  // Selection handlers
  const handleSelectContact = (contactId: string, selected: boolean) => {
    if (selected) {
      setSelectedContacts(prev => [...prev, contactId])
    } else {
      setSelectedContacts(prev => prev.filter(id => id !== contactId))
    }
  }

  const handleSelectAll = () => {
    if (selectedContacts.length === state.contacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(state.contacts.map(c => c.id))
    }
  }

  const handleClearSelection = () => {
    setSelectedContacts([])
  }

  // Bulk enrichment handler
  const handleBulkEnrich = async () => {
    if (selectedContacts.length === 0) return

    console.log('ContactsList: Starting bulk enrichment for contacts:', selectedContacts)
    setIsBulkEnrichModalOpen(true)
  }

  const handleEnrichmentStarted = (jobId: string) => {
    console.log('ContactsList: Enrichment job started with ID:', jobId)
    setCurrentJobId(jobId)
    setIsProgressModalOpen(true)
    setSelectedContacts([]) // Clear selection after starting
  }

  const handleProgressComplete = () => {
    console.log('ContactsList: Bulk enrichment completed, refreshing contacts')
    fetchContacts(state.pagination.page) // Refresh contacts to show updated data
  }

  // Bulk action handlers
  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedContacts.length} contacts?`)) {
      return
    }

    try {
      console.log('ContactsList: Bulk deleting contacts:', selectedContacts)
      
      const response = await fetch('/api/contacts/bulk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          contact_ids: selectedContacts,
          data: { status: 'deleted' }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete contacts')
      }

      console.log('ContactsList: Contacts deleted successfully')
      
      // Remove contacts from local state
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.filter(c => !selectedContacts.includes(c.id))
      }))
      
      setSelectedContacts([])

    } catch (error) {
      console.error('ContactsList: Error bulk deleting contacts:', error)
      alert('Failed to delete contacts. Please try again.')
    }
  }

  const handleBulkAddTag = async () => {
    if (selectedContacts.length === 0) return

    const tag = prompt('Enter tag to add to selected contacts:')
    if (!tag) return

    try {
      console.log('ContactsList: Bulk adding tag to contacts:', selectedContacts, tag)
      
      const response = await fetch('/api/contacts/bulk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add_tag',
          contact_ids: selectedContacts,
          data: { tags: [tag.trim()] }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add tag to contacts')
      }

      console.log('ContactsList: Tag added successfully')
      
      // Refresh contacts to show updated tags
      fetchContacts(state.pagination.page)
      setSelectedContacts([])

    } catch (error) {
      console.error('ContactsList: Error bulk adding tag:', error)
      alert('Failed to add tag to contacts. Please try again.')
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [userId, searchTerm, statusFilter])

  const fetchContacts = async (page = 1) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })

      // Add search and filter parameters
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      console.log('ContactsList: Fetching contacts with params:', params.toString())
      const response = await fetch(`/api/contacts?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('ContactsList: Received data:', data)

      if (data.success && data.data) {
        setState(prev => ({
          ...prev,
          contacts: data.data.contacts || [],
          pagination: data.data.pagination || prev.pagination,
          loading: false,
          error: null
        }))
      } else {
        throw new Error(data.error || 'Failed to load contacts')
      }

    } catch (error) {
      console.error('ContactsList: Error fetching contacts:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load contacts'
      }))
    }
  }

  const handleRetry = () => {
    fetchContacts(state.pagination.page)
  }

  const handlePageChange = (newPage: number) => {
    fetchContacts(newPage)
  }

  // Loading state with skeletons
  if (state.loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  <div className="flex space-x-2">
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Contacts</h3>
            <p className="text-gray-600 mb-4">{state.error}</p>
            <Button onClick={handleRetry}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (state.contacts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
            <p className="text-gray-600 mb-6">
              Get started by adding your first contact or importing a CSV file
            </p>
            <div className="flex justify-center space-x-3">
              <Button onClick={() => console.log('Add contact clicked')}>Add Contact</Button>
              <Button variant="outline" onClick={() => console.log('Import CSV clicked')}>Import CSV</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Main contacts display
  return (
    <div className="space-y-6">
      {/* Select All Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={selectedContacts.length === state.contacts.length && state.contacts.length > 0}
            onChange={handleSelectAll}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">
            Select all ({state.contacts.length})
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Showing {((state.pagination.page - 1) * state.pagination.limit) + 1} to{' '}
          {Math.min(state.pagination.page * state.pagination.limit, state.pagination.total)} of{' '}
          {state.pagination.total} contacts
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedContacts.length}
        onBulkDelete={handleBulkDelete}
        onBulkAddTag={handleBulkAddTag}
        onBulkEnrich={handleBulkEnrich}
        onClearSelection={handleClearSelection}
      />

      {/* Contacts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.contacts.map((contact) => (
          <Card key={contact.id} className={`hover:shadow-md transition-shadow ${selectedContacts.includes(contact.id) ? 'ring-2 ring-blue-500' : ''}`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    {/* Selection checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                      className="mt-1 rounded border-gray-300"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {contact.first_name || contact.last_name 
                          ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                          : contact.email.split('@')[0]
                        }
                      </h3>
                      <p className="text-xs text-gray-600 truncate">{contact.email}</p>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(contact)}
                      className="h-6 w-6 p-0"
                      title="Edit contact"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(contact.id)}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      title="Delete contact"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {(contact.company || contact.position) && (
                  <p className="text-xs text-gray-600 truncate">
                    {contact.position && contact.company 
                      ? `${contact.position} at ${contact.company}`
                      : contact.position || contact.company
                    }
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    contact.status === 'active' ? 'bg-green-100 text-green-800' :
                    contact.status === 'unsubscribed' ? 'bg-yellow-100 text-yellow-800' :
                    contact.status === 'bounced' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {contact.status}
                  </span>
                  
                  {contact.tags && contact.tags.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {contact.tags.length} tag{contact.tags.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Add Tag Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddTag(contact.id)}
                  className="w-full h-6 text-xs text-gray-600 hover:text-gray-900"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Add Tag
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {state.pagination.pages > 1 && (
        <div className="flex justify-center mt-8">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              disabled={state.pagination.page === 1}
              onClick={() => handlePageChange(state.pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-4 text-sm text-gray-600">
              Page {state.pagination.page} of {state.pagination.pages}
            </span>
            <Button
              variant="outline"
              disabled={state.pagination.page === state.pagination.pages}
              onClick={() => handlePageChange(state.pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Results summary */}
      <div className="text-center text-sm text-gray-600">
        Showing {((state.pagination.page - 1) * state.pagination.limit) + 1} to{' '}
        {Math.min(state.pagination.page * state.pagination.limit, state.pagination.total)} of{' '}
        {state.pagination.total} contacts
      </div>

      {/* Edit Contact Modal */}
      <EditContactModal
        contact={editingContact}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onContactUpdated={handleContactUpdated}
      />

      {/* Bulk Enrichment Modal */}
      <BulkEnrichmentModal
        isOpen={isBulkEnrichModalOpen}
        onClose={() => setIsBulkEnrichModalOpen(false)}
        selectedContacts={state.contacts.filter(c => selectedContacts.includes(c.id))}
        onEnrichmentStarted={handleEnrichmentStarted}
      />

      {/* Bulk Enrichment Progress Modal */}
      {currentJobId && (
        <BulkEnrichmentProgressModal
          jobId={currentJobId}
          isOpen={isProgressModalOpen}
          onClose={() => setIsProgressModalOpen(false)}
          onComplete={handleProgressComplete}
        />
      )}
    </div>
  )
}