'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MoreHorizontal, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  showInfo?: boolean
  showFirstLast?: boolean
  className?: string
}

export function Pagination({ 
  currentPage, 
  totalItems, 
  itemsPerPage, 
  onPageChange,
  showInfo = true,
  showFirstLast = true,
  className
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  if (totalPages <= 1) {
    return null
  }

  const getVisiblePages = () => {
    const pages: (number | string)[] = []
    const maxPagesToShow = 7
    const sidePages = 2

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      // Determine the start and end of the middle section
      let startPage = Math.max(2, currentPage - sidePages)
      let endPage = Math.min(totalPages - 1, currentPage + sidePages)

      // Adjust if we're near the beginning
      if (currentPage <= sidePages + 2) {
        startPage = 2
        endPage = maxPagesToShow - 2
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - sidePages - 1) {
        startPage = totalPages - (maxPagesToShow - 3)
        endPage = totalPages - 1
      }

      // Add ellipsis before middle section if needed
      if (startPage > 2) {
        pages.push('...')
      }

      // Add middle section
      for (let i = startPage; i <= endPage; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i)
        }
      }

      // Add ellipsis after middle section if needed
      if (endPage < totalPages - 1) {
        pages.push('...')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Results Information - Enhanced */}
      {showInfo && (
        <div className="text-sm text-gray-600 text-center">
          Showing <span className="font-medium text-gray-900">{startItem}</span> to{' '}
          <span className="font-medium text-gray-900">{endItem}</span> of{' '}
          <span className="font-medium text-gray-900">{totalItems}</span> results
        </div>
      )}

      {/* Desktop Pagination Controls */}
      <div className="hidden sm:flex items-center justify-center">
        <nav className="flex items-center space-x-1" aria-label="Pagination">
          {/* First Page Button */}
          {showFirstLast && currentPage > 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              className="h-9 px-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              title="Go to first page"
            >
              <ChevronsLeft className="h-4 w-4 mr-1" />
              First
            </Button>
          )}

          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(
              "h-9 px-3 text-sm font-medium",
              currentPage === 1 
                ? "text-gray-400 cursor-not-allowed" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {/* Page Numbers */}
          <div className="flex items-center space-x-1">
            {getVisiblePages().map((page, index) => (
              <React.Fragment key={index}>
                {page === '...' ? (
                  <span className="flex h-9 w-9 items-center justify-center text-sm text-gray-500">
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                ) : (
                  <Button
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onPageChange(page as number)}
                    disabled={currentPage === page}
                    className={cn(
                      "h-9 w-9 p-0 text-sm font-medium",
                      currentPage === page
                        ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-300"
                    )}
                    aria-label={`Go to page ${page}`}
                    aria-current={currentPage === page ? 'page' : undefined}
                  >
                    {page}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Next Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(
              "h-9 px-3 text-sm font-medium",
              currentPage === totalPages 
                ? "text-gray-400 cursor-not-allowed" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          {/* Last Page Button */}
          {showFirstLast && currentPage < totalPages - 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              className="h-9 px-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              title="Go to last page"
            >
              Last
              <ChevronsRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </nav>
      </div>

      {/* Mobile Pagination Controls */}
      <div className="sm:hidden flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-9 px-3 text-sm font-medium"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-9 px-3 text-sm font-medium"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}