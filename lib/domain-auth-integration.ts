import { createServerSupabaseClient } from '@/lib/supabase'
import { DomainAuthService, extractDomainFromEmail } from '@/lib/domain-auth'

/**
 * Integration functions to connect domain authentication with existing email accounts
 */

/**
 * Automatically create domain_auth records for existing email accounts that don't have them
 */
export async function syncEmailAccountDomains(userId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const domainAuthService = new DomainAuthService()

  try {
    // Get all email accounts for the user
    const { data: emailAccounts, error: emailError } = await supabase
      .from('email_accounts')
      .select('id, email, domain')
      .eq('user_id', userId)

    if (emailError) {
      console.error('Error fetching email accounts:', emailError)
      return
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return
    }

    // Get existing domain_auth records
    const { data: existingDomains, error: domainError } = await supabase
      .from('domain_auth')
      .select('domain')
      .eq('user_id', userId)

    if (domainError) {
      console.error('Error fetching existing domains:', domainError)
      return
    }

    const existingDomainSet = new Set(existingDomains?.map(d => d.domain) || [])

    // Create domain_auth records for missing domains
    for (const account of emailAccounts) {
      let domain = account.domain

      // If domain is not set in email_accounts, extract from email
      if (!domain && account.email) {
        try {
          domain = extractDomainFromEmail(account.email)
        } catch (error) {
          console.error(`Invalid email format for account ${account.id}:`, account.email)
          continue
        }
      }

      if (domain && !existingDomainSet.has(domain)) {
        try {
          await domainAuthService.createDomain(userId, {
            domain,
            dns_provider: 'manual',
            auto_configure: false
          })
          console.log(`Created domain_auth record for domain: ${domain}`)
        } catch (error) {
          console.error(`Error creating domain_auth for ${domain}:`, error)
        }
      }
    }
  } catch (error) {
    console.error('Error syncing email account domains:', error)
  }
}

/**
 * Update email account domain verification status based on domain_auth
 */
export async function updateEmailAccountVerificationStatus(userId: string, domain: string): Promise<void> {
  const supabase = createServerSupabaseClient()

  try {
    // Get domain authentication status
    const { data: domainAuth, error: domainError } = await supabase
      .from('domain_auth')
      .select('spf_verified, dkim_verified, dmarc_verified')
      .eq('user_id', userId)
      .eq('domain', domain)
      .single()

    if (domainError || !domainAuth) {
      console.error('Error fetching domain auth status:', domainError)
      return
    }

    // Update all email accounts for this domain
    const { error: updateError } = await supabase
      .from('email_accounts')
      .update({
        dkim_verified: domainAuth.dkim_verified,
        spf_verified: domainAuth.spf_verified,
        dmarc_verified: domainAuth.dmarc_verified,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('domain', domain)

    if (updateError) {
      console.error('Error updating email account verification status:', updateError)
    }
  } catch (error) {
    console.error('Error updating email account verification status:', error)
  }
}

/**
 * Get domain authentication summary for dashboard
 */
export async function getDomainAuthSummary(userId: string) {
  const domainAuthService = new DomainAuthService()

  try {
    const stats = await domainAuthService.getDashboardStats(userId)
    
    // Calculate additional metrics
    const totalEmailAccounts = await getTotalEmailAccounts(userId)
    const verifiedEmailAccounts = await getVerifiedEmailAccounts(userId)

    return {
      ...stats,
      emailAccountStats: {
        total: totalEmailAccounts,
        verified: verifiedEmailAccounts,
        unverified: totalEmailAccounts - verifiedEmailAccounts
      }
    }
  } catch (error) {
    console.error('Error getting domain auth summary:', error)
    throw error
  }
}

/**
 * Helper function to get total email accounts for a user
 */
async function getTotalEmailAccounts(userId: string): Promise<number> {
  const supabase = createServerSupabaseClient()
  
  const { count, error } = await supabase
    .from('email_accounts')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)

  if (error) {
    console.error('Error counting email accounts:', error)
    return 0
  }

  return count || 0
}

/**
 * Helper function to get verified email accounts for a user
 */
async function getVerifiedEmailAccounts(userId: string): Promise<number> {
  const supabase = createServerSupabaseClient()
  
  const { count, error } = await supabase
    .from('email_accounts')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('dkim_verified', true)
    .eq('spf_verified', true)
    .eq('dmarc_verified', true)

  if (error) {
    console.error('Error counting verified email accounts:', error)
    return 0
  }

  return count || 0
}