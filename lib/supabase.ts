// Re-export client-side functions (safe for browser)
export { createClientSupabase, supabase } from './supabase-client'

// Legacy export for backward compatibility
export { createClientSupabase as createClient } from './supabase-client'