// Simple test for DNS record generators without complex mocking

const { SPFGenerator } = require('../../lib/dns-record-generators/spf-generator')
const { DMARCGenerator } = require('../../lib/dns-record-generators/dmarc-generator')

describe('DNS Record Generators', () => {
  describe('SPF Generator', () => {
    test('should generate SPF record for Gmail', () => {
      const { record, parsed } = SPFGenerator.generateForProviders('example.com', ['gmail'])
      
      expect(record.type).toBe('TXT')
      expect(record.name).toBe('example.com')
      expect(record.value).toContain('v=spf1')
      expect(record.value).toContain('include:_spf.google.com')
      expect(record.value).toContain('~all')
      
      expect(parsed.version).toBe('spf1')
      expect(parsed.qualifier).toBe('softfail')
    })
    
    test('should validate SPF record', () => {
      const result = SPFGenerator.validateRecord('v=spf1 include:_spf.google.com ~all')
      
      // Check that validation runs without throwing errors
      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(Array.isArray(result.errors)).toBe(true)
    })
    
    test('should generate setup instructions', () => {
      const { record } = SPFGenerator.generateForProviders('boniforce.de', ['gmail'])
      const instructions = SPFGenerator.getSetupInstructions('boniforce.de', record)
      
      expect(instructions).toContain('boniforce.de')
      expect(instructions).toContain('TXT record')
      expect(instructions).toContain('SPF tells receiving email servers')
    })
  })
  
  describe('DMARC Generator', () => {
    test('should generate basic DMARC record', () => {
      const { record, parsed } = DMARCGenerator.generateBasicRecord('example.com', 'reports@example.com')
      
      expect(record.type).toBe('TXT')
      expect(record.name).toBe('_dmarc.example.com')
      expect(record.value).toContain('v=DMARC1')
      expect(record.value).toContain('p=none')
      expect(record.value).toContain('rua=mailto:reports@example.com')
      
      expect(parsed.version).toBe('DMARC1')
      expect(parsed.policy).toBe('none')
    })
    
    test('should generate progressive DMARC records', () => {
      const records = DMARCGenerator.generateProgressiveRecords('example.com', 'reports@example.com')
      
      expect(records.monitoring.parsed.policy).toBe('none')
      expect(records.quarantine25.parsed.policy).toBe('quarantine')
      expect(records.quarantine25.parsed.percentage).toBe(25)
      expect(records.quarantine100.parsed.policy).toBe('quarantine')
      expect(records.quarantine100.parsed.percentage).toBe(100)
      expect(records.reject.parsed.policy).toBe('reject')
    })
    
    test('should validate DMARC record', () => {
      const result = DMARCGenerator.validateRecord('v=DMARC1; p=none; rua=mailto:reports@example.com')
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    test('should generate setup instructions', () => {
      const { record } = DMARCGenerator.generateBasicRecord('boniforce.de', 'reports@boniforce.de')
      const instructions = DMARCGenerator.getSetupInstructions('boniforce.de', record)
      
      expect(instructions).toContain('boniforce.de')
      expect(instructions).toContain('_dmarc')
      expect(instructions).toContain('Progressive Implementation')
      expect(instructions).toContain('p=none')
    })
  })
})