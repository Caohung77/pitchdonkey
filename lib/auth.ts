import { createServerSupabaseClient } from './supabase'
import { User } from '@supabase/supabase-js'

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
      .eq('user_id', userId),
    
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