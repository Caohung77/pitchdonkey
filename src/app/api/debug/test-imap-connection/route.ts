import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imapProcessor } from '@/lib/imap-processor'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🧪 Testing IMAP connection...')

    // Get all email accounts with IMAP enabled
    const { data: emailAccounts, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('imap_enabled', true)

    if (error) {
      console.error('❌ Error fetching email accounts:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch email accounts'
      }, { status: 500 })
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No IMAP-enabled email accounts found',
        details: {
          instruction: 'Please enable IMAP on at least one email account'
        }
      })
    }

    console.log(`📧 Found ${emailAccounts.length} IMAP-enabled account(s)`)

    const testResults = []

    for (const account of emailAccounts) {
      console.log(`\n🔍 Testing IMAP connection for ${account.email}...`)
      
      const imapConfig = {
        host: account.imap_host,
        port: account.imap_port || 993,
        tls: account.imap_secure ?? true,
        user: account.smtp_username || account.email, // Use SMTP credentials for IMAP
        password: account.smtp_password || ''
      }

      console.log(`📡 Connecting to ${imapConfig.host}:${imapConfig.port} (TLS: ${imapConfig.tls})`)

      try {
        const connectionTest = await imapProcessor.testConnection(imapConfig)
        
        testResults.push({
          email: account.email,
          config: {
            host: imapConfig.host,
            port: imapConfig.port,
            tls: imapConfig.tls,
            user: imapConfig.user
          },
          result: connectionTest
        })

        if (connectionTest.success) {
          console.log(`✅ IMAP connection successful for ${account.email}`)
        } else {
          console.log(`❌ IMAP connection failed for ${account.email}: ${connectionTest.message}`)
        }
      } catch (error) {
        console.error(`❌ Error testing ${account.email}:`, error)
        testResults.push({
          email: account.email,
          config: {
            host: imapConfig.host,
            port: imapConfig.port,
            tls: imapConfig.tls,
            user: imapConfig.user
          },
          result: {
            success: false,
            message: error.message
          }
        })
      }
    }

    const successfulConnections = testResults.filter(r => r.result.success).length
    const totalConnections = testResults.length

    return NextResponse.json({
      success: successfulConnections > 0,
      message: `${successfulConnections}/${totalConnections} IMAP connection(s) successful`,
      results: testResults
    })

  } catch (error) {
    console.error('❌ Error testing IMAP connections:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to test IMAP connections' 
      },
      { status: 500 }
    )
  }
}