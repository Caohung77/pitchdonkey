import { createClientSupabase } from './supabase-client'

// Custom fetch function that automatically includes auth headers
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const supabase = createClientSupabase()

  // Get the current session
  const { data: { session }, error } = await supabase.auth.getSession()

  console.log('🔑 Auth session check:', {
    hasSession: !!session,
    hasToken: !!session?.access_token,
    tokenPreview: session?.access_token?.substring(0, 20) + '...',
    error,
    url
  })

  if (!session?.access_token) {
    console.error('❌ No authentication token available:', { session, error })
    throw new Error('No authentication token available')
  }

  // Add authorization header
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers,
  }

  console.log('🚀 Making authenticated request:', {
    url,
    method: options.method || 'GET',
    hasAuthHeader: !!headers.Authorization
  })

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
      console.error('🚨 POST API Request Failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        requestData: typeof data === 'object' ? Object.keys(data).length : 'non-object'
      })

      try {
        const errorData = await response.json()
        // Only log structured error bodies; avoid noisy empty objects
        if (errorData && typeof errorData === 'object' && Object.keys(errorData).length > 0) {
          console.error('📋 POST API Error Response:', errorData)
        } else {
          console.error(`📭 POST API Error ${response.status}: Empty or unstructured error body`)
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

  static async delete(url: string) {
    console.log('🔄 Making DELETE request to:', url)

    const response = await authenticatedFetch(url, { method: 'DELETE' })

    console.log('📊 DELETE Response Details:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      ok: response.ok
    })

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`

      // Handle common HTTP status codes first with user-friendly messages
      if (response.status === 401) {
        errorMessage = 'Please sign in again to continue'
        console.log('🔑 Using 401 error message:', errorMessage)
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to delete this email account'
        console.log('🚫 Using 403 error message:', errorMessage)
      } else if (response.status === 404) {
        errorMessage = 'Email account not found. It may have already been deleted.'
        console.log('🔍 Using 404 error message:', errorMessage)
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment before trying again.'
        console.log('⏱️ Using 429 error message:', errorMessage)
      } else {
        // Try to get more specific error message from response body
        try {
          const errorData = await response.json()
          console.log('📜 DELETE Error Data:', errorData)

          const specificError = errorData?.error || errorData?.message || errorData?.details
          if (specificError) {
            errorMessage = specificError
            console.log('🎯 Using specific error message from response body:', errorMessage)
          } else {
            console.log('⚠️ No specific error in response body, keeping status-based message:', errorMessage)
          }
        } catch (e) {
          // If JSON parsing fails, keep the status-based message
          console.log('❌ Could not parse error response JSON, using status-based message:', errorMessage)
        }
      }

      console.log('🚀 Final error message to throw:', errorMessage)
      throw new Error(errorMessage)
    }

    console.log('✅ DELETE request successful, parsing response')
    return response.json()
  }
}
