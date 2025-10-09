'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export default function FixBouncesPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFixBounces = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/contacts/fix-bounced-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix bounced statuses')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Fix Bounced Contact Statuses</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Retroactive Bounce Status Fix</CardTitle>
          <CardDescription>
            This tool will find all contacts with bounced emails and update their engagement status to "bad"
            with proper penalties. This is useful for fixing historical data after implementing the new bounce tracking system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">What this does:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                <li>Finds contacts with <code className="bg-blue-100 px-1 rounded">email_status = 'bounced'</code></li>
                <li>Updates their <code className="bg-blue-100 px-1 rounded">engagement_status</code> to <code className="bg-blue-100 px-1 rounded">'bad'</code></li>
                <li>Applies -50 point engagement score penalty (minimum -100)</li>
                <li>Contacts will show red "Bounced" badges in the UI</li>
              </ul>
            </div>

            <Button
              onClick={handleFixBounces}
              disabled={isLoading}
              size="lg"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Fix Bounced Contact Statuses'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              Fix Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Total Processed</div>
                  <div className="text-2xl font-bold">{result.summary?.totalProcessed || 0}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600">Successfully Updated</div>
                  <div className="text-2xl font-bold text-green-700">{result.summary?.successfulUpdates || 0}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-red-600">Failed</div>
                  <div className="text-2xl font-bold text-red-700">{result.summary?.failedUpdates || 0}</div>
                </div>
              </div>

              {result.message && (
                <Alert>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              )}

              {result.details?.updates && result.details.updates.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Sample Updates (first 10):</h3>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {result.details.updates.map((update: any, index: number) => (
                        <div key={index} className="text-sm border-b border-gray-200 pb-2">
                          <div className="font-mono text-xs text-gray-600">{update.email}</div>
                          <div className="text-xs text-gray-500">
                            Score: {update.oldScore} → {update.newScore}
                            <span className="text-red-600 ml-2">(-{update.penalty} penalty)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {result.details?.errors && result.details.errors.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2 text-red-600">Errors:</h3>
                  <div className="bg-red-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {result.details.errors.map((err: any, index: number) => (
                        <div key={index} className="text-sm border-b border-red-200 pb-2">
                          <div className="font-mono text-xs text-red-700">{err.email}</div>
                          <div className="text-xs text-red-600">{err.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
