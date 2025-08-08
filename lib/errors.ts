import { z } from 'zod'

// Error classification types
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  NETWORK = 'network',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string
  requestId?: string
  endpoint?: string
  method?: string
  userAgent?: string
  ip?: string
  timestamp?: string
  additionalData?: Record<string, any>
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: ErrorType[]
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'redirect' | 'manual'
  label: string
  action?: () => void | Promise<void>
  url?: string
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly type: ErrorType
  public readonly severity: ErrorSeverity
  public readonly code: string
  public readonly statusCode: number
  public readonly userMessage: string
  public readonly context: ErrorContext
  public readonly recoveryActions: ErrorRecoveryAction[]
  public readonly isRetryable: boolean
  public readonly timestamp: string

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code?: string,
    statusCode: number = 500,
    userMessage?: string,
    context: ErrorContext = {},
    recoveryActions: ErrorRecoveryAction[] = [],
    isRetryable: boolean = false
  ) {
    super(message)
    this.name = 'AppError'
    this.type = type
    this.severity = severity
    this.code = code || this.generateErrorCode()
    this.statusCode = statusCode
    this.userMessage = userMessage || this.generateUserMessage()
    this.context = { ...context, timestamp: new Date().toISOString() }
    this.recoveryActions = recoveryActions
    this.isRetryable = isRetryable
    this.timestamp = new Date().toISOString()

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  private generateErrorCode(): string {
    return `${this.type.toUpperCase()}_${Date.now()}`
  }

  private generateUserMessage(): string {
    switch (this.type) {
      case ErrorType.AUTHENTICATION:
        return 'Please sign in to continue'
      case ErrorType.AUTHORIZATION:
        return 'You don\'t have permission to perform this action'
      case ErrorType.VALIDATION:
        return 'Please check your input and try again'
      case ErrorType.NOT_FOUND:
        return 'The requested resource was not found'
      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please try again later'
      case ErrorType.EXTERNAL_SERVICE:
        return 'External service is temporarily unavailable'
      case ErrorType.DATABASE:
        return 'Database error occurred. Please try again'
      case ErrorType.NETWORK:
        return 'Network error. Please check your connection'
      case ErrorType.BUSINESS_LOGIC:
        return 'Unable to complete the requested operation'
      case ErrorType.SYSTEM:
        return 'System error occurred. Please try again later'
      default:
        return 'An unexpected error occurred'
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      code: this.code,
      statusCode: this.statusCode,
      userMessage: this.userMessage,
      context: this.context,
      recoveryActions: this.recoveryActions,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}

/**
 * Specific error classes
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context: ErrorContext = {}) {
    super(
      message,
      ErrorType.AUTHENTICATION,
      ErrorSeverity.HIGH,
      'AUTH_FAILED',
      401,
      'Please sign in to continue',
      context,
      [
        {
          type: 'redirect',
          label: 'Sign In',
          url: '/auth/signin'
        }
      ]
    )
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', context: ErrorContext = {}) {
    super(
      message,
      ErrorType.AUTHORIZATION,
      ErrorSeverity.HIGH,
      'ACCESS_DENIED',
      403,
      'You don\'t have permission to perform this action',
      context,
      [
        {
          type: 'redirect',
          label: 'Go to Dashboard',
          url: '/dashboard'
        }
      ]
    )
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    validationErrors: Record<string, string> = {},
    context: ErrorContext = {}
  ) {
    super(
      message,
      ErrorType.VALIDATION,
      ErrorSeverity.LOW,
      'VALIDATION_FAILED',
      400,
      'Please check your input and try again',
      context,
      [
        {
          type: 'manual',
          label: 'Fix Errors'
        }
      ]
    )
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', context: ErrorContext = {}) {
    super(
      `${resource} not found`,
      ErrorType.NOT_FOUND,
      ErrorSeverity.LOW,
      'NOT_FOUND',
      404,
      'The requested resource was not found',
      context,
      [
        {
          type: 'redirect',
          label: 'Go Back',
          url: '/dashboard'
        }
      ]
    )
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number = 60,
    context: ErrorContext = {}
  ) {
    super(
      message,
      ErrorType.RATE_LIMIT,
      ErrorSeverity.MEDIUM,
      'RATE_LIMIT_EXCEEDED',
      429,
      `Too many requests. Please try again in ${retryAfter} seconds`,
      context,
      [
        {
          type: 'retry',
          label: `Retry in ${retryAfter}s`
        }
      ],
      true
    )
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string = 'External service error',
    context: ErrorContext = {}
  ) {
    super(
      `${service}: ${message}`,
      ErrorType.EXTERNAL_SERVICE,
      ErrorSeverity.HIGH,
      'EXTERNAL_SERVICE_ERROR',
      502,
      `${service} is temporarily unavailable. Please try again later`,
      context,
      [
        {
          type: 'retry',
          label: 'Retry'
        },
        {
          type: 'fallback',
          label: 'Use Alternative'
        }
      ],
      true
    )
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', context: ErrorContext = {}) {
    super(
      message,
      ErrorType.DATABASE,
      ErrorSeverity.HIGH,
      'DATABASE_ERROR',
      500,
      'Database error occurred. Please try again',
      context,
      [
        {
          type: 'retry',
          label: 'Retry'
        }
      ],
      true
    )
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network error', context: ErrorContext = {}) {
    super(
      message,
      ErrorType.NETWORK,
      ErrorSeverity.MEDIUM,
      'NETWORK_ERROR',
      0,
      'Network error. Please check your connection',
      context,
      [
        {
          type: 'retry',
          label: 'Retry'
        }
      ],
      true
    )
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, userMessage?: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorType.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      'BUSINESS_LOGIC_ERROR',
      400,
      userMessage || 'Unable to complete the requested operation',
      context,
      [
        {
          type: 'manual',
          label: 'Review and Try Again'
        }
      ]
    )
  }
}

/**
 * Error handler class
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private logger: any
  private monitoring: any

  constructor(logger?: any, monitoring?: any) {
    this.logger = logger
    this.monitoring = monitoring
  }

  static getInstance(logger?: any, monitoring?: any): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(logger, monitoring)
    }
    return ErrorHandler.instance
  }

  /**
   * Handle and log error
   */
  async handleError(error: Error | AppError, context: ErrorContext = {}): Promise<AppError> {
    let appError: AppError

    if (error instanceof AppError) {
      appError = error
      // Merge additional context
      Object.assign(appError.context, context)
    } else {
      // Convert generic error to AppError
      appError = this.convertToAppError(error, context)
    }

    // Log the error
    await this.logError(appError)

    // Send to monitoring service
    await this.reportToMonitoring(appError)

    // Send alerts for critical errors
    if (appError.severity === ErrorSeverity.CRITICAL) {
      await this.sendAlert(appError)
    }

    return appError
  }

  /**
   * Convert generic error to AppError
   */
  private convertToAppError(error: Error, context: ErrorContext): AppError {
    // Try to classify the error based on message or type
    let type = ErrorType.UNKNOWN
    let severity = ErrorSeverity.MEDIUM
    let statusCode = 500
    let isRetryable = false

    if (error.message.includes('fetch')) {
      type = ErrorType.NETWORK
      isRetryable = true
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      type = ErrorType.DATABASE
      severity = ErrorSeverity.HIGH
      isRetryable = true
    } else if (error.message.includes('unauthorized') || error.message.includes('auth')) {
      type = ErrorType.AUTHENTICATION
      severity = ErrorSeverity.HIGH
      statusCode = 401
    } else if (error.message.includes('forbidden') || error.message.includes('permission')) {
      type = ErrorType.AUTHORIZATION
      severity = ErrorSeverity.HIGH
      statusCode = 403
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      type = ErrorType.VALIDATION
      severity = ErrorSeverity.LOW
      statusCode = 400
    } else if (error.message.includes('not found')) {
      type = ErrorType.NOT_FOUND
      severity = ErrorSeverity.LOW
      statusCode = 404
    }

    return new AppError(
      error.message,
      type,
      severity,
      undefined,
      statusCode,
      undefined,
      context,
      [],
      isRetryable
    )
  }

  /**
   * Log error with appropriate level
   */
  private async logError(error: AppError): Promise<void> {
    const logData = {
      ...error.toJSON(),
      stack: error.stack
    }

    if (this.logger) {
      switch (error.severity) {
        case ErrorSeverity.LOW:
          this.logger.warn('Application Error', logData)
          break
        case ErrorSeverity.MEDIUM:
          this.logger.error('Application Error', logData)
          break
        case ErrorSeverity.HIGH:
        case ErrorSeverity.CRITICAL:
          this.logger.error('Critical Application Error', logData)
          break
        default:
          this.logger.error('Application Error', logData)
      }
    } else {
      // Fallback to console logging
      console.error(`[${error.severity.toUpperCase()}] ${error.type}:`, logData)
    }
  }

  /**
   * Report error to monitoring service
   */
  private async reportToMonitoring(error: AppError): Promise<void> {
    if (this.monitoring) {
      try {
        await this.monitoring.captureException(error, {
          tags: {
            errorType: error.type,
            severity: error.severity,
            code: error.code
          },
          extra: error.context,
          user: error.context.userId ? { id: error.context.userId } : undefined
        })
      } catch (monitoringError) {
        console.error('Failed to report error to monitoring:', monitoringError)
      }
    }
  }

  /**
   * Send alert for critical errors
   */
  private async sendAlert(error: AppError): Promise<void> {
    // In a real implementation, you would send alerts via:
    // - Slack/Discord webhooks
    // - Email notifications
    // - PagerDuty/OpsGenie
    // - SMS alerts
    
    console.error('CRITICAL ERROR ALERT:', {
      type: error.type,
      message: error.message,
      code: error.code,
      context: error.context,
      timestamp: error.timestamp
    })

    // Example: Send to webhook
    /*
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Critical Error: ${error.type}`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Error Code', value: error.code, short: true },
              { title: 'Message', value: error.message, short: false },
              { title: 'User ID', value: error.context.userId || 'Unknown', short: true },
              { title: 'Timestamp', value: error.timestamp, short: true }
            ]
          }]
        })
      })
    } catch (alertError) {
      console.error('Failed to send alert:', alertError)
    }
    */
  }

  /**
   * Retry mechanism with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorType.NETWORK,
        ErrorType.EXTERNAL_SERVICE,
        ErrorType.DATABASE,
        ErrorType.RATE_LIMIT
      ]
    }
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        // Check if error is retryable
        const appError = error instanceof AppError ? error : this.convertToAppError(error, {})
        
        if (!config.retryableErrors.includes(appError.type) || attempt === config.maxAttempts) {
          throw error
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        )

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000

        console.log(`Retrying operation (attempt ${attempt}/${config.maxAttempts}) after ${jitteredDelay}ms`)
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay))
      }
    }

    throw lastError!
  }

  /**
   * Create error response for API routes
   */
  createErrorResponse(error: AppError) {
    return {
      error: {
        type: error.type,
        code: error.code,
        message: error.userMessage,
        details: error.message,
        recoveryActions: error.recoveryActions,
        timestamp: error.timestamp
      }
    }
  }
}

/**
 * Utility functions
 */
export const errorHandler = ErrorHandler.getInstance()

export function isRetryableError(error: Error | AppError): boolean {
  if (error instanceof AppError) {
    return error.isRetryable
  }
  
  // Check common retryable error patterns
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /connection/i,
    /rate limit/i,
    /service unavailable/i,
    /internal server error/i
  ]
  
  return retryablePatterns.some(pattern => pattern.test(error.message))
}

