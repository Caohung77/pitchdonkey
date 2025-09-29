'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Reply,
  CornerUpRight,
  PenSquare,
  Trash2,
  Archive,
  Tag,
  Star,
  MoreHorizontal
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MailboxToolbarProps {
  onReply: () => void
  onForward: () => void
  onNewEmail: () => void
  onDelete: () => void
  isInboxEmail?: boolean
  className?: string
}

export function MailboxToolbar({
  onReply,
  onForward,
  onNewEmail,
  onDelete,
  isInboxEmail = true,
  className = ''
}: MailboxToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex items-center bg-white rounded-lg shadow-sm border border-gray-200 p-1 ${className}`}>
        {/* Primary Communication Actions */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-all duration-200 text-gray-600"
              >
                <Reply className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Reply</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onForward}
                className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-all duration-200 text-gray-600"
              >
                <CornerUpRight className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Forward</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Subtle Separator */}
        <div className="w-px h-4 bg-gray-200 mx-2" />

        {/* Creation & Management Actions */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewEmail}
                className="h-7 w-7 p-0 hover:bg-green-50 hover:text-green-600 rounded-md transition-all duration-200 text-gray-600"
              >
                <PenSquare className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>New Email</p>
            </TooltipContent>
          </Tooltip>

          {isInboxEmail && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-amber-50 hover:text-amber-600 rounded-md transition-all duration-200 text-gray-600"
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>Archive</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600 rounded-md transition-all duration-200 text-gray-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Delete</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Hidden on small screens - Additional Actions */}
        <div className="hidden sm:flex items-center">
          <div className="w-px h-4 bg-gray-200 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-yellow-50 hover:text-yellow-600 rounded-md transition-all duration-200 text-gray-600"
              >
                <Star className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Star</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-purple-50 hover:text-purple-600 rounded-md transition-all duration-200 text-gray-600"
              >
                <Tag className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>Add Tag</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* More Actions Dropdown - Always visible */}
        <div className="w-px h-4 bg-gray-200 mx-2" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-gray-100 rounded-md transition-all duration-200 text-gray-600"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {/* Mobile-only actions - shown only on small screens */}
            <div className="sm:hidden">
              <DropdownMenuItem>
                <Star className="h-4 w-4 mr-2 text-yellow-500" />
                <span>Star Email</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Tag className="h-4 w-4 mr-2 text-purple-500" />
                <span>Add Tag</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </div>

            <DropdownMenuItem>
              <span>Mark as Unread</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>Mark as Important</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <span>Move to Folder</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>Add to Calendar</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <span>Print Email</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>Export</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}