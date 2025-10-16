'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContactCard } from './ContactCard'
import { ContactSelectionDrawer } from './ContactSelectionDrawer'
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
  overrideContacts?: Contact[] // AI query results override
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
  sortOrder = 'desc',
  overrideContacts
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
  const [currentJobId, setCurrentJobId] = useState<string | { jobId: string; totalContacts: number; contactIds: string[] } | { job_id: string; summary: { eligible_contacts: number; total_requested: number } } | null>(null)

  // Select-all across filtered results loading
  const [isSelectingAllFiltered, setIsSelectingAllFiltered] = useState(false)

  const { addToast } = useToast()

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

      addToast({
        title: 'Contact deleted',
        message: 'Contact has been successfully deleted.',
        type: 'success'
      })

      // Refresh contacts list
      fetchContacts(state.pagination.page)

      // Clear selection if deleted contact was selected
      setSelectedContacts(prev => prev.filter(id => id !== contactToDelete))

    } catch (error) {
      console.error('Error deleting contact:', error)
      addToast({
        title: 'Error',
        message: 'Failed to delete contact. Please try again.',
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
    // Toggle select/deselect for the current page (up to 50)
    const pageIds = state.contacts.map(c => c.id)
    const allOnPageSelected = pageIds.every(id => selectedContacts.includes(id))

    if (allOnPageSelected) {
      // Deselect only current page contacts, preserve selections from other pages
      setSelectedContacts(prev => prev.filter(id => !pageIds.includes(id)))
    } else {
      // Select all on current page (merge with already selected from other pages)
      setSelectedContacts(prev => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const handleClearSelection = () => {
    setSelectedContacts([])
  }

  // Bulk action handlers
  const handleBulkDelete = () => {
    if (selectedContacts.length === 0) return
    // We'll use the existing delete confirmation logic but for multiple contacts
    // For now, let's show a simple confirmation
    const confirmed = confirm(`Are you sure you want to delete ${selectedContacts.length} contacts? This action cannot be undone.`)
    if (confirmed) {
      // TODO: Implement bulk delete API call
      console.log('Bulk delete:', selectedContacts)
      setSelectedContacts([])
    }
  }

  const handleBulkAddTag = () => {
    if (selectedContacts.length === 0) return
    setIsBulkTagModalOpen(true)
  }

  const handleBulkEnrich = () => {
    if (selectedContacts.length === 0) return
    setIsBulkEnrichModalOpen(true)
  }

  const handleBulkAddToList = () => {
    if (selectedContacts.length === 0) return
    setIsBulkListModalOpen(true)
  }

  const handlePageChange = (page: number) => {
    fetchContacts(page)
  }

  // Select all across filtered results (all pages)
  const handleSelectAllFiltered = async () => {
    if (overrideContacts && overrideContacts.length > 0) {
      setSelectedContacts(overrideContacts.map(c => c.id))
      return
    }

    try {
      setIsSelectingAllFiltered(true)

      const totalToFetch = state.pagination.total || 0
      if (totalToFetch === 0) {
        setSelectedContacts([])
        return
      }

      const collectedIds: string[] = []
      const pageLimit = 1000 // fetch in large chunks to reduce requests
      let page = 1

      while (collectedIds.length < totalToFetch) {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pageLimit.toString()
        })

        // Maintain same filters as current view
        if (searchTerm) params.append('search', searchTerm)
        if (enrichmentFilter) params.append('enrichment', enrichmentFilter)
        if (engagementFilter) params.append('engagementStatus', engagementFilter)
        if (scoreRange) {
          params.append('minScore', scoreRange[0].toString())
          params.append('maxScore', scoreRange[1].toString())
        }
        if (sortBy) params.append('sortBy', sortBy)
        if (sortOrder) params.append('sortOrder', sortOrder)

        const resp = await fetch(`/api/contacts?${params}`)
        if (!resp.ok) {
          throw new Error(`Failed to fetch contacts for select-all: ${resp.status} ${resp.statusText}`)
        }

        const data = await resp.json()
        const contactsChunk: Contact[] = data?.data?.contacts || []
        const idsChunk = contactsChunk.map(c => c.id)

        collectedIds.push(...idsChunk)

        // If we got fewer than limit, we've reached the end
        if (contactsChunk.length < pageLimit) {
          break
        }

        page += 1
      }

      setSelectedContacts(Array.from(new Set(collectedIds)))
      addToast({
        title: 'Selected All Filtered',
        message: `Selected ${collectedIds.length} contact${collectedIds.length === 1 ? '' : 's'} across all filtered results.`,
        type: 'success'
      })
    } catch (error) {
      console.error('Select-all filtered error:', error)
      addToast({
        title: 'Error',
        message: 'Failed to select all filtered contacts. Please try again.',
        type: 'error'
      })
    } finally {
      setIsSelectingAllFiltered(false)
    }
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
    // If overrideContacts is provided (from AI query), use those instead of fetching
    if (overrideContacts) {
      setState({
        contacts: overrideContacts,
        loading: false,
        error: null,
        pagination: {
          page: 1,
          limit: overrideContacts.length,
          total: overrideContacts.length,
          pages: 1
        }
      })
    } else {
      fetchContacts()
    }
  }, [userId, searchTerm, enrichmentFilter, engagementFilter, scoreRange, sortBy, sortOrder, overrideContacts])

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
      {/* Main content container with bottom padding for drawer */}
      <div className={selectedContacts.length > 0 ? "pb-32" : ""}>
        {/* Top selection controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={state.contacts.length > 0 && state.contacts.every(c => selectedContacts.includes(c.id))}
                onCheckedChange={() => handleSelectAll()}
              />
              <span className="text-sm text-gray-600">
                Select all ({state.contacts.length})
              </span>
            </div>

            {state.pagination.total > state.contacts.length && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllFiltered}
                  disabled={isSelectingAllFiltered}
                  title="Select all contacts across all filtered results"
                >
                  {isSelectingAllFiltered ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Selecting...
                    </>
                  ) : (
                    <>
                      Select all filtered ({state.pagination.total})
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Selected count indicator */}
          <div className="text-sm text-gray-600">
            {Math.min(state.pagination.page * state.pagination.limit, state.pagination.total)} of{' '}
            {state.pagination.total} contacts
          </div>
        </div>

        {/* Contacts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
      </div>

      {/* Modals */}
      {isEditModalOpen && editingContact && (
        <EditContactModal
          contact={editingContact as any}
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
          contact={state.contacts.find(c => c.id === tagContactId) || null}
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
        open={!!contactToDelete}
        onOpenChange={(open) => {
          if (!open) setContactToDelete(null)
        }}
        onConfirm={confirmDelete}
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />

      {/* Bulk Action Modals */}
      {isBulkEnrichModalOpen && (
        <BulkEnrichmentModal
          selectedContacts={state.contacts.filter(contact => selectedContacts.includes(contact.id))}
          isOpen={isBulkEnrichModalOpen}
          onClose={() => setIsBulkEnrichModalOpen(false)}
          onEnrichmentStarted={(jobId) => {
            setCurrentJobId(jobId)
            setIsBulkEnrichModalOpen(false)
            // Clear selected contacts so user sees full list again
            setSelectedContacts([])
            // Don't open progress modal - enrichment now runs in background
            // User will see progress in dashboard and get completion notifications
          }}
        />
      )}

      {isProgressModalOpen && currentJobId && (
        <BulkEnrichmentProgressModal
          jobId={currentJobId}
          isOpen={isProgressModalOpen}
          onClose={() => {
            setIsProgressModalOpen(false)
            setCurrentJobId(null)
          }}
          onComplete={() => {
            fetchContacts(state.pagination.page)
          }}
        />
      )}

      {isBulkTagModalOpen && (
        <BulkTagManagementModal
          selectedContacts={selectedContacts}
          selectedContactsCount={selectedContacts.length}
          isOpen={isBulkTagModalOpen}
          onClose={() => setIsBulkTagModalOpen(false)}
          onTagsUpdated={() => {
            fetchContacts(state.pagination.page)
            setIsBulkTagModalOpen(false)
            setSelectedContacts([])
          }}
        />
      )}

      {isBulkListModalOpen && (
        <BulkListManagementModal
          selectedContactIds={selectedContacts}
          selectedContactCount={selectedContacts.length}
          isOpen={isBulkListModalOpen}
          onClose={() => setIsBulkListModalOpen(false)}
          onListsUpdated={() => {
            fetchContacts(state.pagination.page)
            setIsBulkListModalOpen(false)
            setSelectedContacts([])
          }}
        />
      )}

      {/* Bottom Selection Drawer */}
      <ContactSelectionDrawer
        selectedCount={selectedContacts.length}
        onBulkDelete={handleBulkDelete}
        onBulkAddTag={handleBulkAddTag}
        onBulkEnrich={handleBulkEnrich}
        onBulkAddToList={handleBulkAddToList}
        onClearSelection={handleClearSelection}
        isVisible={selectedContacts.length > 0}
      />
    </>
  )
}