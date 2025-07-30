'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar, Clock } from 'lucide-react'

interface EngagementHeatmapProps {
  dateRange: {
    startDate: string
    endDate: string
  }
}

interface HeatmapData {
  day: number // 0-6 (Sunday-Saturday)
  hour: number // 0-23
  engagementRate: number // 0-1
  emailCount: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function EngagementHeatmap({ dateRange }: EngagementHeatmapProps) {
  const [data, setData] = useState<HeatmapData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<HeatmapData | null>(null)

  useEffect(() => {
    loadHeatmapData()
  }, [dateRange])

  const loadHeatmapData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        groupBy: 'hour'
      })

      const response = await fetch(`/api/analytics/engagement-heatmap?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load heatmap data')
      }

      const heatmapData = await response.json()
      setData(heatmapData.data || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getEngagementData = (day: number, hour: number): HeatmapData | null => {
    return data.find(d => d.day === day && d.hour === hour) || null
  }

  const getHeatmapColor = (engagementRate: number): string => {
    if (engagementRate === 0) return 'bg-gray-100'
    
    const intensity = Math.min(engagementRate * 4, 1) // Scale up for better visibility
    
    if (intensity >= 0.8) return 'bg-green-500'
    if (intensity >= 0.6) return 'bg-green-400'
    if (intensity >= 0.4) return 'bg-green-300'
    if (intensity >= 0.2) return 'bg-green-200'
    return 'bg-green-100'
  }

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour === 12) return '12 PM'
    if (hour < 12) return `${hour} AM`
    return `${hour - 12} PM`
  }

  const formatPercentage = (num: number): string => {
    return `${(num * 100).toFixed(1)}%`
  }

  const getBestTimes = (): Array<{ day: string; hour: string; rate: number }> => {
    return data
      .filter(d => d.emailCount > 0)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 3)
      .map(d => ({
        day: DAYS[d.day],
        hour: formatHour(d.hour),
        rate: d.engagementRate
      }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={loadHeatmapData}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const bestTimes = getBestTimes()

  return (
    <div className="space-y-4">
      {/* Heatmap Grid */}
      <div className="relative">
        {/* Hour labels */}
        <div className="flex ml-12">
          {[0, 6, 12, 18].map(hour => (
            <div 
              key={hour}
              className="flex-1 text-xs text-gray-500 text-center"
              style={{ marginLeft: hour === 0 ? '0' : '25%' }}
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col w-12">
            {DAYS.map((day, index) => (
              <div 
                key={day}
                className="h-6 flex items-center justify-end pr-2 text-xs text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Heatmap cells */}
          <div className="flex-1">
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex h-6">
                {HOURS.map(hour => {
                  const cellData = getEngagementData(dayIndex, hour)
                  const engagementRate = cellData?.engagementRate || 0
                  const emailCount = cellData?.emailCount || 0

                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={`flex-1 border border-gray-200 cursor-pointer transition-all hover:border-gray-400 ${getHeatmapColor(engagementRate)}`}
                      style={{ minWidth: '8px' }}
                      onClick={() => setSelectedCell(cellData)}
                      title={`${day} ${formatHour(hour)}: ${formatPercentage(engagementRate)} engagement (${emailCount} emails)`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <span>Less engaged</span>
          <div className="flex items-center space-x-1">
            {[0, 0.2, 0.4, 0.6, 0.8].map(intensity => (
              <div
                key={intensity}
                className={`w-3 h-3 border border-gray-200 ${getHeatmapColor(intensity)}`}
              />
            ))}
          </div>
          <span>More engaged</span>
        </div>
      </div>

      {/* Best Times Summary */}
      {bestTimes.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2 flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Best Engagement Times
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {bestTimes.map((time, index) => (
              <div key={index} className="text-center">
                <div className="font-medium text-green-800">
                  {time.day} {time.hour}
                </div>
                <div className="text-sm text-green-600">
                  {formatPercentage(time.rate)} engagement
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Cell Details */}
      {selectedCell && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            {DAYS[selectedCell.day]} {formatHour(selectedCell.hour)}
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Engagement Rate:</span>
              <span className="font-medium ml-2">
                {formatPercentage(selectedCell.engagementRate)}
              </span>
            </div>
            <div>
              <span className="text-blue-700">Emails Sent:</span>
              <span className="font-medium ml-2">
                {selectedCell.emailCount}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No engagement data available for the selected period</p>
        </div>
      )}
    </div>
  )
}