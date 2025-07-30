'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  Trophy,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  Square,
  Download,
  RefreshCw
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { ABTest, ABTestResult, ABTestAnalysis, ABTestService } from '@/lib/ab-testing'

interface ABTestResultsProps {
  test: ABTest
  onTestStop?: (testId: string) => void
  onTestResume?: (testId: string) => void
  autoRefresh?: boolean
}

export function ABTestResults({ 
  test, 
  onTestStop, 
  onTestResume, 
  autoRefresh = true 
}: ABTestResultsProps) {
  const [analysis, setAnalysis] = useState<ABTestAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    analyzeTest()
    
    if (autoRefresh && test.status === 'running') {
      const interval = setInterval(analyzeTest, 30000) // Update every 30 seconds
      return () => clearInterval(interval)
    }
  }, [test, autoRefresh])

  const analyzeTest = async () => {
    try {
      const testAnalysis = ABTestService.analyzeTest(test)
      setAnalysis(testAnalysis)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error analyzing test:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: ABTest['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'stopped': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: ABTest['status']) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4" />
      case 'running': return <Play className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'stopped': return <Square className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`
  const formatNumber = (value: number) => value.toLocaleString()

  const summary = ABTestService.getTestSummary(test)

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Analyzing test results...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Unable to analyze test results
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Test Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(test.status)}
              <div>
                <CardTitle className="text-lg">{test.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getStatusColor(test.status)}>
                    {test.status}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Testing {test.test_type.replace('_', ' ')} • {test.winner_criteria.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {test.status === 'running' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTestStop?.(test.id)}
                >
                  <Square className="w-4 h-4 mr-1" />
                  Stop Test
                </Button>
              )}
              {test.status === 'stopped' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTestResume?.(test.id)}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Resume Test
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={analyzeTest}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatNumber(summary.totalEmails)}</div>
              <div className="text-sm text-gray-500">Emails Sent</div>
              <Progress value={summary.progressPercentage} className="mt-2" />
              <div className="text-xs text-gray-400 mt-1">
                {formatPercentage(summary.progressPercentage)} of target
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.bestVariant}</div>
              <div className="text-sm text-gray-500">Best Performing</div>
              <div className="flex items-center justify-center mt-2">
                {summary.improvement > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={summary.improvement > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatPercentage(Math.abs(summary.improvement))}
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatPercentage(analysis.confidence_level * 100)}
              </div>
              <div className="text-sm text-gray-500">Confidence Level</div>
              <div className="mt-2">
                {analysis.statistical_power > 0.8 ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-500 mx-auto" />
                )}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {summary.daysRemaining.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Days Remaining</div>
              <div className="mt-2">
                <Clock className="w-4 h-4 text-gray-400 mx-auto" />
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              {analysis.status === 'significant' && <Trophy className="w-5 h-5 text-yellow-500" />}
              {analysis.status === 'running' && <Play className="w-5 h-5 text-blue-500" />}
              {analysis.status === 'insufficient_data' && <AlertCircle className="w-5 h-5 text-orange-500" />}
              {analysis.status === 'inconclusive' && <AlertCircle className="w-5 h-5 text-gray-500" />}
              
              <span className="font-medium">
                {analysis.status === 'significant' && 'Winner Found!'}
                {analysis.status === 'running' && 'Test Running'}
                {analysis.status === 'insufficient_data' && 'Collecting Data'}
                {analysis.status === 'inconclusive' && 'No Clear Winner'}
              </span>
            </div>
            
            {analysis.recommendations.length > 0 && (
              <div className="space-y-1">
                {analysis.recommendations.map((recommendation, index) => (
                  <p key={index} className="text-sm text-gray-600">
                    • {recommendation}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Variant Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Variant Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysis.results.map((result) => (
              <Card key={result.variant_id} className={`${result.is_winner ? 'border-green-200 bg-green-50' : ''} ${result.is_control ? 'border-blue-200 bg-blue-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{result.variant_name}</h3>
                      {result.is_control && <Badge variant="secondary">Control</Badge>}
                      {result.is_winner && <Badge className="bg-green-100 text-green-800">Winner</Badge>}
                      {result.statistical_significance && !result.is_control && (
                        <Badge className="bg-blue-100 text-blue-800">Significant</Badge>
                      )}
                    </div>
                    
                    {!result.is_control && (
                      <div className="flex items-center gap-1">
                        {result.lift_percentage > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`font-medium ${result.lift_percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {result.lift_percentage > 0 ? '+' : ''}{formatPercentage(result.lift_percentage)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Emails Sent</div>
                      <div className="font-medium">{formatNumber(result.emails_sent)}</div>
                    </div>
                    
                    <div>
                      <div className="text-gray-500">Delivery Rate</div>
                      <div className="font-medium">{formatPercentage(result.delivery_rate)}</div>
                    </div>
                    
                    <div>
                      <div className="text-gray-500">Open Rate</div>
                      <div className="font-medium">{formatPercentage(result.open_rate)}</div>
                    </div>
                    
                    <div>
                      <div className="text-gray-500">Click Rate</div>
                      <div className="font-medium">{formatPercentage(result.click_rate)}</div>
                    </div>
                    
                    <div>
                      <div className="text-gray-500">Reply Rate</div>
                      <div className="font-medium">{formatPercentage(result.reply_rate)}</div>
                    </div>
                  </div>

                  {/* Statistical Details */}
                  {!result.is_control && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-gray-500">
                        <div>
                          <span>P-value: </span>
                          <span className="font-mono">{result.p_value.toFixed(4)}</span>
                        </div>
                        <div>
                          <span>Confidence Interval: </span>
                          <span className="font-mono">
                            [{formatPercentage(result.confidence_interval[0])}, {formatPercentage(result.confidence_interval[1])}]
                          </span>
                        </div>
                        <div>
                          <span>Significance: </span>
                          <span className={result.statistical_significance ? 'text-green-600' : 'text-red-600'}>
                            {result.statistical_significance ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Test Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Test Type</div>
              <div className="font-medium capitalize">{test.test_type.replace('_', ' ')}</div>
            </div>
            
            <div>
              <div className="text-gray-500">Winner Criteria</div>
              <div className="font-medium capitalize">{test.winner_criteria.replace('_', ' ')}</div>
            </div>
            
            <div>
              <div className="text-gray-500">Confidence Level</div>
              <div className="font-medium">{formatPercentage(test.confidence_level * 100)}</div>
            </div>
            
            <div>
              <div className="text-gray-500">Sample Size Target</div>
              <div className="font-medium">{formatNumber(test.minimum_sample_size)}</div>
            </div>
            
            <div>
              <div className="text-gray-500">Test Duration</div>
              <div className="font-medium">{test.test_duration_hours}h</div>
            </div>
            
            <div>
              <div className="text-gray-500">Auto Winner Selection</div>
              <div className="font-medium">{test.auto_select_winner ? 'Enabled' : 'Disabled'}</div>
            </div>
          </div>
          
          {test.description && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-gray-500 text-sm">Description</div>
              <div className="text-sm">{test.description}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      {autoRefresh && test.status === 'running' && (
        <div className="flex items-center justify-center text-xs text-gray-500 pt-2">
          <RefreshCw className="w-3 h-3 mr-1" />
          <span>Auto-updating every 30s • Last updated: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  )
}