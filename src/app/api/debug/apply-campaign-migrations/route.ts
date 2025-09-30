import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Apply Campaign Database Migrations
 *
 * This endpoint applies the missing database migrations for batch scheduling
 * and contact tracking to fix stuck campaign processing.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting campaign database migration...')

    const supabase = createServerSupabaseClient()

    // Apply batch scheduling migration
    console.log('📅 Applying batch scheduling migration...')
    const batchMigration = `
      -- Add next_batch_send_time field to track when the next batch should be sent
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS next_batch_send_time TIMESTAMP WITH TIME ZONE;

      -- Add first_batch_sent_at to track the original send time for interval calculations
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS first_batch_sent_at TIMESTAMP WITH TIME ZONE;

      -- Add batch_number to track which batch we're currently on
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_batch_number INTEGER DEFAULT 0;

      -- Index for efficient querying of campaigns ready for batch sending
      CREATE INDEX IF NOT EXISTS idx_campaigns_next_batch_send_time
      ON campaigns(next_batch_send_time)
      WHERE status IN ('sending', 'running');

      -- Index for efficient status + timing queries
      CREATE INDEX IF NOT EXISTS idx_campaigns_batch_processing
      ON campaigns(status, next_batch_send_time, daily_send_limit)
      WHERE status IN ('sending', 'running', 'scheduled');
    `

    // Execute each statement individually to handle IF NOT EXISTS properly
    const batchStatements = [
      'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS next_batch_send_time TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS first_batch_sent_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_batch_number INTEGER DEFAULT 0;'
    ]

    let batchError = null
    for (const statement of batchStatements) {
      const { error } = await supabase.rpc('exec', { sql: statement })
      if (error) {
        console.error('❌ Statement failed:', statement, error)
        batchError = error
      }
    }

    if (batchError) {
      console.error('❌ Batch migration failed:', batchError)
      // Continue anyway - fields might already exist
    } else {
      console.log('✅ Batch scheduling migration applied successfully')
    }

    // Apply contact tracking migration
    console.log('👥 Applying contact tracking migration...')
    const contactMigration = `
      -- Add contact tracking fields to campaigns table
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_processed JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_remaining JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_failed JSONB DEFAULT '[]'::jsonb;

      -- Add batch tracking
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_history JSONB DEFAULT '[]'::jsonb;

      -- Create index for better performance on contact tracking queries
      CREATE INDEX IF NOT EXISTS idx_campaigns_contacts_processed ON campaigns USING GIN (contacts_processed);
      CREATE INDEX IF NOT EXISTS idx_campaigns_contacts_remaining ON campaigns USING GIN (contacts_remaining);
    `

    // Execute contact tracking statements individually
    const contactStatements = [
      'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_processed JSONB DEFAULT \'[]\'::jsonb;',
      'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_remaining JSONB DEFAULT \'[]\'::jsonb;',
      'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_failed JSONB DEFAULT \'[]\'::jsonb;',
      'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_history JSONB DEFAULT \'[]\'::jsonb;'
    ]

    let contactError = null
    for (const statement of contactStatements) {
      const { error } = await supabase.rpc('exec', { sql: statement })
      if (error) {
        console.error('❌ Statement failed:', statement, error)
        contactError = error
      }
    }

    if (contactError) {
      console.error('❌ Contact tracking migration failed:', contactError)
      // Continue anyway - fields might already exist
    } else {
      console.log('✅ Contact tracking migration applied successfully')
    }

    // Initialize existing campaigns with default values
    console.log('🔄 Initializing existing campaigns...')
    const { error: initError } = await supabase
      .from('campaigns')
      .update({
        contacts_processed: [],
        contacts_remaining: [],
        contacts_failed: [],
        batch_history: [],
        current_batch_number: 0
      })
      .is('contacts_processed', null)

    if (initError) {
      console.error('⚠️ Warning: Could not initialize existing campaigns:', initError)
    } else {
      console.log('✅ Existing campaigns initialized')
    }

    // Verify schema by testing a select query
    console.log('🔍 Verifying database schema...')
    const { data, error: testError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        first_batch_sent_at,
        next_batch_send_time,
        current_batch_number,
        contacts_remaining,
        contacts_processed,
        contacts_failed,
        batch_history
      `)
      .limit(1)

    if (testError) {
      console.error('❌ Schema verification failed:', testError)
      return NextResponse.json({
        success: false,
        error: 'Database schema verification failed',
        details: testError.message
      }, { status: 500 })
    }

    console.log('✅ Database schema verified successfully')

    return NextResponse.json({
      success: true,
      message: 'Campaign database migrations applied successfully',
      details: {
        batchMigrationApplied: !batchError,
        contactTrackingApplied: !contactError,
        existingCampaignsInitialized: !initError,
        schemaVerified: true
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Critical error applying migrations:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to apply campaign migrations',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}