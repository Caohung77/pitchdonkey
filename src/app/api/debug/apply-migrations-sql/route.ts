import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Apply Database Migrations via SQL
 *
 * This endpoint executes the missing migrations using direct SQL execution
 * to add the required batch scheduling and contact tracking fields.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Applying campaign database migrations via SQL...')

    const supabase = createServerSupabaseClient()

    const migrations = [
      {
        name: 'batch_scheduling',
        sql: `
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS next_batch_send_time TIMESTAMP WITH TIME ZONE;
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS first_batch_sent_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_batch_number INTEGER DEFAULT 0;
        `
      },
      {
        name: 'contact_tracking',
        sql: `
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_processed JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_remaining JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_failed JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_history JSONB DEFAULT '[]'::jsonb;
        `
      }
    ]

    const results = []

    for (const migration of migrations) {
      console.log(`📝 Applying ${migration.name} migration...`)

      try {
        // Use execute_sql function to run migration
        const { data, error } = await supabase.rpc('execute_sql', {
          query: migration.sql
        })

        if (error) {
          console.error(`❌ ${migration.name} migration failed:`, error)
          results.push({
            migration: migration.name,
            success: false,
            error: error.message
          })
        } else {
          console.log(`✅ ${migration.name} migration applied successfully`)
          results.push({
            migration: migration.name,
            success: true,
            result: data
          })
        }
      } catch (err) {
        console.error(`💥 Error applying ${migration.name}:`, err)
        results.push({
          migration: migration.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    // Initialize existing campaigns
    console.log('🔄 Initializing existing campaigns...')
    try {
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
    } catch (err) {
      console.error('⚠️ Warning: Initialization error:', err)
    }

    const successCount = results.filter(r => r.success).length
    const totalMigrations = migrations.length

    return NextResponse.json({
      success: successCount > 0,
      message: `Applied ${successCount}/${totalMigrations} migrations`,
      migrations: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Critical error applying migrations:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to apply migrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}