/**
 * Security utilities for PitchDonkey application
 * Provides CSRF protection, input sanitization, and security headers
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * CSRF Protection
 */
export class CSRFProtection {
  private static readonly CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'
  
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }
  
  static validateToken(token: string, sessionToken?: string): boolean {
    if (!token || typeof token !== 'string') return false
    if (token.length !== 64) return false // 32 bytes = 64 hex chars
    
    // In a production app, you'd validate against a stored session token
    // For now, just validate format
    return /^[a-f0-9]{64}$/.test(token)
  }
  
  static addCSRFHeader(response: NextResponse, token: string): NextResponse {
    response.headers.set('X-CSRF-Token', token)
    return response
  }
}

/**
 * Input Sanitization
 */
export class InputSanitizer {
  /**
   * Sanitize HTML input to prevent XSS
   */
  static sanitizeHTML(input: string): string {
    if (typeof input !== 'string') return ''
    
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }
  
  /**
   * Sanitize email addresses
   */
  static sanitizeEmail(email: string): string {
    if (typeof email !== 'string') return ''
    
    return email.toLowerCase().trim()
  }
  
  /**
   * Sanitize SQL-like input (basic protection)
   */
  static sanitizeSQLInput(input: string): string {
    if (typeof input !== 'string') return ''
    
    // Remove common SQL injection patterns
    return input
      .replace(/[';--]/g, '')
      .replace(/\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|CREATE|ALTER)\b/gi, '')
      .trim()
  }
  
  /**
   * Validate and sanitize JSON input
   */
  static sanitizeJSON(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeHTML(input)
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeJSON(item))
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        const sanitizedKey = this.sanitizeHTML(key)
        sanitized[sanitizedKey] = this.sanitizeJSON(value)
      }
      return sanitized
    }
    
    return input
  }
}

/**
 * Security Headers Manager
 */
export class SecurityHeaders {
  static addAllSecurityHeaders(response: NextResponse): NextResponse {
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co https://api.openai.com https://api.anthropic.com wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
    
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    
    // HSTS (HTTP Strict Transport Security)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
    
    return response
  }
  
  static addAPISecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY') 
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    
    return response
  }
}

/**
 * Request Validation
 */
export class RequestValidator {
  static validateRequestSize(request: NextRequest, maxSizeBytes: number = 1024 * 1024): boolean {
    const contentLength = request.headers.get('content-length')
    if (!contentLength) return true // Let Next.js handle it
    
    const size = parseInt(contentLength, 10)
    return size <= maxSizeBytes
  }
  
  static validateContentType(request: NextRequest, allowedTypes: string[]): boolean {
    const contentType = request.headers.get('content-type')
    if (!contentType) return false
    
    return allowedTypes.some(type => contentType.includes(type))
  }
  
  static validateUserAgent(request: NextRequest): boolean {
    const userAgent = request.headers.get('user-agent')
    if (!userAgent) return false
    
    // Block obviously malicious user agents
    const blockedPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /hack/i,
      /scan/i
    ]
    
    return !blockedPatterns.some(pattern => pattern.test(userAgent))
  }
}

/**
 * Audit Logging
 */
export class AuditLogger {
  static async logAuthEvent(
    event: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'permission_denied',
    userId: string | null,
    request: NextRequest,
    details?: Record<string, any>
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      userId,
      ip: this.getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      path: request.nextUrl.pathname,
      details: details || {}
    }
    
    // In production, send to a logging service
    console.log('AUTH_AUDIT:', JSON.stringify(logEntry))
    
    // TODO: In production, save to audit log table or external service
    // await saveAuditLog(logEntry)
  }
  
  static async logAPIAccess(
    method: string,
    path: string,
    userId: string | null,
    statusCode: number,
    request: NextRequest,
    responseTime?: number
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      path,
      userId,
      statusCode,
      ip: this.getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      responseTime: responseTime || 0
    }
    
    // In production, send to a logging service
    console.log('API_ACCESS:', JSON.stringify(logEntry))
  }
  
  private static getClientIP(request: NextRequest): string {
    const xForwardedFor = request.headers.get('x-forwarded-for')
    const xRealIP = request.headers.get('x-real-ip')
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    
    return xForwardedFor?.split(',')[0] || 
           xRealIP || 
           cfConnectingIP || 
           'unknown'
  }
}

/**
 * Session Security
 */
export class SessionSecurity {
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex')
  }
  
  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const useSalt = salt || crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, useSalt, 100000, 64, 'sha512').toString('hex')
    
    return { hash, salt: useSalt }
  }
  
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
    return hash === verifyHash
  }
  
  static isSessionExpired(sessionTimestamp: string, maxAgeMs: number): boolean {
    const sessionTime = new Date(sessionTimestamp).getTime()
    const now = Date.now()
    
    return (now - sessionTime) > maxAgeMs
  }
}

/**
 * Encryption utilities for sensitive data
 */
export class EncryptionUtils {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32-chars'
  
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.ALGORITHM, this.KEY)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Note: This is a simplified version. In production, use proper GCM mode
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: 'placeholder' // In real implementation, get from cipher.getAuthTag()
    }
  }
  
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    try {
      const decipher = crypto.createDecipher(this.ALGORITHM, this.KEY)
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }
}

/**
 * Security middleware wrapper
 */
export function withSecurity<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const startTime = Date.now()
    
    try {
      // Basic request validation
      if (!RequestValidator.validateRequestSize(request)) {
        return NextResponse.json(
          { error: 'Request too large', code: 'REQUEST_TOO_LARGE' },
          { status: 413 }
        )
      }
      
      if (!RequestValidator.validateUserAgent(request)) {
        await AuditLogger.logAuthEvent('permission_denied', null, request, {
          reason: 'Blocked user agent'
        })
        
        return NextResponse.json(
          { error: 'Access denied', code: 'ACCESS_DENIED' },
          { status: 403 }
        )
      }
      
      // Execute the handler
      const response = await handler(request, ...args)
      
      // Add security headers
      const secureResponse = SecurityHeaders.addAPISecurityHeaders(response as NextResponse)
      
      // Log the API access
      const responseTime = Date.now() - startTime
      await AuditLogger.logAPIAccess(
        request.method,
        request.nextUrl.pathname,
        null, // userId would come from auth context
        secureResponse.status,
        request,
        responseTime
      )
      
      return secureResponse
      
    } catch (error) {
      console.error('Security middleware error:', error)
      
      return NextResponse.json(
        { error: 'Security validation failed', code: 'SECURITY_ERROR' },
        { status: 500 }
      )
    }
  }
}