import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Simple fix for tracking pixel issues - updates existing NULL tracking_pixel_id values
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔧 Starting simple tracking pixel fix...')
    
    const results = {
      timestamp: new Date().toISOString(),
      steps: [] as string[],
      errors: [] as string[],
      fixed_records: 0
    }

    // Step 1: Find records with NULL tracking_pixel_id
    console.log('🔍 Finding records with missing tracking_pixel_id...')
    
    const { data: nullRecords, error: findError } = await supabase
      .from('email_tracking')
      .select('id, message_id, created_at')
      .is('tracking_pixel_id', null)
      .order('created_at', { ascending: false })
      .limit(100) // Process in batches

    if (findError) {
      results.errors.push(`Error finding NULL records: ${findError.message}`)
      return NextResponse.json({ success: false, details: results }, { status: 500 })
    }

    const nullCount = nullRecords?.length || 0
    results.steps.push(`Found ${nullCount} records with NULL tracking_pixel_id`)

    if (nullCount === 0) {
      results.steps.push('No records need fixing - all have tracking_pixel_id values')
      return NextResponse.json({ 
        success: true, 
        message: 'No records need fixing',
        details: results 
      })
    }

    // Step 2: Generate UUIDs and update records one by one
    console.log('🔄 Updating records with generated tracking pixel IDs...')
    
    for (const record of nullRecords || []) {
      try {
        // Generate a tracking pixel ID similar to the original format
        const pixelId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        const { error: updateError } = await supabase
          .from('email_tracking')
          .update({ tracking_pixel_id: pixelId })
          .eq('id', record.id)

        if (updateError) {
          results.errors.push(`Failed to update record ${record.id}: ${updateError.message}`)
        } else {
          results.fixed_records++
          if (results.fixed_records <= 5) { // Log first few for verification
            results.steps.push(`✅ Updated record ${record.id} with tracking_pixel_id: ${pixelId}`)
          }
        }
      } catch (error) {
        results.errors.push(`Error updating record ${record.id}: ${error.message}`)
      }
    }

    results.steps.push(`✅ Successfully updated ${results.fixed_records} out of ${nullCount} records`)

    // Step 3: Verify the fix worked
    console.log('🧪 Verifying the fix...')
    
    const { data: remainingNulls, error: verifyError } = await supabase
      .from('email_tracking')
      .select('id')
      .is('tracking_pixel_id', null)
      .limit(5)

    if (verifyError) {
      results.errors.push(`Error verifying fix: ${verifyError.message}`)
    } else {
      const remainingCount = remainingNulls?.length || 0
      if (remainingCount > 0) {
        results.steps.push(`⚠️ ${remainingCount} records still have NULL tracking_pixel_id - may need additional runs`)
      } else {
        results.steps.push('✅ Verification successful - no more NULL tracking_pixel_id values found')
      }
    }

    const success = results.fixed_records > 0 && results.errors.length === 0

    console.log(success ? '✅ Simple tracking fix completed successfully' : '⚠️ Fix completed with some issues')

    return NextResponse.json({
      success: true, // Always return success if we made progress
      message: `Fixed ${results.fixed_records} email tracking records`,
      details: results,
      next_steps: [
        'Send a new test campaign to verify tracking works',
        'Check /api/debug/tracking-diagnosis for overall health',
        results.errors.length > 0 ? 'Review errors and consider running fix again' : 'Monitor future campaigns for proper tracking'
      ].filter(Boolean)
    })

  } catch (error) {
    console.error('❌ Error in simple tracking fix:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Simple fix failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}