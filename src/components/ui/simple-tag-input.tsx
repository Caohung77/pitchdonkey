'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Tag, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TagOption {
  id: string
  name: string
  color?: string
  usage_count?: number
}

export interface SimpleTagInputProps {
  value: TagOption[]
  onChange: (tags: TagOption[]) => void
  suggestions?: TagOption[]
  placeholder?: string
  maxTags?: number
  disabled?: boolean
  allowCreate?: boolean
  onCreateTag?: (tagName: string) => Promise<TagOption>
  className?: string
}

export function SimpleTagInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  maxTags,
  disabled = false,
  allowCreate = true,
  onCreateTag,
  className
}: SimpleTagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on input and exclude already selected tags
  const filteredSuggestions = suggestions.filter(suggestion => 
    suggestion.name.toLowerCase().includes(inputValue.toLowerCase()) &&
    !value.some(tag => tag.id === suggestion.id)
  ).slice(0, 10) // Limit to 10 suggestions

  // Check if input value matches any existing suggestion
  const exactMatch = filteredSuggestions.find(
    suggestion => suggestion.name.toLowerCase() === inputValue.toLowerCase()
  )

  // Show create option if allowCreate is true, input is not empty, no exact match, and not at max tags
  const showCreateOption = 
    allowCreate &&
    inputValue.trim() &&
    !exactMatch &&
    (!maxTags || value.length < maxTags)

  const handleAddTag = (tag: TagOption) => {
    if (maxTags && value.length >= maxTags) return
    if (value.some(t => t.id === tag.id)) return

    onChange([...value, tag])
    setInputValue('')
    setShowSuggestions(false)
    
    // Focus back on input after adding tag
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleRemoveTag = (tagId: string) => {
    onChange(value.filter(tag => tag.id !== tagId))
  }

  const handleCreateTag = async () => {
    if (!inputValue.trim() || !onCreateTag) return
    
    setIsCreating(true)
    try {
      const newTag = await onCreateTag(inputValue.trim())
      handleAddTag(newTag)
    } catch (error) {
      console.error('Failed to create tag:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showCreateOption) {
        handleCreateTag()
      } else if (filteredSuggestions.length > 0) {
        handleAddTag(filteredSuggestions[0])
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when backspacing with empty input
      handleRemoveTag(value[value.length - 1].id)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      inputRef.current?.blur()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setShowSuggestions(true)
  }

  const handleInputFocus = () => {
    setShowSuggestions(true)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs px-2 py-1 flex items-center gap-1"
              style={{ 
                backgroundColor: tag.color ? `${tag.color}20` : undefined,
                borderColor: tag.color || undefined 
              }}
            >
              <Tag className="h-3 w-3" />
              {tag.name}
              {!disabled && (
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:text-red-600 ml-1"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Input with Suggestions */}
      {(!maxTags || value.length < maxTags) && !disabled && (
        <div className="relative">
          <div className="relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              placeholder={placeholder}
              className="pr-8"
              disabled={disabled}
            />
            <Tag className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && (filteredSuggestions.length > 0 || showCreateOption) && (
            <div 
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              {/* Existing Tags */}
              {filteredSuggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-1 px-2">Existing Tags</div>
                  {filteredSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      onClick={() => handleAddTag(suggestion)}
                      className="flex items-center justify-between px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: suggestion.color || '#3B82F6' }}
                        />
                        <span>{suggestion.name}</span>
                      </div>
                      {suggestion.usage_count !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          {suggestion.usage_count} contact{suggestion.usage_count !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Create New Tag */}
              {showCreateOption && (
                <div className="border-t p-2">
                  <div className="text-xs font-medium text-gray-500 mb-1 px-2">Create New</div>
                  <div
                    onClick={handleCreateTag}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create "{inputValue}"</span>
                    {isCreating && (
                      <div className="ml-auto">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {filteredSuggestions.length === 0 && !showCreateOption && (
                <div className="p-4 text-center text-sm text-gray-500">
                  No tags found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Max tags reached message */}
      {maxTags && value.length >= maxTags && (
        <p className="text-xs text-gray-500">
          Maximum {maxTags} tags reached
        </p>
      )}
    </div>
  )
}