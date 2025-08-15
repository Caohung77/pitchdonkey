import { createClientSupabase } from './supabase-client'

// Enhanced fetch that automatically adds auth headers
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const supabase = createClientSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers = new Headers(options.headers)
  
  // Add auth header if we have a session
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  
  // Ensure content-type is set for POST/PUT requests
  if (!headers.has('Content-Type') && (options.method === 'POST' || options.method === 'PUT')) {
    headers.set('Content-Type', 'application/json')
  }
  
  return fetch(url, {
    ...options,
    headers
  })
}

// Convenience methods
export const apiClient = {
  get: (url: string, options?: RequestInit) => 
    authenticatedFetch(url, { ...options, method: 'GET' }),
    
  post: (url: string, data?: any, options?: RequestInit) => 
    authenticatedFetch(url, { 
      ...options, 
      method: 'POST', 
      body: data ? JSON.stringify(data) : undefined 
    }),
    
  put: (url: string, data?: any, options?: RequestInit) => 
    authenticatedFetch(url, { 
      ...options, 
      method: 'PUT', 
      body: data ? JSON.stringify(data) : undefined 
    }),
    
  delete: (url: string, options?: RequestInit) => 
    authenticatedFetch(url, { ...options, method: 'DELETE' })
}