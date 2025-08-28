import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting email_tracking table migration...')
    
    const supabase = createServerSupabaseClient()
    
    // Create email_tracking table with proper structure
    const createTableSQL = `
      -- Create the email_tracking table that the code expects
      CREATE TABLE IF NOT EXISTS email_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
        step_number INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
        subject VARCHAR(500),
        content TEXT,
        personalized_content TEXT,
        ab_test_variant VARCHAR(100),
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        opened_at TIMESTAMP WITH TIME ZONE,
        clicked_at TIMESTAMP WITH TIME ZONE,
        replied_at TIMESTAMP WITH TIME ZONE,
        bounced_at TIMESTAMP WITH TIME ZONE,
        bounce_reason TEXT,
        reply_content TEXT,
        reply_sentiment VARCHAR(20) CHECK (reply_sentiment IN ('positive', 'negative', 'neutral')),
        tracking_pixel_id UUID DEFAULT gen_random_uuid(),
        link_clicks JSONB DEFAULT '[]',
        tracking_data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
    
    console.log('📝 Creating email_tracking table...')
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL })
    if (createError) {
      console.error('❌ Error creating table:', createError)
      // Try alternative approach with direct SQL
      const { error: directError } = await supabase.from('email_tracking').select('id').limit(1)
      if (directError && directError.code === '42P01') {
        // Table doesn't exist, need to create it manually
        return NextResponse.json({
          success: false,
          error: 'email_tracking table does not exist. Please run the migration SQL manually in your database.',
          sql: createTableSQL
        }, { status: 500 })
      }
    }
    
    // Create indexes
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign_id ON email_tracking(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_email_tracking_contact_id ON email_tracking(contact_id);
      CREATE INDEX IF NOT EXISTS idx_email_tracking_status ON email_tracking(status);
      CREATE INDEX IF NOT EXISTS idx_email_tracking_sent_at ON email_tracking(sent_at);
    `
    
    console.log('📊 Creating indexes...')
    await supabase.rpc('exec_sql', { sql: indexSQL })
    
    // Test if the table is accessible
    console.log('🧪 Testing table access...')
    const { data: testData, error: testError } = await supabase
      .from('email_tracking')
      .select('id')
      .limit(1)
    
    if (testError) {
      console.error('❌ Table access test failed:', testError)
      return NextResponse.json({
        success: false,
        error: 'Failed to access email_tracking table',
        details: testError.message,
        manualSql: createTableSQL
      }, { status: 500 })
    }
    
    console.log('✅ Migration completed successfully!')
    return NextResponse.json({
      success: true,
      message: 'email_tracking table migration completed',
      tableExists: true,
      recordCount: testData?.length || 0
    })
    
  } catch (error) {
    console.error('💥 Migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}