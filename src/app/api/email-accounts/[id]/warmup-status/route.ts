import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const GET = withAuth(async (
  request: NextRequest,
  context: { user: any }
) => {
  const supabase = createServerSupabaseClient()
  const { user } = context

  // Extract accountId from URL path
  const pathname = request.nextUrl.pathname
  const accountId = pathname.split('/').filter(Boolean)[2] // /api/email-accounts/[id]/warmup-status

  try {
    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('id, email')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      )
    }

    // Get warmup plan if exists
    const { data: warmupPlan } = await supabase
      .from('warmup_plans')
      .select('*')
      .eq('email_account_id', accountId)
      .eq('status', 'active')
      .single()

    // FIXED: All accounts have max limit of 50/day
    const accountDailyLimit = 50
    let currentDailyLimit = accountDailyLimit
    let warmupActive = false
    let warmupInfo = null

    if (warmupPlan) {
      warmupActive = true
      currentDailyLimit = Math.min(accountDailyLimit, warmupPlan.daily_target || 5)

      warmupInfo = {
        week: warmupPlan.current_week,
        totalWeeks: warmupPlan.total_weeks,
        dailyTarget: warmupPlan.daily_target,
        strategy: warmupPlan.strategy,
        totalSent: warmupPlan.total_sent
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        accountId: account.id,
        accountEmail: account.email,
        accountDailyLimit,
        currentDailyLimit,
        warmupActive,
        warmupInfo,
        availableBatchSizes: [5, 10, 15, 20, 30, 50].filter(size => size <= currentDailyLimit)
      }
    })
  } catch (error) {
    console.error('Error fetching warmup status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warmup status' },
      { status: 500 }
    )
  }
})
