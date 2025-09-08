import { parseCompanyName, parseCompanyData } from '@/lib/contact-utils'

describe('contact-utils', () => {
  describe('parseCompanyName', () => {
    it('should return null for null, undefined or empty input', () => {
      expect(parseCompanyName(null)).toBeNull()
      expect(parseCompanyName(undefined)).toBeNull()
      expect(parseCompanyName('')).toBeNull()
      expect(parseCompanyName('   ')).toBeNull()
    })

    it('should return plain string as is', () => {
      expect(parseCompanyName('DMG MORI Bielefeld GmbH')).toBe('DMG MORI Bielefeld GmbH')
      expect(parseCompanyName('Google Inc')).toBe('Google Inc')
    })

    it('should parse JSON string and extract name', () => {
      const jsonCompany = '{"name":"DMG MORI Bielefeld GmbH","location":"Germany"}'
      expect(parseCompanyName(jsonCompany)).toBe('DMG MORI Bielefeld GmbH')
    })

    it('should parse JSON string with null location', () => {
      const jsonCompany = '{"name":"DMG MORI Bielefeld GmbH","location":null}'
      expect(parseCompanyName(jsonCompany)).toBe('DMG MORI Bielefeld GmbH')
    })

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"name":"DMG MORI Bielefeld GmbH","location":null'
      expect(parseCompanyName(malformedJson)).toBe(malformedJson)
    })

    it('should handle JSON without name field', () => {
      const jsonWithoutName = '{"location":"Germany","industry":"Manufacturing"}'
      expect(parseCompanyName(jsonWithoutName)).toBe(jsonWithoutName)
    })
  })

  describe('parseCompanyData', () => {
    it('should return null values for null or undefined input', () => {
      expect(parseCompanyData(null)).toEqual({ name: null, location: null })
      expect(parseCompanyData(undefined)).toEqual({ name: null, location: null })
    })

    it('should return name and null location for plain string', () => {
      expect(parseCompanyData('DMG MORI Bielefeld GmbH')).toEqual({
        name: 'DMG MORI Bielefeld GmbH',
        location: null
      })
    })

    it('should parse JSON string and extract name and location', () => {
      const jsonCompany = '{"name":"DMG MORI Bielefeld GmbH","location":"Germany"}'
      expect(parseCompanyData(jsonCompany)).toEqual({
        name: 'DMG MORI Bielefeld GmbH',
        location: 'Germany'
      })
    })

    it('should parse JSON string with null location', () => {
      const jsonCompany = '{"name":"DMG MORI Bielefeld GmbH","location":null}'
      expect(parseCompanyData(jsonCompany)).toEqual({
        name: 'DMG MORI Bielefeld GmbH',
        location: null
      })
    })

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"name":"DMG MORI Bielefeld GmbH","location":null'
      expect(parseCompanyData(malformedJson)).toEqual({
        name: malformedJson,
        location: null
      })
    })
  })
})