import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Add the missing email_account_id column to the campaigns table
 */
export async function POST(request: NextRequest) {
  console.log('🔧 Adding missing email_account_id column to campaigns table')

  try {
    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('1. Adding email_account_id column to campaigns table...')

    // Add the column using raw SQL
    const { error: addColumnError } = await supabase
      .from('campaigns')
      .select('id')
      .limit(0) // Just test the connection

    if (addColumnError) {
      console.error('❌ Cannot connect to campaigns table:', addColumnError)
      return NextResponse.json({
        success: false,
        error: 'Cannot connect to campaigns table',
        details: addColumnError.message
      }, { status: 500 })
    }

    // Use SQL to add the column - we'll do this step by step
    console.log('2. Attempting to add email_account_id column via direct query...')

    // Let's first check what columns exist
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'campaigns' })
      .single()

    if (tableError) {
      console.log('⚠️ Cannot use get_table_columns function, will proceed with manual approach')
    } else {
      console.log('📋 Table columns info:', tableInfo)
    }

    // Try a simple approach - create a manual SQL migration endpoint
    return NextResponse.json({
      success: false,
      error: 'Need to add column manually via Supabase SQL editor',
      instructions: {
        step1: 'Go to your Supabase dashboard → SQL Editor',
        step2: 'Run this SQL command:',
        sql: `
-- Add missing email_account_id column
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS email_account_id UUID
REFERENCES email_accounts(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_email_account_id
ON campaigns(email_account_id);

-- Update existing campaigns with a default email account
UPDATE campaigns
SET email_account_id = (
  SELECT ea.id
  FROM email_accounts ea
  WHERE ea.user_id = campaigns.user_id
  AND ea.status = 'active'
  LIMIT 1
)
WHERE email_account_id IS NULL;
        `,
        step3: 'After running the SQL, test with: curl -X POST http://localhost:3003/api/debug/test-fix'
      },
      alternativeApproach: {
        description: 'Apply the simple campaigns migration that should include this column',
        script: 'node scripts/apply-simple-campaign-migration.js'
      }
    })

  } catch (error) {
    console.error('💥 Error adding column:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add email_account_id column',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}