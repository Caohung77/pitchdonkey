'use client'

import { useState } from 'react'
import { ChevronDown, ArrowUpDown, Clock, User, Activity, Star, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel 
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface SortOption {
  value: string
  label: string
  icon: React.ReactNode
  description?: string
  order: 'asc' | 'desc'
}

interface SortDropdownProps {
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  className?: string
}

export function SortDropdown({ sortBy, sortOrder, onSortChange, className }: SortDropdownProps) {
  
  const sortOptions: SortOption[] = [
    {
      value: 'updated_at',
      label: 'Latest Changed',
      icon: <Clock className="h-4 w-4" />,
      description: 'Recently updated contacts first',
      order: 'desc'
    },
    {
      value: 'last_contacted_at',
      label: 'Last Interaction',
      icon: <Activity className="h-4 w-4" />,
      description: 'Most recently contacted first',
      order: 'desc'
    },
    {
      value: 'created_at',
      label: 'Recently Added',
      icon: <Calendar className="h-4 w-4" />,
      description: 'Newest contacts first',
      order: 'desc'
    },
    {
      value: 'last_name',
      label: 'Last Name (A-Z)',
      icon: <User className="h-4 w-4" />,
      description: 'Alphabetical by last name',
      order: 'asc'
    },
    {
      value: 'first_name',
      label: 'First Name (A-Z)',
      icon: <User className="h-4 w-4" />,
      description: 'Alphabetical by first name',
      order: 'asc'
    },
    {
      value: 'status_priority',
      label: 'Status Priority',
      icon: <Star className="h-4 w-4" />,
      description: 'Active contacts first',
      order: 'desc'
    }
  ]

  const currentSort = sortOptions.find(option => 
    option.value === sortBy && option.order === sortOrder
  ) || sortOptions[0]

  const handleSortSelect = (option: SortOption) => {
    onSortChange(option.value, option.order)
  }

  // Custom sorting for status priority
  const getStatusPriority = (status: string) => {
    const priorities = {
      'active': 4,
      'unsubscribed': 3,
      'bounced': 2,
      'complained': 1
    }
    return priorities[status as keyof typeof priorities] || 0
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("justify-between min-w-[200px]", className)}
        >
          <div className="flex items-center gap-2">
            {currentSort.icon}
            <span className="hidden sm:inline">{currentSort.label}</span>
            <span className="sm:hidden">Sort</span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
          Sort Contacts By
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Recent Activity Group */}
        <DropdownMenuLabel className="text-xs text-gray-500 font-medium px-2 py-1">
          Recent Activity
        </DropdownMenuLabel>
        
        {sortOptions.slice(0, 3).map((option) => (
          <DropdownMenuItem 
            key={`${option.value}-${option.order}`}
            onClick={() => handleSortSelect(option)}
            className={cn(
              "flex items-start gap-3 px-3 py-2 cursor-pointer",
              currentSort.value === option.value && currentSort.order === option.order && 
              "bg-blue-50 text-blue-700"
            )}
          >
            <div className={cn(
              "mt-0.5",
              currentSort.value === option.value && currentSort.order === option.order && 
              "text-blue-600"
            )}>
              {option.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{option.label}</span>
                {currentSort.value === option.value && currentSort.order === option.order && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                )}
              </div>
              {option.description && (
                <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Alphabetical Group */}
        <DropdownMenuLabel className="text-xs text-gray-500 font-medium px-2 py-1">
          Alphabetical
        </DropdownMenuLabel>
        
        {sortOptions.slice(3, 5).map((option) => (
          <DropdownMenuItem 
            key={`${option.value}-${option.order}`}
            onClick={() => handleSortSelect(option)}
            className={cn(
              "flex items-start gap-3 px-3 py-2 cursor-pointer",
              currentSort.value === option.value && currentSort.order === option.order && 
              "bg-blue-50 text-blue-700"
            )}
          >
            <div className={cn(
              "mt-0.5",
              currentSort.value === option.value && currentSort.order === option.order && 
              "text-blue-600"
            )}>
              {option.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{option.label}</span>
                {currentSort.value === option.value && currentSort.order === option.order && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                )}
              </div>
              {option.description && (
                <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Priority Group */}
        <DropdownMenuLabel className="text-xs text-gray-500 font-medium px-2 py-1">
          Priority
        </DropdownMenuLabel>
        
        {sortOptions.slice(5).map((option) => (
          <DropdownMenuItem 
            key={`${option.value}-${option.order}`}
            onClick={() => handleSortSelect(option)}
            className={cn(
              "flex items-start gap-3 px-3 py-2 cursor-pointer",
              currentSort.value === option.value && currentSort.order === option.order && 
              "bg-blue-50 text-blue-700"
            )}
          >
            <div className={cn(
              "mt-0.5",
              currentSort.value === option.value && currentSort.order === option.order && 
              "text-blue-600"
            )}>
              {option.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{option.label}</span>
                {currentSort.value === option.value && currentSort.order === option.order && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                )}
              </div>
              {option.description && (
                <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Simplified version for mobile or compact layouts
export function SortDropdownCompact({ sortBy, sortOrder, onSortChange }: SortDropdownProps) {
  const sortOptions: SortOption[] = [
    { value: 'updated_at', label: 'Latest Changed', icon: <Clock className="h-4 w-4" />, order: 'desc' },
    { value: 'last_contacted_at', label: 'Last Interaction', icon: <Activity className="h-4 w-4" />, order: 'desc' },
    { value: 'created_at', label: 'Recently Added', icon: <Calendar className="h-4 w-4" />, order: 'desc' },
    { value: 'last_name', label: 'Last Name', icon: <User className="h-4 w-4" />, order: 'asc' },
    { value: 'status_priority', label: 'Priority', icon: <Star className="h-4 w-4" />, order: 'desc' }
  ]

  const currentSort = sortOptions.find(option => 
    option.value === sortBy && option.order === sortOrder
  ) || sortOptions[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentSort.icon}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-48">
        {sortOptions.map((option) => (
          <DropdownMenuItem 
            key={`${option.value}-${option.order}`}
            onClick={() => onSortChange(option.value, option.order)}
            className={cn(
              "flex items-center gap-2",
              currentSort.value === option.value && currentSort.order === option.order && 
              "bg-blue-50 text-blue-700"
            )}
          >
            {option.icon}
            <span>{option.label}</span>
            {currentSort.value === option.value && currentSort.order === option.order && (
              <div className="w-2 h-2 bg-blue-600 rounded-full ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}