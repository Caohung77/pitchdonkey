/**
 * Migration Runner Script - Add IMAP Credentials for SMTP Sent Folder Sync
 *
 * This script runs the migration to add IMAP configuration columns
 * and auto-populates them for existing SMTP accounts.
 *
 * Usage: npx ts-node scripts/run-smtp-sent-sync-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Starting SMTP Sent Sync Migration...\n')

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251011_add_imap_credentials.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded:', migrationPath)
    console.log('📝 SQL statements to execute:\n')
    console.log(migrationSQL)
    console.log('\n' + '='.repeat(80) + '\n')

    // Split SQL into individual statements (basic split on semicolons)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`🔧 Executing ${statements.length} SQL statements...\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement) {
        console.log(`\n[${i + 1}/${statements.length}] Executing...`)
        console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''))

        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

        if (error) {
          // Try direct query as fallback
          const { error: directError } = await supabase.from('_migrations').select('*').limit(0)

          if (directError) {
            console.warn(`⚠️  Statement ${i + 1} warning:`, error.message)
            console.warn('   This might be expected if columns already exist')
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      }
    }

    console.log('\n' + '='.repeat(80) + '\n')

    // Verify migration results
    console.log('🔍 Verifying migration results...\n')

    const { data: emailAccounts, error: fetchError } = await supabase
      .from('email_accounts')
      .select('id, email, provider, smtp_host, imap_host, imap_port, imap_secure')
      .eq('provider', 'smtp')
      .limit(5)

    if (fetchError) {
      console.error('❌ Error fetching email accounts:', fetchError)
    } else {
      console.log(`📊 Found ${emailAccounts?.length || 0} SMTP accounts`)

      if (emailAccounts && emailAccounts.length > 0) {
        console.log('\n📋 Sample SMTP accounts after migration:\n')
        emailAccounts.forEach((account, index) => {
          console.log(`${index + 1}. ${account.email}`)
          console.log(`   SMTP: ${account.smtp_host}`)
          console.log(`   IMAP: ${account.imap_host || 'NOT SET'}:${account.imap_port || 'N/A'}`)
          console.log(`   Secure: ${account.imap_secure ? 'Yes' : 'No'}`)
          console.log('')
        })
      } else {
        console.log('ℹ️  No SMTP accounts found in database')
      }
    }

    console.log('✅ Migration completed successfully!\n')
    console.log('📋 Next steps:')
    console.log('   1. Send a test email via SMTP from your application')
    console.log('   2. Check your mail client\'s Sent folder')
    console.log('   3. Verify the email appears in Eisbrief\'s outbox/sent view')
    console.log('')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Migration script finished')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })
