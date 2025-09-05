import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/debug/update-imap-schema - Add missing IMAP columns to existing database
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔧 Updating IMAP schema...')

    // Add missing columns to incoming_emails table
    const updates = [
      // Add IMAP-specific columns if they don't exist
      `ALTER TABLE IF EXISTS public.incoming_emails 
       ADD COLUMN IF NOT EXISTS imap_uid INTEGER;`,
       
      `ALTER TABLE IF EXISTS public.incoming_emails 
       ADD COLUMN IF NOT EXISTS flags TEXT[];`,
       
      `ALTER TABLE IF EXISTS public.incoming_emails 
       ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`,

      // Add missing column to imap_connections table
      `ALTER TABLE IF EXISTS public.imap_connections 
       ADD COLUMN IF NOT EXISTS last_full_reconciliation_at TIMESTAMPTZ;`,

      // Create indexes if they don't exist
      `CREATE INDEX IF NOT EXISTS idx_incoming_emails_imap_uid 
       ON public.incoming_emails(email_account_id, imap_uid);`,
       
      `CREATE INDEX IF NOT EXISTS idx_incoming_emails_archived_at 
       ON public.incoming_emails(archived_at);`
    ]

    const results = []
    for (const sql of updates) {
      try {
        console.log(`🔧 Executing: ${sql.split('\n')[0].substring(0, 60)}...`)
        const { error } = await supabase.rpc('execute_sql', { 
          sql_query: sql.trim()
        })
        
        if (error) {
          console.error('❌ SQL Error:', error)
          results.push({ sql: sql.substring(0, 60), success: false, error: error.message })
        } else {
          results.push({ sql: sql.substring(0, 60), success: true })
        }
      } catch (sqlError) {
        console.error('❌ SQL Execution Error:', sqlError)
        results.push({ 
          sql: sql.substring(0, 60), 
          success: false, 
          error: sqlError.message || 'Unknown SQL error' 
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: failureCount === 0,
      message: `Schema update completed: ${successCount} successful, ${failureCount} failed`,
      results: results,
      summary: {
        total_operations: results.length,
        successful: successCount,
        failed: failureCount
      }
    })

  } catch (error) {
    console.error('❌ Error updating IMAP schema:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update schema'
    }, { status: 500 })
  }
}

// Alternative approach using direct SQL if RPC doesn't work
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔧 Updating IMAP schema (direct SQL approach)...')

    // Check if columns exist first
    const { data: columnCheck } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'incoming_emails')
      .eq('table_schema', 'public')
      .in('column_name', ['imap_uid', 'flags', 'archived_at'])

    const existingColumns = new Set(columnCheck?.map(c => c.column_name) || [])
    
    const updates = []
    
    if (!existingColumns.has('imap_uid')) {
      updates.push('Adding imap_uid column')
    }
    if (!existingColumns.has('flags')) {
      updates.push('Adding flags column')
    }
    if (!existingColumns.has('archived_at')) {
      updates.push('Adding archived_at column')
    }

    return NextResponse.json({
      success: true,
      message: 'Schema check completed',
      existing_columns: Array.from(existingColumns),
      needed_updates: updates,
      note: 'Run the SQL from database-schema-imap.sql manually in Supabase SQL Editor if columns are missing'
    })

  } catch (error) {
    console.error('❌ Error checking IMAP schema:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to check schema'
    }, { status: 500 })
  }
}