import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔧 Adding missing tracking_pixel_id column to email_tracking table...')
    
    // First, check if column already exists
    const { data: columns, error: checkError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'email_tracking' AND column_name = 'tracking_pixel_id';
      `
    })
    
    if (checkError) {
      console.error('❌ Error checking column:', checkError)
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }
    
    const columnExists = columns && columns.length > 0
    
    if (columnExists) {
      console.log('✅ Column tracking_pixel_id already exists!')
      return NextResponse.json({
        success: true,
        message: 'Column tracking_pixel_id already exists',
        alreadyExists: true
      })
    }
    
    // Add the missing column
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE email_tracking 
        ADD COLUMN tracking_pixel_id UUID DEFAULT gen_random_uuid();
      `
    })
    
    if (addColumnError) {
      console.error('❌ Error adding column:', addColumnError)
      return NextResponse.json({ error: addColumnError.message }, { status: 500 })
    }
    
    console.log('✅ Successfully added tracking_pixel_id column!')
    
    // Create index for performance
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_email_tracking_pixel_id 
        ON email_tracking(tracking_pixel_id);
      `
    })
    
    if (indexError) {
      console.warn('⚠️ Warning: Could not create index:', indexError)
    } else {
      console.log('✅ Created index on tracking_pixel_id')
    }
    
    // Verify the column was added
    const { data: verifyColumns, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_name = 'email_tracking' AND column_name = 'tracking_pixel_id';
      `
    })
    
    if (verifyError) {
      console.error('❌ Error verifying column:', verifyError)
    }
    
    return NextResponse.json({
      success: true,
      message: 'tracking_pixel_id column added successfully',
      columnInfo: verifyColumns?.[0] || null,
      nextSteps: [
        'You can now send campaigns again',
        'The tracking system should work properly',
        'Each email will get a unique tracking pixel ID'
      ]
    })
    
  } catch (error) {
    console.error('💥 Add column error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add column',
      details: error.message
    }, { status: 500 })
  }
}