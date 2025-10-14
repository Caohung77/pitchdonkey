'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Globe, Linkedin, Sparkles, Users, X, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterTag {
  id: string
  label: string
  value: string
  icon: React.ReactNode
  count?: number
  color: {
    bg: string
    text: string
    hover: string
    active: string
    border: string
  }
}

interface FilterTagCloudProps {
  onFilterChange: (filter: string | null) => void
  activeFilter: string | null
  enrichmentStats?: {
    webEnriched: number
    linkedinEnriched: number
    fullyEnriched: number
    notEnriched: number
    total: number
  }
  className?: string
}

export function FilterTagCloud({ 
  onFilterChange, 
  activeFilter, 
  enrichmentStats,
  className 
}: FilterTagCloudProps) {
  
  const filterTags: FilterTag[] = [
    {
      id: 'all',
      label: 'All Contacts',
      value: '',
      icon: <Users className="h-3.5 w-3.5" />,
      count: enrichmentStats?.total || 0,
      color: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        hover: 'hover:bg-gray-150',
        active: 'bg-gray-200 text-gray-900',
        border: 'border-gray-200'
      }
    },
    {
      id: 'linkedin-enriched',
      label: 'LinkedIn Enriched',
      value: 'linkedin-enriched',
      icon: <Linkedin className="h-3.5 w-3.5" />,
      count: enrichmentStats?.linkedinEnriched || 0,
      color: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        hover: 'hover:bg-blue-150',
        active: 'bg-blue-200 text-blue-900',
        border: 'border-blue-200'
      }
    },
    {
      id: 'web-enriched',
      label: 'Web Enriched',
      value: 'web-enriched',
      icon: <Globe className="h-3.5 w-3.5" />,
      count: enrichmentStats?.webEnriched || 0,
      color: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        hover: 'hover:bg-green-150',
        active: 'bg-green-200 text-green-900',
        border: 'border-green-200'
      }
    },
    {
      id: 'fully-enriched',
      label: 'Fully Enriched',
      value: 'fully-enriched',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      count: enrichmentStats?.fullyEnriched || 0,
      color: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        hover: 'hover:bg-purple-150',
        active: 'bg-purple-200 text-purple-900',
        border: 'border-purple-200'
      }
    },
    {
      id: 'not-enriched',
      label: 'Not Enriched',
      value: 'not-enriched',
      icon: <Filter className="h-3.5 w-3.5" />,
      count: enrichmentStats?.notEnriched || 0,
      color: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        hover: 'hover:bg-orange-150',
        active: 'bg-orange-200 text-orange-900',
        border: 'border-orange-200'
      }
    }
  ]

  const handleTagClick = (tag: FilterTag) => {
    const newFilter = tag.value === activeFilter ? null : (tag.value || null)
    onFilterChange(newFilter)
  }

  const clearFilter = () => {
    onFilterChange(null)
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Quick Filters</span>
        </div>
        {activeFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Tag Cloud */}
      <div className="flex flex-wrap gap-2">
        {filterTags.map((tag) => {
          const isActive = activeFilter === tag.value || (activeFilter === null && tag.id === 'all')
          
          return (
            <Button
              key={tag.id}
              variant="ghost"
              size="sm"
              onClick={() => handleTagClick(tag)}
              className={cn(
                "h-8 px-3 text-sm font-medium rounded-full border transition-all duration-200",
                "flex items-center gap-2 group",
                isActive 
                  ? `${tag.color.active} ${tag.color.border} shadow-sm ring-1 ring-opacity-20`
                  : `${tag.color.bg} ${tag.color.text} ${tag.color.border} ${tag.color.hover}`
              )}
              disabled={tag.count === 0}
            >
              <span className={cn(
                "transition-transform duration-200",
                isActive ? "scale-110" : "group-hover:scale-105"
              )}>
                {tag.icon}
              </span>
              <span className="truncate">{tag.label}</span>
              {tag.count !== undefined && (
                <Badge 
                  variant="secondary"
                  className={cn(
                    "ml-1 h-5 px-1.5 text-xs font-medium rounded-full",
                    isActive 
                      ? "bg-white/20 text-current border-white/30"
                      : "bg-white/50 text-current border-white/20"
                  )}
                >
                  {tag.count}
                </Badge>
              )}
            </Button>
          )
        })}
      </div>

    </div>
  )
}

// Compact version for smaller layouts
export function FilterTagCloudCompact({ 
  onFilterChange, 
  activeFilter, 
  enrichmentStats 
}: Omit<FilterTagCloudProps, 'className'>) {
  
  const compactTags = [
    {
      id: 'linkedin',
      label: 'LinkedIn',
      value: 'linkedin-enriched',
      icon: <Linkedin className="h-3 w-3" />,
      count: enrichmentStats?.linkedinEnriched || 0,
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100'
    },
    {
      id: 'web',
      label: 'Web',
      value: 'web-enriched', 
      icon: <Globe className="h-3 w-3" />,
      count: enrichmentStats?.webEnriched || 0,
      color: 'text-green-600 bg-green-50 hover:bg-green-100'
    },
    {
      id: 'full',
      label: 'Full',
      value: 'fully-enriched',
      icon: <Sparkles className="h-3 w-3" />,
      count: enrichmentStats?.fullyEnriched || 0,
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100'
    }
  ]

  return (
    <div className="flex items-center gap-1">
      {compactTags.map((tag) => {
        const isActive = activeFilter === tag.value
        
        return (
          <Button
            key={tag.id}
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange(isActive ? null : tag.value)}
            className={cn(
              "h-7 px-2 text-xs rounded-full",
              tag.color,
              isActive && "ring-1 ring-current shadow-sm"
            )}
            disabled={tag.count === 0}
          >
            {tag.icon}
            <span className="ml-1">{tag.count}</span>
          </Button>
        )
      })}
    </div>
  )
}