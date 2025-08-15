// Re-export client-side functions (safe for browser)
export { createClientSupabase, supabase, createBrowserClient } from './supabase-client'

// Re-export server-side functions (will be tree-shaken on client)
export { 
  createServerSupabaseClient, 
  supabaseAdmin, 
  getUser, 
  getSession, 
  requireAuth, 
  getUserProfile, 
  upsertUserProfile 
} from './supabase-server'

// Legacy export for backward compatibility
export { createBrowserClient as createClient } from './supabase-client'