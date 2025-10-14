'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

interface DeliveryRateChartProps {
  dailyStats: Array<{
    date: string
    sent: number
    delivered: number
    opened: number
    clicked: number
    replied: number
    bounced: number
  }>
}

export function DeliveryRateChart({ dailyStats }: DeliveryRateChartProps) {
  // Calculate trends and key metrics
  const totalSent = dailyStats.reduce((sum, day) => sum + day.sent, 0)
  const totalDelivered = dailyStats.reduce((sum, day) => sum + day.delivered, 0)
  const totalOpened = dailyStats.reduce((sum, day) => sum + day.opened, 0)
  const totalReplied = dailyStats.reduce((sum, day) => sum + day.replied, 0)
  
  const overallDeliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0
  const overallOpenRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0
  const overallReplyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0

  // Get recent activity (last 7 days with data)
  const recentDays = dailyStats
    .filter(day => day.sent > 0 || day.delivered > 0 || day.opened > 0)
    .slice(-7)

  // Calculate trend for delivery rate
  const getDeliveryTrend = () => {
    if (recentDays.length < 2) return null
    
    const firstHalf = recentDays.slice(0, Math.floor(recentDays.length / 2))
    const secondHalf = recentDays.slice(Math.floor(recentDays.length / 2))
    
    const firstHalfRate = firstHalf.reduce((sum, day) => sum + day.sent, 0) > 0 
      ? Math.round((firstHalf.reduce((sum, day) => sum + day.delivered, 0) / firstHalf.reduce((sum, day) => sum + day.sent, 0)) * 100)
      : 0
    const secondHalfRate = secondHalf.reduce((sum, day) => sum + day.sent, 0) > 0 
      ? Math.round((secondHalf.reduce((sum, day) => sum + day.delivered, 0) / secondHalf.reduce((sum, day) => sum + day.sent, 0)) * 100)
      : 0
    
    const difference = secondHalfRate - firstHalfRate
    return {
      direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable',
      percentage: Math.abs(difference),
      current: secondHalfRate,
      previous: firstHalfRate
    }
  }

  const deliveryTrend = getDeliveryTrend()

  // Get peak activity day
  const peakDay = dailyStats.reduce((peak, day) => 
    (day.sent + day.delivered + day.opened) > (peak.sent + peak.delivered + peak.opened) ? day : peak
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Calculate daily rates for mini chart visualization
  const dailyRates = dailyStats.map(day => ({
    date: day.date,
    deliveryRate: day.sent > 0 ? Math.round((day.delivered / day.sent) * 100) : 0,
    openRate: day.delivered > 0 ? Math.round((day.opened / day.delivered) * 100) : 0,
    sent: day.sent,
    delivered: day.delivered,
    opened: day.opened
  })).filter(day => day.sent > 0) // Only show days with activity

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Performance Trends</span>
        </CardTitle>
        <CardDescription>
          Daily email performance over time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{overallDeliveryRate}%</div>
            <div className="text-xs text-gray-500">Delivery Rate</div>
            {deliveryTrend && (
              <div className="flex items-center justify-center space-x-1 mt-1">
                {deliveryTrend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : deliveryTrend.direction === 'down' ? (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                ) : null}
                <span className={`text-xs ${
                  deliveryTrend.direction === 'up' ? 'text-green-500' : 
                  deliveryTrend.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {deliveryTrend.percentage > 0 ? `${deliveryTrend.percentage}%` : 'stable'}
                </span>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{overallOpenRate}%</div>
            <div className="text-xs text-gray-500">Open Rate</div>
            <div className="text-xs text-gray-400 mt-1">
              {totalOpened} opens
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{overallReplyRate}%</div>
            <div className="text-xs text-gray-500">Reply Rate</div>
            <div className="text-xs text-gray-400 mt-1">
              {totalReplied} replies
            </div>
          </div>
        </div>

        {/* Simple Bar Chart Visualization */}
        {dailyRates.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Daily Activity</h4>
            <div className="space-y-2">
              {dailyRates.slice(-10).map((day) => (
                <div key={day.date} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{formatDate(day.date)}</span>
                    <div className="flex items-center space-x-3">
                      <span>{day.sent} sent</span>
                      <span className="text-blue-600">{day.deliveryRate}% delivered</span>
                      <span className="text-green-600">{day.openRate}% opened</span>
                    </div>
                  </div>
                  
                  {/* Visual bar representation */}
                  <div className="flex space-x-1 h-2">
                    <div 
                      className="bg-blue-200 rounded-sm" 
                      style={{ width: `${day.deliveryRate}%` }}
                    />
                    <div 
                      className="bg-green-200 rounded-sm" 
                      style={{ width: `${day.openRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Summary */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Active Days</span>
            <Badge variant="secondary">
              {dailyRates.length} days
            </Badge>
          </div>
          
          {peakDay.sent > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Peak Activity</span>
              <div className="text-right">
                <div className="text-sm font-semibold">{formatDate(peakDay.date)}</div>
                <div className="text-xs text-gray-500">
                  {peakDay.sent} emails sent
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Volume</span>
            <div className="text-right">
              <div className="text-sm font-semibold">{totalSent.toLocaleString()}</div>
              <div className="text-xs text-gray-500">
                emails processed
              </div>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        {dailyRates.length >= 3 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Performance Insights</h4>
            <div className="space-y-2 text-xs">
              {overallDeliveryRate >= 95 && (
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Excellent delivery rate - your sender reputation is strong</span>
                </div>
              )}
              
              {overallOpenRate >= 25 && (
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Above-average open rate - your subject lines are effective</span>
                </div>
              )}
              
              {overallReplyRate >= 5 && (
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Strong reply rate - your content is engaging recipients</span>
                </div>
              )}
              
              {deliveryTrend?.direction === 'up' && deliveryTrend.percentage >= 5 && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Delivery rate is trending upward - keep up the good work</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}