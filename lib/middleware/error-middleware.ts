import { NextRequest, NextResponse } from 'next/server'
import { AppError, ErrorHandler, ErrorType, ErrorSeverity, errorHandler } from '../errors'

/**
 * API Error handling middleware for Next.js API routes
 */
export function withErrorHandling(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args)
    } catch (error) {
      return handleApiError(error, req)
    }
  }
}

/**
 * Handle API errors and return appropriate response
 */
export async function handleApiError(
  error: Error | AppError,
  req: NextRequest
): Promise<NextResponse> {
  // Extract context from request
  const context = {
    requestId: req.headers.get('x-request-id') || generateRequestId(),
    endpoint: req.url,
    method: req.method,
    userAgent: req.headers.get('user-agent') || undefined,
    ip: getClientIP(req),
    timestamp: new Date().toISOString()
  }

  // Handle the error
  const handledError = await errorHandler.handleError(error, context)

  // Create error response
  const errorResponse = errorHandler.createErrorResponse(handledError)

  // Add additional headers
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Error-Code': handledError.code,
    'X-Request-ID': context.requestId
  })

  // Add retry-after header for rate limit errors
  if (handledError.type === ErrorType.RATE_LIMIT && handledError.context.retryAfter) {
    headers.set('Retry-After', handledError.context.retryAfter.toString())
  }

  return NextResponse.json(errorResponse, {
    status: handledError.statusCode,
    headers
  })
}

/**
 * Validation error handler
 */
export function handleValidationError(
  validationResult: any,
  message: string = 'Validation failed'
): never {
  const validationErrors: Record<string, string> = {}

  if (validationResult.error) {
    // Handle Zod validation errors
    if (validationResult.error.issues) {
      validationResult.error.issues.forEach((issue: any) => {
        const path = issue.path.join('.')
        validationErrors[path] = issue.message
      })
    }
  }

  throw new AppError(
    message,
    ErrorType.VALIDATION,
    ErrorSeverity.LOW,
    'VALIDATION_ERROR',
    400,
    'Please check your input and try again',
    { validationErrors },
    [{ type: 'manual', label: 'Fix validation errors' }]
  )
}

/**
 * Database error handler
 */
export function handleDatabaseError(error: any, operation: string): never {
  let message = `Database error during ${operation}`
  let userMessage = 'A database error occurred. Please try again.'

  // Handle specific database errors
  if (error.code) {
    switch (error.code) {
      case '23505': // Unique violation
        message = `Duplicate entry during ${operation}`
        userMessage = 'This record already exists.'
        break
      case '23503': // Foreign key violation
        message = `Foreign key constraint violation during ${operation}`
        userMessage = 'Referenced record does not exist.'
        break
      case '23502': // Not null violation
        message = `Required field missing during ${operation}`
        userMessage = 'Required information is missing.'
        break
      case '42P01': // Undefined table
        message = `Table not found during ${operation}`
        userMessage = 'System configuration error. Please contact support.'
        break
      default:
        message = `Database error (${error.code}) during ${operation}`
    }
  }

  throw new AppError(
    message,
    ErrorType.DATABASE,
    ErrorSeverity.HIGH,
    'DATABASE_ERROR',
    500,
    userMessage,
    { 
      operation,
      databaseError: {
        code: error.code,
        detail: error.detail,
        hint: error.hint
      }
    },
    [{ type: 'retry', label: 'Try again' }],
    true
  )
}

/**
 * External service error handler
 */
export function handleExternalServiceError(
  error: any,
  serviceName: string,
  operation: string
): never {
  let message = `${serviceName} error during ${operation}`
  let statusCode = 502
  let userMessage = `${serviceName} is temporarily unavailable. Please try again later.`

  // Handle specific service errors
  if (error.response) {
    statusCode = error.response.status
    
    switch (statusCode) {
      case 401:
        message = `${serviceName} authentication failed during ${operation}`
        userMessage = 'Service authentication error. Please contact support.'
        break
      case 403:
        message = `${serviceName} access denied during ${operation}`
        userMessage = 'Service access denied. Please contact support.'
        break
      case 429:
        message = `${serviceName} rate limit exceeded during ${operation}`
        userMessage = `${serviceName} rate limit exceeded. Please try again later.`
        break
      case 500:
      case 502:
      case 503:
      case 504:
        message = `${serviceName} server error during ${operation}`
        userMessage = `${serviceName} is experiencing issues. Please try again later.`
        break
    }
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    message = `Cannot connect to ${serviceName} during ${operation}`
    userMessage = `Cannot connect to ${serviceName}. Please try again later.`
  } else if (error.code === 'ETIMEDOUT') {
    message = `${serviceName} timeout during ${operation}`
    userMessage = `${serviceName} request timed out. Please try again.`
  }

  throw new AppError(
    message,
    ErrorType.EXTERNAL_SERVICE,
    ErrorSeverity.HIGH,
    'EXTERNAL_SERVICE_ERROR',
    statusCode,
    userMessage,
    {
      service: serviceName,
      operation,
      serviceError: {
        code: error.code,
        status: error.response?.status,
        message: error.message
      }
    },
    [
      { type: 'retry', label: 'Retry' },
      { type: 'fallback', label: 'Use alternative method' }
    ],
    true
  )
}

