/**
 * Utility functions for contact data handling
 */

/**
 * Parse company field that might be stored as JSON string or plain string
 */
export function parseCompanyName(company: string | null | undefined): string | null {
  if (!company || company.trim() === '') return null
  
  // If company is a JSON string, parse it and extract the name
  try {
    const parsed = JSON.parse(company)
    if (parsed && typeof parsed === 'object' && parsed.name) {
      return parsed.name
    }
  } catch {
    // If parsing fails, treat as regular string
  }
  
  // Return as is if it's already a plain string
  return company
}

/**
 * Get additional company information from JSON format
 */
export function parseCompanyData(company: string | null | undefined): { name: string | null; location: string | null } {
  if (!company || company.trim() === '') return { name: null, location: null }
  
  // If company is a JSON string, parse it
  try {
    const parsed = JSON.parse(company)
    if (parsed && typeof parsed === 'object') {
      return {
        name: parsed.name || null,
        location: parsed.location || null
      }
    }
  } catch {
    // If parsing fails, treat as regular string
  }
  
  // Return as plain string company name
  return { name: company, location: null }
}