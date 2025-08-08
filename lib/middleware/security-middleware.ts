import { NextRequest, NextResponse } from 'next/server'
import { security, defaultSecurityConfig } from '../security'
import { handleRateLimitError, handleValidationError } from './error-middleware'

/**
 * Security middleware for API routes
 */
export function withSecurity(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: {
    rateLimit?: {
      maxRequests?: number
      windowMs?: number
      keyGenerator?: (req: NextRequest) => string
    }
    validation?: {
      body?: any
      query?: any
      headers?: any
    }
    csrf?: boolean
    audit?: {
      action: string
      resource: string
    }
  } = {}
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      // Apply rate limiting
      if (options.rateLimit) {
        const rateLimitResult = await applyRateLimit(req, options.rateLimit)
        if (!rateLimitResult.allowed) {
          const retryAfter = Math.ceil((rateLimitResult.info.resetTime - Date.now()) / 1000)
          handleRateLimitError(
            options.rateLimit?.maxRequests || 100,
            options.rateLimit?.windowMs || 60000,
            retryAfter * 1000
          )
        }
      }

      // CSRF protection for state-changing operations
      if (options.csrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        await validateCSRFToken(req)
      }

      // Input validation
      if (options.validation) {
        await validateInput(req, options.validation)
      }

      // Execute the handler
      const response = await handler(req, ...args)

      // Add security headers
      addSecurityHeaders(response)

      // Audit logging
      if (options.audit) {
        await auditRequest(req, options.audit, true)
      }

      return response

    } catch (error) {
      // Audit failed requests
      if (options.audit) {
        await auditRequest(
          req, 
          options.audit, 
          false, 
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
      throw error
    }
  }
}

/**
 * Apply rate limiting to request
 */
async function applyRateLimit(
  req: NextRequest,
  options?: {
    maxRequests?: number
    windowMs?: number
    keyGenerator?: (req: NextRequest) => string
  }
): Promise<{ allowed: boolean; info: any }> {
  const maxRequests = options?.maxRequests || defaultSecurityConfig.rateLimit.maxRequests
  const windowMs = options?.windowMs || defaultSecurityConfig.rateLimit.windowMs
  
  const key = options?.keyGenerator 
    ? options.keyGenerator(req)
    : security.rateLimit.generateKey(req)

  return security.rateLimit.isAllowed(key, maxRequests, windowMs)
}

/**
 * Validate CSRF token
 */
async function validateCSRFToken(req: NextRequest): Promise<void> {
  const config = defaultSecurityConfig.csrf
  if (!config.enabled) return

  const tokenFromHeader = req.headers.get(config.headerName)
  const tokenFromCookie = req.cookies.get(config.cookieName)?.value

  if (!tokenFromHeader || !tokenFromCookie) {
    throw new Error('CSRF token missing')
  }

  if (!security.encrypt.verifyCSRFToken(tokenFromHeader, tokenFromCookie)) {
    throw new Error('Invalid CSRF token')
  }
}

/**
 * Validate request input
 */
async function validateInput(
  req: NextRequest,
  validation: {
    body?: any
    query?: any
    headers?: any
  }
): Promise<void> {
  // Validate request body
  if (validation.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      const body = await req.json()
      const result = security.validate.validateBody(body, validation.body)
      
      if (!result.success) {
        handleValidationError({ error: { issues: [] } }, 'Request validation failed')
      }
    } catch (error) {
      handleValidationError({ error: { issues: [] } }, 'Invalid JSON in request body')
    }
  }

  // Validate query parameters
  if (validation.query) {
    const url = new URL(req.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    const result = security.validate.validateBody(queryParams, validation.query)
    
    if (!result.success) {
      handleValidationError({ error: { issues: [] } }, 'Query parameter validation failed')
    }
  }

  // Validate headers
  if (validation.headers) {
    const headers = Object.fromEntries(req.headers.entries())
    const result = security.validate.validateBody(headers, validation.headers)
    
    if (!result.success) {
      handleValidationError({ error: { issues: [] } }, 'Header validation failed')
    }
  }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  const headers = security.headers.getHeaders(defaultSecurityConfig.headers)
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

/**
 * Audit request
 */
async function auditRequest(
  req: NextRequest,
  audit: { action: string; resource: string },
  success: boolean,
  error?: string
): Promise<void> {
  if (!defaultSecurityConfig.audit.enabled) return

  // Extract user ID from request (you might need to adapt this based on your auth system)
  const userId = req.headers.get('x-user-id') || undefined

  await security.audit.log(
    audit.action,
    audit.resource,
    req,
    userId,
    success,
    error
  )
}

/**
 * Input sanitization middleware
 */
export function withInputSanitization(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // Sanitize request body if present
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        const body = await req.json()
        const sanitizedBody = sanitizeObject(body)
        
        // Create new request with sanitized body
        const sanitizedReq = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(sanitizedBody)
        })

        return handler(sanitizedReq, ...args)
      } catch (error) {
        // If JSON parsing fails, continue with original request
        return handler(req, ...args)
      }
    }

    return handler(req, ...args)
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return security.sanitize.sanitizeInput(obj)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  
  return obj
}

