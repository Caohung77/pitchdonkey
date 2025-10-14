'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReactNode } from 'react'

interface ToolFallbackProps {
  title?: string
  description?: ReactNode
  children?: ReactNode
}

export function ToolFallback({ title = 'Tool Output', description, children }: ToolFallbackProps) {
  return (
    <Card className="w-full max-w-xl border border-dashed border-muted-foreground/40 bg-muted/40">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {description ? (
          <p className="text-sm text-muted-foreground/80 leading-relaxed">{description}</p>
        ) : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}
