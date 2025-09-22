/**
 * Debug script to test the exact campaign query that the cron job uses
 * This will help us see what's wrong with the SMTP campaign
 */

const { createClient } = require('@supabase/supabase-js')

async function debugCampaignQuery() {
  console.log('🔍 Debugging Campaign Query')
  console.log('============================')

  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const now = new Date()

  console.log(`🕐 Current time: ${now.toISOString()}`)
  console.log('')

  // 1. Check ALL campaigns
  console.log('📊 Step 1: All campaigns')
  const { data: allCampaigns, error: allError } = await supabase
    .from('campaigns')
    .select('id, name, status, scheduled_date, email_account_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (allError) {
    console.error('❌ Error fetching all campaigns:', allError)
    return
  }

  console.log(`Found ${allCampaigns?.length || 0} campaigns:`)
  allCampaigns?.forEach(c => {
    console.log(`  - ${c.name}: status=${c.status}, scheduled=${c.scheduled_date}, email_account=${c.email_account_id}`)
  })
  console.log('')

  // 2. Check campaigns with the exact cron query (the one that's failing)
  console.log('📊 Step 2: Cron job query (what cron actually sees)')
  const { data: cronCampaigns, error: cronError } = await supabase
    .from('campaigns')
    .select(`
      *,
      email_accounts!inner(
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

  if (cronError) {
    console.error('❌ Error with cron query:', cronError)
    return
  }

  console.log(`Found ${cronCampaigns?.length || 0} campaigns with email accounts:`)
  cronCampaigns?.forEach(c => {
    console.log(`  - ${c.name}: status=${c.status}, scheduled=${c.scheduled_date}`)
    console.log(`    Email: ${c.email_accounts.email} (${c.email_accounts.provider})`)
  })
  console.log('')

  // 3. Check SMTP campaigns specifically
  console.log('📊 Step 3: SMTP campaigns specifically')
  const { data: smtpCampaigns, error: smtpError } = await supabase
    .from('campaigns')
    .select(`
      *,
      email_accounts(*)
    `)
    .ilike('name', '%smtp%')

  if (smtpError) {
    console.error('❌ Error fetching SMTP campaigns:', smtpError)
    return
  }

  console.log(`Found ${smtpCampaigns?.length || 0} SMTP campaigns:`)
  smtpCampaigns?.forEach(c => {
    console.log(`  - ${c.name}: status=${c.status}, scheduled=${c.scheduled_date}`)
    console.log(`    Email account: ${c.email_accounts ? c.email_accounts.email : 'NONE'} (${c.email_accounts?.provider || 'NONE'})`)
    console.log(`    Account ID: ${c.email_account_id}`)
  })
  console.log('')

  // 4. Check email accounts
  console.log('📊 Step 4: Available email accounts')
  const { data: emailAccounts, error: accountsError } = await supabase
    .from('email_accounts')
    .select('id, email, provider, status')
    .eq('status', 'active')

  if (accountsError) {
    console.error('❌ Error fetching email accounts:', accountsError)
    return
  }

  console.log(`Found ${emailAccounts?.length || 0} active email accounts:`)
  emailAccounts?.forEach(ea => {
    console.log(`  - ${ea.email} (${ea.provider}) - ID: ${ea.id}`)
  })
  console.log('')

  // 5. Analysis
  console.log('🔍 Analysis:')
  const smtpTestCampaign = allCampaigns?.find(c => c.name.includes('SMTP Test'))
  if (smtpTestCampaign) {
    console.log(`✅ Found SMTP Test Campaign: ${smtpTestCampaign.id}`)
    console.log(`   Status: ${smtpTestCampaign.status}`)
    console.log(`   Scheduled: ${smtpTestCampaign.scheduled_date}`)
    console.log(`   Email Account ID: ${smtpTestCampaign.email_account_id}`)

    if (!smtpTestCampaign.email_account_id) {
      console.log('❌ PROBLEM: Campaign has no email_account_id - this is why cron ignores it!')
    } else {
      const hasAccount = emailAccounts?.find(ea => ea.id === smtpTestCampaign.email_account_id)
      if (!hasAccount) {
        console.log('❌ PROBLEM: Campaign references non-existent or inactive email account!')
      } else {
        console.log('✅ Campaign has valid email account')
      }
    }
  } else {
    console.log('❌ No SMTP Test Campaign found')
  }
}

// Run the debug
debugCampaignQuery().catch(console.error)