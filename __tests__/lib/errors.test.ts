import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  NetworkError,
  BusinessLogicError,
  ErrorHandler,
  ErrorType,
  ErrorSeverity,
  isRetryableError,
  getErrorSeverity
} from '../../lib/errors'

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create basic AppError with defaults', () => {
      const error = new AppError('Test error')
      
      expect(error.message).toBe('Test error')
      expect(error.type).toBe(ErrorType.UNKNOWN)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.statusCode).toBe(500)
      expect(error.userMessage).toBe('An unexpected error occurred')
      expect(error.isRetryable).toBe(false)
      expect(error.recoveryActions).toEqual([])
      expect(error.code).toMatch(/UNKNOWN_\d+/)
    })

    it('should create AppError with custom properties', () => {
      const context = { userId: 'user123', endpoint: '/api/test' }
      const recoveryActions = [{ type: 'retry' as const, label: 'Retry' }]
      
      const error = new AppError(
        'Custom error',
        ErrorType.VALIDATION,
        ErrorSeverity.HIGH,
        'CUSTOM_001',
        400,
        'Custom user message',
        context,
        recoveryActions,
        true
      )
      
      expect(error.message).toBe('Custom error')
      expect(error.type).toBe(ErrorType.VALIDATION)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.code).toBe('CUSTOM_001')
      expect(error.statusCode).toBe(400)
      expect(error.userMessage).toBe('Custom user message')
      expect(error.context).toMatchObject(context)
      expect(error.recoveryActions).toEqual(recoveryActions)
      expect(error.isRetryable).toBe(true)
    })

    it('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', ErrorType.DATABASE)
      const json = error.toJSON()
      
      expect(json).toMatchObject({
        name: 'AppError',
        message: 'Test error',
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        statusCode: 500,
        userMessage: 'Database error occurred. Please try again',
        isRetryable: false
      })
      expect(json.timestamp).toBeDefined()
      expect(json.code).toBeDefined()
    })
  })

  describe('Specific Error Classes', () => {
    it('should create AuthenticationError correctly', () => {
      const error = new AuthenticationError('Invalid token')
      
      expect(error.message).toBe('Invalid token')
      expect(error.type).toBe(ErrorType.AUTHENTICATION)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.statusCode).toBe(401)
      expect(error.userMessage).toBe('Please sign in to continue')
      expect(error.recoveryActions).toHaveLength(1)
      expect(error.recoveryActions[0].url).toBe('/auth/signin')
    })

    it('should create AuthorizationError correctly', () => {
      const error = new AuthorizationError('Insufficient permissions')
      
      expect(error.message).toBe('Insufficient permissions')
      expect(error.type).toBe(ErrorType.AUTHORIZATION)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.statusCode).toBe(403)
      expect(error.userMessage).toBe('You don\'t have permission to perform this action')
    })

    it('should create ValidationError correctly', () => {
      const validationErrors = { email: 'Invalid email format' }
      const error = new ValidationError('Validation failed', validationErrors)
      
      expect(error.message).toBe('Validation failed')
      expect(error.type).toBe(ErrorType.VALIDATION)
      expect(error.severity).toBe(ErrorSeverity.LOW)
      expect(error.statusCode).toBe(400)
      expect(error.context.validationErrors).toEqual(validationErrors)
    })

    it('should create NotFoundError correctly', () => {
      const error = new NotFoundError('Campaign')
      
      expect(error.message).toBe('Campaign not found')
      expect(error.type).toBe(ErrorType.NOT_FOUND)
      expect(error.statusCode).toBe(404)
    })

    it('should create RateLimitError correctly', () => {
      const error = new RateLimitError('Too many requests', 120)
      
      expect(error.message).toBe('Too many requests')
      expect(error.type).toBe(ErrorType.RATE_LIMIT)
      expect(error.statusCode).toBe(429)
      expect(error.isRetryable).toBe(true)
      expect(error.context.retryAfter).toBe(120)
      expect(error.userMessage).toContain('120 seconds')
    })

    it('should create ExternalServiceError correctly', () => {
      const error = new ExternalServiceError('OpenAI', 'API timeout')
      
      expect(error.message).toBe('OpenAI: API timeout')
      expect(error.type).toBe(ErrorType.EXTERNAL_SERVICE)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.statusCode).toBe(502)
      expect(error.isRetryable).toBe(true)
      expect(error.context.service).toBe('OpenAI')
    })

    it('should create DatabaseError correctly', () => {
      const error = new DatabaseError('Connection timeout')
      
      expect(error.message).toBe('Connection timeout')
      expect(error.type).toBe(ErrorType.DATABASE)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.isRetryable).toBe(true)
    })

    it('should create NetworkError correctly', () => {
      const error = new NetworkError('Fetch failed')
      
      expect(error.message).toBe('Fetch failed')
      expect(error.type).toBe(ErrorType.NETWORK)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.statusCode).toBe(0)
      expect(error.isRetryable).toBe(true)
    })

    it('should create BusinessLogicError correctly', () => {
      const error = new BusinessLogicError(
        'Campaign limit exceeded',
        'You have reached your campaign limit'
      )
      
      expect(error.message).toBe('Campaign limit exceeded')
      expect(error.type).toBe(ErrorType.BUSINESS_LOGIC)
      expect(error.userMessage).toBe('You have reached your campaign limit')
      expect(error.statusCode).toBe(400)
    })
  })
})

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler
  let mockLogger: any
  let mockMonitoring: any

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn()
    }
    mockMonitoring = {
      captureException: jest.fn()
    }
    errorHandler = new ErrorHandler(mockLogger, mockMonitoring)
  })

  describe('handleError', () => {
    it('should handle AppError correctly', async () => {
      const originalError = new ValidationError('Test validation error')
      const context = { userId: 'user123' }
      
      const handledError = await errorHandler.handleError(originalError, context)
      
      expect(handledError).toBe(originalError)
      expect(handledError.context.userId).toBe('user123')
      expect(mockLogger.warn).toHaveBeenCalledWith('Application Error', expect.any(Object))
      expect(mockMonitoring.captureException).toHaveBeenCalledWith(
        originalError,
        expect.objectContaining({
          tags: {
            errorType: ErrorType.VALIDATION,
            severity: ErrorSeverity.LOW,
            code: originalError.code
          }
        })
      )
    })

    it('should convert generic Error to AppError', async () => {
      const genericError = new Error('Database connection failed')
      
      const handledError = await errorHandler.handleError(genericError)
      
      expect(handledError).toBeInstanceOf(AppError)
      expect(handledError.type).toBe(ErrorType.DATABASE)
      expect(handledError.severity).toBe(ErrorSeverity.HIGH)
      expect(handledError.isRetryable).toBe(true)
    })

    it('should classify network errors correctly', async () => {
      const networkError = new Error('fetch failed')
      
      const handledError = await errorHandler.handleError(networkError)
      
      expect(handledError.type).toBe(ErrorType.NETWORK)
      expect(handledError.isRetryable).toBe(true)
    })

    it('should classify authentication errors correctly', async () => {
      const authError = new Error('unauthorized access')
      
      const handledError = await errorHandler.handleError(authError)
      
      expect(handledError.type).toBe(ErrorType.AUTHENTICATION)
      expect(handledError.statusCode).toBe(401)
    })

    it('should log critical errors with error level', async () => {
      const criticalError = new AppError(
        'System failure',
        ErrorType.SYSTEM,
        ErrorSeverity.CRITICAL
      )
      
      await errorHandler.handleError(criticalError)
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical Application Error',
        expect.any(Object)
      )
    })
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success')
      
      const result = await errorHandler.withRetry(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Connection failed'))
        .mockResolvedValue('success')
      
      const result = await errorHandler.withRetry(operation, {
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: [ErrorType.NETWORK]
      })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new ValidationError('Invalid input'))
      
      await expect(errorHandler.withRetry(operation, {
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: [ErrorType.NETWORK]
      })).rejects.toThrow('Invalid input')
      
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should exhaust all retry attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new NetworkError('Connection failed'))
      
      await expect(errorHandler.withRetry(operation, {
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: [ErrorType.NETWORK]
      })).rejects.toThrow('Connection failed')
      
      expect(operation).toHaveBeenCalledTimes(3)
    })
  })

  describe('createErrorResponse', () => {
    it('should create proper error response', () => {
      const error = new ValidationError('Invalid email', { email: 'Required' })
      
      const response = errorHandler.createErrorResponse(error)
      
      expect(response).toMatchObject({
        error: {
          type: ErrorType.VALIDATION,
          code: error.code,
          message: 'Please check your input and try again',
          details: 'Invalid email',
          recoveryActions: error.recoveryActions,
          timestamp: error.timestamp
        }
      })
    })
  })
})

