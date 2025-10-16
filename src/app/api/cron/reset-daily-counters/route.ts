import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Daily Counter Reset Cron Job
 *
 * This endpoint resets daily sending counters to 0 at midnight UTC.
 * This is CRITICAL for warmup system to work correctly.
 *
 * Without this reset:
 * - email_accounts.current_daily_sent stays at max limit forever
 * - warmup_plans.actual_sent_today never resets
 * - Campaigns get stuck after hitting daily limit
 *
 * Schedule: Runs at midnight UTC daily (00:00)
 * Trigger: Ubuntu Docker cron or Vercel cron (if on paid plan)
 *
 * Command for Ubuntu cron:
 * 0 0 * * * curl -X GET https://your-app.vercel.app/api/cron/reset-daily-counters \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  console.log('🔄 Daily counter reset cron triggered at', new Date().toISOString())

  try {
    // Security: Verify the request is from authorized cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const userAgent = request.headers.get('user-agent')

    // Verify authorization (CRON_SECRET) OR Vercel cron user agent
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request - invalid CRON_SECRET')
      return new Response('Unauthorized', { status: 401 })
    }

    // Additional verification: Check for Vercel cron user agent (if using Vercel cron)
    if (!userAgent?.includes('vercel-cron') && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request - not from Vercel cron or authorized source')
      return new Response('Unauthorized', { status: 401 })
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    console.log(`🕐 Current time (UTC): ${now.toISOString()}`)

    // ============================================================================
    // STEP 1: Reset email_accounts.current_daily_sent to 0
    // ============================================================================
    console.log('📧 Resetting email account daily counters...')

    const { data: accountsData, error: accountsError } = await supabase
      .from('email_accounts')
      .update({ current_daily_sent: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Update all real accounts
      .select('id, email, current_daily_sent')

    if (accountsError) {
      console.error('❌ Failed to reset email_accounts:', accountsError)
      return NextResponse.json(
        { error: 'Failed to reset email account counters', details: accountsError.message },
        { status: 500 }
      )
    }

    const accountsResetCount = accountsData?.length || 0
    console.log(`✅ Reset ${accountsResetCount} email account counters`)

    // ============================================================================
    // STEP 2: Reset warmup_plans.actual_sent_today to 0 (for active plans only)
    // NOTE: This is optional - if the column doesn't exist, we'll skip it
    // The critical reset is email_accounts.current_daily_sent (above)
    // ============================================================================
    console.log('🔥 Resetting active warmup plan daily counters...')

    let warmupData: any[] = []
    let warmupResetCount = 0

    try {
      const { data, error: warmupError } = await supabase
        .from('warmup_plans')
        .update({ actual_sent_today: 0 })
        .eq('status', 'active')
        .select('id, email_account_id, current_week')

      if (warmupError) {
        // Log warning but don't fail - this field might not exist yet
        console.warn('⚠️ Could not reset warmup_plans.actual_sent_today:', warmupError.message)
        console.warn('   This is okay - the critical reset (email_accounts.current_daily_sent) succeeded')
      } else {
        warmupData = data || []
        warmupResetCount = warmupData.length
        console.log(`✅ Reset ${warmupResetCount} active warmup plan counters`)
      }
    } catch (warmupErr) {
      console.warn('⚠️ Warmup plans reset failed (non-critical):', warmupErr)
    }

    // ============================================================================
    // STEP 3: Check for warmup progression (time-based)
    // ============================================================================
    console.log('📈 Checking warmup progression for active plans...')

    if (warmupData && warmupData.length > 0) {
      // Import warmup system to check progression
      const { WarmupSystem } = await import('@/lib/warmup-system')
      const warmupSystem = new WarmupSystem(supabase)

      for (const plan of warmupData) {
        try {
          await warmupSystem.checkWarmupProgression(plan.id)
        } catch (error) {
          console.error(`⚠️ Error checking warmup progression for plan ${plan.id}:`, error)
          // Continue with other plans even if one fails
        }
      }

      console.log(`✅ Checked warmup progression for ${warmupData.length} plans`)
    }

    // ============================================================================
    // Summary
    // ============================================================================
    const summary = {
      success: true,
      message: 'Daily counters reset successfully',
      timestamp: now.toISOString(),
      counters_reset: {
        email_accounts: accountsResetCount,
        warmup_plans: warmupResetCount
      },
      details: {
        accounts: accountsData?.map(a => ({
          id: a.id,
          email: a.email,
          reset_to: 0
        })),
        warmup_plans: warmupData?.map(w => ({
          id: w.id,
          email_account_id: w.email_account_id,
          current_week: w.current_week,
          reset_to: 0
        }))
      }
    }

    console.log(`\n📊 Daily reset summary:`)
    console.log(`   ✅ Email accounts reset: ${accountsResetCount}`)
    console.log(`   ✅ Warmup plans reset: ${warmupResetCount}`)
    console.log(`   🕐 Completed at: ${now.toISOString()}`)

    return NextResponse.json(summary)

  } catch (error) {
    console.error('💥 Critical error in daily reset cron:', error)
    console.error('📋 Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      {
        success: false,
        error: 'Daily reset failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint for manual testing
 */
export async function POST(request: NextRequest) {
  console.log('🧪 Manual daily reset test triggered')
  console.log('⚠️  Note: This is a manual test of the daily reset endpoint')

  // Call the same logic as GET
  return GET(request)
}
