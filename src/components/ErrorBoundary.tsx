'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  ChevronDown, 
  ChevronUp,
  Copy,
  CheckCircle
} from 'lucide-react'
import { AppError, ErrorType, ErrorSeverity, errorHandler } from '@/lib/errors'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  appError: AppError | null
  showDetails: boolean
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      appError: null,
      showDetails: false,
      copied: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Handle the error through our centralized error handler
    const appError = await errorHandler.handleError(error, {
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    })

    this.setState({
      errorInfo,
      appError
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      appError: null,
      showDetails: false,
      copied: false
    })
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReportBug = () => {
    const { error, errorInfo, appError } = this.state
    const bugReport = {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      appError: appError?.toJSON(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }

    // In a real implementation, you would send this to your bug tracking system
    console.log('Bug Report:', bugReport)
    
    // For now, just copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(bugReport, null, 2))
    this.setState({ copied: true })
    setTimeout(() => this.setState({ copied: false }), 2000)
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'bg-blue-100 text-blue-800'
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-100 text-yellow-800'
      case ErrorSeverity.HIGH:
        return 'bg-orange-100 text-orange-800'
      case ErrorSeverity.CRITICAL:
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  getErrorIcon = (type: ErrorType) => {
    switch (type) {
      case ErrorType.AUTHENTICATION:
        return '🔐'
      case ErrorType.AUTHORIZATION:
        return '🚫'
      case ErrorType.VALIDATION:
        return '⚠️'
      case ErrorType.NOT_FOUND:
        return '🔍'
      case ErrorType.RATE_LIMIT:
        return '⏱️'
      case ErrorType.EXTERNAL_SERVICE:
        return '🌐'
      case ErrorType.DATABASE:
        return '💾'
      case ErrorType.NETWORK:
        return '📡'
      case ErrorType.BUSINESS_LOGIC:
        return '💼'
      case ErrorType.SYSTEM:
        return '⚙️'
      default:
        return '❌'
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback
    }

    const { error, appError, showDetails, copied } = this.state

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            
            <CardTitle className="text-2xl font-bold text-gray-900">
              {appError ? (
                <div className="flex items-center justify-center space-x-2">
                  <span>{this.getErrorIcon(appError.type)}</span>
                  <span>Something went wrong</span>
                </div>
              ) : (
                'Oops! Something went wrong'
              )}
            </CardTitle>
            
            <CardDescription className="text-lg">
              {appError?.userMessage || 'An unexpected error occurred while loading this page.'}
            </CardDescription>

            {appError && (
              <div className="flex items-center justify-center space-x-2 mt-4">
                <Badge className={this.getSeverityColor(appError.severity)}>
                  {appError.severity} severity
                </Badge>
                <Badge variant="outline">
                  {appError.type.replace('_', ' ')}
                </Badge>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Recovery Actions */}
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={this.handleRetry} className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </Button>
              
              <Button variant="outline" onClick={this.handleReload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
              
              <Button variant="outline" onClick={this.handleGoHome}>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>

            {/* Custom Recovery Actions */}
            {appError?.recoveryActions && appError.recoveryActions.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-center mb-3">Suggested Actions:</h4>
                <div className="flex flex-wrap gap-2 justify-center">
                  {appError.recoveryActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (action.action) {
                          action.action()
                        } else if (action.url) {
                          window.location.href = action.url
                        }
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Error Details Toggle */}
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                onClick={this.toggleDetails}
                className="w-full flex items-center justify-center space-x-2"
              >
                <span>Error Details</span>
                {showDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showDetails && (
                <div className="mt-4 space-y-4">
                  {appError && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Error Information:</h5>
                      <dl className="space-y-1 text-sm">
                        <div className="flex">
                          <dt className="font-medium w-20">Code:</dt>
                          <dd className="font-mono">{appError.code}</dd>
                        </div>
                        <div className="flex">
                          <dt className="font-medium w-20">Type:</dt>
                          <dd>{appError.type}</dd>
                        </div>
                        <div className="flex">
                          <dt className="font-medium w-20">Time:</dt>
                          <dd>{new Date(appError.timestamp).toLocaleString()}</dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  <div className="bg-red-50 p-4 rounded-lg">
                    <h5 className="font-medium mb-2 text-red-800">Technical Details:</h5>
                    <pre className="text-xs text-red-700 overflow-auto max-h-40 whitespace-pre-wrap">
                      {error?.message}
                      {error?.stack && (
                        <>
                          {'\n\nStack Trace:\n'}
                          {error.stack}
                        </>
                      )}
                    </pre>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={this.handleReportBug}
                      className="flex items-center space-x-2"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Copied to Clipboard</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy Error Report</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Help Text */}
            <div className="text-center text-sm text-gray-600 border-t pt-4">
              <p>
                If this problem persists, please contact our support team with the error code above.
              </p>
              <p className="mt-1">
                <a 
                  href="mailto:support@coldreachpro.com" 
                  className="text-blue-600 hover:underline"
                >
                  support@coldreachpro.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}

/**
 * Hook-based error boundary for functional components
 */
export function useErrorHandler() {
  const handleError = React.useCallback(async (error: Error, context?: any) => {
    const appError = await errorHandler.handleError(error, context)
    
    // In a real implementation, you might want to show a toast notification
    // or update some global error state
    console.error('Handled error:', appError)
    
    return appError
  }, [])

  return { handleError }
}

/**
 * Error boundary wrapper component
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Simple error fallback component
 */
export function ErrorFallback({ 
  error, 
  resetError 
}: { 
  error: Error
  resetError: () => void 
}) {
  return (
    <div className="text-center py-8">
      <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Something went wrong
      </h3>
      <p className="text-gray-600 mb-4">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button onClick={resetError}>
        Try again
      </Button>
    </div>
  )
}