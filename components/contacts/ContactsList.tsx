'use client'

import { useState, useEffect } from 'react'
import { Users, AlertCircle, Edit, Trash2, Tag, List, MoreVertical, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseCompanyName } from '@/lib/contact-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditContactModal } from './EditContactModal'
import { ContactViewModal } from './ContactViewModal'
import { TagManagementModal } from './TagManagementModal'
import { BulkActionsBar } from './BulkActionsBar'
import { BulkEnrichmentModal } from './BulkEnrichmentModal'
import { BulkEnrichmentProgressModal } from './BulkEnrichmentProgressModal'
import { BulkTagManagementModal } from './BulkTagManagementModal'
import { BulkListManagementModal } from './BulkListManagementModal'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { useToast } from '@/components/ui/toast'
import { Contact } from '@/lib/contacts'

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
  const [viewingContact, setViewingContact] = useState<Contact | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [tagManagementContact, setTagManagementContact] = useState<Contact | null>(null)
  const [isTagManagementModalOpen, setIsTagManagementModalOpen] = useState(false)
  const [isBulkEnrichModalOpen, setIsBulkEnrichModalOpen] = useState(false)
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | { jobId: string; totalContacts: number; contactIds: string[] } | { job_id: string; summary: { eligible_contacts: number; total_requested: number } } | null>(null)
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false)
  const [isBulkListModalOpen, setIsBulkListModalOpen] = useState(false)

  // Selection states
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  
  // Confirmation dialog states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<string | null>(null)
  
  // Toast hook
  const { addToast } = useToast()

  // Contact action handlers
  const handleView = async (contact: Contact) => {
    try {
      // Fetch the freshest version from Supabase via our API
      const resp = await fetch(`/api/contacts?ids=${contact.id}`)
      if (resp.ok) {
        const json = await resp.json()
        const updated = json?.data?.contacts?.[0]
        setViewingContact(updated || contact)
      } else {
        setViewingContact(contact)
      }
    } catch {
      setViewingContact(contact)
    } finally {
      setIsViewModalOpen(true)
    }
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setIsEditModalOpen(true)
  }

  const handleDelete = (contactId: string) => {
    setContactToDelete(contactId)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!contactToDelete) return

    try {
      console.log('ContactsList: Deleting contact:', contactToDelete)
      const response = await fetch(`/api/contacts/${contactToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      console.log('ContactsList: Contact deleted successfully')
      
      // Remove contact from local state
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.filter(c => c.id !== contactToDelete)
      }))

      addToast({
        type: 'success',
        message: 'Contact deleted successfully'
      })

    } catch (error) {
      console.error('ContactsList: Error deleting contact:', error)
      addToast({
        type: 'error',
        message: 'Failed to delete contact. Please try again.'
      })
    } finally {
      setContactToDelete(null)
    }
  }

  const handleAddTag = (contactId: string) => {
    console.log('ContactsList: Opening tag management for contact:', contactId)
    const contact = state.contacts.find(c => c.id === contactId)
    if (contact) {
      setTagManagementContact(contact)
      setIsTagManagementModalOpen(true)
    }
  }

  const handleTagsUpdated = () => {
    console.log('ContactsList: Tags updated, refreshing contacts list')
    fetchContacts(state.pagination.page)
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

  const handleEnrichmentStarted = (jobData: string | { jobId: string; totalContacts: number; contactIds: string[] } | { job_id: string; summary: { eligible_contacts: number; total_requested: number } } | null) => {
    console.log('ContactsList: Enrichment job started:', jobData)
    console.log('ContactsList: Current modal states before update:', { 
      isProgressModalOpen, 
      isBulkEnrichModalOpen,
      currentJobId 
    })
    
    if (jobData === null) {
      // Close progress modal
      setCurrentJobId(null)
      setIsProgressModalOpen(false)
      setSelectedContacts([])
      return
    }
    
    // Handle multiple formats: string, temp object, or real job data
    const jobId = typeof jobData === 'string' ? jobData : 
                 'jobId' in jobData ? jobData.jobId : jobData.job_id
    
    // Always update the job data (this handles temp, real, and legacy formats)
    setCurrentJobId(jobData) // Pass the full data for progress tracking
    
    // Only set modal open if it's not already open (for initial temp ID)
    if (!isProgressModalOpen) {
      setIsProgressModalOpen(true)
      setSelectedContacts([]) // Clear selection after starting
    }
    
    console.log('ContactsList: State updates called - jobData set to:', jobData, 'isProgressModalOpen:', isProgressModalOpen || 'set to true')
  }

  const handleProgressComplete = async () => {
    console.log('ContactsList: Bulk enrichment completed, refreshing contacts')
    fetchContacts(state.pagination.page) // Refresh contacts to show updated data
    // If viewing a contact, refresh it as well so LinkedIn data appears immediately
    if (isViewModalOpen && viewingContact) {
      try {
        const resp = await fetch(`/api/contacts?ids=${viewingContact.id}`)
        if (resp.ok) {
          const json = await resp.json()
          const updated = json?.data?.contacts?.[0]
          if (updated) setViewingContact(updated)
        }
      } catch {}
    }
  }

  // Bulk action handlers
  const handleBulkDelete = () => {
    if (selectedContacts.length === 0) return
    setIsBulkDeleteConfirmOpen(true)
  }

  const confirmBulkDelete = async () => {
    if (selectedContacts.length === 0) return

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
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `Failed to delete contacts (${response.status})`
        throw new Error(errorMessage)
      }

      console.log('ContactsList: Contacts deleted successfully')
      
      // Remove contacts from local state
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.filter(c => !selectedContacts.includes(c.id))
      }))
      
      addToast({
        type: 'success',
        message: `Successfully deleted ${selectedContacts.length} contact${selectedContacts.length === 1 ? '' : 's'}`
      })
      
      setSelectedContacts([])

    } catch (error) {
      console.error('ContactsList: Error bulk deleting contacts:', error)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete contacts. Please try again.'
      })
    }
  }

  const handleBulkAddTag = () => {
    if (selectedContacts.length === 0) return
    console.log('ContactsList: Opening bulk tag management for contacts:', selectedContacts.length)
    setIsBulkTagModalOpen(true)
  }

  const handleBulkAddToList = () => {
    if (selectedContacts.length === 0) return
    console.log('ContactsList: Opening bulk list management for contacts:', selectedContacts.length)
    setIsBulkListModalOpen(true)
  }

  const handleListsUpdated = () => {
    console.log('ContactsList: Lists updated, refreshing contacts list')
    fetchContacts(state.pagination.page)
    setSelectedContacts([])
  }

  useEffect(() => {
    fetchContacts()
  }, [userId, searchTerm, statusFilter])

  // Debug effect to track modal state changes
  useEffect(() => {
    console.log('ContactsList: Modal state changed:', {
      currentJobId,
      isProgressModalOpen,
      isBulkEnrichModalOpen
    })
  }, [currentJobId, isProgressModalOpen, isBulkEnrichModalOpen])

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
        onBulkAddToList={handleBulkAddToList}
        onClearSelection={handleClearSelection}
      />

      {/* Contacts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.contacts.map((contact) => {
          const formatName = () => {
            const firstName = contact.first_name || ''
            const lastName = contact.last_name || ''
            const fullName = `${firstName} ${lastName}`.trim()
            
            if (fullName) return fullName
            const companyName = parseCompanyName(contact.company)
            if (companyName && companyName.trim()) return companyName.trim()
            return contact.email
          }

          const getCompanyPosition = () => {
            const firstName = contact.first_name || ''
            const lastName = contact.last_name || ''
            const fullName = `${firstName} ${lastName}`.trim()
            const companyName = parseCompanyName(contact.company)
            const isCompanyAsTitle = !fullName && companyName && companyName.trim()
            
            if (isCompanyAsTitle && contact.position) return contact.position
            if (contact.position && companyName) return `${contact.position} at ${companyName}`
            if (contact.position) return contact.position
            if (companyName && !isCompanyAsTitle) return companyName
            return null
          }

          const listsCount = contact.lists?.length || 0
          const tagsCount = contact.tags?.length || 0

          return (
            <Card 
              key={contact.id} 
              className={`hover:shadow-lg transition-all duration-200 border-0 shadow-sm transform hover:scale-[1.02] cursor-pointer ${
                selectedContacts.includes(contact.id) 
                  ? 'ring-2 ring-blue-500 bg-blue-50/30 shadow-blue-100' 
                  : 'bg-white hover:bg-gray-50/50'
              }`}
            >
              <CardContent className="p-4" onClick={() => handleView(contact)}>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    
                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                        {formatName()}
                      </h3>
                      
                      <p className="text-sm text-gray-600 truncate mb-2">{contact.email}</p>
                      
                      {/* Company/Position */}
                      {getCompanyPosition() && (
                        <p className="text-sm text-gray-600 truncate">{getCompanyPosition()}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(contact)
                      }}
                      className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      title="Edit contact"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddTag(contact.id)
                      }}
                      className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-700 transition-colors"
                      title="Add tag"
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-gray-100 transition-colors"
                          title="More actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(contact)
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddTag(contact.id)
                          }}
                        >
                          <Tag className="h-4 w-4 mr-2" />
                          Add Tag
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(contact.id)
                          }}
                          className="text-red-600 focus:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Meta Information Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {/* Status */}
                    <Badge 
                      variant="secondary" 
                      className={`text-xs font-medium px-2 py-1 ${
                        contact.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' :
                        contact.status === 'unsubscribed' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                        contact.status === 'bounced' ? 'bg-red-100 text-red-700 border-red-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {contact.status}
                    </Badge>
                    
                    {/* AI Enriched */}
                    {'enrichment_status' in contact && contact.enrichment_status === 'completed' && (
                      <Badge variant="secondary" className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 border-blue-200">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Enriched
                      </Badge>
                    )}

                    {/* Processing status */}
                    {'enrichment_status' in contact && contact.enrichment_status === 'pending' && (
                      <Badge variant="secondary" className="text-xs font-medium px-2 py-1 bg-orange-100 text-orange-700 border-orange-200">
                        Processing
                      </Badge>
                    )}
                  </div>
                  
                  {/* Counts */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {tagsCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        <span>{tagsCount}</span>
                      </div>
                    )}
                    {listsCount > 0 && (
                      <div className="flex items-center gap-1">
                        <List className="h-3 w-3" />
                        <span>{listsCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {contact.tags.slice(0, 3).map((tag: string, index: number) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {contact.tags.length > 3 && (
                      <Badge 
                        variant="outline" 
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 border-gray-300"
                      >
                        +{contact.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Lists */}
                {contact.lists && contact.lists.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {contact.lists.slice(0, 3).map((listName: string, index: number) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                      >
                        <List className="h-3 w-3 mr-1" />
                        {listName}
                      </Badge>
                    ))}
                    {contact.lists.length > 3 && (
                      <Badge 
                        variant="outline" 
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 border-gray-300"
                      >
                        +{contact.lists.length - 3} lists
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
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
      {/* Contact View Modal */}
      <ContactViewModal
        contact={viewingContact}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onEdit={(contact) => {
          setViewingContact(null)
          setIsViewModalOpen(false)
          setEditingContact(contact)
          setIsEditModalOpen(true)
        }}
      />

      {/* Contact Edit Modal */}
      <EditContactModal
        contact={editingContact}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onContactUpdated={handleContactUpdated}
      />

      {/* Tag Management Modal */}
      <TagManagementModal
        contact={tagManagementContact}
        isOpen={isTagManagementModalOpen}
        onClose={() => setIsTagManagementModalOpen(false)}
        onTagsUpdated={handleTagsUpdated}
      />

      {/* Bulk Enrichment Modal */}
      <BulkEnrichmentModal
        isOpen={isBulkEnrichModalOpen}
        onClose={() => setIsBulkEnrichModalOpen(false)}
        selectedContacts={state.contacts.filter(c => selectedContacts.includes(c.id))}
        onEnrichmentStarted={handleEnrichmentStarted}
      />

      {/* Bulk Enrichment Progress Modal */}
      {(() => {
        console.log('ContactsList: Rendering progress modal - currentJobId:', currentJobId, 'isProgressModalOpen:', isProgressModalOpen)
        return currentJobId && isProgressModalOpen && (
          <BulkEnrichmentProgressModal
            jobId={currentJobId}
            isOpen={isProgressModalOpen}
            onClose={() => setIsProgressModalOpen(false)}
            onComplete={handleProgressComplete}
          />
        )
      })()}

      {/* Bulk Tag Management Modal */}
      <BulkTagManagementModal
        isOpen={isBulkTagModalOpen}
        onClose={() => setIsBulkTagModalOpen(false)}
        selectedContacts={selectedContacts}
        selectedContactsCount={selectedContacts.length}
        onTagsUpdated={handleTagsUpdated}
      />

      {/* Bulk List Management Modal */}
      <BulkListManagementModal
        isOpen={isBulkListModalOpen}
        onClose={() => setIsBulkListModalOpen(false)}
        selectedContactIds={selectedContacts}
        selectedContactCount={selectedContacts.length}
        onListsUpdated={handleListsUpdated}
      />

      {/* Single Contact Delete Confirmation */}
      <ConfirmationDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmationDialog
        open={isBulkDeleteConfirmOpen}
        onOpenChange={setIsBulkDeleteConfirmOpen}
        title="Delete Contacts"
        description={`Are you sure you want to delete ${selectedContacts.length} contact${selectedContacts.length === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
    </div>
  )
}