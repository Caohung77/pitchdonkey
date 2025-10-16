import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get email accounts
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (accountsError) {
      console.error('Error fetching email accounts:', accountsError)
      return handleApiError(accountsError)
    }

    // Filter active accounts - fallback to all accounts if is_active column doesn't exist
    const activeEmailAccounts = emailAccounts?.filter(acc => acc.is_active !== false) || []

    // Get current date for daily usage calculation
    const today = new Date().toISOString().split('T')[0]

    // Calculate account health for each email account
    const accountHealthPromises = activeEmailAccounts?.map(async (account) => {
      // Use current_daily_sent from email_accounts (updated by campaign processor)
      const dailySent = account.current_daily_sent || 0

      // Get recent bounce/spam rates for reputation calculation
      const { data: recentEmails, error: recentError } = await supabase
        .from('email_tracking')
        .select('status')
        .eq('email_account_id', account.id)
        .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(100)

      if (recentError) {
        console.error('Error fetching recent emails:', recentError)
      }

      // Calculate reputation score (0-100)
      const totalRecent = recentEmails?.length || 0
      const bounced = recentEmails?.filter(e => e.status === 'bounced').length || 0
      const delivered = recentEmails?.filter(e => e.status === 'delivered').length || 0

      let reputation = 100
      if (totalRecent > 0) {
        const bounceRate = bounced / totalRecent
        const deliveryRate = delivered / totalRecent
        // Start at 100, penalize for bounces, reward for deliveries, but cap at 100
        reputation = Math.max(0, Math.min(100, Math.round(100 - (bounceRate * 50) + (deliveryRate * 10))))
      }

      // Get daily limit from warmup plan if warmup is enabled
      let dailyLimit = account.daily_limit || 50 // Default to 50 if not set

      if (account.warmup_enabled) {
        // Fetch active warmup plan
        const { data: warmupPlan } = await supabase
          .from('warmup_plans')
          .select('current_week, schedule')
          .eq('email_account_id', account.id)
          .eq('status', 'active')
          .single()

        if (warmupPlan && warmupPlan.schedule) {
          // Get current week's daily target from schedule
          const currentWeekData = warmupPlan.schedule.find((s: any) => s.week === warmupPlan.current_week)
          if (currentWeekData) {
            dailyLimit = currentWeekData.daily_target
          }
        }
      }

      // Determine account status
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      if (reputation < 70 || bounced > 5) {
        status = 'error'
      } else if (reputation < 85 || dailySent > dailyLimit * 0.9) {
        status = 'warning'
      }

      return {
        id: account.id,
        email: account.email,
        status,
        warmupStatus: account.warmup_status,
        dailySent,
        dailyLimit,
        reputation
      }
    }) || []

    const accountHealthData = await Promise.all(accountHealthPromises)

    // Calculate overall health
    let overallHealth: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent'
    const errorAccounts = accountHealthData.filter(a => a.status === 'error').length
    const warningAccounts = accountHealthData.filter(a => a.status === 'warning').length
    const totalAccounts = accountHealthData.length

    if (totalAccounts === 0) {
      overallHealth = 'warning'
    } else if (errorAccounts > 0) {
      overallHealth = errorAccounts > totalAccounts / 2 ? 'critical' : 'warning'
    } else if (warningAccounts > 0) {
      overallHealth = 'good'
    }

    // Generate issues and recommendations
    const issues: string[] = []
    const recommendations: string[] = []

    if (totalAccounts === 0) {
      issues.push('No email accounts connected')
      recommendations.push('Connect at least one email account to start sending campaigns')
    }

    accountHealthData.forEach(account => {
      if (account.status === 'error') {
        if (account.reputation < 70) {
          issues.push(`${account.email} has low sender reputation (${account.reputation}%)`)
          recommendations.push(`Reduce sending volume for ${account.email} and focus on list quality`)
        }
      }
      
      if (account.status === 'warning') {
        if (account.dailySent > account.dailyLimit * 0.9) {
          issues.push(`${account.email} is approaching daily sending limit`)
          recommendations.push(`Consider spreading sends across multiple accounts or upgrading limits`)
        }
      }

      if (account.warmupStatus !== 'completed') {
        recommendations.push(`Complete warmup process for ${account.email} to improve deliverability`)
      }
    })

    // Add general recommendations
    if (accountHealthData.length === 1) {
      recommendations.push('Consider adding more email accounts for better distribution and higher limits')
    }

    const avgReputation = accountHealthData.length > 0 
      ? accountHealthData.reduce((sum, acc) => sum + acc.reputation, 0) / accountHealthData.length 
      : 0

    if (avgReputation < 90) {
      recommendations.push('Focus on improving email content quality and list hygiene')
    }

    const healthData = {
      emailAccounts: accountHealthData,
      overallHealth,
      issues,
      recommendations
    }

    return createSuccessResponse(healthData)

  } catch (error) {
    return handleApiError(error)
  }
})
