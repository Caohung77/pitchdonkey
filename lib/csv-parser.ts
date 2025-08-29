import { AddressParser, ParsedAddress } from './address-parser'

interface CSVParseResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  errors: Array<{
    row: number
    error: string
  }>
}

interface FieldMapping {
  csvField: string
  contactField: string
  required: boolean
  confidence?: number
  example?: string
}

interface CSVProcessingOptions {
  delimiter?: string
  skipEmptyRows?: boolean
  trimWhitespace?: boolean
  maxRows?: number
}

export class CSVParser {
  private static readonly CONTACT_FIELDS = {
    email: { required: true, label: 'Email Address' },
    first_name: { required: false, label: 'First Name' },
    last_name: { required: false, label: 'Last Name' },
    company: { required: false, label: 'Company Name' },
    position: { required: false, label: 'Position' },
    website: { required: false, label: 'Website' },
    phone: { required: false, label: 'Phone Number' },
    linkedin_url: { required: false, label: 'LinkedIn URL' },
    twitter_url: { required: false, label: 'Twitter URL' },
    address: { required: false, label: 'Address' },
    postcode: { required: false, label: 'Postcode/Zip Code' },
    country: { required: false, label: 'Country' },
    city: { required: false, label: 'City' },
    timezone: { required: false, label: 'Timezone' },
    source: { required: false, label: 'Source' }
  }

  private static readonly FIELD_ALIASES = {
    email: ['email', 'email_address', 'e-mail', 'mail', 'contact_email'],
    first_name: ['first_name', 'firstname', 'first', 'fname', 'given_name'],
    last_name: ['last_name', 'lastname', 'last', 'lname', 'surname', 'family_name'],
    company: ['company', 'company_name', 'organization', 'org', 'business'],
    position: ['position', 'job_title', 'title', 'role', 'job'],
    website: ['website', 'url', 'web', 'site', 'homepage'],
    phone: ['phone', 'phone_number', 'tel', 'telephone', 'mobile', 'cell'],
    linkedin_url: ['linkedin_url', 'linkedin', 'linkedin_profile', 'li_url'],
    twitter_url: ['twitter_url', 'twitter', 'twitter_profile', 'twitter_handle'],
    address: ['address', 'street_address', 'street', 'location_address', 'addr'],
    postcode: ['postcode', 'postal_code', 'zip_code', 'zip', 'postal'],
    country: ['country', 'nation', 'location_country'],
    city: ['city', 'location', 'location_city'],
    timezone: ['timezone', 'tz', 'time_zone'],
    source: ['source', 'import_source', 'data_source']
  }

  /**
   * Parse CSV content and return structured data
   */
  static parseCSV(csvContent: string, options: CSVProcessingOptions = {}): CSVParseResult {
    const {
      delimiter = ',',
      skipEmptyRows = true,
      trimWhitespace = true,
      maxRows = 10000
    } = options

    const result: CSVParseResult = {
      headers: [],
      rows: [],
      totalRows: 0,
      errors: []
    }

    try {
      // Split content into lines
      const lines = csvContent.split(/\r?\n/)
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty')
      }

      // Parse headers
      const headerLine = lines[0]
      if (!headerLine.trim()) {
        throw new Error('CSV file has no headers')
      }

      result.headers = this.parseCSVLine(headerLine, delimiter)
        .map(header => trimWhitespace ? header.trim() : header)
        .filter(header => header.length > 0)

      if (result.headers.length === 0) {
        throw new Error('No valid headers found in CSV')
      }

      // Parse data rows
      for (let i = 1; i < lines.length && result.rows.length < maxRows; i++) {
        const line = lines[i]
        
        // Skip empty rows if configured
        if (skipEmptyRows && !line.trim()) {
          continue
        }

        try {
          const values = this.parseCSVLine(line, delimiter)
          
          // Skip rows that are completely empty
          if (values.every(val => !val.trim())) {
            continue
          }

          // Create row object
          const row: Record<string, string> = {}
          result.headers.forEach((header, index) => {
            const value = values[index] || ''
            row[header] = trimWhitespace ? value.trim() : value
          })

          result.rows.push(row)
          result.totalRows++

        } catch (error) {
          result.errors.push({
            row: i + 1,
            error: error instanceof Error ? error.message : 'Failed to parse row'
          })
        }
      }

      // Check if we hit the max rows limit
      if (lines.length - 1 > maxRows) {
        result.errors.push({
          row: 0,
          error: `CSV file has ${lines.length - 1} rows, but only ${maxRows} were processed`
        })
      }

    } catch (error) {
      result.errors.push({
        row: 0,
        error: error instanceof Error ? error.message : 'Failed to parse CSV'
      })
    }

