import { updateContactSchema } from '@/lib/validations'

describe('updateContactSchema', () => {
  it('should accept valid contact data', () => {
    const validData = {
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      company: 'Acme Corp',
      website: 'https://example.com'
    }
    
    const result = updateContactSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should accept empty string values and convert to undefined', () => {
    const dataWithEmptyStrings = {
      email: 'john@example.com',
      first_name: '',
      last_name: '',
      company: '',
      website: '',
      sex: ''
    }
    
    const result = updateContactSchema.safeParse(dataWithEmptyStrings)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.first_name).toBeUndefined()
      expect(result.data.website).toBeUndefined()
    }
  })

  it('should handle domain names without protocol', () => {
    const dataWithDomain = {
      email: 'john@example.com',
      website: 'example.com'
    }
    
    const result = updateContactSchema.safeParse(dataWithDomain)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.website).toBe('https://example.com')
    }
  })

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email'
    }
    
    const result = updateContactSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  it('should accept valid sex values', () => {
    const maleData = { email: 'test@example.com', sex: 'm' }
    const femaleData = { email: 'test@example.com', sex: 'f' }
    
    expect(updateContactSchema.safeParse(maleData).success).toBe(true)
    expect(updateContactSchema.safeParse(femaleData).success).toBe(true)
  })
})