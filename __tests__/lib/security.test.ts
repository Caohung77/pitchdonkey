import {
  InputSanitizer,
  EncryptionManager,
  RateLimiter,
  SecurityHeaders,
  AuditLogger,
  InputValidator,
  securitySchemas,
  defaultSecurityConfig
} from '../../lib/security'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

describe('InputSanitizer', () => {
  describe('sanitizeHtml', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>'
      const result = InputSanitizer.sanitizeHtml(input)
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;')
    })

    it('should handle empty input', () => {
      expect(InputSanitizer.sanitizeHtml('')).toBe('')
      expect(InputSanitizer.sanitizeHtml(null as any)).toBe('')
    })

    it('should escape all dangerous characters', () => {
      const input = '&<>"\'/'
      const result = InputSanitizer.sanitizeHtml(input)
      expect(result).toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;')
    })
  })

  describe('sanitizeSql', () => {
    it('should escape single quotes', () => {
      const input = "'; DROP TABLE users; --"
      const result = InputSanitizer.sanitizeSql(input)
      expect(result).toBe("''; DROP TABLE users; ")
    })

    it('should remove dangerous SQL patterns', () => {
      const input = 'SELECT * FROM users; -- comment'
      const result = InputSanitizer.sanitizeSql(input)
      expect(result).toBe('SELECT * FROM users; ')
    })

    it('should remove stored procedure calls', () => {
      const input = 'xp_cmdshell sp_executesql'
      const result = InputSanitizer.sanitizeSql(input)
      expect(result).toBe(' ')
    })
  })

  describe('sanitizeFileName', () => {
    it('should replace dangerous characters', () => {
      const input = '../../../etc/passwd'
      const result = InputSanitizer.sanitizeFileName(input)
      expect(result).toBe('___..._etc_passwd')
    })

    it('should limit file name length', () => {
      const input = 'a'.repeat(300)
      const result = InputSanitizer.sanitizeFileName(input)
      expect(result.length).toBe(255)
    })

    it('should handle multiple dots', () => {
      const input = 'file...txt'
      const result = InputSanitizer.sanitizeFileName(input)
      expect(result).toBe('file.txt')
    })
  })

  describe('sanitizeEmail', () => {
    it('should normalize email addresses', () => {
      const input = '  TEST@EXAMPLE.COM  '
      const result = InputSanitizer.sanitizeEmail(input)
      expect(result).toBe('test@example.com')
    })
  })

  describe('sanitizeInput', () => {
    it('should remove control characters', () => {
      const input = 'test\x00\x1F\x7Fstring'
      const result = InputSanitizer.sanitizeInput(input)
      expect(result).toBe('teststring')
    })

    it('should normalize whitespace', () => {
      const input = 'test   multiple    spaces'
      const result = InputSanitizer.sanitizeInput(input)
      expect(result).toBe('test multiple spaces')
    })
  })
})

