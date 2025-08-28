// Re-export client-side functions (safe for browser)
export { createClientSupabase, supabase } from './supabase-client'

// Re-export server-side functions (server-only)
export { 
  createServerSupabaseClient,
  getUserFromRequest,
  supabaseAdmin,
  getUser,
  getSession,
  requireAuth,
  getUserProfile,
  upsertUserProfile
} from './supabase-server'

// Legacy export for backward compatibility
export { createClientSupabase as createClient } from './supabase-client'