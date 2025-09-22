'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugClickTrackingPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runTest = async (endpoint: string, description: string) => {
    try {
      setLoading(true)
      console.log(`🧪 Running test: ${description}`)

      const response = await fetch(endpoint)
      const data = await response.json()

      setResults({
        endpoint,
        description,
        success: response.ok,
        status: response.status,
        data,
        timestamp: new Date().toISOString()
      })

      console.log(`✅ Test completed: ${description}`, data)

    } catch (error) {
      console.error(`❌ Test failed: ${description}`, error)
      setResults({
        endpoint,
        description,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const tests = [
    {
      endpoint: '/api/debug/check-click-tracking-schema',
      description: 'Check Database Schema',
      action: 'Verify click tracking tables exist'
    },
    {
      endpoint: '/api/debug/test-click-tracking',
      description: 'Test Click Tracking Functionality',
      action: 'Test link rewriting and click tracking'
    },
    {
      endpoint: '/api/debug/check-email-content',
      description: 'Check Email Content',
      action: 'Verify if links are being rewritten in emails'
    },
    {
      endpoint: '/api/debug/test-click-api',
      description: 'Test Click API',
      action: 'Test the click tracking API endpoint'
    }
  ]

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🔍 Click Tracking Debug</h1>
        <p className="text-gray-600">
          Debug and test the click tracking functionality to identify why clicks aren't being recorded.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {tests.map((test, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-lg">{test.description}</CardTitle>
              <CardDescription>{test.action}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => runTest(test.endpoint, test.description)}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Running...' : 'Run Test'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${results.success ? 'text-green-600' : 'text-red-600'}`}>
              {results.success ? '✅' : '❌'} {results.description}
            </CardTitle>
            <CardDescription>
              Status: {results.status} | {results.timestamp}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded-md">
              <p className="font-semibold mb-2">Endpoint: {results.endpoint}</p>

              {results.error ? (
                <div className="text-red-600">
                  <p className="font-semibold">Error:</p>
                  <pre className="text-sm">{results.error}</pre>
                </div>
              ) : (
                <div>
                  <p className="font-semibold mb-2">Response:</p>
                  <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                    {JSON.stringify(results.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Analysis based on results */}
            {results.success && results.data && (
              <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <h4 className="font-semibold mb-2">📊 Analysis:</h4>
                {results.endpoint.includes('schema') && (
                  <div>
                    {results.data.results?.clickTrackingTable?.exists ? (
                      <p className="text-green-600">✅ Click tracking table exists</p>
                    ) : (
                      <p className="text-red-600">❌ Click tracking table missing</p>
                    )}
                    {results.data.results?.emailEventsTable?.exists ? (
                      <p className="text-green-600">✅ Email events table exists</p>
                    ) : (
                      <p className="text-red-600">❌ Email events table missing</p>
                    )}
                  </div>
                )}

                {results.endpoint.includes('test-click-tracking') && (
                  <div>
                    {results.data.summary?.linkRewritingWorks ? (
                      <p className="text-green-600">✅ Link rewriting works</p>
                    ) : (
                      <p className="text-red-600">❌ Link rewriting failed</p>
                    )}
                    {results.data.summary?.clickTrackingWorks ? (
                      <p className="text-green-600">✅ Click tracking works</p>
                    ) : (
                      <p className="text-red-600">❌ Click tracking failed</p>
                    )}
                  </div>
                )}

                {results.endpoint.includes('email-content') && (
                  <div>
                    <p>📧 Total emails analyzed: {results.data.results?.totalEmailsSent || 0}</p>
                    <p>🔗 Tracking links found: {results.data.results?.linkAnalysis?.trackingLinksFound || 0}</p>
                    <p>🌐 Original links found: {results.data.results?.linkAnalysis?.originalLinksFound || 0}</p>
                    <p className={`font-semibold ${results.data.results?.linkAnalysis?.trackingLinksFound > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {results.data.diagnosis}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🎯 Quick Manual Test</CardTitle>
          <CardDescription>Test a specific tracking URL directly</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Test Click Tracking URL:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter tracking URL or click ID"
                  className="flex-1 p-2 border rounded"
                  id="testUrl"
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById('testUrl') as HTMLInputElement
                    const value = input.value
                    if (value) {
                      const url = value.startsWith('http') ? value : `/api/tracking/click/${value}`
                      window.open(url, '_blank')
                    }
                  }}
                >
                  Test Click
                </Button>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p>• Enter a full tracking URL or just the click ID</p>
              <p>• Example: track_123456789_abcdef</p>
              <p>• This will open the tracking URL in a new tab</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}