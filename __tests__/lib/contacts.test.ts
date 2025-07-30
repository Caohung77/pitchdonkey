import { ContactService } from '@/lib/contacts'
import { EmailValidationService } from '@/lib/email-validation'

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
  })),
  auth: {
    getUser: jest.fn(),
  },
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: jest.fn(() => mockSupabase),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

// Mock EmailValidationService
jest.mock('@/lib/email-validation')
const mockEmailValidationService = EmailValidationService as jest.Mocked<typeof EmailValidationService>

describe('ContactService', () => {
  let contactService: ContactService
  const userId = 'test-user-id'

  beforeEach(() => {
    jest.clearAllMocks()
    contactService = new ContactService()
  })

  describe('validateContactData', () => {
    it('should validate valid contact data', () => {
      const validContact = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Test Company',
        job_title: 'Developer',
      }

      expect(() => contactService.validateContactData(validContact)).not.toThrow()
    })

    it('should throw error for invalid email', () => {
      const invalidContact = {
        email: 'invalid-email',
        first_name: 'John',
        last_name: 'Doe',
      }

      expect(() => contactService.validateContactData(invalidContact)).toThrow('Validation failed')
    })

    it('should throw error for missing required fields', () => {
      const invalidContact = {
        email: 'test@example.com',
        // Missing first_name and last_name
      }

      expect(() => contactService.validateContactData(invalidContact)).toThrow('Validation failed')
    })

    it('should validate optional fields correctly', () => {
      const contactWithOptionalFields = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        website: 'https://example.com',
        custom_fields: { role: 'manager' },
        tags: ['lead', 'important'],
      }

      expect(() => contactService.validateContactData(contactWithOptionalFields)).not.toThrow()
    })
  })

  describe('findDuplicateContact', () => {
    it('should find duplicate contact by email', async () => {
      const mockContact = {
        id: 'existing-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      }

      mockSupabase.from().select().eq().eq().neq().single.mockResolvedValue({
        data: mockContact,
        error: null,
      })

      mockEmailValidationService.normalizeEmail.mockReturnValue('test@example.com')

      const result = await contactService.findDuplicateContact(userId, 'test@example.com')

      expect(result).toEqual(mockContact)
      expect(mockSupabase.from).toHaveBeenCalledWith('contacts')
    })

    it('should return null when no duplicate found', async () => {
      mockSupabase.from().select().eq().eq().neq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found error
      })

      mockEmailValidationService.normalizeEmail.mockReturnValue('test@example.com')

      const result = await contactService.findDuplicateContact(userId, 'test@example.com')

      expect(result).toBeNull()
    })

    it('should exclude specific contact ID when checking duplicates', async () => {
      const excludeId = 'exclude-this-id'
      
      mockSupabase.from().select().eq().eq().neq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      mockEmailValidationService.normalizeEmail.mockReturnValue('test@example.com')

      await contactService.findDuplicateContact(userId, 'test@example.com', excludeId)

      expect(mockSupabase.from().neq).toHaveBeenCalledWith('id', excludeId)
    })
  })

  describe('createContact', () => {
    it('should create contact with valid data', async () => {
      const contactData = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Test Company',
      }

      const mockCreatedContact = {
        id: 'new-contact-id',
        user_id: userId,
        ...contactData,
        status: 'active',
        email_status: 'valid',
      }

      // Mock no duplicate found
      mockSupabase.from().select().eq().eq().neq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      // Mock email validation
      mockEmailValidationService.validateEmail.mockResolvedValue({
        email: 'test@example.com',
        isValid: true,
        status: 'valid',
        deliverable: true,
      })

      mockEmailValidationService.normalizeEmail.mockReturnValue('test@example.com')

      // Mock successful insert
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockCreatedContact,
        error: null,
      })

      const result = await contactService.createContact(userId, contactData)

      expect(result).toEqual(mockCreatedContact)
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          status: 'active',
          email_status: 'valid',
        })
      )
    })

    it('should throw error when duplicate contact exists', async () => {
      const contactData = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      }

      // Mock duplicate found
      mockSupabase.from().select().eq().eq().neq().single.mockResolvedValue({
        data: { id: 'existing-id', email: 'test@example.com' },
        error: null,
      })

      mockEmailValidationService.normalizeEmail.mockReturnValue('test@example.com')

      await expect(contactService.createContact(userId, contactData)).rejects.toThrow(
        'Contact with email test@example.com already exists'
      )
    })

    it('should handle email validation failure gracefully', async () => {
      const contactData = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      }

      // Mock no duplicate found
      mockSupabase.from().select().eq().eq().neq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      // Mock email validation failure
      mockEmailValidationService.validateEmail.mockRejectedValue(new Error('Validation service unavailable'))
      mockEmailValidationService.normalizeEmail.mockReturnValue('test@example.com')

      // Mock successful insert
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { ...contactData, email_status: 'unknown' },
        error: null,
      })

      const result = await contactService.createContact(userId, contactData)

      expect(result.email_status).toBe('unknown')
    })
  })

  describe('validateContactEmails', () => {
    it('should validate multiple contact emails', async () => {
      const contacts = [
        { email: 'valid@example.com', first_name: 'John', last_name: 'Doe' },
        { email: 'invalid@invalid', first_name: 'Jane', last_name: 'Smith' },
        { email: 'risky@role.com', first_name: 'Bob', last_name: 'Johnson' },
      ]

      mockEmailValidationService.validateEmails.mockResolvedValue({
        results: [
          { email: 'valid@example.com', isValid: true, status: 'valid' },
          { email: 'invalid@invalid', isValid: false, status: 'invalid' },
          { email: 'risky@role.com', isValid: true, status: 'risky' },
        ],
        summary: { total: 3, valid: 1, invalid: 1, risky: 1, unknown: 0 },
      })

      const result = await contactService.validateContactEmails(contacts)

      expect(result.summary).toEqual({
        total: 3,
        valid: 1,
        invalid: 1,
        risky: 1,
      })

      expect(result.results).toHaveLength(3)
      expect(result.results[0].isValid).toBe(true)
      expect(result.results[1].isValid).toBe(false)
      expect(result.results[2].isValid).toBe(true)
    })
  })

  describe('mergeDuplicateContacts', () => {
    it('should merge two contacts correctly', async () => {
      const primaryContact = {
        id: 'primary-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Primary Company',
        tags: ['tag1'],
        custom_fields: { field1: 'value1' },
        created_at: '2023-01-01T00:00:00Z',
      }

      const duplicateContact = {
        id: 'duplicate-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        job_title: 'Developer', // This should be merged
        tags: ['tag2'],
        custom_fields: { field2: 'value2' },
        created_at: '2023-01-02T00:00:00Z',
      }

      // Mock getting both contacts
      mockSupabase.from().select().eq().eq().neq().single
        .mockResolvedValueOnce({ data: primaryContact, error: null })
        .mockResolvedValueOnce({ data: duplicateContact, error: null })

      // Mock update and delete operations
      mockSupabase.from().update().eq().eq().select().single.mockResolvedValue({
        data: { ...primaryContact, job_title: 'Developer' },
        error: null,
      })

      mockSupabase.from().update().eq().eq.mockResolvedValue({ error: null })

      const result = await contactService.mergeDuplicateContacts(userId, 'primary-id', 'duplicate-id')

      expect(result.tags).toEqual(['tag1', 'tag2'])
      expect(result.custom_fields).toEqual({ field1: 'value1', field2: 'value2' })
      expect(result.job_title).toBe('Developer')
      expect(result.created_at).toBe('2023-01-01T00:00:00Z') // Earlier date
    })
  })
})