    return result
  }

  /**
   * Parse a single CSV line handling quoted values and escaped quotes
   */
  private static parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i += 2
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
          i++
        }
      } else if (char === delimiter && !inQuotes) {
        // Field separator
        result.push(current)
        current = ''
        i++
      } else {
        // Regular character
        current += char
        i++
      }
    }

    // Add the last field
    result.push(current)

    return result
  }

  /**
   * Automatically detect field mappings based on header names with confidence scoring
   */
  static detectFieldMappings(headers: string[]): FieldMapping[] {
    const mappings: FieldMapping[] = []
    const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'))
    const usedHeaders = new Set<string>()

    // Try to map each contact field
    Object.entries(this.CONTACT_FIELDS).forEach(([contactField, config]) => {
      const aliases = this.FIELD_ALIASES[contactField as keyof typeof this.FIELD_ALIASES] || []
      let bestMatch = { header: '', index: -1, confidence: 0 }

      // Calculate confidence for each header
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (usedHeaders.has(headers[i])) continue // Skip already used headers
        
        const normalizedHeader = normalizedHeaders[i]
        let confidence = 0

        // Exact match - highest confidence
        if (aliases.includes(normalizedHeader)) {
          confidence = 1.0
        } else {
          // Partial match scoring
          for (const alias of aliases) {
            if (normalizedHeader.includes(alias)) {
              // Header contains alias (e.g., "contact_email" contains "email")
              confidence = Math.max(confidence, 0.8)
            } else if (alias.includes(normalizedHeader)) {
              // Alias contains header (e.g., "email" contains "mail")
              confidence = Math.max(confidence, 0.6)
            } else {
              // Levenshtein-like similarity
              const similarity = this.calculateSimilarity(normalizedHeader, alias)
              if (similarity > 0.7) {
                confidence = Math.max(confidence, similarity * 0.7)
              }
            }
          }
        }

        if (confidence > bestMatch.confidence) {
          bestMatch = { header: headers[i], index: i, confidence }
        }
      }

      // Only use matches with reasonable confidence
      if (bestMatch.confidence > 0.3) {
        usedHeaders.add(bestMatch.header)
        mappings.push({
          csvField: bestMatch.header,
          contactField,
          required: config.required,
          confidence: bestMatch.confidence,
          example: bestMatch.header ? `Example from "${bestMatch.header}"` : undefined
        })
      } else {
        // No good match found
        mappings.push({
          csvField: '',
          contactField,
          required: config.required,
          confidence: 0,
          example: undefined
        })
      }
    })

    return mappings
  }

  /**
   * Calculate string similarity using simple character overlap
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const matches = shorter.split('').filter(char => longer.includes(char)).length
    return matches / longer.length
  }

  /**
   * Validate field mappings and return any issues
   */
  static validateFieldMappings(mappings: FieldMapping[]): string[] {
    const errors: string[] = []
    const usedCsvFields = new Set<string>()

    mappings.forEach(mapping => {
      // Check for required fields
      if (mapping.required && !mapping.csvField) {
        const fieldConfig = this.CONTACT_FIELDS[mapping.contactField as keyof typeof this.CONTACT_FIELDS]
        errors.push(`Required field "${fieldConfig.label}" is not mapped`)
      }

      // Check for duplicate mappings
      if (mapping.csvField && usedCsvFields.has(mapping.csvField)) {
        errors.push(`CSV field "${mapping.csvField}" is mapped to multiple contact fields`)
      }

      if (mapping.csvField) {
        usedCsvFields.add(mapping.csvField)
      }
    })

    return errors
  }

  /**
   * Transform CSV rows to contact objects using field mappings
   */
  static transformRowsToContacts(
    rows: Record<string, string>[],
    mappings: FieldMapping[]
  ): Array<{
    contact: Record<string, any>
    rowIndex: number
    errors: string[]
  }> {
    const results: Array<{
      contact: Record<string, any>
      rowIndex: number
      errors: string[]
    }> = []

    // Create mapping lookup (skip fields marked as __skip__)
    const mappingLookup = new Map<string, string>()
    mappings.forEach(mapping => {
      if (mapping.csvField && mapping.contactField && mapping.contactField !== '__skip__') {
        mappingLookup.set(mapping.csvField, mapping.contactField)
      }
    })

    rows.forEach((row, index) => {
      const contact: Record<string, any> = {
        custom_fields: {},
        tags: []
      }
      const errors: string[] = []

      // Map known fields
      Object.entries(row).forEach(([csvField, value]) => {
        const contactField = mappingLookup.get(csvField)
        
        if (contactField) {
          // Map to known contact field
          if (value && value.trim()) {
            contact[contactField] = value.trim()
          }
        } else if (value && value.trim()) {
          // Add to custom fields
          contact.custom_fields[csvField] = value.trim()
        }
      })

      // Validate required fields
      const requiredMappings = mappings.filter(m => m.required)
      requiredMappings.forEach(mapping => {
        if (!contact[mapping.contactField] || !contact[mapping.contactField].trim()) {
          const fieldConfig = this.CONTACT_FIELDS[mapping.contactField as keyof typeof this.CONTACT_FIELDS]
          errors.push(`Missing required field: ${fieldConfig.label}`)
        }
      })

      // Basic email validation
      if (contact.email && !this.isValidEmail(contact.email)) {
        errors.push(`Invalid email format: ${contact.email}`)
      }

      // Website URL validation - be more lenient for CSV imports
      if (contact.website && contact.website.trim()) {
        const cleanedUrl = this.cleanURL(contact.website)
        if (!this.isValidURL(cleanedUrl)) {
          // Don't error on invalid URLs, just clean them or skip
          contact.website = cleanedUrl || null
        } else {
          contact.website = cleanedUrl
        }
      }

      // Address parsing - extract postcode and city if address is provided
      if (contact.address && contact.address.trim()) {
        const parsedAddress = AddressParser.parseAddressWithConfidence(contact.address)
        
        // Only use parsed results if confidence is high enough and fields aren't already set
        if (parsedAddress.confidence > 0.5) {
          // Set postcode if not already provided and successfully parsed
          if (parsedAddress.postcode && AddressParser.isValidPostcode(parsedAddress.postcode)) {
            if (!contact.postcode || !contact.postcode.trim()) {
              contact.postcode = parsedAddress.postcode
            }
          }
          
          // Set city if not already provided and successfully parsed
          if (parsedAddress.city && AddressParser.isValidCity(parsedAddress.city)) {
            if (!contact.city || !contact.city.trim()) {
              contact.city = parsedAddress.city
            }
          }
          
          // Set country if parsed and not already provided
          if (parsedAddress.country && parsedAddress.country.trim()) {
            if (!contact.country || !contact.country.trim()) {
              contact.country = parsedAddress.country
            }
          }
          
          // Optionally update address to street-only version if parsing was successful
          if (parsedAddress.street && parsedAddress.street.trim()) {
            contact.address = parsedAddress.street
          }
        }
      }

      results.push({
        contact,
        rowIndex: index,
        errors
      })
    })

    return results
  }

  /**
   * Basic email validation
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Clean and normalize URL for validation
   */
  private static cleanURL(url: string): string | null {
    if (!url || !url.trim()) return null
    
    // Clean the URL
    let cleanedUrl = url.trim().toLowerCase()
    
    // Remove common prefixes that might be invalid
    cleanedUrl = cleanedUrl.replace(/^(https?:\/\/)?(www\.)?/, '')
    
    // Basic domain validation - must contain at least one dot
    if (!cleanedUrl.includes('.') || cleanedUrl.length < 3) {
      return null
    }
    
    // Remove trailing slashes and common suffixes
    cleanedUrl = cleanedUrl.replace(/\/+$/, '')
    
    // Add https prefix
    return `https://${cleanedUrl}`
  }

  /**
   * Lenient URL validation for CSV imports
   */
  private static isValidURL(url: string): boolean {
    if (!url || !url.trim()) return false
    
    try {
      const urlObj = new URL(url)
      // Basic checks - must have hostname and valid protocol
      return urlObj.hostname.length > 0 && 
             (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
             urlObj.hostname.includes('.')
    } catch {
      return false
    }
  }

  /**
   * Get sample data from CSV for preview
   */
  static getSampleData(rows: Record<string, string>[], sampleSize: number = 5): Record<string, string>[] {
    return rows.slice(0, Math.min(sampleSize, rows.length))
  }

  /**
   * Detect CSV delimiter
   */
  static detectDelimiter(csvContent: string): string {
    const delimiters = [',', ';', '\t', '|']
    const firstLine = csvContent.split('\n')[0]
    
    let bestDelimiter = ','
    let maxFields = 0

    delimiters.forEach(delimiter => {
      const fields = this.parseCSVLine(firstLine, delimiter)
      if (fields.length > maxFields) {
        maxFields = fields.length
        bestDelimiter = delimiter
      }
    })

    return bestDelimiter
  }

  /**
   * Get processing statistics
   */
  static getProcessingStats(
    transformResults: Array<{
      contact: Record<string, any>
      rowIndex: number
      errors: string[]
    }>
  ) {
    const stats = {
      total: transformResults.length,
      valid: 0,
      invalid: 0,
      withErrors: 0,
      commonErrors: new Map<string, number>()
    }

    transformResults.forEach(result => {
      if (result.errors.length === 0) {
        stats.valid++
      } else {
        stats.invalid++
        stats.withErrors++
        
        // Count common errors
        result.errors.forEach(error => {
          const count = stats.commonErrors.get(error) || 0
          stats.commonErrors.set(error, count + 1)
        })
      }
    })

    return stats
  }
}