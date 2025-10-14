'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ApiClient } from '@/lib/api-client'
import { 
  Users, 
  Plus, 
  X, 
  Search,
  Check
} from 'lucide-react'

interface CreateContactListModalProps {
  isOpen: boolean
  onClose: () => void
  onListCreated: (list: ContactList) => void
}

interface ContactList {
  id: string
  name: string
  description: string
  contactCount: number
  tags: string[]
  isFavorite: boolean
  createdAt: string
  type: 'list'
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  company: string
  position: string
}

export function CreateContactListModal({ isOpen, onClose, onListCreated }: CreateContactListModalProps) {
  const [step, setStep] = useState<'basic' | 'contacts'>('basic')
  const [listData, setListData] = useState({
    name: '',
    description: '',
    tags: [] as string[]
  })
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(false)

  useEffect(() => {
    if (step === 'contacts' && contacts.length === 0) {
      fetchContacts()
    }
  }, [step])

  const fetchContacts = async () => {
    try {
      setContactsLoading(true)
      const result = await ApiClient.get('/api/contacts?limit=1000') // Get more contacts for list creation
      console.log('Contacts API response:', result) // Debug log
      
      // Handle the API response structure
      if (result.success && result.data && result.data.contacts) {
        console.log('Found contacts:', result.data.contacts.length) // Debug log
        setContacts(result.data.contacts)
      } else if (Array.isArray(result)) {
        // Fallback for direct array response
        console.log('Direct array response:', result.length) // Debug log
        setContacts(result)
      } else {
        console.error('Unexpected API response structure:', result)
        setContacts([])
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
      // Reset to empty array on error
      setContacts([])
    } finally {
      setContactsLoading(false)
    }
  }

  const handleBasicNext = () => {
    if (listData.name.trim()) {
      setStep('contacts')
    }
  }

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const handleCreateList = async () => {
    try {
      setLoading(true)
      
      const result = await ApiClient.post('/api/contacts/lists', {
        name: listData.name,
        description: listData.description,
        contactIds: selectedContacts,
        tags: listData.tags
      })

      console.log('API response:', result) // Debug log
      
      // Handle the API response structure - the API returns { success: true, data: list }
      const newList = result.success ? result.data : result
      onListCreated(newList)
      onClose()
      resetForm()
    } catch (error) {
      console.error('Error creating list:', error)
      alert(`Failed to create list: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep('basic')
    setListData({ name: '', description: '', tags: [] })
    setSelectedContacts([])
    setSearchTerm('')
  }

  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchTerm.toLowerCase()
    return (
      contact.first_name.toLowerCase().includes(searchLower) ||
      contact.last_name.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      contact.company.toLowerCase().includes(searchLower)
    )
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Create Contact List</h2>
            <p className="text-gray-600 text-sm">
              {step === 'basic' ? 'Define your list' : 'Select contacts to include'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {step === 'basic' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">List Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., VIP Customers"
                  value={listData.name}
                  onChange={(e) => setListData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Brief description of this list..."
                  value={listData.description}
                  onChange={(e) => setListData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <Users className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                  <div>
                    <h4 className="font-medium text-blue-900">Contact Lists vs Segments</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• <strong>Lists</strong> are static collections of specific contacts</li>
                      <li>• <strong>Segments</strong> are dynamic filters that update automatically</li>
                      <li>• Use lists for handpicked contacts or special groups</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleBasicNext} disabled={!listData.name.trim()}>
                  Next: Select Contacts
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Select Contacts</h3>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {selectedContacts.length} of {contacts.length} contacts selected
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContacts(
                    selectedContacts.length === filteredContacts.length 
                      ? [] 
                      : filteredContacts.map(c => c.id)
                  )}
                >
                  {selectedContacts.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {contactsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                        selectedContacts.includes(contact.id) ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => handleContactToggle(contact.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedContacts.includes(contact.id)
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedContacts.includes(contact.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <p className="text-sm text-gray-600">{contact.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{contact.company}</p>
                          <p className="text-xs text-gray-500">{contact.position}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Selected Contacts</h4>
                      <p className="text-sm text-gray-600">Ready to add to list</p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {selectedContacts.length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('basic')}>
                  Back
                </Button>
                <div className="space-x-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateList} disabled={loading || selectedContacts.length === 0}>
                    {loading ? 'Creating...' : `Create List (${selectedContacts.length} contacts)`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}