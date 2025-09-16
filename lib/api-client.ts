import { createClientSupabase } from './supabase-client'

// Custom fetch function that automatically includes auth headers
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const supabase = createClientSupabase()
  
  // Get the current session
  const { data: { session }, error } = await supabase.auth.getSession()
  
  console.log('Auth session:', { hasSession: !!session, hasToken: !!session?.access_token, error }) // Debug
  
  if (!session?.access_token) {
    console.error('No authentication token available. Session:', session)
    throw new Error('No authentication token available')
  }

  // Add authorization header
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers,
  }

  console.log('Making authenticated request to:', url) // Debug

  return fetch(url, {
    ...options,
    headers,
  })
}

// API client class for easier usage
export class ApiClient {
  static async get(url: string) {
    const response = await authenticatedFetch(url, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    return response.json()
  }

  static async post(url: string, data: any) {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        // Only log structured error bodies; avoid noisy empty objects
        if (errorData && typeof errorData === 'object' && Object.keys(errorData).length > 0) {
          console.error('API Error Response:', errorData)
        } else {
          console.error(`API Error ${response.status}: Empty or unstructured error body`)
        }

        // Handle both plain errors and our API envelope: { success, data, error, message }
        const topLevelError = (errorData && (errorData.error || errorData.message || errorData.details)) as string | undefined
        const envelopeData = errorData && errorData.data ? errorData.data : undefined
        const nestedError = envelopeData && (envelopeData.error || envelopeData.message || envelopeData.details) as string | undefined

        if (topLevelError) {
          errorMessage = topLevelError
        } else if (nestedError) {
          errorMessage = nestedError
        } else if (envelopeData && typeof envelopeData === 'object') {
          // Try common fields we return inside data for validation/capability errors
          const hints: string[] = []
          if (envelopeData.reason) hints.push(envelopeData.reason)
          if (envelopeData.currentStatus) hints.push(`status=${envelopeData.currentStatus}`)
          if (hints.length) {
            errorMessage = `${errorMessage} - ${hints.join(' | ')}`
          }
        }
      } catch (e) {
        // If we can't parse the error response, try text
        try {
          const errorText = await response.text()
          console.error('API Error Text:', errorText)
          if (errorText) {
            errorMessage += ` - ${errorText}`
          }
        } catch (textError) {
          console.error('Failed to read error response as text:', textError)
        }
      }
      throw new Error(errorMessage)
    }
    return response.json()
  }

  static async put(url: string, data: any) {
    const response = await authenticatedFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // If we can't parse the error response, use the status code
      }
      throw new Error(errorMessage)
    }
    return response.json()
  }

  static async delete(url: string) {
    const response = await authenticatedFetch(url, { method: 'DELETE' })
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // If we can't parse the error response, use the status code
      }
      throw new Error(errorMessage)
    }
    return response.json()
  }
}
