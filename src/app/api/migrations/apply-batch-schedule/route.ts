import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('🔧 Applying batch_schedule migration...')

    // Apply the migration using raw SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_schedule JSONB DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_campaigns_batch_schedule ON campaigns USING gin (batch_schedule);
      `
    })

    if (error) {
      // If rpc doesn't exist, try direct execution
      console.log('RPC method not available, trying direct execution...')

      // Create a simple function to execute SQL
      const { error: createFnError } = await supabase.rpc('exec', {
        query: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_schedule JSONB DEFAULT NULL'
      })

      if (createFnError) {
        throw new Error(`Migration failed: ${createFnError.message}`)
      }
    }

    console.log('✅ Migration applied successfully')

    return NextResponse.json({
      success: true,
      message: 'Migration applied successfully. Please refresh the page.'
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error.message,
        instructions: 'Please run this SQL in Supabase Dashboard SQL Editor:\n\nALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_schedule JSONB DEFAULT NULL;\nCREATE INDEX IF NOT EXISTS idx_campaigns_batch_schedule ON campaigns USING gin (batch_schedule);'
      },
      { status: 500 }
    )
  }
})