describe('EncryptionManager', () => {
  const testPassword = 'test-password'
  const testSalt = 'test-salt'
  const testData = 'sensitive data'

  describe('generateKey', () => {
    it('should generate consistent keys', () => {
      const key1 = EncryptionManager.generateKey(testPassword, testSalt)
      const key2 = EncryptionManager.generateKey(testPassword, testSalt)
      expect(key1.equals(key2)).toBe(true)
    })

    it('should generate different keys for different inputs', () => {
      const key1 = EncryptionManager.generateKey(testPassword, testSalt)
      const key2 = EncryptionManager.generateKey('different', testSalt)
      expect(key1.equals(key2)).toBe(false)
    })
  })

  describe('generateSalt', () => {
    it('should generate random salts', () => {
      const salt1 = EncryptionManager.generateSalt()
      const salt2 = EncryptionManager.generateSalt()
      expect(salt1).not.toBe(salt2)
      expect(salt1.length).toBe(64) // 32 bytes * 2 (hex)
    })
  })

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const key = EncryptionManager.generateKey(testPassword, testSalt)
      const encrypted = EncryptionManager.encrypt(testData, key)
      const decrypted = EncryptionManager.decrypt(encrypted, key)
      
      expect(decrypted).toBe(testData)
      expect(encrypted).not.toBe(testData)
    })

    it('should produce different encrypted output each time', () => {
      const key = EncryptionManager.generateKey(testPassword, testSalt)
      const encrypted1 = EncryptionManager.encrypt(testData, key)
      const encrypted2 = EncryptionManager.encrypt(testData, key)
      
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should fail with wrong key', () => {
      const key1 = EncryptionManager.generateKey(testPassword, testSalt)
      const key2 = EncryptionManager.generateKey('wrong', testSalt)
      const encrypted = EncryptionManager.encrypt(testData, key1)
      
      expect(() => {
        EncryptionManager.decrypt(encrypted, key2)
      }).toThrow()
    })

    it('should fail with malformed encrypted data', () => {
      const key = EncryptionManager.generateKey(testPassword, testSalt)
      
      expect(() => {
        EncryptionManager.decrypt('invalid:format', key)
      }).toThrow('Invalid encrypted data format')
    })
  })

  describe('hashPassword', () => {
    it('should hash passwords', async () => {
      const password = 'test-password'
      const hash = await EncryptionManager.hashPassword(password)
      
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50)
    })

    it('should produce different hashes for same password', async () => {
      const password = 'test-password'
      const hash1 = await EncryptionManager.hashPassword(password)
      const hash2 = await EncryptionManager.hashPassword(password)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct passwords', async () => {
      const password = 'test-password'
      const hash = await EncryptionManager.hashPassword(password)
      const isValid = await EncryptionManager.verifyPassword(password, hash)
      
      expect(isValid).toBe(true)
    })

    it('should reject incorrect passwords', async () => {
      const password = 'test-password'
      const hash = await EncryptionManager.hashPassword(password)
      const isValid = await EncryptionManager.verifyPassword('wrong', hash)
      
      expect(isValid).toBe(false)
    })
  })

  describe('generateToken', () => {
    it('should generate random tokens', () => {
      const token1 = EncryptionManager.generateToken()
      const token2 = EncryptionManager.generateToken()
      
      expect(token1).not.toBe(token2)
      expect(token1.length).toBe(64) // 32 bytes * 2 (hex)
    })

    it('should generate tokens of specified length', () => {
      const token = EncryptionManager.generateToken(16)
      expect(token.length).toBe(32) // 16 bytes * 2 (hex)
    })
  })

  describe('CSRF tokens', () => {
    it('should generate and verify CSRF tokens', () => {
      const token = EncryptionManager.generateCSRFToken()
      const isValid = EncryptionManager.verifyCSRFToken(token, token)
      
      expect(isValid).toBe(true)
      expect(token.length).toBeGreaterThan(40)
    })

    it('should reject invalid CSRF tokens', () => {
      const token1 = EncryptionManager.generateCSRFToken()
      const token2 = EncryptionManager.generateCSRFToken()
      const isValid = EncryptionManager.verifyCSRFToken(token1, token2)
      
      expect(isValid).toBe(false)
    })

    it('should handle empty tokens', () => {
      const token = EncryptionManager.generateCSRFToken()
      
      expect(EncryptionManager.verifyCSRFToken('', token)).toBe(false)
      expect(EncryptionManager.verifyCSRFToken(token, '')).toBe(false)
    })
  })
})

