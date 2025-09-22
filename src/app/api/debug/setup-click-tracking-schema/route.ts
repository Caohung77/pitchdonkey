import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    console.log('🔧 Setting up click tracking database schema...')

    const results = {
      steps: [],
      success: false,
      errors: []
    }

    // Step 1: Create click_tracking table
    try {
      console.log('📝 Creating click_tracking table...')

      const { error: clickTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS click_tracking (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            original_url TEXT NOT NULL,
            tracking_url TEXT NOT NULL,
            campaign_id TEXT,
            contact_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            clicked BOOLEAN DEFAULT FALSE,
            clicked_at TIMESTAMP WITH TIME ZONE,
            click_count INTEGER DEFAULT 0,
            last_clicked_at TIMESTAMP WITH TIME ZONE,
            user_agent TEXT,
            ip_address TEXT,
            location JSONB
          );
        `
      })

      if (clickTableError) {
        results.errors.push(`click_tracking table creation failed: ${clickTableError.message}`)
        results.steps.push({ step: 'create_click_tracking_table', success: false, error: clickTableError.message })
      } else {
        results.steps.push({ step: 'create_click_tracking_table', success: true })
        console.log('✅ click_tracking table created successfully')
      }

    } catch (error) {
      results.errors.push(`click_tracking table creation error: ${error.message}`)
      results.steps.push({ step: 'create_click_tracking_table', success: false, error: error.message })
    }

    // Step 2: Create indexes for performance
    try {
      console.log('📝 Creating indexes...')

      const { error: indexError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_click_tracking_message_id ON click_tracking(message_id);
          CREATE INDEX IF NOT EXISTS idx_click_tracking_recipient_email ON click_tracking(recipient_email);
          CREATE INDEX IF NOT EXISTS idx_click_tracking_campaign_id ON click_tracking(campaign_id);
          CREATE INDEX IF NOT EXISTS idx_click_tracking_clicked ON click_tracking(clicked);
          CREATE INDEX IF NOT EXISTS idx_click_tracking_created_at ON click_tracking(created_at);
        `
      })

      if (indexError) {
        results.errors.push(`Index creation failed: ${indexError.message}`)
        results.steps.push({ step: 'create_indexes', success: false, error: indexError.message })
      } else {
        results.steps.push({ step: 'create_indexes', success: true })
        console.log('✅ Indexes created successfully')
      }

    } catch (error) {
      results.errors.push(`Index creation error: ${error.message}`)
      results.steps.push({ step: 'create_indexes', success: false, error: error.message })
    }

    // Step 3: Verify the table exists and has correct structure
    try {
      console.log('🔍 Verifying table structure...')

      const { data: tableData, error: verifyError } = await supabase
        .from('click_tracking')
        .select('*')
        .limit(1)

      if (verifyError) {
        results.errors.push(`Table verification failed: ${verifyError.message}`)
        results.steps.push({ step: 'verify_table', success: false, error: verifyError.message })
      } else {
        results.steps.push({ step: 'verify_table', success: true, message: 'Table is accessible' })
        console.log('✅ Table verification successful')
      }

    } catch (error) {
      results.errors.push(`Table verification error: ${error.message}`)
      results.steps.push({ step: 'verify_table', success: false, error: error.message })
    }

    // Step 4: Test inserting a sample record
    try {
      console.log('🧪 Testing table functionality...')

      const testRecord = {
        id: `test_${Date.now()}`,
        message_id: 'test_message',
        recipient_email: 'test@example.com',
        original_url: 'https://example.com',
        tracking_url: 'https://app.example.com/api/tracking/click/test',
        clicked: false,
        click_count: 0
      }

      const { error: insertError } = await supabase
        .from('click_tracking')
        .insert(testRecord)

      if (insertError) {
        results.errors.push(`Test insert failed: ${insertError.message}`)
        results.steps.push({ step: 'test_insert', success: false, error: insertError.message })
      } else {
        // Clean up test record
        await supabase
          .from('click_tracking')
          .delete()
          .eq('id', testRecord.id)

        results.steps.push({ step: 'test_insert', success: true, message: 'Insert/delete test successful' })
        console.log('✅ Table functionality test successful')
      }

    } catch (error) {
      results.errors.push(`Table test error: ${error.message}`)
      results.steps.push({ step: 'test_insert', success: false, error: error.message })
    }

    // Determine overall success
    results.success = results.errors.length === 0

    return NextResponse.json({
      success: results.success,
      message: results.success ?
        'Click tracking schema setup completed successfully' :
        'Click tracking schema setup completed with errors',
      timestamp: new Date().toISOString(),
      results,
      nextSteps: results.success ? [
        'Schema is ready for click tracking',
        'Test the EmailLinkRewriter functionality',
        'Send a test campaign with tracking links',
        'Verify clicks are recorded in the database'
      ] : [
        'Review error messages above',
        'Check database permissions',
        'Ensure Supabase RPC functions are available',
        'Consider manual schema creation'
      ]
    })

  } catch (error) {
    console.error('💥 Schema setup error:', error)
    return NextResponse.json({
      success: false,
      error: 'Schema setup failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}