import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Debug endpoint to analyze why the cron job finds 0 campaigns
 */
export async function GET(request: NextRequest) {
  console.log('🔍 Debug: Analyzing campaign query issue')

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
    const now = new Date()

    console.log(`🕐 Current time: ${now.toISOString()}`)

    // 1. Check ALL campaigns (including from_email_account_id)
    console.log('📊 Step 1: All campaigns')
    const { data: allCampaigns, error: allError } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, from_email_account_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (allError) {
      console.error('❌ Error fetching all campaigns:', allError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: allError.message },
        { status: 500 }
      )
    }

    console.log(`Found ${allCampaigns?.length || 0} campaigns`)

    // 2. Check campaigns with the exact cron query (the one that's failing)
    console.log('📊 Step 2: Cron job query (what cron actually sees)')
    const { data: cronCampaigns, error: cronError } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts!from_email_account_id(
          id,
          email,
          provider,
          status,
          access_token,
          refresh_token
        )
      `)
      .in('status', ['scheduled', 'sending'])
      .eq('email_accounts.status', 'active')
      .order('created_at', { ascending: true })

    console.log(`Cron query found ${cronCampaigns?.length || 0} campaigns`)

    // 3. Check SMTP campaigns specifically
    console.log('📊 Step 3: SMTP campaigns specifically')
    const { data: smtpCampaigns, error: smtpError } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(*)
      `)
      .ilike('name', '%smtp%')

    console.log(`SMTP query found ${smtpCampaigns?.length || 0} campaigns`)

    // 4. Check email accounts
    console.log('📊 Step 4: Available email accounts')
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id, email, provider, status')
      .eq('status', 'active')

    console.log(`Found ${emailAccounts?.length || 0} active email accounts`)

    // 5. Analysis
    const smtpTestCampaign = allCampaigns?.find(c => c.name.includes('SMTP Test'))
    let analysis = {
      foundSmtpTestCampaign: !!smtpTestCampaign,
      smtpCampaignDetails: smtpTestCampaign || null,
      problem: 'Unknown',
      solution: 'None'
    }

    if (smtpTestCampaign) {
      console.log(`✅ Found SMTP Test Campaign: ${smtpTestCampaign.id}`)
      console.log(`   Status: ${smtpTestCampaign.status}`)
      console.log(`   Scheduled: ${smtpTestCampaign.scheduled_date}`)
      console.log(`   Email Account ID: ${smtpTestCampaign.from_email_account_id}`)

      if (!smtpTestCampaign.from_email_account_id) {
        analysis.problem = 'Campaign has no from_email_account_id'
        analysis.solution = 'Update campaign to link it to an active email account'
        console.log('❌ PROBLEM: Campaign has no from_email_account_id - this is why cron ignores it!')
      } else {
        const hasAccount = emailAccounts?.find(ea => ea.id === smtpTestCampaign.from_email_account_id)
        if (!hasAccount) {
          analysis.problem = 'Campaign references non-existent or inactive email account'
          analysis.solution = 'Fix the from_email_account_id or reactivate the email account'
          console.log('❌ PROBLEM: Campaign references non-existent or inactive email account!')
        } else {
          analysis.problem = 'Campaign should be picked up by cron - check other conditions'
          analysis.solution = 'Check scheduled_date and status conditions'
          console.log('✅ Campaign has valid email account')
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      analysis,
      data: {
        allCampaigns: allCampaigns?.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          scheduled_date: c.scheduled_date,
          from_email_account_id: c.from_email_account_id,
          hasEmailAccount: !!c.from_email_account_id
        })),
        cronCampaigns: cronCampaigns?.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          scheduled_date: c.scheduled_date,
          emailAccount: {
            email: c.email_accounts.email,
            provider: c.email_accounts.provider
          }
        })) || [],
        smtpCampaigns: smtpCampaigns?.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          scheduled_date: c.scheduled_date,
          from_email_account_id: c.from_email_account_id,
          emailAccount: c.email_accounts ? {
            email: c.email_accounts.email,
            provider: c.email_accounts.provider
          } : null
        })) || [],
        emailAccounts: emailAccounts?.map(ea => ({
          id: ea.id,
          email: ea.email,
          provider: ea.provider,
          status: ea.status
        })) || []
      }
    })

  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Debug analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}