describe('RateLimiter', () => {
  beforeEach(() => {
    // Clear rate limiter store
    RateLimiter['store'].clear()
  })

  describe('isAllowed', () => {
    it('should allow first request', () => {
      const result = RateLimiter.isAllowed('test-key', 5, 60000)
      
      expect(result.allowed).toBe(true)
      expect(result.info.count).toBe(1)
      expect(result.info.remaining).toBe(4)
    })

    it('should track multiple requests', () => {
      RateLimiter.isAllowed('test-key', 5, 60000)
      RateLimiter.isAllowed('test-key', 5, 60000)
      const result = RateLimiter.isAllowed('test-key', 5, 60000)
      
      expect(result.allowed).toBe(true)
      expect(result.info.count).toBe(3)
      expect(result.info.remaining).toBe(2)
    })

    it('should block when limit exceeded', () => {
      // Make 5 requests (limit)
      for (let i = 0; i < 5; i++) {
        RateLimiter.isAllowed('test-key', 5, 60000)
      }
      
      // 6th request should be blocked
      const result = RateLimiter.isAllowed('test-key', 5, 60000)
      
      expect(result.allowed).toBe(false)
      expect(result.info.remaining).toBe(0)
    })

    it('should reset after window expires', () => {
      // Make requests with short window
      RateLimiter.isAllowed('test-key', 2, 10) // 10ms window
      RateLimiter.isAllowed('test-key', 2, 10)
      
      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          const result = RateLimiter.isAllowed('test-key', 2, 10)
          expect(result.allowed).toBe(true)
          expect(result.info.count).toBe(1)
          resolve(undefined)
        }, 15)
      })
    })
  })

  describe('generateKey', () => {
    it('should generate consistent keys for same request', () => {
      const mockRequest = {
        url: 'http://localhost/api/test',
        headers: new Map([
          ['x-forwarded-for', '192.168.1.1'],
          ['user-agent', 'test-agent']
        ])
      } as any

      const key1 = RateLimiter.generateKey(mockRequest)
      const key2 = RateLimiter.generateKey(mockRequest)
      
      expect(key1).toBe(key2)
    })

    it('should include identifier when provided', () => {
      const mockRequest = {
        url: 'http://localhost/api/test',
        headers: new Map()
      } as any

      const key = RateLimiter.generateKey(mockRequest, 'user123')
      expect(key).toContain('user123')
      expect(key).toContain('/api/test')
    })
  })

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      // Add entry with short expiration
      RateLimiter.isAllowed('test-key', 5, 10) // 10ms window
      
      return new Promise(resolve => {
        setTimeout(() => {
          RateLimiter.cleanup()
          const info = RateLimiter.getInfo('test-key')
          expect(info).toBeNull()
          resolve(undefined)
        }, 15)
      })
    })
  })
})

describe('SecurityHeaders', () => {
  it('should generate security headers', () => {
    const headers = SecurityHeaders.getHeaders(defaultSecurityConfig.headers)
    
    expect(headers['Strict-Transport-Security']).toBeDefined()
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-XSS-Protection']).toBe('1; mode=block')
    expect(headers['Content-Security-Policy']).toBeDefined()
    expect(headers['Permissions-Policy']).toBeDefined()
  })

  it('should respect configuration options', () => {
    const config = {
      hsts: false,
      contentTypeOptions: true,
      frameOptions: false,
      xssProtection: true,
      referrerPolicy: 'no-referrer'
    }
    
    const headers = SecurityHeaders.getHeaders(config)
    
    expect(headers['Strict-Transport-Security']).toBeUndefined()
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBeUndefined()
    expect(headers['Referrer-Policy']).toBe('no-referrer')
  })
})

describe('AuditLogger', () => {
  beforeEach(() => {
    // Clear audit logs
    AuditLogger['logs'] = []
  })

  describe('log', () => {
    it('should create audit log entry', async () => {
      const mockRequest = {
        method: 'POST',
        url: 'http://localhost/api/test',
        headers: new Map([
          ['user-agent', 'test-agent'],
          ['x-forwarded-for', '192.168.1.1']
        ])
      } as any

      await AuditLogger.log(
        'login',
        'user',
        mockRequest,
        'user123',
        true,
        undefined,
        { extra: 'data' }
      )

      const logs = AuditLogger.getLogs()
      expect(logs).toHaveLength(1)
      
      const log = logs[0]
      expect(log.action).toBe('login')
      expect(log.resource).toBe('user')
      expect(log.userId).toBe('user123')
      expect(log.method).toBe('POST')
      expect(log.success).toBe(true)
      expect(log.metadata?.extra).toBe('data')
    })

    it('should sanitize sensitive metadata', async () => {
      const mockRequest = {
        method: 'POST',
        url: 'http://localhost/api/test',
        headers: new Map()
      } as any

      await AuditLogger.log(
        'update',
        'user',
        mockRequest,
        'user123',
        true,
        undefined,
        { password: 'secret123', name: 'John' }
      )

      const logs = AuditLogger.getLogs()
      const log = logs[0]
      
      expect(log.metadata?.password).toBe('[REDACTED]')
      expect(log.metadata?.name).toBe('John')
    })
  })

  describe('getLogs', () => {
    it('should filter logs by user', async () => {
      const mockRequest = { method: 'GET', url: 'http://localhost/api/test', headers: new Map() } as any

      await AuditLogger.log('action1', 'resource', mockRequest, 'user1')
      await AuditLogger.log('action2', 'resource', mockRequest, 'user2')
      await AuditLogger.log('action3', 'resource', mockRequest, 'user1')

      const user1Logs = AuditLogger.getLogs('user1')
      expect(user1Logs).toHaveLength(2)
      expect(user1Logs.every(log => log.userId === 'user1')).toBe(true)
    })

    it('should filter logs by action', async () => {
      const mockRequest = { method: 'GET', url: 'http://localhost/api/test', headers: new Map() } as any

      await AuditLogger.log('login', 'user', mockRequest)
      await AuditLogger.log('logout', 'user', mockRequest)
      await AuditLogger.log('login', 'user', mockRequest)

      const loginLogs = AuditLogger.getLogs(undefined, 'login')
      expect(loginLogs).toHaveLength(2)
      expect(loginLogs.every(log => log.action === 'login')).toBe(true)
    })

    it('should limit returned logs', async () => {
      const mockRequest = { method: 'GET', url: 'http://localhost/api/test', headers: new Map() } as any

      for (let i = 0; i < 10; i++) {
        await AuditLogger.log(`action${i}`, 'resource', mockRequest)
      }

      const logs = AuditLogger.getLogs(undefined, undefined, undefined, undefined, 5)
      expect(logs).toHaveLength(5)
    })
  })
})

