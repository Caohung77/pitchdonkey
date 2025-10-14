'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface PerformanceChartProps {
  dateRange: {
    startDate: string
    endDate: string
  }
  metrics: string[]
  campaignIds?: string[]
  height?: number
}

interface ChartDataPoint {
  date: string
  openRate: number
  clickRate: number
  replyRate: number
  bounceRate: number
  deliveryRate: number
}

export function PerformanceChart({ 
  dateRange, 
  metrics, 
  campaignIds,
  height = 300 
}: PerformanceChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(metrics)

  useEffect(() => {
    loadChartData()
  }, [dateRange, campaignIds])

  const loadChartData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        groupBy: 'day',
        metrics: selectedMetrics.join(',')
      })

      if (campaignIds?.length) {
        params.append('campaignIds', campaignIds.join(','))
      }

      const response = await fetch(`/api/analytics/time-series?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load chart data')
      }

      const chartData = await response.json()
      setData(chartData.data || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const metricConfig = {
    openRate: { color: '#3B82F6', label: 'Open Rate' },
    clickRate: { color: '#10B981', label: 'Click Rate' },
    replyRate: { color: '#8B5CF6', label: 'Reply Rate' },
    bounceRate: { color: '#EF4444', label: 'Bounce Rate' },
    deliveryRate: { color: '#F59E0B', label: 'Delivery Rate' }
  }

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    )
  }

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={loadChartData}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500">No data available for the selected period</p>
      </div>
    )
  }

  // Simple SVG chart implementation
  const chartWidth = 600
  const chartHeight = height - 80
  const padding = 40

  const maxValue = Math.max(
    ...data.flatMap(d => selectedMetrics.map(metric => d[metric as keyof ChartDataPoint] as number))
  )

  const getX = (index: number) => padding + (index * (chartWidth - 2 * padding)) / (data.length - 1)
  const getY = (value: number) => chartHeight - padding - ((value / maxValue) * (chartHeight - 2 * padding))

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(metricConfig).map(([metric, config]) => (
          <button
            key={metric}
            onClick={() => toggleMetric(metric)}
            className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-colors ${
              selectedMetrics.includes(metric)
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <span>{config.label}</span>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative">
        <svg width={chartWidth} height={chartHeight} className="border rounded">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <g key={ratio}>
              <line
                x1={padding}
                y1={getY(maxValue * ratio)}
                x2={chartWidth - padding}
                y2={getY(maxValue * ratio)}
                stroke="#E5E7EB"
                strokeWidth={1}
              />
              <text
                x={padding - 10}
                y={getY(maxValue * ratio) + 4}
                textAnchor="end"
                className="text-xs fill-gray-500"
              >
                {formatPercentage(maxValue * ratio)}
              </text>
            </g>
          ))}

          {/* Data lines */}
          {selectedMetrics.map(metric => {
            const config = metricConfig[metric as keyof typeof metricConfig]
            if (!config) return null

            const points = data.map((d, i) => 
              `${getX(i)},${getY(d[metric as keyof ChartDataPoint] as number)}`
            ).join(' ')

            return (
              <g key={metric}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={config.color}
                  strokeWidth={2}
                  className="drop-shadow-sm"
                />
                {/* Data points */}
                {data.map((d, i) => (
                  <circle
                    key={i}
                    cx={getX(i)}
                    cy={getY(d[metric as keyof ChartDataPoint] as number)}
                    r={3}
                    fill={config.color}
                    className="drop-shadow-sm"
                  />
                ))}
              </g>
            )
          })}

          {/* X-axis labels */}
          {data.map((d, i) => {
            if (i % Math.ceil(data.length / 6) === 0) {
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                >
                  {new Date(d.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </text>
              )
            }
            return null
          })}
        </svg>

        {/* Tooltip would go here in a real implementation */}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {selectedMetrics.map(metric => {
          const config = metricConfig[metric as keyof typeof metricConfig]
          if (!config) return null

          const values = data.map(d => d[metric as keyof ChartDataPoint] as number)
          const average = values.reduce((sum, val) => sum + val, 0) / values.length
          const latest = values[values.length - 1]
          const change = values.length > 1 ? ((latest - values[0]) / values[0]) * 100 : 0

          return (
            <div key={metric} className="text-center p-3 bg-gray-50 rounded">
              <div className="font-medium" style={{ color: config.color }}>
                {config.label}
              </div>
              <div className="text-lg font-bold">
                {formatPercentage(average)}
              </div>
              <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}