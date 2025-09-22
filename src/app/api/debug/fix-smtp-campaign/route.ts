import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Fix the specific SMTP Test Campaign by linking it to an active SMTP email account
 */
export async function POST(request: NextRequest) {
  console.log('🔧 Fixing SMTP Test Campaign by linking it to active email account')

  try {
    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Find the SMTP Test Campaign
    const { data: smtpCampaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, from_email_account_id, user_id')
      .eq('name', 'SMTP Test Campaign')
      .single()

    if (campaignError || !smtpCampaign) {
      return NextResponse.json({
        success: false,
        error: 'SMTP Test Campaign not found',
        details: campaignError?.message
      }, { status: 404 })
    }

    console.log(`📧 Found SMTP Test Campaign: ${smtpCampaign.id}`)
    console.log(`   Status: ${smtpCampaign.status}`)
    console.log(`   Email Account ID: ${smtpCampaign.from_email_account_id}`)

    // 2. Find an active SMTP email account for this user
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id, email, provider, status')
      .eq('user_id', smtpCampaign.user_id)
      .eq('provider', 'smtp')
      .eq('status', 'active')
      .limit(1)

    if (accountsError || !emailAccounts || emailAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active SMTP email accounts found for this user',
        recommendation: 'Create an SMTP email account first'
      }, { status: 400 })
    }

    const emailAccount = emailAccounts[0]
    console.log(`📧 Found SMTP email account: ${emailAccount.email} (${emailAccount.id})`)

    // 3. Update the campaign with the email account ID and set it to scheduled status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        from_email_account_id: emailAccount.id,
        status: 'scheduled',  // Reset to scheduled so cron can pick it up
        updated_at: new Date().toISOString()
      })
      .eq('id', smtpCampaign.id)

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update campaign',
        details: updateError.message
      }, { status: 500 })
    }

    console.log(`✅ Updated campaign with email account ID and status = scheduled`)

    // 4. Verify the fix by running the cron query
    const { data: cronTest, error: cronTestError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        scheduled_date,
        email_accounts!from_email_account_id(
          id,
          email,
          provider,
          status
        )
      `)
      .in('status', ['scheduled', 'sending'])
      .eq('email_accounts.status', 'active')

    if (cronTestError) {
      return NextResponse.json({
        success: false,
        error: 'Fix applied but cron query test failed',
        details: cronTestError.message
      }, { status: 500 })
    }

    const readyCampaigns = cronTest?.length || 0
    console.log(`🎯 Cron query now finds ${readyCampaigns} ready campaigns`)

    return NextResponse.json({
      success: true,
      message: 'SMTP Test Campaign fixed successfully',
      details: {
        campaignId: smtpCampaign.id,
        campaignName: smtpCampaign.name,
        linkedEmailAccount: emailAccount.email,
        newStatus: 'scheduled',
        cronTestResult: `${readyCampaigns} campaigns now ready for processing`
      },
      nextSteps: [
        'Test the cron job: curl -X POST http://localhost:3003/api/cron/process-campaigns',
        'The campaign should now be picked up and processed',
        'Check the campaign status in the dashboard'
      ]
    })

  } catch (error) {
    console.error('💥 Error fixing SMTP campaign:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fix SMTP campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}