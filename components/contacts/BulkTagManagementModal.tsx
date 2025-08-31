'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SimpleTagInput, TagOption } from '@/components/ui/simple-tag-input'
import { Loader2, Save, Users } from 'lucide-react'

interface BulkTagManagementModalProps {
  isOpen: boolean
  onClose: () => void
  selectedContacts: string[]
  selectedContactsCount: number
  onTagsUpdated: () => void
}

export function BulkTagManagementModal({
  isOpen,
  onClose,
  selectedContacts,
  selectedContactsCount,
  onTagsUpdated
}: BulkTagManagementModalProps) {
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([])
  const [availableTags, setAvailableTags] = useState<TagOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch available tags when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableTags()
      setSelectedTags([]) // Reset selected tags when opening
    }
  }, [isOpen])

  const fetchAvailableTags = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/tags')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.log('Tags API not ready (status:', response.status, '):', errorData.error)
        // For any non-200 response, assume the system isn't ready and set empty tags
        setAvailableTags([])
        return
      }
      const data = await response.json()
      setAvailableTags(data.tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description
      })))
    } catch (error) {
      console.error('Error fetching tags:', error)
      setAvailableTags([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (selectedTags.length === 0) {
      onClose()
      return
    }

    setIsSaving(true)
    
    try {
      // Use advanced tagging system first
      await addTagsToContacts()
    } catch (error) {
      console.error('Error adding tags:', error)
      alert('Failed to add tags. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const addTagsToContacts = async () => {
    try {
      // First, ensure all tags exist (create new ones if needed)
      const tagIds = []
      
      for (const tag of selectedTags) {
        let tagId = tag.id
        
        // If tag doesn't have an ID, it's a new tag - create it
        if (!tagId) {
          try {
            const createResponse = await fetch('/api/tags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: tag.name,
                color: tag.color || '#3B82F6'
              })
            })
            
            if (!createResponse.ok) {
              throw new Error('Failed to create tag')
            }
            
            const createdTag = await createResponse.json()
            tagId = createdTag.tag.id
            
            // Update available tags list
            setAvailableTags(prev => [...prev, {
              id: tagId,
              name: tag.name,
              color: tag.color || '#3B82F6'
            }])
            
          } catch (error) {
            console.log('Advanced tag creation failed, using legacy fallback')
            // Continue with legacy approach below
          }
        }
        
        if (tagId) {
          tagIds.push(tagId)
        }
      }
      
      // For now, use the legacy system that the bulk API currently supports
      // TODO: Update bulk API to support both tag_ids (advanced) and tags (legacy)
      const tagNames = selectedTags.map(tag => tag.name)
      const response = await fetch('/api/contacts/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_ids: selectedContacts,
          action: 'add_tags',
          data: { tags: tagNames }
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to add tags to contacts')
      }
      
      console.log('Tags added successfully via bulk API')
      
      // Close modal and trigger refresh
      onClose()
      onTagsUpdated()
      
    } catch (error) {
      throw error // Re-throw to be handled by caller
    }
  }

  const handleCreateTag = async (name: string): Promise<TagOption> => {
    try {
      // Try to create tag via advanced system first
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          color: '#3B82F6'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        const newTag = {
          id: data.tag.id,
          name: data.tag.name,
          color: data.tag.color
        }
        
        // Update available tags
        setAvailableTags(prev => [...prev, newTag])
        
        return newTag
      }
    } catch (error) {
      console.log('Advanced tag creation failed, using legacy fallback')
    }
    
    // Legacy fallback: return tag without ID (will be handled as string)
    return {
      name: name,
      color: '#3B82F6'
    }
  }

  const handleCancel = () => {
    setSelectedTags([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add Tags to {selectedContactsCount} Contact{selectedContactsCount !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Select existing tags or create new ones to add to the selected contacts.
            </p>
            
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading tags...</span>
              </div>
            ) : (
              <SimpleTagInput
                tags={selectedTags}
                onChange={setSelectedTags}
                suggestions={availableTags}
                onCreateTag={handleCreateTag}
                maxTags={5}
                placeholder="Type to search or create tags..."
              />
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || selectedTags.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding Tags...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Add Tags ({selectedTags.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}