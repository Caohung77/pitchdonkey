'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ContactCard } from './ContactCard'
import { BulkActionsBar } from './BulkActionsBar'
import { BulkEnrichmentModal } from './BulkEnrichmentModal'
import { BulkEnrichmentProgressModal } from './BulkEnrichmentProgressModal'
import { BulkTagManagementModal } from './BulkTagManagementModal'
import { BulkListManagementModal } from './BulkListManagementModal'
import { EditContactModal } from './EditContactModal'
import { TagManagementModal } from './TagManagementModal'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { useToast } from '@/components/ui/toast'
import { Contact } from '@/lib/contacts'

interface ContactsListProps {
  userId: string
  searchTerm?: string
  enrichmentFilter?: string | null
  engagementFilter?: string | null
  scoreRange?: [number, number] | null
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
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

export function ContactsList({
  userId,
  searchTerm = '',
  enrichmentFilter = null,
  engagementFilter = null,
  scoreRange = null,
  sortBy = 'updated_at',
  sortOrder = 'desc'
}: ContactsListProps) {
  const router = useRouter()
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

  // UI state
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<string | null>(null)
  const [tagContactId, setTagContactId] = useState<string | null>(null)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)

  // Bulk operations state
  const [isBulkEnrichModalOpen, setIsBulkEnrichModalOpen] = useState(false)
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false)
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false)
  const [isBulkListModalOpen, setIsBulkListModalOpen] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  const { showToast } = useToast()

  // Contact action handlers
  const handleView = (contact: Contact) => {
    router.push(`/dashboard/contacts/${contact.id}`)
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setIsEditModalOpen(true)
  }

  const handleDeleteConfirm = (contactId: string) => {
    setContactToDelete(contactId)
  }

  const confirmDelete = async () => {
    if (!contactToDelete) return

    try {
      const response = await fetch(`/api/contacts/${contactToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      showToast({
        title: 'Contact deleted',
        description: 'Contact has been successfully deleted.',
        type: 'success'
      })

      // Refresh contacts list
      fetchContacts(state.pagination.page)

      // Clear selection if deleted contact was selected
      setSelectedContacts(prev => prev.filter(id => id !== contactToDelete))

    } catch (error) {
      console.error('Error deleting contact:', error)
      showToast({
        title: 'Error',
        description: 'Failed to delete contact. Please try again.',
        type: 'error'
      })
    } finally {
      setContactToDelete(null)
    }
  }

  const handleAddTag = (contactId: string) => {
    setTagContactId(contactId)
    setIsTagModalOpen(true)
  }

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

  const handlePageChange = (page: number) => {
    fetchContacts(page)
  }

  // Fetch contacts from API
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
      if (enrichmentFilter) {
        params.append('enrichment', enrichmentFilter)
      }
      if (engagementFilter) {
        params.append('engagementStatus', engagementFilter)
      }
      if (scoreRange) {
        params.append('minScore', scoreRange[0].toString())
        params.append('maxScore', scoreRange[1].toString())
      }
      if (sortBy) {
        params.append('sortBy', sortBy)
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder)
      }

      const response = await fetch(`/api/contacts?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        setState(prev => ({
          ...prev,
          contacts: data.data.contacts || [],
          loading: false,
          pagination: {
            page: data.data.pagination?.page || page,
            limit: data.data.pagination?.limit || 50,
            total: data.data.pagination?.total || 0,
            pages: data.data.pagination?.pages || 0
          }
        }))
      } else {
        throw new Error(data.error || 'Failed to fetch contacts')
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }))
    }
  }

  // Effects
  useEffect(() => {
    fetchContacts()
  }, [userId, searchTerm, enrichmentFilter, engagementFilter, scoreRange, sortBy, sortOrder])

  // Render loading state
  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading contacts...</p>
        </div>
      </div>
    )
  }

  // Render error state
  if (state.error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Contacts</h3>
            <p className="text-gray-600 mb-4">{state.error}</p>
            <button
              onClick={() => fetchContacts(state.pagination.page)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render empty state
  if (state.contacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
            <p className="text-gray-600">
              {searchTerm || enrichmentFilter || engagementFilter || scoreRange
                ? 'Try adjusting your search criteria or filters.'
                : 'Start by importing contacts or adding them manually.'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedContacts.length}
        totalCount={state.contacts.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
      />

      {/* Contacts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            isSelected={selectedContacts.includes(contact.id)}
            onSelect={(contactId, selected) => handleSelectContact(contactId, selected)}
            onClick={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteConfirm}
            onAddTag={handleAddTag}
          />
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={state.pagination.page}
        totalItems={state.pagination.total}
        itemsPerPage={state.pagination.limit}
        onPageChange={handlePageChange}
        showInfo={true}
        showFirstLast={true}
      />

      {/* Modals */}
      {isEditModalOpen && editingContact && (
        <EditContactModal
          contact={editingContact}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingContact(null)
          }}
          onContactUpdated={() => {
            fetchContacts(state.pagination.page)
            setIsEditModalOpen(false)
            setEditingContact(null)
          }}
        />
      )}

      {isTagModalOpen && tagContactId && (
        <TagManagementModal
          contactId={tagContactId}
          isOpen={isTagModalOpen}
          onClose={() => {
            setIsTagModalOpen(false)
            setTagContactId(null)
          }}
          onTagsUpdated={() => {
            fetchContacts(state.pagination.page)
            setIsTagModalOpen(false)
            setTagContactId(null)
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  )
}