describe('Utility Functions', () => {
  describe('isRetryableError', () => {
    it('should identify retryable AppErrors', () => {
      const retryableError = new NetworkError('Connection failed')
      const nonRetryableError = new ValidationError('Invalid input')
      
      expect(isRetryableError(retryableError)).toBe(true)
      expect(isRetryableError(nonRetryableError)).toBe(false)
    })

    it('should identify retryable generic errors', () => {
      const networkError = new Error('network timeout')
      const validationError = new Error('invalid format')
      
      expect(isRetryableError(networkError)).toBe(true)
      expect(isRetryableError(validationError)).toBe(false)
    })
  })

  describe('getErrorSeverity', () => {
    it('should return severity for AppErrors', () => {
      const highSeverityError = new AuthenticationError()
      const lowSeverityError = new ValidationError('Invalid')
      
      expect(getErrorSeverity(highSeverityError)).toBe(ErrorSeverity.HIGH)
      expect(getErrorSeverity(lowSeverityError)).toBe(ErrorSeverity.LOW)
    })

    it('should classify generic errors by message', () => {
      const criticalError = new Error('critical system failure')
      const authError = new Error('authentication failed')
      const validationError = new Error('validation error')
      const genericError = new Error('something went wrong')
      
      expect(getErrorSeverity(criticalError)).toBe(ErrorSeverity.CRITICAL)
      expect(getErrorSeverity(authError)).toBe(ErrorSeverity.HIGH)
      expect(getErrorSeverity(validationError)).toBe(ErrorSeverity.LOW)
      expect(getErrorSeverity(genericError)).toBe(ErrorSeverity.MEDIUM)
    })
  })
})