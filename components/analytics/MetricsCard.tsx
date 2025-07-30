'use client'

import { Card } from '@/components/ui/card'
import { ReactNode } from 'react'

interface MetricsCardProps {
  title: string
  value: string
  change?: number
  icon: ReactNode
  trend?: ReactNode
  description?: string
  color?: 'default' | 'success' | 'warning' | 'danger'
}

export function MetricsCard({ 
  title, 
  value, 
  change, 
  icon, 
  trend, 
  description,
  color = 'default'
}: MetricsCardProps) {
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600'
    if (change < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getCardBorderColor = () => {
    switch (color) {
      case 'success':
        return 'border-l-4 border-l-green-500'
      case 'warning':
        return 'border-l-4 border-l-yellow-500'
      case 'danger':
        return 'border-l-4 border-l-red-500'
      default:
        return 'border-l-4 border-l-blue-500'
    }
  }

  return (
    <Card className={`p-6 ${getCardBorderColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
        
        {trend && (
          <div className="flex items-center space-x-1">
            {trend}
          </div>
        )}
      </div>
      
      {(change !== undefined || description) && (
        <div className="mt-4 flex items-center justify-between">
          {change !== undefined && (
            <div className="flex items-center space-x-1">
              <span className={`text-sm font-medium ${getChangeColor(change)}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-sm text-gray-500">vs last period</span>
            </div>
          )}
          
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      )}
    </Card>
  )
}