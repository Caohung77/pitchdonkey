import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔍 Getting actual table schema...')
    
    // Get a sample record to see the actual fields
    const { data: sampleRecord, error } = await supabase
      .from('email_tracking')
      .select('*')
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const actualFields = sampleRecord ? Object.keys(sampleRecord) : []
    
    // Expected fields from our insert attempts
    const expectedFields = ['campaign_id', 'contact_id', 'step_number', 'status', 'subject', 'content', 'sent_at']
    
    // Check which fields are missing
    const missingFields = expectedFields.filter(field => !actualFields.includes(field))
    const extraFields = actualFields.filter(field => !expectedFields.includes(field))
    
    return NextResponse.json({
      success: true,
      table_info: {
        name: 'email_tracking',
        has_records: !!sampleRecord,
        total_fields: actualFields.length
      },
      actual_fields: actualFields,
      expected_fields: expectedFields,
      schema_mismatch: {
        missing_from_table: missingFields,
        extra_in_table: extraFields
      },
      sample_record: sampleRecord,
      recommendations: missingFields.length > 0 ? [
        `The table is missing fields: ${missingFields.join(', ')}`,
        'Need to either update the table schema or adjust the insert code',
        'Current inserts are likely failing silently due to unknown columns'
      ] : [
        'Schema matches expectations',
        'Inserts should work properly'
      ]
    })
    
  } catch (error) {
    console.error('💥 Schema check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Schema check failed',
      details: error.message
    }, { status: 500 })
  }
}