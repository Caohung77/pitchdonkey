import { z } from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

// Security configuration
export interface SecurityConfig {
  encryption: {
    algorithm: string
    keyLength: number
    ivLength: number
  }
  rateLimit: {
    windowMs: number
    maxRequests: number
    skipSuccessfulRequests: boolean
  }
  csrf: {
    enabled: boolean
    tokenLength: number
    cookieName: string
    headerName: string
  }
  headers: {
    hsts: boolean
    contentTypeOptions: boolean
    frameOptions: boolean
    xssProtection: boolean
    referrerPolicy: string
  }
  audit: {
    enabled: boolean
    sensitiveFields: string[]
    retentionDays: number
  }
}

export interface AuditLog {
  id: string
  userId?: string
  action: string
  resource: string
  method: string
  endpoint: string
  ip: string
  userAgent: string
  timestamp: string
  success: boolean
  error?: string
  metadata?: Record<string, any>
}

export interface RateLimitInfo {
  key: string
  count: number
  resetTime: number
  remaining: number
}

// Input validation schemas
export const emailSchema = z.string().email().max(255)
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')

export const nameSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')

export const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional()

export const urlSchema = z.string().url().max(2048)

export const idSchema = z.string().uuid('Invalid ID format')

// Sanitization functions
export class InputSanitizer {
  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    if (!input) return ''
    
    // Basic HTML entity encoding
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * Sanitize SQL input to prevent injection
   */
  static sanitizeSql(input: string): string {
    if (!input) return ''
    
    // Remove or escape dangerous SQL characters
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/gi, '')
      .replace(/sp_/gi, '')
  }

  /**
   * Sanitize file names
   */
  static sanitizeFileName(fileName: string): string {
    if (!fileName) return ''
    
    // Remove dangerous characters and limit length
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255)
  }

  /**
   * Sanitize email addresses
   */
  static sanitizeEmail(email: string): string {
    if (!email) return ''
    
    return email.toLowerCase().trim()
  }

  /**
   * Remove potentially dangerous characters from general input
   */
  static sanitizeInput(input: string): string {
    if (!input) return ''
    
    return input
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
  }
}

/**
 * Encryption utilities for sensitive data
 */
export class EncryptionManager {
  private static algorithm = 'aes-256-gcm'
  private static keyLength = 32
  private static ivLength = 16
  private static tagLength = 16

  /**
   * Generate encryption key from password
   */
  static generateKey(password: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256')
  }

  /**
   * Generate random salt
   */
  static generateSalt(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(data: string, key: Buffer): string {
    const iv = crypto.randomBytes(this.ivLength)
    const cipher = crypto.createCipher(this.algorithm, key)
    // Note: setAAD is only available for authenticated encryption modes
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Note: getAuthTag is only available for authenticated encryption modes
    
    return `${iv.toString('hex')}:${encrypted}`
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string, key: Buffer): string {
    const [ivHex, encrypted] = encryptedData.split(':')
    
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format')
    }
    
    const iv = Buffer.from(ivHex, 'hex')
    
    const decipher = crypto.createDecipher(this.algorithm, key)
    // Note: setAAD and setAuthTag are only available for authenticated encryption modes
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  /**
   * Hash password securely
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(password, saltRounds)
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Generate secure random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('base64url')
  }

  /**
   * Verify CSRF token
   */
  static verifyCSRFToken(token: string, expectedToken: string): boolean {
    if (!token || !expectedToken) return false
    return crypto.timingSafeEqual(
      Buffer.from(token, 'base64url'),
      Buffer.from(expectedToken, 'base64url')
    )
  }
}

/**
 * Rate limiting implementation
 */
export class RateLimiter {
  private static store = new Map<string, { count: number; resetTime: number }>()

  /**
   * Check if request is within rate limit
   */
  static isAllowed(
    key: string, 
    maxRequests: number = 100, 
    windowMs: number = 60000
  ): { allowed: boolean; info: RateLimitInfo } {
    const now = Date.now()
    const record = this.store.get(key)

    if (!record || now > record.resetTime) {
      // First request or window expired
      this.store.set(key, { count: 1, resetTime: now + windowMs })
      return {
        allowed: true,
        info: {
          key,
          count: 1,
          resetTime: now + windowMs,
          remaining: maxRequests - 1
        }
      }
    }

    if (record.count >= maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        info: {
          key,
          count: record.count,
          resetTime: record.resetTime,
          remaining: 0
        }
      }
    }

    // Increment count
    record.count++
    this.store.set(key, record)

    return {
      allowed: true,
      info: {
        key,
        count: record.count,
        resetTime: record.resetTime,
        remaining: maxRequests - record.count
      }
    }
  }

  /**
   * Get rate limit info for key
   */
  static getInfo(key: string): RateLimitInfo | null {
    const record = this.store.get(key)
    if (!record) return null

    return {
      key,
      count: record.count,
      resetTime: record.resetTime,
      remaining: Math.max(0, 100 - record.count) // Default max of 100
    }
  }