/**
 * Authentication error handler
 */
export function handleAuthError(message: string = 'Authentication required'): never {
  throw new AppError(
    message,
    ErrorType.AUTHENTICATION,
    ErrorSeverity.HIGH,
    'AUTH_REQUIRED',
    401,
    'Please sign in to continue',
    {},
    [
      { type: 'redirect', label: 'Sign In', url: '/auth/signin' }
    ]
  )
}

/**
 * Authorization error handler
 */
export function handleAuthzError(
  message: string = 'Insufficient permissions',
  requiredPermission?: string
): never {
  throw new AppError(
    message,
    ErrorType.AUTHORIZATION,
    ErrorSeverity.HIGH,
    'INSUFFICIENT_PERMISSIONS',
    403,
    'You don\'t have permission to perform this action',
    { requiredPermission },
    [
      { type: 'redirect', label: 'Go to Dashboard', url: '/dashboard' }
    ]
  )
}

/**
 * Rate limit error handler
 */
export function handleRateLimitError(
  limit: number,
  windowMs: number,
  retryAfter: number
): never {
  throw new AppError(
    `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
    ErrorType.RATE_LIMIT,
    ErrorSeverity.MEDIUM,
    'RATE_LIMIT_EXCEEDED',
    429,
    `Too many requests. Please try again in ${Math.ceil(retryAfter / 1000)} seconds.`,
    { limit, windowMs, retryAfter },
    [
      { type: 'retry', label: `Retry in ${Math.ceil(retryAfter / 1000)}s` }
    ],
    true
  )
}

/**
 * Business logic error handler
 */
export function handleBusinessLogicError(
  message: string,
  userMessage?: string,
  code?: string
): never {
  throw new AppError(
    message,
    ErrorType.BUSINESS_LOGIC,
    ErrorSeverity.MEDIUM,
    code || 'BUSINESS_LOGIC_ERROR',
    400,
    userMessage || 'Unable to complete the requested operation',
    {},
    [
      { type: 'manual', label: 'Review and try again' }
    ]
  )
}

/**
 * Not found error handler
 */
export function handleNotFoundError(resource: string = 'Resource'): never {
  throw new AppError(
    `${resource} not found`,
    ErrorType.NOT_FOUND,
    ErrorSeverity.LOW,
    'NOT_FOUND',
    404,
    `The requested ${resource.toLowerCase()} was not found`,
    { resource },
    [
      { type: 'redirect', label: 'Go back', url: '/dashboard' }
    ]
  )
}

/**
 * Utility functions
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return 'unknown'
}

/**
 * Error logging middleware
 */
export function logRequest(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || generateRequestId()
  const startTime = Date.now()
  
  console.log(`[${requestId}] ${req.method} ${req.url} - Started`)
  
  return {
    requestId,
    logResponse: (response: NextResponse) => {
      const duration = Date.now() - startTime
      const status = response.status
      
      console.log(`[${requestId}] ${req.method} ${req.url} - ${status} (${duration}ms)`)
      
      // Add request ID to response headers
      response.headers.set('X-Request-ID', requestId)
    }
  }
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler(
  fn: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return (req: NextRequest, ...args: any[]) => {
    const { requestId, logResponse } = logRequest(req)
    
    return Promise.resolve(fn(req, ...args))
      .then(response => {
        logResponse(response)
        return response
      })
      .catch(error => {
        console.error(`[${requestId}] Error:`, error)
        return handleApiError(error, req)
      })
  }
}

/**
 * Type-safe error response creator
 */
export function createErrorResponse<T = any>(
  error: AppError,
  data?: T
): NextResponse {
  const response = errorHandler.createErrorResponse(error)
  
  if (data) {
    response.data = data
  }
  
  return NextResponse.json(response, {
    status: error.statusCode,
    headers: {
      'X-Error-Code': error.code,
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Success response creator
 */
export function createSuccessResponse<T = any>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  }, { status })
}