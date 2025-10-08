'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCcw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

export default function CampaignResetPage() {
  const [campaignId, setCampaignId] = useState('')
  const [resetBatches, setResetBatches] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async () => {
    if (!campaignId.trim()) {
      setError('Please enter a campaign ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirm: true,
          resetBatches
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset campaign')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            Reset Campaign
          </CardTitle>
          <CardDescription>
            Reset a completed campaign back to sending status to resume batch processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="campaignId">Campaign ID</Label>
            <Input
              id="campaignId"
              placeholder="Enter campaign ID (e.g., abc123...)"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              You can find the campaign ID in the URL when viewing a campaign
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="resetBatches"
              checked={resetBatches}
              onCheckedChange={(checked) => setResetBatches(checked as boolean)}
              disabled={loading}
            />
            <Label
              htmlFor="resetBatches"
              className="text-sm font-normal cursor-pointer"
            >
              Reset all batches to pending (will resend already sent batches)
            </Label>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This will change the campaign status from "completed" to "sending".
              {resetBatches && (
                <span className="block mt-1">
                  <strong>All batches will be reset:</strong> This means emails in already-sent batches will be sent again!
                </span>
              )}
              {!resetBatches && (
                <span className="block mt-1">
                  <strong>Only pending batches will be sent:</strong> Already-sent batches will not be resent.
                </span>
              )}
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleReset}
            disabled={loading || !campaignId.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting Campaign...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset Campaign
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-green-900">{result.message}</p>
                  {result.campaign && (
                    <div className="text-sm text-green-800 space-y-1">
                      <p><strong>Campaign:</strong> {result.campaign.name}</p>
                      <p><strong>Status:</strong> {result.campaign.status}</p>
                      <p><strong>Progress:</strong> {result.campaign.emails_sent}/{result.campaign.total_contacts} emails sent</p>
                      {result.campaign.next_batch_send_time && (
                        <p><strong>Next batch:</strong> {new Date(result.campaign.next_batch_send_time).toLocaleString()}</p>
                      )}
                    </div>
                  )}
                  {result.next_steps && (
                    <div className="mt-3 space-y-1">
                      <p className="font-semibold text-green-900">Next Steps:</p>
                      <ul className="list-disc list-inside text-sm text-green-800">
                        {result.next_steps.map((step: string, i: number) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">How to Find Campaign ID</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Go to the Campaigns page</p>
          <p>2. Click on a campaign to view details</p>
          <p>3. Copy the ID from the URL: <code className="bg-muted px-1 py-0.5 rounded">/campaigns/[campaign-id]</code></p>
          <p className="pt-2">Or use the browser console:</p>
          <code className="block bg-muted p-2 rounded text-xs">
            {/* On campaigns page, run this in console: */}
            <br />
            document.querySelector(&apos;[data-campaign-id]&apos;)?.getAttribute(&apos;data-campaign-id&apos;)
          </code>
        </CardContent>
      </Card>
    </div>
  )
}
