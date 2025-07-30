import { CSVParser } from '@/lib/csv-parser'

describe('CSVParser', () => {
  describe('parseCSV', () => {
    it('should parse basic CSV content correctly', () => {
      const csvContent = `email,first_name,last_name,company
john@example.com,John,Doe,Acme Corp
jane@example.com,Jane,Smith,Tech Inc`

      const result = CSVParser.parseCSV(csvContent)

      expect(result.headers).toEqual(['email', 'first_name', 'last_name', 'company'])
      expect(result.rows).toHaveLength(2)
      expect(result.totalRows).toBe(2)
      expect(result.errors).toHaveLength(0)
      
      expect(result.rows[0]).toEqual({
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        company: 'Acme Corp'
      })
    })

    it('should handle quoted CSV values with commas', () => {
      const csvContent = `name,company,description
"John Doe","Acme, Inc","Software, Hardware"`

      const result = CSVParser.parseCSV(csvContent)

      expect(result.rows[0]).toEqual({
        name: 'John Doe',
        company: 'Acme, Inc',
        description: 'Software, Hardware'
      })
    })

    it('should handle escaped quotes in CSV', () => {
      const csvContent = `name,quote
"John ""The Great"" Doe","He said ""Hello"""`

      const result = CSVParser.parseCSV(csvContent)

      expect(result.rows[0]).toEqual({
        name: 'John "The Great" Doe',
        quote: 'He said "Hello"'
      })
    })

    it('should skip empty rows when configured', () => {
      const csvContent = `email,name
john@example.com,John

jane@example.com,Jane`

      const result = CSVParser.parseCSV(csvContent, { skipEmptyRows: true })

      expect(result.rows).toHaveLength(2)
      expect(result.totalRows).toBe(2)
    })

    it('should trim whitespace when configured', () => {
      const csvContent = `email,name
  john@example.com  ,  John  
jane@example.com,Jane`

      const result = CSVParser.parseCSV(csvContent, { trimWhitespace: true })

      expect(result.rows[0]).toEqual({
        email: 'john@example.com',
        name: 'John'
      })
    })

    it('should respect maxRows limit', () => {
      const csvContent = `email,name
john1@example.com,John1
john2@example.com,John2
john3@example.com,John3`

      const result = CSVParser.parseCSV(csvContent, { maxRows: 2 })

      expect(result.rows).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('only 2 were processed')
    })

    it('should handle different delimiters', () => {
      const csvContent = `email;name;company
john@example.com;John;Acme`

      const result = CSVParser.parseCSV(csvContent, { delimiter: ';' })

      expect(result.headers).toEqual(['email', 'name', 'company'])
      expect(result.rows[0]).toEqual({
        email: 'john@example.com',
        name: 'John',
        company: 'Acme'
      })
    })

    it('should handle malformed CSV gracefully', () => {
      const csvContent = `email,name
john@example.com,John,Extra,Field
jane@example.com`

      const result = CSVParser.parseCSV(csvContent)

      expect(result.rows).toHaveLength(2)
      expect(result.errors).toHaveLength(0) // Should not error, just handle gracefully
    })
  })

  describe('detectFieldMappings', () => {
    it('should detect common field mappings', () => {
      const headers = ['email_address', 'first_name', 'last_name', 'company_name', 'job_title']
      const mappings = CSVParser.detectFieldMappings(headers)

      const emailMapping = mappings.find(m => m.contactField === 'email')
      const firstNameMapping = mappings.find(m => m.contactField === 'first_name')
      const companyMapping = mappings.find(m => m.contactField === 'company_name')

      expect(emailMapping?.csvField).toBe('email_address')
      expect(firstNameMapping?.csvField).toBe('first_name')
      expect(companyMapping?.csvField).toBe('company_name')
    })

    it('should handle alternative field names', () => {
      const headers = ['mail', 'firstname', 'surname', 'organization']
      const mappings = CSVParser.detectFieldMappings(headers)

      const emailMapping = mappings.find(m => m.contactField === 'email')
      const firstNameMapping = mappings.find(m => m.contactField === 'first_name')
      const lastNameMapping = mappings.find(m => m.contactField === 'last_name')
      const companyMapping = mappings.find(m => m.contactField === 'company_name')

      expect(emailMapping?.csvField).toBe('mail')
      expect(firstNameMapping?.csvField).toBe('firstname')
      expect(lastNameMapping?.csvField).toBe('surname')
      expect(companyMapping?.csvField).toBe('organization')
    })

    it('should mark required fields correctly', () => {
      const headers = ['email', 'first_name', 'last_name', 'company']
      const mappings = CSVParser.detectFieldMappings(headers)

      const emailMapping = mappings.find(m => m.contactField === 'email')
      const firstNameMapping = mappings.find(m => m.contactField === 'first_name')
      const companyMapping = mappings.find(m => m.contactField === 'company_name')

      expect(emailMapping?.required).toBe(true)
      expect(firstNameMapping?.required).toBe(true)
      expect(companyMapping?.required).toBe(false)
    })
  })

  describe('validateFieldMappings', () => {
    it('should validate required field mappings', () => {
      const mappings = [
        { csvField: 'email', contactField: 'email', required: true },
        { csvField: '', contactField: 'first_name', required: true },
        { csvField: 'last_name', contactField: 'last_name', required: true }
      ]

      const errors = CSVParser.validateFieldMappings(mappings)

      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('First Name')
    })

    it('should detect duplicate CSV field mappings', () => {
      const mappings = [
        { csvField: 'name', contactField: 'first_name', required: true },
        { csvField: 'name', contactField: 'last_name', required: true },
        { csvField: 'email', contactField: 'email', required: true }
      ]

      const errors = CSVParser.validateFieldMappings(mappings)

      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('mapped to multiple')
    })

    it('should pass validation for correct mappings', () => {
      const mappings = [
        { csvField: 'email', contactField: 'email', required: true },
        { csvField: 'first_name', contactField: 'first_name', required: true },
        { csvField: 'last_name', contactField: 'last_name', required: true },
        { csvField: 'company', contactField: 'company_name', required: false }
      ]

      const errors = CSVParser.validateFieldMappings(mappings)

      expect(errors).toHaveLength(0)
    })
  })

  describe('transformRowsToContacts', () => {
    it('should transform CSV rows to contact objects', () => {
      const rows = [
        {
          email: 'john@example.com',
          first_name: 'John',
          last_name: 'Doe',
          company: 'Acme Corp',
          extra_field: 'Extra Data'
        }
      ]

      const mappings = [
        { csvField: 'email', contactField: 'email', required: true },
        { csvField: 'first_name', contactField: 'first_name', required: true },
        { csvField: 'last_name', contactField: 'last_name', required: true },
        { csvField: 'company', contactField: 'company_name', required: false }
      ]

      const results = CSVParser.transformRowsToContacts(rows, mappings)

      expect(results).toHaveLength(1)
      expect(results[0].contact).toEqual({
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Acme Corp',
        custom_fields: {
          extra_field: 'Extra Data'
        },
        tags: []
      })
      expect(results[0].errors).toHaveLength(0)
    })

    it('should validate required fields', () => {
      const rows = [
        {
          email: 'john@example.com',
          first_name: 'John'
          // Missing last_name
        }
      ]

      const mappings = [
        { csvField: 'email', contactField: 'email', required: true },
        { csvField: 'first_name', contactField: 'first_name', required: true },
        { csvField: 'last_name', contactField: 'last_name', required: true }
      ]

      const results = CSVParser.transformRowsToContacts(rows, mappings)

      expect(results[0].errors).toHaveLength(1)
      expect(results[0].errors[0]).toContain('Missing required field')
    })

    it('should validate email format', () => {
      const rows = [
        {
          email: 'invalid-email',
          first_name: 'John',
          last_name: 'Doe'
        }
      ]

      const mappings = [
        { csvField: 'email', contactField: 'email', required: true },
        { csvField: 'first_name', contactField: 'first_name', required: true },
        { csvField: 'last_name', contactField: 'last_name', required: true }
      ]

      const results = CSVParser.transformRowsToContacts(rows, mappings)

      expect(results[0].errors).toHaveLength(1)
      expect(results[0].errors[0]).toContain('Invalid email format')
    })

    it('should validate website URLs', () => {
      const rows = [
        {
          email: 'john@example.com',
          first_name: 'John',
          last_name: 'Doe',
          website: 'not-a-url'
        }
      ]

      const mappings = [
        { csvField: 'email', contactField: 'email', required: true },
        { csvField: 'first_name', contactField: 'first_name', required: true },
        { csvField: 'last_name', contactField: 'last_name', required: true },
        { csvField: 'website', contactField: 'website', required: false }
      ]

      const results = CSVParser.transformRowsToContacts(rows, mappings)

      expect(results[0].errors).toHaveLength(1)
      expect(results[0].errors[0]).toContain('Invalid website URL')
    })
  })

  describe('detectDelimiter', () => {
    it('should detect comma delimiter', () => {
      const csvContent = 'email,name,company\njohn@example.com,John,Acme'
      const delimiter = CSVParser.detectDelimiter(csvContent)
      expect(delimiter).toBe(',')
    })

    it('should detect semicolon delimiter', () => {
      const csvContent = 'email;name;company\njohn@example.com;John;Acme'
      const delimiter = CSVParser.detectDelimiter(csvContent)
      expect(delimiter).toBe(';')
    })

    it('should detect tab delimiter', () => {
      const csvContent = 'email\tname\tcompany\njohn@example.com\tJohn\tAcme'
      const delimiter = CSVParser.detectDelimiter(csvContent)
      expect(delimiter).toBe('\t')
    })

    it('should default to comma for ambiguous cases', () => {
      const csvContent = 'email name company'
      const delimiter = CSVParser.detectDelimiter(csvContent)
      expect(delimiter).toBe(',')
    })
  })

  describe('getSampleData', () => {
    it('should return sample data with specified size', () => {
      const rows = [
        { email: 'john1@example.com', name: 'John1' },
        { email: 'john2@example.com', name: 'John2' },
        { email: 'john3@example.com', name: 'John3' },
        { email: 'john4@example.com', name: 'John4' },
        { email: 'john5@example.com', name: 'John5' }
      ]

      const sample = CSVParser.getSampleData(rows, 3)

      expect(sample).toHaveLength(3)
      expect(sample[0].email).toBe('john1@example.com')
      expect(sample[2].email).toBe('john3@example.com')
    })

    it('should return all rows if sample size is larger', () => {
      const rows = [
        { email: 'john1@example.com', name: 'John1' },
        { email: 'john2@example.com', name: 'John2' }
      ]

      const sample = CSVParser.getSampleData(rows, 5)

      expect(sample).toHaveLength(2)
    })
  })

  describe('getProcessingStats', () => {
    it('should calculate processing statistics correctly', () => {
      const transformResults = [
        { contact: {}, rowIndex: 0, errors: [] },
        { contact: {}, rowIndex: 1, errors: ['Invalid email'] },
        { contact: {}, rowIndex: 2, errors: [] },
        { contact: {}, rowIndex: 3, errors: ['Missing name', 'Invalid email'] }
      ]

      const stats = CSVParser.getProcessingStats(transformResults)

      expect(stats.total).toBe(4)
      expect(stats.valid).toBe(2)
      expect(stats.invalid).toBe(2)
      expect(stats.withErrors).toBe(2)
      expect(stats.commonErrors.get('Invalid email')).toBe(2)
      expect(stats.commonErrors.get('Missing name')).toBe(1)
    })
  })
})