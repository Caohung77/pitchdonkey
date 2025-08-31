'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { X, Tag, Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TagOption {
  id: string
  name: string
  color?: string
  usage_count?: number
}

export interface TagInputProps {
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

export function TagInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  maxTags,
  disabled = false,
  allowCreate = true,
  onCreateTag,
  className
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter suggestions based on input and exclude already selected tags
  const filteredSuggestions = suggestions.filter(suggestion => 
    suggestion.name.toLowerCase().includes(inputValue.toLowerCase()) &&
    !value.some(tag => tag.id === suggestion.id)
  )

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
    setIsOpen(false)
    
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
    if (e.key === 'Enter' && !isOpen) {
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
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setIsOpen(true)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleInputBlur = () => {
    // Delay closing to allow clicking on suggestions
    setTimeout(() => setIsOpen(false), 150)
  }

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

      {/* Input with Autocomplete */}
      {(!maxTags || value.length < maxTags) && !disabled && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={placeholder}
                className="pr-8"
                disabled={disabled}
              />
              <Tag className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </PopoverTrigger>

          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandList>
                {filteredSuggestions.length === 0 && !showCreateOption && (
                  <CommandEmpty>No tags found.</CommandEmpty>
                )}
                
                {filteredSuggestions.length > 0 && (
                  <CommandGroup heading="Existing Tags">
                    {filteredSuggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion.id}
                        onSelect={() => handleAddTag(suggestion)}
                        className="flex items-center justify-between cursor-pointer"
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
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {showCreateOption && (
                  <CommandGroup heading="Create New">
                    <CommandItem
                      onSelect={handleCreateTag}
                      disabled={isCreating}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create "{inputValue}"</span>
                      {isCreating && (
                        <div className="ml-auto">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                        </div>
                      )}
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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