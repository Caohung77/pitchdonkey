export interface ParsedAddress {
  street?: string
  postcode?: string
  city?: string
  country?: string
  originalAddress: string
}

export class AddressParser {
  /**
   * Parse a full address string and extract components
   */
  static parseAddress(address: string): ParsedAddress {
    if (!address || !address.trim()) {
      return { originalAddress: address }
    }

    const cleanAddress = address.trim()
    const result: ParsedAddress = {
      originalAddress: cleanAddress
    }

    // Try different address patterns
    const patterns = [
      // German format: "Kurze Straße 18-20, 40213 Düsseldorf"
      // Pattern: Street, PostalCode City
      /^(.+?),\s*(\d{4,5})\s+(.+)$/,
      
      // US format: "123 Main St, New York, NY 10001"
      // Pattern: Street, City, State PostalCode
      /^(.+?),\s*(.+?),\s*[A-Z]{2}\s+(\d{5}(?:-\d{4})?)$/,
      
      // UK format: "123 High Street, London SW1A 1AA"
      // Pattern: Street, City PostalCode
      /^(.+?),\s*(.+?)\s+([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i,
      
      // Simple format: "Street 123, 12345 City"
      /^(.+?),?\s*(\d{4,6})\s+(.+)$/,
      
      // Format with country: "Street 123, 12345 City, Country"
      /^(.+?),\s*(\d{4,6})\s+(.+?),\s*(.+)$/
    ]

    for (const pattern of patterns) {
      const match = cleanAddress.match(pattern)
      if (match) {
        if (pattern.source.includes('(.+?),\\s*(.+?),\\s*[A-Z]{2}\\s+')) {
          // US format
          result.street = match[1]?.trim()
          result.city = match[2]?.trim()
          result.postcode = match[3]?.trim()
        } else if (pattern.source.includes('(.+?),\\s*(.+?)\\s+([A-Z]{1,2}\\d')) {
          // UK format
          result.street = match[1]?.trim()
          result.city = match[2]?.trim()
          result.postcode = match[3]?.trim()
        } else if (match.length === 5) {
          // Format with country
          result.street = match[1]?.trim()
          result.postcode = match[2]?.trim()
          result.city = match[3]?.trim()
          result.country = match[4]?.trim()
        } else if (match.length === 4) {
          // German/European format
          result.street = match[1]?.trim()
          result.postcode = match[2]?.trim()
          result.city = match[3]?.trim()
        }
        break
      }
    }

    // Fallback: Try to extract postal code and city from end of address
    if (!result.postcode && !result.city) {
      // Look for postal code pattern at the end
      const postcodeMatch = cleanAddress.match(/(\d{4,6})\s+([^,\d]+?)(?:,\s*([^,]+))?$/)
      if (postcodeMatch) {
        result.postcode = postcodeMatch[1]?.trim()
        result.city = postcodeMatch[2]?.trim()
        if (postcodeMatch[3]) {
          result.country = postcodeMatch[3]?.trim()
        }
        // Extract remaining part as street
        const streetPart = cleanAddress.replace(postcodeMatch[0], '').replace(/,\s*$/, '').trim()
        if (streetPart) {
          result.street = streetPart
        }
      }
    }

    // Clean up extracted values
    if (result.street) {
      result.street = result.street.replace(/,\s*$/, '').trim()
    }
    if (result.city) {
      result.city = result.city.replace(/,\s*$/, '').trim()
    }
    if (result.country) {
      result.country = result.country.replace(/,\s*$/, '').trim()
    }

    return result
  }

  /**
   * Validate extracted postal code format
   */
  static isValidPostcode(postcode: string): boolean {
    if (!postcode) return false
    
    // Common postal code patterns
    const patterns = [
      /^\d{4,6}$/, // 4-6 digits (Germany, etc.)
      /^\d{5}(-\d{4})?$/, // US ZIP code
      /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, // UK postcode
      /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i, // Canadian postal code
    ]
    
    return patterns.some(pattern => pattern.test(postcode.trim()))
  }

  /**
   * Validate extracted city name
   */
  static isValidCity(city: string): boolean {
    if (!city || city.trim().length < 2) return false
    
    // City should not contain numbers (except some valid cases)
    const cleanCity = city.trim()
    
    // Allow cities with numbers like "New York 1" but not pure numbers
    if (/^\d+$/.test(cleanCity)) return false
    
    // Should contain at least one letter
    if (!/[a-zA-ZÀ-ÿ]/.test(cleanCity)) return false
    
    return true
  }

  /**
   * Get confidence score for parsed address (0-1)
   */
  static getParsingConfidence(parsed: ParsedAddress): number {
    let confidence = 0
    
    if (parsed.postcode && this.isValidPostcode(parsed.postcode)) {
      confidence += 0.4
    }
    
    if (parsed.city && this.isValidCity(parsed.city)) {
      confidence += 0.3
    }
    
    if (parsed.street && parsed.street.length > 3) {
      confidence += 0.2
    }
    
    if (parsed.country && parsed.country.length > 2) {
      confidence += 0.1
    }
    
    return Math.min(confidence, 1.0)
  }

  /**
   * Parse multiple address formats and return best result
   */
  static parseAddressWithConfidence(address: string): ParsedAddress & { confidence: number } {
    const parsed = this.parseAddress(address)
    const confidence = this.getParsingConfidence(parsed)
    
    return {
      ...parsed,
      confidence
    }
  }
}