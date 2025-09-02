import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Fix email tracking schema issues - adds tracking_pixel_id with proper default
 * This should be run by the system administrator to fix tracking issues
 */
export async function POST(request: NextRequest) {
  try {
    // Use service role to modify schema
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase configuration'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('🔧 Starting email tracking schema fix...')
    
    const results = {
      timestamp: new Date().toISOString(),
      steps: [] as string[],
      errors: [] as string[],
      success: true
    }

    // Step 1: Check if tracking_pixel_id column exists
    console.log('📊 Checking current schema...')
    
    try {
      const { data: testData, error: testError } = await supabase
        .from('email_tracking')
        .select('tracking_pixel_id')
        .limit(1)

      if (testError) {
        if (testError.message.includes('column "tracking_pixel_id" does not exist')) {
          results.steps.push('tracking_pixel_id column does not exist - will create it')
          
          // Add the column with UUID default
          const { error: addColumnError } = await supabase.rpc('exec_sql', {
            sql: `
              ALTER TABLE email_tracking 
              ADD COLUMN IF NOT EXISTS tracking_pixel_id UUID DEFAULT gen_random_uuid();
            `
          })
          
          if (addColumnError) {
            results.errors.push(`Failed to add tracking_pixel_id column: ${addColumnError.message}`)
            results.success = false
          } else {
            results.steps.push('✅ Added tracking_pixel_id column with UUID default')
          }
        } else {
          results.errors.push(`Error checking schema: ${testError.message}`)
          results.success = false
        }
      } else {
        results.steps.push('tracking_pixel_id column exists')
        
        // Check if it has a proper default value by looking at recent NULL values
        const { data: nullData, error: nullError } = await supabase
          .from('email_tracking')
          .select('id, tracking_pixel_id')
          .is('tracking_pixel_id', null)
          .limit(5)

        if (nullError) {
          results.errors.push(`Error checking for NULL values: ${nullError.message}`)
        } else {
          const nullCount = nullData?.length || 0
          if (nullCount > 0) {
            results.steps.push(`Found ${nullCount} records with NULL tracking_pixel_id - fixing default value`)
            
            // Set default value for existing column
            const { error: setDefaultError } = await supabase.rpc('exec_sql', {
              sql: `
                ALTER TABLE email_tracking 
                ALTER COLUMN tracking_pixel_id SET DEFAULT gen_random_uuid();
              `
            })
            
            if (setDefaultError) {
              results.errors.push(`Failed to set default value: ${setDefaultError.message}`)
              results.success = false
            } else {
              results.steps.push('✅ Set default value for tracking_pixel_id column')
              
              // Update existing NULL records
              const { error: updateNullsError } = await supabase.rpc('exec_sql', {
                sql: `
                  UPDATE email_tracking 
                  SET tracking_pixel_id = gen_random_uuid() 
                  WHERE tracking_pixel_id IS NULL;
                `
              })
              
              if (updateNullsError) {
                results.errors.push(`Failed to update NULL values: ${updateNullsError.message}`)
                results.success = false
              } else {
                results.steps.push('✅ Updated existing NULL tracking_pixel_id values')
              }
            }
          } else {
            results.steps.push('No NULL tracking_pixel_id values found - schema appears healthy')
          }
        }
      }
    } catch (error) {
      results.errors.push(`Schema check failed: ${error.message}`)
      results.success = false
    }

    // Step 2: Test the fix by creating a new record
    if (results.success) {
      console.log('🧪 Testing the fix...')
      
      try {
        const testMessageId = `test_fix_${Date.now()}`
        
        const { data: testRecord, error: testError } = await supabase
          .from('email_tracking')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            campaign_id: '00000000-0000-0000-0000-000000000000', 
            contact_id: '00000000-0000-0000-0000-000000000000',
            message_id: testMessageId,
            subject_line: 'Test fix record',
            email_body: 'Test email body',
          })
          .select('id, tracking_pixel_id')
          .single()

        if (testError) {
          results.errors.push(`Test record creation failed: ${testError.message}`)
          results.success = false
        } else {
          if (testRecord.tracking_pixel_id) {
            results.steps.push(`✅ Test successful - generated tracking_pixel_id: ${testRecord.tracking_pixel_id}`)
            
            // Clean up test record
            await supabase
              .from('email_tracking')
              .delete()
              .eq('id', testRecord.id)
            
            results.steps.push('Test record cleaned up')
          } else {
            results.errors.push('Test failed - tracking_pixel_id is still NULL')
            results.success = false
          }
        }
      } catch (error) {
        results.errors.push(`Test failed: ${error.message}`)
        results.success = false
      }
    }

    console.log(results.success ? '✅ Schema fix completed successfully' : '❌ Schema fix failed')

    return NextResponse.json({
      success: results.success,
      message: results.success ? 'Email tracking schema fixed successfully' : 'Schema fix failed',
      details: results,
      next_steps: results.success ? [
        'Test by sending a new campaign email',
        'Check open tracking after recipients view emails',
        'Monitor /api/debug/tracking-diagnosis for continued health'
      ] : [
        'Review error messages above',
        'Check Supabase permissions for schema modifications', 
        'Manually run SQL commands if needed'
      ]
    })

  } catch (error) {
    console.error('❌ Error in schema fix:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Schema fix failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}