describe('InputValidator', () => {
  describe('validateBody', () => {
    it('should validate correct data', () => {
      const data = { email: 'test@example.com', password: 'Test123!@#' }
      const result = InputValidator.validateBody(data, securitySchemas.login)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('test@example.com')
      }
    })

    it('should return errors for invalid data', () => {
      const data = { email: 'invalid-email', password: '' }
      const result = InputValidator.validateBody(data, securitySchemas.login)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.email).toBeDefined()
        expect(result.errors.password).toBeDefined()
      }
    })
  })

  describe('validateFile', () => {
    it('should validate correct file', () => {
      const mockFile = {
        name: 'test.csv',
        size: 1024,
        type: 'text/csv'
      } as File

      const result = InputValidator.validateFile(mockFile)
      expect(result.valid).toBe(true)
    })

    it('should reject oversized files', () => {
      const mockFile = {
        name: 'test.csv',
        size: 20 * 1024 * 1024, // 20MB
        type: 'text/csv'
      } as File

      const result = InputValidator.validateFile(mockFile, { maxSize: 10 * 1024 * 1024 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('size exceeds')
    })

    it('should reject invalid file types', () => {
      const mockFile = {
        name: 'test.exe',
        size: 1024,
        type: 'application/x-executable'
      } as File

      const result = InputValidator.validateFile(mockFile)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('should reject invalid file extensions', () => {
      const mockFile = {
        name: 'test.exe',
        size: 1024,
        type: 'text/csv'
      } as File

      const result = InputValidator.validateFile(mockFile)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('extension')
    })
  })
})

describe('Security Schemas', () => {
  describe('passwordSchema', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'Test123!@#',
        'MySecure$Pass1',
        'Complex&Password9'
      ]

      strongPasswords.forEach(password => {
        const result = securitySchemas.register.safeParse({
          name: 'Test User',
          email: 'test@example.com',
          password
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password',      // No uppercase, numbers, or special chars
        'PASSWORD',      // No lowercase, numbers, or special chars
        'Password',      // No numbers or special chars
        'Password1',     // No special chars
        'Pass1!',        // Too short
        'a'.repeat(150)  // Too long
      ]

      weakPasswords.forEach(password => {
        const result = securitySchemas.register.safeParse({
          name: 'Test User',
          email: 'test@example.com',
          password
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ]

      validEmails.forEach(email => {
        const result = securitySchemas.login.safeParse({
          email,
          password: 'Test123!@#'
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com'
      ]

      invalidEmails.forEach(email => {
        const result = securitySchemas.login.safeParse({
          email,
          password: 'Test123!@#'
        })
        expect(result.success).toBe(false)
      })
    })
  })
})