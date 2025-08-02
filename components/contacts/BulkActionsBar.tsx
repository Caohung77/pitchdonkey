'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Tag, X } from 'lucide-react'

interface BulkActionsBarProps {
  selectedCount: number
  onBulkDelete: () => void
  onBulkAddTag: () => void
  onClearSelection: () => void
}

export function BulkActionsBar({ 
  selectedCount, 
  onBulkDelete, 
  onBulkAddTag, 
  onClearSelection 
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Selection
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkAddTag}
              className="flex items-center space-x-1"
            >
              <Tag className="h-4 w-4" />
              <span>Add Tag</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}