/**
 * File upload security middleware
 */
export function withFileUploadSecurity(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: {
    maxSize?: number
    allowedTypes?: string[]
    allowedExtensions?: string[]
    virusScan?: boolean
  } = {}
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    if (req.method !== 'POST' && req.method !== 'PUT') {
      return handler(req, ...args)
    }

    try {
      const formData = await req.formData()
      
      for (const [key, value] of Array.from(formData.entries())) {
        if (value instanceof File) {
          const validation = security.validate.validateFile(value, options)
          
          if (!validation.valid) {
            throw new Error(validation.error)
          }

          // Additional security checks
          await performFileSecurityChecks(value, options)
        }
      }

      return handler(req, ...args)
    } catch (error) {
      throw error
    }
  }
}

/**
 * Perform additional file security checks
 */
async function performFileSecurityChecks(
  file: File,
  options: { virusScan?: boolean } = {}
): Promise<void> {
  // Check file content matches extension
  const buffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(buffer)
  
  // Basic file signature validation
  if (file.type === 'text/csv') {
    // CSV files should start with printable characters
    const firstBytes = uint8Array.slice(0, 100)
    const hasNullBytes = firstBytes.some(byte => byte === 0)
    
    if (hasNullBytes) {
      throw new Error('File appears to be corrupted or not a valid CSV')
    }
  }

  // Check for embedded scripts in text files
  if (file.type.startsWith('text/')) {
    const content = new TextDecoder().decode(uint8Array)
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i
    ]
    
    if (dangerousPatterns.some(pattern => pattern.test(content))) {
      throw new Error('File contains potentially dangerous content')
    }
  }

  // Virus scanning (placeholder - would integrate with actual AV service)
  if (options.virusScan) {
    // In a real implementation, you would send the file to a virus scanning service
    console.log('Virus scan would be performed here')
  }
}

/**
 * API key authentication middleware
 */
export function withApiKeyAuth(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: {
    headerName?: string
    validateKey?: (key: string) => Promise<{ valid: boolean; userId?: string }>
  } = {}
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const headerName = options.headerName || 'x-api-key'
    const apiKey = req.headers.get(headerName)

    if (!apiKey) {
      throw new Error('API key required')
    }

    // Validate API key
    if (options.validateKey) {
      const validation = await options.validateKey(apiKey)
      if (!validation.valid) {
        throw new Error('Invalid API key')
      }

      // Add user ID to request headers for downstream use
      if (validation.userId) {
        req.headers.set('x-user-id', validation.userId)
      }
    }

    return handler(req, ...args)
  }
}

/**
 * IP whitelist middleware
 */
export function withIPWhitelist(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  allowedIPs: string[]
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const clientIP = getClientIP(req)
    
    if (!allowedIPs.includes(clientIP)) {
      throw new Error(`Access denied for IP: ${clientIP}`)
    }

    return handler(req, ...args)
  }
}

/**
 * Get client IP address
 */
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
 * Combine multiple security middlewares
 */
export function withSecurityStack(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: {
    rateLimit?: any
    validation?: any
    csrf?: boolean
    audit?: any
    sanitization?: boolean
    fileUpload?: any
    apiKey?: any
    ipWhitelist?: string[]
  } = {}
) {
  let securedHandler = handler

  // Apply middlewares in reverse order (they wrap each other)
  if (options.ipWhitelist) {
    securedHandler = withIPWhitelist(securedHandler, options.ipWhitelist)
  }

  if (options.apiKey) {
    securedHandler = withApiKeyAuth(securedHandler, options.apiKey)
  }

  if (options.fileUpload) {
    securedHandler = withFileUploadSecurity(securedHandler, options.fileUpload)
  }

  if (options.sanitization) {
    securedHandler = withInputSanitization(securedHandler)
  }

  // Main security middleware (includes rate limiting, CSRF, validation, audit)
  securedHandler = withSecurity(securedHandler, {
    rateLimit: options.rateLimit,
    validation: options.validation,
    csrf: options.csrf,
    audit: options.audit
  })

  return securedHandler
}