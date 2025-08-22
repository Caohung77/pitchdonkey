// Re-export client-side functions (safe for browser)
export { createClientSupabase, supabase } from './supabase-client'

// Re-export server-side functions (will be tree-shaken on client)
export { 
  createServerSupabaseClient, 
  supabaseAdmin, 
  getUser, // @deprecated
  getSession, // @deprecated
  requireAuth as requireAuthDeprecated, // @deprecated
  getUserProfile, 
  upsertUserProfile 
} from './supabase-server'

// Export new standardized authentication middleware (RECOMMENDED)
export { 
  requireAuth,
  optionalAuth,
  withAuth,
  withOptionalAuth,
  requirePermission,
  AuthenticationError,
  PermissionError,
  RateLimitError,
  addSecurityHeaders,
  rateLimit,
  withRateLimit
} from './auth-middleware'

// Legacy export for backward compatibility
export { createClientSupabase as createClient } from './supabase-client'