'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface DomainAuthRecord {
  type: 'SPF' | 'DKIM' | 'DMARC'
  status: 'valid' | 'warning' | 'missing' | 'unknown'
  record: string | null
  issues: string[]
  recommendations: string[]
}

interface DomainAuthResult {
  domain: string
  spf: DomainAuthRecord
  dkim: DomainAuthRecord
  dmarc: DomainAuthRecord
  overall_score: number
  overall_status: 'excellent' | 'good' | 'warning' | 'critical'
  recommendations: string[]
  last_checked: string
}

interface DomainAuthDialogProps {
  isOpen: boolean
  onClose: () => void
  emailAccountId: string
  email: string
}

export function DomainAuthDialog({ 
  isOpen, 
  onClose, 
  emailAccountId, 
  email 
}: DomainAuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [authResult, setAuthResult] = useState<DomainAuthResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkDomainAuth = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/email-accounts/${emailAccountId}/verify-domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check domain authentication')
      }

      setAuthResult(data.data.domain_auth)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const loadExistingData = async () => {
    try {
      const response = await fetch(`/api/email-accounts/${emailAccountId}/verify-domain`)
      const data = await response.json()

      if (response.ok && data.data.domain_auth) {
        setAuthResult(data.data.domain_auth)
      }
    } catch (err) {
      // Ignore errors when loading existing data
    }
  }

  // Load existing data when dialog opens
  React.useEffect(() => {
    if (isOpen && !authResult) {
      loadExistingData()
    }
  }, [isOpen])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'missing':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      valid: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      missing: 'bg-red-100 text-red-800',
      unknown: 'bg-gray-100 text-gray-800'
    }

    return (
      <Badge className={variants[status as keyof typeof variants] || variants.unknown}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600'
      case 'good':
        return 'text-blue-600'
      case 'warning':
        return 'text-yellow-600'
      case 'critical':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const domain = email.split('@')[1]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Domain Authentication Status
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Checking authentication records for <strong>{domain}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Check Button */}
          <div className="flex justify-between items-center">
            <Button
              onClick={checkDomainAuth}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isLoading ? 'Checking...' : 'Check Domain Authentication'}
            </Button>

            {authResult && (
              <div className="text-sm text-gray-500">
                Last checked: {new Date(authResult.last_checked).toLocaleString()}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Results */}
          {authResult && (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Overall Authentication Score</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{authResult.overall_score}</span>
                    <span className="text-gray-500">/100</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        authResult.overall_score >= 90 ? 'bg-green-500' :
                        authResult.overall_score >= 70 ? 'bg-blue-500' :
                        authResult.overall_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${authResult.overall_score}%` }}
                    />
                  </div>
                  <span className={`font-medium ${getOverallStatusColor(authResult.overall_status)}`}>
                    {authResult.overall_status.charAt(0).toUpperCase() + authResult.overall_status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Individual Records */}
              <div className="space-y-4">
                {[authResult.spf, authResult.dkim, authResult.dmarc].map((record) => (
                  <div key={record.type} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(record.status)}
                        <h4 className="font-semibold">{record.type}</h4>
                      </div>
                      {getStatusBadge(record.status)}
                    </div>

                    {record.record && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Record:</p>
                        <code className="text-xs bg-gray-100 p-2 rounded block break-all">
                          {record.record}
                        </code>
                      </div>
                    )}

                    {record.issues.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Issues:</p>
                        <ul className="text-sm text-red-600 space-y-1">
                          {record.issues.map((issue, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span>•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {record.recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Recommendations:</p>
                        <ul className="text-sm text-blue-600 space-y-1">
                          {record.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span>•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Overall Recommendations */}
              {authResult.recommendations.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Recommendations</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {authResult.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}