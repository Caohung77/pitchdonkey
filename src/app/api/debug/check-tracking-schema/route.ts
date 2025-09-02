import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Check email tracking database schema and sample data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔍 Checking email tracking schema and data...')
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      schema_issues: [] as string[],
      data_issues: [] as string[],
      recommendations: [] as string[]
    }

    // 1. Check email_tracking table structure by trying to insert a test record
    console.log('📊 Testing email_tracking table structure...')
    
    try {
      // First, let's see what columns exist by checking a recent record
      const { data: sampleData, error: sampleError } = await supabase
        .from('email_tracking')
        .select('*')
        .limit(1)

      if (sampleError) {
        diagnosis.schema_issues.push(`Cannot query email_tracking table: ${sampleError.message}`)
      } else {
        console.log('📋 Sample email_tracking record structure:', sampleData?.[0] ? Object.keys(sampleData[0]) : 'No records')
        diagnosis.data_issues.push(`Email tracking table columns: ${sampleData?.[0] ? Object.keys(sampleData[0]).join(', ') : 'No records to examine'}`)
        
        if (sampleData?.[0]) {
          const hasTrackingPixelId = 'tracking_pixel_id' in sampleData[0]
          if (!hasTrackingPixelId) {
            diagnosis.schema_issues.push('tracking_pixel_id column is missing from email_tracking table')
            diagnosis.recommendations.push('Add tracking_pixel_id column with UUID default to email_tracking table')
          } else {
            diagnosis.data_issues.push(`tracking_pixel_id sample value: ${sampleData[0].tracking_pixel_id}`)
            
            if (!sampleData[0].tracking_pixel_id) {
              diagnosis.data_issues.push('tracking_pixel_id values are NULL - default value may not be working')
            }
          }
        }
      }
    } catch (error) {
      diagnosis.schema_issues.push(`Error checking email_tracking schema: ${error.message}`)
    }

    // 2. Test creating a tracking record to see what happens
    console.log('🧪 Testing tracking record creation...')
    
    try {
      const testMessageId = `test_${Date.now()}`
      
      const { data: testRecord, error: testError } = await supabase
        .from('email_tracking')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
          campaign_id: '00000000-0000-0000-0000-000000000000', // Test UUID  
          contact_id: '00000000-0000-0000-0000-000000000000', // Test UUID
          message_id: testMessageId,
          subject_line: 'Test tracking record',
          email_body: 'Test email body',
        })
        .select('tracking_pixel_id, id')
        .single()

      if (testError) {
        diagnosis.schema_issues.push(`Cannot create test tracking record: ${testError.message}`)
        
        // Common issues
        if (testError.message.includes('tracking_pixel_id')) {
          diagnosis.recommendations.push('The tracking_pixel_id column may need a DEFAULT value like gen_random_uuid()')
        }
        if (testError.message.includes('null value')) {
          diagnosis.recommendations.push('Some required columns may be missing NOT NULL constraints or default values')
        }
        if (testError.message.includes('foreign key')) {
          diagnosis.recommendations.push('Foreign key constraints may be preventing test record creation (use real IDs for testing)')
        }
      } else {
        console.log('✅ Successfully created test tracking record:', testRecord)
        diagnosis.data_issues.push(`Test record created with tracking_pixel_id: ${testRecord.tracking_pixel_id}`)
        
        if (!testRecord.tracking_pixel_id) {
          diagnosis.schema_issues.push('tracking_pixel_id is NULL even after creation - column needs DEFAULT value')
          diagnosis.recommendations.push('Add DEFAULT gen_random_uuid() to tracking_pixel_id column')
        }
        
        // Clean up test record
        await supabase
          .from('email_tracking')
          .delete()
          .eq('id', testRecord.id)
        
        diagnosis.data_issues.push('Test record cleaned up successfully')
      }
    } catch (error) {
      diagnosis.schema_issues.push(`Error in tracking record test: ${error.message}`)
    }

    // 3. Check for actual tracking pixel usage patterns
    console.log('📈 Checking tracking pixel usage patterns...')
    
    try {
      const { data: recentTracking, error: recentError } = await supabase
        .from('email_tracking')
        .select('id, tracking_pixel_id, sent_at, opened_at, status')
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentError) {
        diagnosis.data_issues.push(`Cannot query recent tracking data: ${recentError.message}`)
      } else {
        const totalRecords = recentTracking?.length || 0
        const recordsWithPixelId = recentTracking?.filter(r => r.tracking_pixel_id).length || 0
        const recordsWithOpens = recentTracking?.filter(r => r.opened_at).length || 0
        
        diagnosis.data_issues.push(`Recent tracking: ${totalRecords} records, ${recordsWithPixelId} have pixel IDs, ${recordsWithOpens} have opens`)
        
        if (totalRecords > 0 && recordsWithPixelId === 0) {
          diagnosis.schema_issues.push('No recent records have tracking_pixel_id - this is the main issue!')
          diagnosis.recommendations.push('Fix tracking_pixel_id column to auto-generate UUIDs')
        }
        
        if (recordsWithPixelId > 0 && recordsWithOpens === 0) {
          diagnosis.data_issues.push('Tracking pixels exist but no opens recorded - check pixel endpoint or email client issues')
        }
      }
    } catch (error) {
      diagnosis.data_issues.push(`Error checking tracking patterns: ${error.message}`)
    }

    // 4. Provide SQL fix if needed
    if (diagnosis.schema_issues.some(issue => issue.includes('tracking_pixel_id'))) {
      diagnosis.recommendations.push('SQL Fix: ALTER TABLE email_tracking ALTER COLUMN tracking_pixel_id SET DEFAULT gen_random_uuid();')
      diagnosis.recommendations.push('Or if column does not exist: ALTER TABLE email_tracking ADD COLUMN tracking_pixel_id UUID DEFAULT gen_random_uuid();')
    }

    const hasIssues = diagnosis.schema_issues.length > 0 || diagnosis.data_issues.some(issue => issue.includes('NULL') || issue.includes('missing'))

    return NextResponse.json({
      success: true,
      diagnosis,
      status: hasIssues ? 'issues_found' : 'healthy',
      summary: {
        schema_issues: diagnosis.schema_issues.length,
        data_issues: diagnosis.data_issues.length,
        main_issue: hasIssues ? 'Tracking pixel ID generation not working' : 'Schema appears healthy'
      }
    })

  } catch (error) {
    console.error('❌ Error in schema check:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Schema check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}