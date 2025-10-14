'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SimpleTagInput, TagOption } from '@/components/ui/simple-tag-input'
import { Loader2, Save } from 'lucide-react'
import { Contact } from '@/lib/contacts'

interface TagManagementModalProps {
  isOpen: boolean
  onClose: () => void
  contact: Contact | null
  onTagsUpdated: () => void
}

export function TagManagementModal({
  isOpen,
  onClose,
  contact,
  onTagsUpdated
}: TagManagementModalProps) {
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([])
  const [availableTags, setAvailableTags] = useState<TagOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch available tags when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableTags()
      fetchContactTags()
    }
  }, [isOpen, contact])

  const fetchAvailableTags = async () => {
    try {
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
        usage_count: tag.usage_count
      })))
    } catch (error) {
      console.log('Error fetching available tags (system not ready):', error.message)
      setAvailableTags([]) // Set empty array on error
    }
  }

  const fetchContactTags = async () => {
    if (!contact) return

    setIsLoading(true)
    try {
      // Try to fetch from advanced tagging system first
      const response = await fetch(`/api/contacts/${contact.id}/tags`)
      if (response.ok) {
        const data = await response.json()
        setSelectedTags(data.tags.map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          usage_count: tag.usage_count
        })))
        return
      }
      
      // Fallback: Use legacy tags from the contact object
      console.log('Advanced tagging not available, using legacy tags from contact')
      if (contact.tags && contact.tags.length > 0) {
        const legacyTags = contact.tags.map((tagName: string) => ({
          id: tagName,
          name: tagName,
          color: '#3B82F6', // Default blue color
          usage_count: 0
        }))
        setSelectedTags(legacyTags)
      } else {
        setSelectedTags([])
      }
    } catch (error) {
      console.log('Error fetching contact tags, using legacy fallback:', error.message)
      
      // Final fallback: Use legacy tags from contact object
      if (contact.tags && contact.tags.length > 0) {
        const legacyTags = contact.tags.map((tagName: string) => ({
          id: tagName,
          name: tagName,
          color: '#3B82F6', // Default blue color  
          usage_count: 0
        }))
        setSelectedTags(legacyTags)
      } else {
        setSelectedTags([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTag = async (tagName: string): Promise<TagOption> => {
    try {
      // Try to create tag in the advanced system
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: tagName })
      })

      if (response.ok) {
        // Advanced system is available
        const data = await response.json()
        const newTag = {
          id: data.tag.id,
          name: data.tag.name,
          color: data.tag.color,
          usage_count: data.tag.usage_count
        }

        // Add to available tags
        setAvailableTags(prev => [...prev, newTag])
        return newTag
      } else {
        // Advanced system not available - use legacy fallback
        console.log('Advanced tagging not available, using simple tag creation')
        
        // For legacy system, tag ID = tag name
        const newTag = {
          id: tagName.trim(),
          name: tagName.trim(),
          color: '#3B82F6', // Default blue color
          usage_count: 0
        }

        return newTag
      }
    } catch (error) {
      console.log('Tag creation failed, using simple fallback:', error)
      
      // Fallback: Create a simple tag option
      const newTag = {
        id: tagName.trim(),
        name: tagName.trim(),
        color: '#3B82F6', // Default blue color
        usage_count: 0
      }

      return newTag
    }
  }

  const handleSave = async () => {
    if (!contact) return

    setIsSaving(true)
    try {
      // Check if the advanced tagging system is available
      if (availableTags.length > 0 || selectedTags.some(tag => tag.id !== tag.name)) {
        // Use advanced tagging system
        const response = await fetch(`/api/contacts/${contact.id}/tags`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tag_ids: selectedTags.map(tag => tag.id)
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update contact tags')
        }
      } else {
        // Fallback: Update legacy tags field directly
        console.log('Using legacy tag system fallback')
        const tagNames = selectedTags.map(tag => tag.name)
        
        // Update contact with legacy tags field
        const response = await fetch(`/api/contacts/${contact.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tags: tagNames
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update contact with legacy tags')
        }
      }

      onTagsUpdated()
      onClose()
    } catch (error) {
      console.error('Failed to save tags:', error)
      alert('Failed to save tags. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setSelectedTags([])
    setAvailableTags([])
    onClose()
  }

  if (!contact) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags for {contact.first_name} {contact.last_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading tags...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Contact Tags
                </label>
                <SimpleTagInput
                  value={selectedTags}
                  onChange={setSelectedTags}
                  suggestions={availableTags}
                  placeholder="Type to search or create tags..."
                  allowCreate={true}
                  onCreateTag={handleCreateTag}
                  maxTags={5}
                />
              </div>

              {/* Show migration notice if no tags available */}
              {availableTags.length === 0 && !isLoading && (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm mb-2">🏗️ Tag system is being set up</p>
                  <p className="text-xs">
                    The advanced tagging feature requires database migration.
                    <br />
                    Please apply the migration to enable full functionality.
                  </p>
                </div>
              )}

              {availableTags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Popular Tags ({availableTags.length} total)
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {availableTags
                      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
                      .slice(0, 20)
                      .map((tag) => {
                        const isSelected = selectedTags.some(selected => selected.id === tag.id)
                        return (
                          <Button
                            key={tag.id}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(prev => prev.filter(t => t.id !== tag.id))
                              } else {
                                setSelectedTags(prev => [...prev, tag])
                              }
                            }}
                            style={{ 
                              backgroundColor: isSelected && tag.color ? `${tag.color}20` : undefined,
                              borderColor: tag.color || undefined 
                            }}
                          >
                            {tag.name}
                            {tag.usage_count && tag.usage_count > 0 && (
                              <span className="ml-1 opacity-60">({tag.usage_count})</span>
                            )}
                          </Button>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Tags
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}