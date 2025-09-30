import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Check Campaign Schema
 *
 * This endpoint tests if the required batch scheduling and contact tracking
 * fields exist in the campaigns table.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking campaign schema...')

    const supabase = createServerSupabaseClient()

    // Try to select all the fields that campaign processor expects
    const { data, error } = await supabase
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

    if (error) {
      console.error('❌ Schema check failed:', error)

      // Parse error to identify missing fields
      const missingFields = []
      if (error.message.includes('first_batch_sent_at')) missingFields.push('first_batch_sent_at')
      if (error.message.includes('next_batch_send_time')) missingFields.push('next_batch_send_time')
      if (error.message.includes('current_batch_number')) missingFields.push('current_batch_number')
      if (error.message.includes('contacts_remaining')) missingFields.push('contacts_remaining')
      if (error.message.includes('contacts_processed')) missingFields.push('contacts_processed')
      if (error.message.includes('contacts_failed')) missingFields.push('contacts_failed')
      if (error.message.includes('batch_history')) missingFields.push('batch_history')

      return NextResponse.json({
        success: false,
        schemaValid: false,
        error: 'Missing required database fields',
        missingFields,
        errorDetails: error.message,
        solution: 'Run the database migrations to add missing fields'
      })
    }

    // Also check if we have any campaigns in sending status
    const { data: sendingCampaigns, error: sendingError } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('status', 'sending')

    console.log('✅ Schema check passed')

    return NextResponse.json({
      success: true,
      schemaValid: true,
      message: 'All required fields exist in campaigns table',
      sendingCampaigns: sendingCampaigns || [],
      sendingCount: sendingCampaigns?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Critical error checking schema:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to check campaign schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}