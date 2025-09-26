import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log(`🧪 Testing sent emails API for user: ${user.email} (${user.id})`)

    // Test the exact same query that the mailbox page uses
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Replicate the API query from /api/mailbox/sent/route.ts
    const baseSelect = `
      id,
      subject,
      content,
      send_status,
      sent_at,
      created_at,
      email_account_id,
      contact_id,
      campaign_id,
      contacts (
        id,
        first_name,
        last_name,
        email
      ),
      campaigns (
        id,
        name
      )
    `

    const startTime = Date.now()

    const { data: emails, error, count } = await supabase
      .from('email_sends')
      .select(baseSelect, { count: 'exact' })
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false, nullsLast: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const queryTime = Date.now() - startTime

    if (error) {
      console.error('❌ Query failed:', error)
      return NextResponse.json({
        success: false,
        error: 'Query failed',
        details: {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        },
        queryTime
      }, { status: 400 })
    }

    // Get account information for the emails
    const accountIds = (emails || [])
      .map(email => email.email_account_id)
      .filter((value): value is string => Boolean(value))

    let accountMap: Record<string, { id: string; email: string; provider: string }> = {}

    if (accountIds.length > 0) {
      const { data: accounts, error: accountError } = await supabase
        .from('email_accounts')
        .select('id, email, provider, status')
        .in('id', Array.from(new Set(accountIds)))
        .eq('user_id', user.id)

      if (accountError) {
        console.warn('⚠️ Could not fetch account metadata:', accountError)
      } else if (accounts) {
        for (const account of accounts) {
          accountMap[account.id] = {
            id: account.id,
            email: account.email,
            provider: account.provider,
          }
        }
      }
    }

    // Enhance emails with account info
    const enhancedEmails = (emails || []).map(email => ({
      ...email,
      email_accounts: email.email_account_id ? accountMap[email.email_account_id] || null : null,
    }))

    console.log(`✅ Query successful! Found ${count} emails in ${queryTime}ms`)

    const response = NextResponse.json({
      success: true,
      message: `Successfully retrieved ${count} sent emails`,
      data: {
        emails: enhancedEmails,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
        metadata: {
          user_id: user.id,
          user_email: user.email,
          query_time_ms: queryTime,
          account_map_size: Object.keys(accountMap).length,
          unique_accounts: accountIds.length,
          timestamp: new Date().toISOString()
        }
      }
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('🚨 Exception in test:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed with exception',
      details: String(error)
    }, { status: 500 })
  }
})

// Also provide POST method to insert test data
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log(`🧪 Creating test data for user: ${user.email} (${user.id})`)

    // Get user's first contact and email account
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .eq('user_id', user.id)
      .limit(1)

    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('id, email, provider')
      .eq('user_id', user.id)
      .limit(1)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No contacts found - create a contact first'
      }, { status: 400 })
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No email accounts found - add an email account first'
      }, { status: 400 })
    }

    const contact = contacts[0]
    const emailAccount = emailAccounts[0]

    // Create test email sends
    const testEmails = [
      {
        user_id: user.id,
        contact_id: contact.id,
        email_account_id: emailAccount.id,
        subject: 'Welcome to our platform!',
        content: 'Thank you for joining us. We are excited to have you on board!',
        send_status: 'sent',
        sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        message_id: `test_${Date.now()}_1`
      },
      {
        user_id: user.id,
        contact_id: contact.id,
        email_account_id: emailAccount.id,
        subject: 'Follow-up: Getting started guide',
        content: 'Here are some tips to help you get the most out of our platform...',
        send_status: 'delivered',
        sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        message_id: `test_${Date.now()}_2`
      },
      {
        user_id: user.id,
        contact_id: contact.id,
        email_account_id: emailAccount.id,
        subject: 'Quick check-in',
        content: 'Hope everything is going well with your setup!',
        send_status: 'sent',
        sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        message_id: `test_${Date.now()}_3`
      }
    ]

    const { data: insertedEmails, error: insertError } = await supabase
      .from('email_sends')
      .insert(testEmails)
      .select()

    if (insertError) {
      console.error('❌ Failed to insert test data:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create test data',
        details: insertError
      }, { status: 400 })
    }

    console.log(`✅ Created ${insertedEmails?.length} test emails`)

    return NextResponse.json({
      success: true,
      message: `Created ${insertedEmails?.length} test emails`,
      data: {
        inserted_emails: insertedEmails,
        contact_used: contact,
        email_account_used: emailAccount
      }
    })

  } catch (error) {
    console.error('🚨 Exception creating test data:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create test data',
      details: String(error)
    }, { status: 500 })
  }
})