'use client'

import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface TooltipIconButtonProps extends ButtonProps {
  tooltip: ReactNode
}

export function TooltipIconButton({
  tooltip,
  className,
  children,
  variant = 'ghost',
  size = 'icon',
  ...props
}: TooltipIconButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            className={cn('rounded-full', className)}
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