export function getErrorSeverity(error: Error | AppError): ErrorSeverity {
  if (error instanceof AppError) {
    return error.severity
  }
  
  // Classify based on error message
  if (error.message.includes('critical') || error.message.includes('fatal')) {
    return ErrorSeverity.CRITICAL
  } else if (error.message.includes('auth') || error.message.includes('permission')) {
    return ErrorSeverity.HIGH
  } else if (error.message.includes('validation') || error.message.includes('invalid')) {
    return ErrorSeverity.LOW
  }
  
  return ErrorSeverity.MEDIUM
}

/**
 * Error boundary hook for React components
 */
export function createErrorBoundary() {
  return {
    componentDidCatch(error: Error, errorInfo: any) {
      errorHandler.handleError(error, {
        additionalData: errorInfo
      })
    }
  }
}

// Export validation schemas
export const errorContextSchema = z.object({
  userId: z.string().optional(),
  requestId: z.string().optional(),
  endpoint: z.string().optional(),
  method: z.string().optional(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  timestamp: z.string().optional(),
  additionalData: z.record(z.any()).optional()
})

export const retryConfigSchema = z.object({
  maxAttempts: z.number().min(1).max(10),
  baseDelay: z.number().min(100),
  maxDelay: z.number().min(1000),
  backoffMultiplier: z.number().min(1),
  retryableErrors: z.array(z.nativeEnum(ErrorType))
})

/**
 * API error handler for Next.js API routes
 */
export async function handleApiError(error: unknown): Promise<Response> {
  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else if (error instanceof Error) {
    // Convert generic error to AppError
    appError = await errorHandler.handleError(error, {})
  } else {
    appError = new AppError(
      'Unknown error occurred',
      ErrorType.UNKNOWN,
      ErrorSeverity.MEDIUM
    )
    await errorHandler.handleError(appError)
  }

  // Return appropriate HTTP response
  return new Response(
    JSON.stringify(errorHandler.createErrorResponse(appError)),
    {
      status: appError.statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}