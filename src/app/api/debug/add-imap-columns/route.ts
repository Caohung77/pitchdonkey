import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔧 Adding IMAP columns to email_accounts table...')

    // Check if columns already exist by trying to select them
    const { data: checkData, error: checkError } = await supabase
      .from('email_accounts')
      .select('imap_enabled, imap_host, imap_port, imap_secure')
      .limit(1)

    if (!checkError) {
      // Columns already exist
      console.log('✅ IMAP columns already exist in email_accounts table')
      return NextResponse.json({
        success: true,
        message: 'IMAP columns already exist',
        details: {
          columnsAdded: 0,
          reason: 'Columns already exist'
        }
      })
    }

    // If we get here, columns likely don't exist, try to add them
    // Note: Since Supabase doesn't have exec_sql, we'll provide SQL instructions
    console.log('❌ IMAP columns not found. Please run this SQL in your Supabase SQL Editor:')
    
    const sqlToRun = `
-- Add IMAP columns to email_accounts table
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS imap_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS imap_host TEXT,
ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993,
ADD COLUMN IF NOT EXISTS imap_secure BOOLEAN DEFAULT true;
    `.trim()

    console.log('\n' + sqlToRun + '\n')

    return NextResponse.json({
      success: false,
      message: 'IMAP columns need to be added manually',
      details: {
        instruction: 'Please run the provided SQL in your Supabase SQL Editor',
        sql: sqlToRun
      }
    })

  } catch (error) {
    console.error('❌ Error checking IMAP columns:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to check IMAP columns' 
      },
      { status: 500 }
    )
  }
}