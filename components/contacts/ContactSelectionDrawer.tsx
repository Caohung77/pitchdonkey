'use client'

import { Button } from '@/components/ui/button'
import { Trash2, Tag, X, Globe, List, Users } from 'lucide-react'

interface ContactSelectionDrawerProps {
  selectedCount: number
  onBulkDelete: () => void
  onBulkAddTag: () => void
  onBulkEnrich: () => void
  onBulkAddToList: () => void
  onClearSelection: () => void
  isVisible: boolean
}

export function ContactSelectionDrawer({
  selectedCount,
  onBulkDelete,
  onBulkAddTag,
  onBulkEnrich,
  onBulkAddToList,
  onClearSelection,
  isVisible
}: ContactSelectionDrawerProps) {
  if (selectedCount === 0 && !isVisible) {
    return null
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl transition-transform duration-300 ease-out z-50 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="px-4 py-3 sm:px-6">
        <div className="flex flex-col items-center space-y-3">
          {/* Centered selection count */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-7 h-7 bg-blue-100 rounded-full">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">
              {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Centered action buttons */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkEnrich}
              className="h-8 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              title="Enrich contacts"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="ml-1 hidden sm:inline">Enrich</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBulkAddToList}
              className="h-8 px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              title="Add to list"
            >
              <List className="h-3.5 w-3.5" />
              <span className="ml-1 hidden sm:inline">Add to List</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBulkAddTag}
              className="h-8 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              title="Add tag"
            >
              <Tag className="h-3.5 w-3.5" />
              <span className="ml-1 hidden sm:inline">Add Tag</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              className="h-8 px-3 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
              title="Delete contacts"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="ml-1 hidden sm:inline">Delete</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 ml-1"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
        <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
      </div>
    </div>
  )
}