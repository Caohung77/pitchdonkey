import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔧 Verifying IMAP database schema...')

    // Verify that all IMAP tables exist by trying to select from them
    const tablesToCheck = [
      'incoming_emails',
      'email_replies', 
      'email_processing_jobs',
      'imap_connections'
    ]

    const verificationResults = []
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)
        
        if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
          // Table exists but query failed for other reasons (like RLS)
          verificationResults.push({ table, exists: true, error: error.message })
          console.log(`✅ Table ${table} exists`)
        } else if (error) {
          // Table doesn't exist
          verificationResults.push({ table, exists: false, error: error.message })
          console.log(`❌ Table ${table} does not exist`)
        } else {
          // Table exists and query succeeded
          verificationResults.push({ table, exists: true, error: null })
          console.log(`✅ Table ${table} exists and is accessible`)
        }
      } catch (err) {
        verificationResults.push({ table, exists: false, error: err.message })
        console.log(`❌ Error checking table ${table}:`, err.message)
      }
    }

    const existingTables = verificationResults.filter(r => r.exists).map(r => r.table)
    const missingTables = verificationResults.filter(r => !r.exists).map(r => r.table)

    return NextResponse.json({
      success: existingTables.length === tablesToCheck.length,
      message: existingTables.length === tablesToCheck.length 
        ? 'IMAP database schema verified successfully'
        : `IMAP schema incomplete: ${missingTables.length} tables missing`,
      details: {
        existingTables,
        missingTables,
        verificationResults: verificationResults
      }
    })

  } catch (error) {
    console.error('❌ Error setting up IMAP schema:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to setup IMAP schema' 
      },
      { status: 500 }
    )
  }
}