'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, List, Users } from 'lucide-react'
// Using alert for consistency with other components

interface ContactList {
  id: string
  name: string
  description: string
  contactCount: number
  tags: string[]
  isFavorite: boolean
  createdAt: string
  type: string
}

interface BulkListManagementModalProps {
  isOpen: boolean
  onClose: () => void
  selectedContactIds: string[]
  selectedContactCount: number
  onListsUpdated?: () => void
}

export function BulkListManagementModal({
  isOpen,
  onClose,
  selectedContactIds,
  selectedContactCount,
  onListsUpdated
}: BulkListManagementModalProps) {
  const [activeTab, setActiveTab] = useState('existing')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Existing lists state
  const [existingLists, setExistingLists] = useState<ContactList[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  
  // New list state
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')

  // Load existing lists
  useEffect(() => {
    if (isOpen) {
      loadExistingLists()
    }
  }, [isOpen])

  const loadExistingLists = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/contacts/lists')
      const result = await response.json()

      if (result.success) {
        setExistingLists(result.data)
      } else {
        alert('Failed to load contact lists')
      }
    } catch (error) {
      console.error('Error loading lists:', error)
      alert('Failed to load contact lists')
    } finally {
      setLoading(false)
    }
  }

  const handleListSelection = (listId: string, checked: boolean) => {
    if (checked) {
      setSelectedListIds(prev => [...prev, listId])
    } else {
      setSelectedListIds(prev => prev.filter(id => id !== listId))
    }
  }

  const handleSubmit = async () => {
    if (activeTab === 'existing' && selectedListIds.length === 0) {
      alert('Please select at least one list')
      return
    }

    if (activeTab === 'new' && !newListName.trim()) {
      alert('Please enter a list name')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        contactIds: selectedContactIds,
        ...(activeTab === 'existing' 
          ? { listIds: selectedListIds }
          : { 
              newListName: newListName.trim(),
              newListDescription: newListDescription.trim()
            }
        )
      }

      const response = await fetch('/api/contacts/bulk-list-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        // Success feedback - could be improved with a proper toast system later
        console.log('Success:', result.message)
        if (onListsUpdated) {
          onListsUpdated()
        }
        handleClose()
      } else {
        alert(result.error || 'Failed to add contacts to lists')
      }
    } catch (error) {
      console.error('Error adding contacts to lists:', error)
      alert('Failed to add contacts to lists')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setActiveTab('existing')
    setSelectedListIds([])
    setNewListName('')
    setNewListDescription('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <List className="h-5 w-5" />
            <span>Add to Lists</span>
            <Badge variant="secondary" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {selectedContactCount} contacts
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Lists</TabsTrigger>
            <TabsTrigger value="new">Create New List</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading lists...</span>
              </div>
            ) : existingLists.length === 0 ? (
              <div className="text-center py-8">
                <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No contact lists found</p>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('new')}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create your first list</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {existingLists.map((list) => (
                  <Card 
                    key={list.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedListIds.includes(list.id) 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleListSelection(list.id, !selectedListIds.includes(list.id))}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={selectedListIds.includes(list.id)}
                          onChange={() => {}}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-sm">{list.name}</h3>
                            {list.isFavorite && (
                              <Badge variant="outline" className="text-xs">
                                ⭐ Favorite
                              </Badge>
                            )}
                          </div>
                          {list.description && (
                            <p className="text-xs text-gray-500 mt-1">{list.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">
                              {list.contactCount} contacts
                            </span>
                            {list.tags && list.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {list.tags.slice(0, 3).map((tag, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {list.tags.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{list.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="listName">List Name *</Label>
                <Input
                  id="listName"
                  placeholder="Enter list name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="listDescription">Description (Optional)</Label>
                <Textarea
                  id="listDescription"
                  placeholder="Enter list description"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 text-blue-700">
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">New List Preview</span>
                  </div>
                  <div className="mt-2">
                    <p className="font-medium text-sm">
                      {newListName || 'New List Name'}
                    </p>
                    {newListDescription && (
                      <p className="text-xs text-gray-600 mt-1">
                        {newListDescription}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Will contain {selectedContactCount} contacts
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="flex items-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>
                  {activeTab === 'existing' 
                    ? `Add to ${selectedListIds.length} list(s)`
                    : 'Create List'
                  }
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}