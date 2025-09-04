import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imapProcessor } from '@/lib/imap-processor'
import { decryptSMTPConfig } from '@/lib/encryption'

// POST /api/debug/test-imap-direct - Test IMAP with exact config from database
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { emailAccountId } = body || {}
    
    // Get the specific account
    let query = supabase
      .from('email_accounts')
      .select(`
        id,
        email,
        provider,
        imap_host,
        imap_port,
        imap_username,
        imap_password,
        imap_secure,
        smtp_password
      `)
    
    if (emailAccountId) {
      query = query.eq('id', emailAccountId)
    } else {
      // Default to hung@theaiwhisperer.de
      query = query.eq('email', 'hung@theaiwhisperer.de')
    }
    
    const { data: account, error } = await query.single()

    if (error || !account) {
      return NextResponse.json({
        success: false,
        error: 'Account not found',
        details: error?.message
      }, { status: 404 })
    }

    console.log('🔍 Testing IMAP for account:', account.email)
    
    // Prepare IMAP config exactly like the monitor does
    let password = null
    let passwordSource = 'none'
    
    if (account.imap_password) {
      try {
        password = decryptSMTPConfig(account.imap_password).password || account.imap_password
        passwordSource = 'imap_password (decrypted)'
      } catch (decryptError) {
        console.log('❌ Decryption failed, using raw password:', decryptError.message)
        password = account.imap_password
        passwordSource = 'imap_password (raw)'
      }
    } else if (account.smtp_password) {
      try {
        password = decryptSMTPConfig(account.smtp_password).password || account.smtp_password
        passwordSource = 'smtp_password (decrypted)'
      } catch (decryptError) {
        console.log('❌ SMTP Decryption failed, using raw password:', decryptError.message)
        password = account.smtp_password
        passwordSource = 'smtp_password (raw)'
      }
    }
    
    const imapConfig = {
      host: account.imap_host,
      port: account.imap_port || 993,
      tls: account.imap_secure !== false,
      user: account.imap_username || account.email,
      password: password
    }

    console.log('🔧 IMAP Config:')
    console.log('   Host:', imapConfig.host)
    console.log('   Port:', imapConfig.port)
    console.log('   TLS:', imapConfig.tls)
    console.log('   User:', imapConfig.user)
    console.log('   Password Source:', passwordSource)
    console.log('   Password Length:', password?.length || 0)

    // Test the connection
    const testResult = await imapProcessor.testConnection(imapConfig)

    return NextResponse.json({
      success: true,
      account: {
        email: account.email,
        provider: account.provider
      },
      config: {
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
        user: imapConfig.user,
        passwordSource,
        passwordLength: password?.length || 0
      },
      test_result: testResult
    })

  } catch (error) {
    console.error('❌ Error in direct IMAP test:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}