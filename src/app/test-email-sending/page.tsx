'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiClient } from '@/lib/api-client'

export default function TestEmailSendingPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testEmailSending = async () => {
    try {
      setLoading(true)
      setResult(null)
      
      console.log('🧪 Testing email sending...')
      console.log('📡 Making API request to /api/campaigns/manual-send')
      
      const response = await ApiClient.post('/api/campaigns/manual-send', {})
      
      console.log('✅ Response:', response)
      setResult({ success: true, data: response, timestamp: new Date().toISOString() })
      
    } catch (error) {
      console.error('❌ Error:', error)
      console.error('📋 Error details:', error.stack)
      setResult({ 
        success: false, 
        error: error.message, 
        stack: error.stack,
        timestamp: new Date().toISOString() 
      })
    } finally {
      setLoading(false)
    }
  }

  const checkDebugInfo = async () => {
    try {
      setLoading(true)
      setResult(null)
      
      console.log('🔍 Checking debug info...')
      console.log('📡 Making API request to /api/debug/email-system')
      
      const response = await ApiClient.get('/api/debug/email-system')
      
      console.log('📊 Debug Info:', response)
      setResult({ success: true, data: response, timestamp: new Date().toISOString() })
      
    } catch (error) {
      console.error('❌ Error:', error)
      console.error('📋 Error details:', error.stack)
      setResult({ 
        success: false, 
        error: error.message, 
        stack: error.stack,
        timestamp: new Date().toISOString() 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Email Sending Test</CardTitle>
          <CardDescription>
            Test the actual email sending functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <Button 
              onClick={testEmailSending} 
              disabled={loading}
              variant="default"
            >
              {loading ? '⏳ Testing...' : '📧 Test Email Sending'}
            </Button>
            
            <Button 
              onClick={checkDebugInfo} 
              disabled={loading}
              variant="outline"
            >
              {loading ? '⏳ Checking...' : '🔍 Debug System Status'}
            </Button>
          </div>

          {result && (
            <div className="space-y-4">
              <h3 className="font-medium">Results:</h3>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="font-medium mb-2">📋 Instructions:</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• <strong>Test Email Sending:</strong> Finds campaigns with "sending" status and tries to send emails</li>
              <li>• <strong>Debug System Status:</strong> Checks email accounts, campaigns, contacts, and system readiness</li>
              <li>• <strong>Check Terminal:</strong> Watch the terminal where <code>npm run dev</code> is running for detailed logs</li>
              <li>• <strong>Server URL:</strong> Make sure you're running on <code>localhost:3003</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}