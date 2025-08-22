'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Home, LogIn } from 'lucide-react'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    if (errorParam) {
      setError(getErrorMessage(errorParam, errorDescription))
    } else {
      setError('An unexpected authentication error occurred.')
    }
  }, [searchParams])

  const getErrorMessage = (errorCode: string, description: string | null): string => {
    switch (errorCode) {
      case 'access_denied':
        return 'Access was denied. You may have cancelled the authentication process.'
      case 'server_error':
        return 'The authentication service is temporarily unavailable. Please try again later.'
      case 'temporarily_unavailable':
        return 'The authentication service is temporarily overloaded. Please try again in a few minutes.'
      case 'invalid_request':
        return 'The authentication request was invalid. Please try signing in again.'
      case 'unsupported_response_type':
        return 'The authentication method is not supported. Please contact support.'
      case 'invalid_scope':
        return 'The requested permissions are invalid. Please contact support.'
      case 'session_expired':
        return 'Your session has expired. Please sign in again.'
      case 'invalid_token':
        return 'Your authentication token is invalid. Please sign in again.'
      case 'token_expired':
        return 'Your authentication token has expired. Please sign in again.'
      default:
        return description || 'An authentication error occurred. Please try again.'
    }
  }

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    router.push('/auth/signin')
  }

  const handleGoHome = () => {
    router.push('/')
  }

  const handleContactSupport = () => {
    // In production, this would redirect to your support system
    window.open('mailto:support@pitchdonkey.com?subject=Authentication%20Error', '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="mt-4 text-xl font-semibold text-gray-900">
              Authentication Error
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-gray-600">
              We encountered a problem while trying to sign you in.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error Details
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={handleRetry}
                className="w-full"
                disabled={retryCount >= 3}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {retryCount >= 3 ? 'Too many retries' : 'Try Again'}
              </Button>

              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={handleGoHome}
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/debug-auth')}
                  className="flex-1"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Debug
                </Button>
              </div>

              {retryCount >= 3 && (
                <Button 
                  variant="outline" 
                  onClick={handleContactSupport}
                  className="w-full"
                >
                  Contact Support
                </Button>
              )}
            </div>

            <div className="text-xs text-gray-500 text-center">
              <p>If this problem persists, please contact our support team.</p>
              <p className="mt-1">Error ID: {Date.now().toString(36)}</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Need help? Visit our{' '}
            <a 
              href="/help" 
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              help center
            </a>{' '}
            or{' '}
            <button 
              onClick={handleContactSupport}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              contact support
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  )
}