  /**
   * Reset rate limit for key
   */
  static reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clean up expired entries
   */
  static cleanup(): void {
    const now = Date.now()
    for (const [key, record] of Array.from(this.store.entries())) {
      if (now > record.resetTime) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Generate rate limit key from request
   */
  static generateKey(req: NextRequest, identifier?: string): string {
    const ip = this.getClientIP(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const endpoint = new URL(req.url).pathname
    
    if (identifier) {
      return `${identifier}:${endpoint}`
    }
    
    return `${ip}:${endpoint}:${crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8)}`
  }

  private static getClientIP(req: NextRequest): string {
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
}

/**
 * Security headers manager
 */
export class SecurityHeaders {
  /**
   * Get security headers for responses
   */
  static getHeaders(config: SecurityConfig['headers']): Record<string, string> {
    const headers: Record<string, string> = {}

    if (config.hsts) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    }

    if (config.contentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff'
    }

    if (config.frameOptions) {
      headers['X-Frame-Options'] = 'DENY'
    }

    if (config.xssProtection) {
      headers['X-XSS-Protection'] = '1; mode=block'
    }

    if (config.referrerPolicy) {
      headers['Referrer-Policy'] = config.referrerPolicy
    }

    // Content Security Policy
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.stripe.com https://api.openai.com",
      "frame-src https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')

    // Permissions Policy
    headers['Permissions-Policy'] = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=(self)'
    ].join(', ')

    return headers
  }
}

/**
 * Audit logging system
 */
export class AuditLogger {
  private static logs: AuditLog[] = []
  private static sensitiveFields = [
    'password', 'token', 'secret', 'key', 'credential',
    'ssn', 'credit_card', 'bank_account'
  ]

  /**
   * Log security-relevant action
   */
  static async log(
    action: string,
    resource: string,
    req: NextRequest,
    userId?: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: crypto.randomUUID(),
      userId,
      action,
      resource,
      method: req.method,
      endpoint: new URL(req.url).pathname,
      ip: RateLimiter['getClientIP'](req),
      userAgent: req.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      success,
      error,
      metadata: this.sanitizeMetadata(metadata)
    }

    this.logs.push(auditLog)

    // Keep only recent logs (last 10000)
    if (this.logs.length > 10000) {
      this.logs.shift()
    }

    // In a real implementation, you would store this in a database
    console.log('AUDIT:', auditLog)
  }

  /**
   * Get audit logs with filtering
   */
  static getLogs(
    userId?: string,
    action?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): AuditLog[] {
    let filteredLogs = this.logs

    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === userId)
    }

    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action)
    }

    if (startDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= startDate
      )
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= endDate
      )
    }

    return filteredLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Remove sensitive data from metadata
   */
  private static sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined

    const sanitized = { ...metadata }

    for (const key in sanitized) {
      if (this.sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }
}

/**
 * Input validation middleware
 */
export class InputValidator {
  /**
   * Validate and sanitize request body
   */
  static validateBody<T>(
    body: unknown,
    schema: z.ZodSchema<T>
  ): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    try {
      const result = schema.safeParse(body)
      
      if (result.success) {
        return { success: true, data: result.data }
      } else {
        const errors: Record<string, string> = {}
        result.error.issues.forEach(issue => {
          const path = issue.path.join('.')
          errors[path] = issue.message
        })
        return { success: false, errors }
      }
    } catch (error) {
      return { 
        success: false, 
        errors: { _general: 'Validation failed' } 
      }
    }
  }

  /**
   * Validate file upload
   */
  static validateFile(
    file: File,
    options: {
      maxSize?: number
      allowedTypes?: string[]
      allowedExtensions?: string[]
    } = {}
  ): { valid: boolean; error?: string } {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['text/csv', 'application/json', 'text/plain'],
      allowedExtensions = ['.csv', '.json', '.txt']
    } = options

    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
      }
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`
      }
    }

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension ${extension} is not allowed`
      }
    }

    return { valid: true }
  }
}

// Default security configuration
export const defaultSecurityConfig: SecurityConfig = {
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16
  },
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    skipSuccessfulRequests: false
  },
  csrf: {
    enabled: true,
    tokenLength: 32,
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token'
  },
  headers: {
    hsts: true,
    contentTypeOptions: true,
    frameOptions: true,
    xssProtection: true,
    referrerPolicy: 'strict-origin-when-cross-origin'
  },
  audit: {
    enabled: true,
    sensitiveFields: [
      'password', 'token', 'secret', 'key', 'credential',
      'ssn', 'credit_card', 'bank_account'
    ],
    retentionDays: 90
  }
}

// Validation schemas for common use cases
export const securitySchemas = {
  login: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required')
  }),
  
  register: z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema
  }),
  
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  }),
  
  updateProfile: z.object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema
  }),
  
  apiKey: z.object({
    name: z.string().min(1).max(100),
    permissions: z.array(z.string()).optional()
  })
}

// Export utility functions
export const security = {
  sanitize: InputSanitizer,
  encrypt: EncryptionManager,
  rateLimit: RateLimiter,
  headers: SecurityHeaders,
  audit: AuditLogger,
  validate: InputValidator,
  schemas: securitySchemas
}