import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔧 Applying email_tracking schema fix...')
    
    // Apply the schema fix
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Fix email_tracking table schema - add missing updated_at column
        ALTER TABLE email_tracking 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

        -- Add trigger to automatically update updated_at when record is modified
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Create trigger if it doesn't exist
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger 
                WHERE tgname = 'update_email_tracking_updated_at'
            ) THEN
                CREATE TRIGGER update_email_tracking_updated_at 
                BEFORE UPDATE ON email_tracking 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END$$;
      `
    })

    if (error) {
      console.error('❌ Schema fix failed:', error)
      
      // Try direct SQL execution as fallback
      const { error: directError } = await supabase
        .from('email_tracking')
        .select('id')
        .limit(1)
      
      if (!directError) {
        console.log('✅ Table exists, trying direct ALTER...')
        
        // Try simpler approach - just add the column
        const { error: alterError } = await supabase.sql`
          ALTER TABLE email_tracking ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        `
        
        if (alterError) {
          return NextResponse.json({
            error: 'Failed to apply schema fix',
            details: alterError.message,
            suggestion: 'Please run the SQL manually in your database'
          }, { status: 500 })
        }
        
        return NextResponse.json({
          success: true,
          message: 'Schema fix applied successfully (direct ALTER)',
          applied: ['updated_at column added']
        })
      }
      
      return NextResponse.json({
        error: 'Failed to apply schema fix',
        details: error.message
      }, { status: 500 })
    }

    console.log('✅ Schema fix applied successfully')
    
    return NextResponse.json({
      success: true,
      message: 'email_tracking schema fix applied successfully',
      applied: [
        'updated_at column added',
        'update trigger created'
      ]
    })

  } catch (error) {
    console.error('Error applying schema fix:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}