import { createServerSupabaseClient, supabase } from './supabase'
import { User } from '@supabase/supabase-js'
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { SupabaseAdapter } from '@next-auth/supabase-adapter'

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'database',
  },
}

// Client-side auth helpers
export const authHelpers = {
  // Sign up with email and password
  async signUp(email: string, password: string, userData?: { name?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    })
    
    if (error) throw error
    return data
  },

  // Sign in with email and password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    return data
  },

  // Sign in with Google OAuth
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    
    if (error) throw error
    return data
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Get current session
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  // Get current user
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // Reset password
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    
    if (error) throw error
  },

  // Update password
  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({
      password,
    })
    
    if (error) throw error
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// Helper function to get current user from server-side
export async function getCurrentUser(userId: string) {
  const supabase = createServerSupabaseClient()
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  return user
}

// Helper function to check user permissions
export async function checkUserPermissions(userId: string, resource: string, action: string) {
  const user = await getCurrentUser(userId)
  
  if (!user) {
    return false
  }

  // Basic plan-based permissions
  const planPermissions = {
    starter: {
      email_accounts: { max: 1 },
      contacts: { max: 1000 },
      emails_per_month: { max: 2000 },
      campaigns: { max: 5 },
    },
    professional: {
      email_accounts: { max: 3 },
      contacts: { max: 5000 },
      emails_per_month: { max: 10000 },
      campaigns: { max: 20 },
      ab_testing: true,
    },
    agency: {
      email_accounts: { max: 10 },
      contacts: { max: 25000 },
      emails_per_month: { max: 50000 },
      campaigns: { max: 100 },
      ab_testing: true,
      white_label: true,
      team_collaboration: true,
    },
  }

  const userPlan = user.plan as keyof typeof planPermissions
  const permissions = planPermissions[userPlan]

  if (!permissions) {
    return false
  }

  // Check specific resource permissions
  if (resource in permissions) {
    const resourcePermissions = permissions[resource as keyof typeof permissions]
    
    if (typeof resourcePermissions === 'object' && 'max' in resourcePermissions) {
      // Check if user has reached the limit for this resource
      return await checkResourceLimit(userId, resource, resourcePermissions.max)
    }
    
    if (typeof resourcePermissions === 'boolean') {
      return resourcePermissions
    }
  }

  return true
}

// Helper function to check resource limits
async function checkResourceLimit(userId: string, resource: string, limit: number): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  let query
  
  switch (resource) {
    case 'email_accounts':
      query = supabase
        .from('email_accounts')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_active', true)
      break
      
    case 'contacts':
      query = supabase
        .from('contacts')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .neq('status', 'deleted')
      break
      
    case 'campaigns':
      query = supabase
        .from('campaigns')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .neq('status', 'deleted')
      break
      
    default:
      return true
  }

  const { count, error } = await query
  
  if (error) {
    console.error('Error checking resource limit:', error)
    return false
  }

  return (count || 0) < limit
}

// Helper function to get user usage statistics
export async function getUserUsage(userId: string) {
  const supabase = createServerSupabaseClient()
  
  const [
    emailAccountsResult,
    contactsResult,
    campaignsResult,
    emailsSentResult
  ] = await Promise.all([
    supabase
      .from('email_accounts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_active', true),
    
    supabase
      .from('contacts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .neq('status', 'deleted'),
    
    supabase
      .from('campaigns')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .neq('status', 'deleted'),
    
    supabase
      .from('email_sends')
      .select('id', { count: 'exact' })
      .eq('campaign_id', userId) // This would need a join in real implementation
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
  ])

  return {
    email_accounts: emailAccountsResult.count || 0,
    contacts: contactsResult.count || 0,
    campaigns: campaignsResult.count || 0,
    emails_sent_30_days: emailsSentResult.count || 0,
  }
}