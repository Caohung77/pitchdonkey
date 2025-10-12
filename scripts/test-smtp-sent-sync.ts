import { IMAPProcessor } from '../lib/imap-processor'
import { createServerSupabaseClient } from '../lib/supabase-server'

async function testSMTPSentSync() {
  const supabase = createServerSupabaseClient()

  // Get the SMTP account
  const { data: account, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', 'a6ff7eb4-63ee-42f4-ac8a-d93f353d415c')
    .single()

  if (error || !account) {
    console.error('Failed to fetch account:', error)
    return
  }

  console.log('📧 Testing SMTP sent folder sync for:', account.email)
  console.log('📧 Provider:', account.provider)
  console.log('📧 IMAP Host:', account.imap_host)
  console.log('📧 IMAP Port:', account.imap_port)

  const imapConfig = {
    host: account.imap_host,
    port: account.imap_port || 993,
    tls: account.imap_secure !== false,
    user: account.imap_username || account.email,
    password: account.smtp_password || account.imap_password
  }

  const imapProcessor = new IMAPProcessor()

  try {
    console.log('\n🔄 Syncing sent emails...')
    const result = await imapProcessor.syncSentEmails(
      account.user_id,
      account.id,
      imapConfig,
      { lookbackDays: 30, maxMessages: 200 }
    )

    console.log('\n✅ Sync completed!')
    console.log('📊 Results:', JSON.stringify(result, null, 2))

    // Check database for any synced sent emails
    const { data: sentEmails, count } = await supabase
      .from('outgoing_emails')
      .select('*', { count: 'exact' })
      .eq('email_account_id', account.id)

    console.log(`\n📧 Total sent emails in database: ${count}`)
    if (sentEmails && sentEmails.length > 0) {
      console.log('📧 Sample sent emails:')
      sentEmails.slice(0, 5).forEach((email: any) => {
        console.log(`   - "${email.subject}" (${email.date_sent})`)
      })
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testSMTPSentSync()
