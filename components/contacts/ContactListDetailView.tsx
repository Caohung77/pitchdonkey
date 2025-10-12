'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ContactCard } from './ContactCard'
import { AddContactModal } from './AddContactModal'
import { EditContactModal } from './EditContactModal'
import { BulkListManagementModal } from './BulkListManagementModal'
import { ContactViewModal } from './ContactViewModal'
import { ConfirmationDialog } from '../ui/confirmation-dialog'
import { ApiClient } from '@/lib/api-client'
import { Contact } from '@/lib/contacts'
import { 
  ArrowLeft,
  Search, 
  Plus, 
  Users, 
  Filter,
  UserPlus,
  Settings,
  Trash2,
  Edit,
  MoreVertical,
  CheckCircle2,
  X
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/toast'

interface ContactList {
  id: string
  name: string
  description: string
  contact_ids: string[]
  created_at: string
  updated_at: string
}

interface ContactListDetailViewProps {
  list: ContactList
  onBack: () => void
  onListUpdated?: (list: ContactList) => void
  onListDeleted?: (listId: string) => void
}

export function ContactListDetailView({ 
  list, 
  onBack, 
  onListUpdated,
  onListDeleted 
}: ContactListDetailViewProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([]) // For adding contacts
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [showAddContactModal, setShowAddContactModal] = useState(false)
  const [showEditContactModal, setShowEditContactModal] = useState(false)
  const [showAddExistingModal, setShowAddExistingModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [viewingContact, setViewingContact] = useState<Contact | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
    variant?: 'default' | 'destructive'
  }>({ open: false, title: '', description: '', action: () => {} })
  const { addToast } = useToast()

  useEffect(() => {
    fetchListContacts()
    fetchAllContacts()
  }, [list.id])

  const fetchListContacts = async () => {
    try {
      setLoading(true)
      const response = await ApiClient.get(`/api/contacts/lists/${list.id}/contacts`)
      setContacts(response.data || [])
    } catch (error) {
      console.error('Error fetching list contacts:', error)
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAllContacts = async () => {
    try {
      const response = await ApiClient.get('/api/contacts')
      setAllContacts(response.data || [])
    } catch (error) {
      console.error('Error fetching all contacts:', error)
    }
  }

  // Filter contacts based on search and status
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = searchTerm === '' || 
      contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleContactSelect = (contactId: string, selected: boolean) => {
    if (selected) {
      setSelectedContacts(prev => [...prev, contactId])
    } else {
      setSelectedContacts(prev => prev.filter(id => id !== contactId))
    }
  }

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id))
    }
  }

  const handleRemoveFromList = async (contactIds: string[]) => {
    try {
      await ApiClient.delete(`/api/contacts/lists/${list.id}/contacts`, {
        contact_ids: contactIds
      })
      
      // Update local state
      setContacts(prev => prev.filter(c => !contactIds.includes(c.id)))
      setSelectedContacts([])
      setIsSelectionMode(false)
      
      // Update parent list
      if (onListUpdated) {
        const updatedList = {
          ...list,
          contact_ids: (list.contact_ids || []).filter(id => !contactIds.includes(id))
        }
        onListUpdated(updatedList)
      }
    } catch (error) {
      console.error('Error removing contacts from list:', error)
      alert('Failed to remove contacts from list')
    }
  }

  const handleAddExistingContacts = async (contactIds: string[]) => {
    try {
      await ApiClient.post(`/api/contacts/lists/${list.id}/contacts`, {
        contact_ids: contactIds
      })
      
      // Refresh the list
      await fetchListContacts()
      
      // Update parent list
      if (onListUpdated) {
        const updatedList = {
          ...list,
          contact_ids: [...new Set([...(list.contact_ids || []), ...contactIds])]
        }
        onListUpdated(updatedList)
      }
    } catch (error) {
      console.error('Error adding contacts to list:', error)
      alert('Failed to add contacts to list')
    }
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setShowEditContactModal(true)
  }

  const handleRemoveContactFromList = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId)
    setConfirmDialog({
      open: true,
      title: 'Remove Contact from List',
      description: `Are you sure you want to remove ${contact?.first_name || contact?.email || 'this contact'} from "${list.name}"? The contact will remain in your database and other lists.`,
      action: () => handleRemoveFromList([contactId]),
      variant: 'default'
    })
  }

  const handleDeleteContact = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId)
    const listsCount = contact?.lists?.length || 0

    let description = `Are you sure you want to permanently delete ${contact?.first_name || contact?.email || 'this contact'}? This action cannot be undone.`

    if (listsCount > 1) {
      description += ` This contact will be removed from ${listsCount} lists.`
    } else if (listsCount === 1) {
      description += ` This contact will be removed from 1 list.`
    }

    setConfirmDialog({
      open: true,
      title: 'Delete Contact Permanently',
      description,
      action: () => performDeleteContact(contactId),
      variant: 'destructive'
    })
  }

  const performDeleteContact = async (contactId: string) => {
    try {
      await ApiClient.delete(`/api/contacts/${contactId}`)
      setContacts(prev => prev.filter(c => c.id !== contactId))

      // Update parent list
      if (onListUpdated) {
        const updatedList = {
          ...list,
          contact_ids: (list.contact_ids || []).filter(id => id !== contactId)
        }
        onListUpdated(updatedList)
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  const handleAddTag = async (contactId: string) => {
    // This would open a tag management modal
    console.log('Add tag to contact:', contactId)
  }

  const handleViewContact = (contact: Contact) => {
    setViewingContact(contact)
  }

  const handleContactAdded = () => {
    fetchListContacts()
    fetchAllContacts()
  }

  const handleContactUpdated = (updatedContact: Contact) => {
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c))
    setEditingContact(null)
    setShowEditContactModal(false)
  }

  const confirmDeleteList = () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Contact List',
      description: `Are you sure you want to delete "${list.name}"? This will remove the list but keep all contacts in your database.`,
      action: performDeleteList,
      variant: 'destructive'
    })
  }

  const performDeleteList = async () => {
    try {
      await ApiClient.delete(`/api/contacts/lists/${list.id}`)

      addToast({
        type: 'success',
        title: 'List deleted',
        message: `"${list.name}" has been removed from your contact lists.`
      })

      onListDeleted?.(list.id)
      onBack()
    } catch (error: any) {
      console.error('Error deleting contact list:', error)
      addToast({
        type: 'error',
        title: 'Delete failed',
        message: error?.message || 'Unable to delete contact list. Please try again.'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lists
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
            <p className="text-gray-600">
              {list.description || 'Contact list'} • {contacts.length} contacts
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isSelectionMode && selectedContacts.length > 0 && (
            <>
              <Button
                variant="destructive" 
                size="sm"
                onClick={() => handleRemoveFromList(selectedContacts)}
              >
                <X className="h-4 w-4 mr-2" />
                Remove ({selectedContacts.length})
              </Button>
              <Button
                variant="outline" 
                size="sm"
                onClick={() => setIsSelectionMode(false)}
              >
                Cancel
              </Button>
            </>
          )}
          
          {!isSelectionMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddExistingModal(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Existing
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddContactModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Contact
              </Button>
              
              {contacts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSelectionMode(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDeleteList}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete List
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Contacts</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {contacts.filter(c => c.status === 'active').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unsubscribed</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {contacts.filter(c => c.status === 'unsubscribed').length}
                </p>
              </div>
              <X className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Bounced</p>
                <p className="text-2xl font-bold text-red-600">
                  {contacts.filter(c => c.status === 'bounced').length}
                </p>
              </div>
              <X className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search contacts by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
              </SelectContent>
            </Select>

            {isSelectionMode && (
              <Button variant="outline" onClick={handleSelectAll}>
                {selectedContacts.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}

            {(searchTerm || statusFilter !== 'all') && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contacts Grid */}
      {filteredContacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEditContact}
              onDelete={handleDeleteContact}
              onRemoveFromList={handleRemoveContactFromList}
              onAddTag={handleAddTag}
              onClick={!isSelectionMode ? handleViewContact : undefined}
              isSelected={selectedContacts.includes(contact.id)}
              onSelect={isSelectionMode ? handleContactSelect : undefined}
              showRemoveFromList={true}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No contacts match your filters' : 'No contacts in this list'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search terms or filters.'
                : 'Start building your contact list by adding contacts.'
              }
            </p>
            {(!searchTerm && statusFilter === 'all') && (
              <div className="flex justify-center space-x-2">
                <Button onClick={() => setShowAddContactModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Contact
                </Button>
                <Button variant="outline" onClick={() => setShowAddExistingModal(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Existing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {showAddContactModal && (
        <AddContactModal
          onContactAdded={handleContactAdded}
          onNavigateToContacts={() => {}}
          isOpen={showAddContactModal}
          onClose={() => setShowAddContactModal(false)}
          autoAddToList={list.id}
        />
      )}

      {showEditContactModal && editingContact && (
        <EditContactModal
          contact={editingContact}
          isOpen={showEditContactModal}
          onClose={() => {
            setShowEditContactModal(false)
            setEditingContact(null)
          }}
          onContactUpdated={handleContactUpdated}
        />
      )}

      {showAddExistingModal && (
        <AddExistingContactsModal
          allContacts={allContacts}
          existingContactIds={contacts.map(c => c.id)}
          onAdd={handleAddExistingContacts}
          isOpen={showAddExistingModal}
          onClose={() => setShowAddExistingModal(false)}
        />
      )}

      {/* Contact Detail View Modal */}
      {viewingContact && (
        <ContactViewModal
          contact={viewingContact}
          isOpen={!!viewingContact}
          onClose={() => setViewingContact(null)}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.action}
        variant={confirmDialog.variant || 'default'}
        confirmText={confirmDialog.variant === 'destructive' ? 'Delete' : 'Remove'}
        cancelText="Cancel"
      />
    </div>
  )
}

// Modal for adding existing contacts to the list
interface AddExistingContactsModalProps {
  allContacts: Contact[]
  existingContactIds: string[]
  onAdd: (contactIds: string[]) => void
  isOpen: boolean
  onClose: () => void
}

function AddExistingContactsModal({
  allContacts,
  existingContactIds,
  onAdd,
  isOpen,
  onClose
}: AddExistingContactsModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])

  // Filter out contacts already in the list
  const availableContacts = allContacts.filter(contact => 
    !existingContactIds.includes(contact.id)
  )

  const filteredContacts = availableContacts.filter(contact => {
    return searchTerm === '' || 
      contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const handleContactSelect = (contactId: string, selected: boolean) => {
    if (selected) {
      setSelectedContacts(prev => [...prev, contactId])
    } else {
      setSelectedContacts(prev => prev.filter(id => id !== contactId))
    }
  }

  const handleAdd = () => {
    if (selectedContacts.length > 0) {
      onAdd(selectedContacts)
      setSelectedContacts([])
      setSearchTerm('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Add Existing Contacts</h2>
          <p className="text-gray-600">Select contacts to add to this list</p>
        </div>

        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {filteredContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onAddTag={() => {}}
                  isSelected={selectedContacts.includes(contact.id)}
                  onSelect={handleContactSelect}
                  showRemoveFromList={false}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No contacts match your search.' : 'No more contacts available to add.'}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {selectedContacts.length} contacts selected
          </p>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={selectedContacts.length === 0}
            >
              Add {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
