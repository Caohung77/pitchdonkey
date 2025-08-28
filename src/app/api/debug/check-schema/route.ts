import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔍 Checking email_tracking table schema...')
    
    // Get table structure info
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'email_tracking' 
        ORDER BY ordinal_position;
      `
    })
    
    if (error) {
      console.error('❌ Error checking schema:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('📊 Current email_tracking columns:', data)
    
    // Check if tracking_pixel_id exists
    const hasTrackingPixelId = data?.some(col => col.column_name === 'tracking_pixel_id')
    
    return NextResponse.json({
      success: true,
      table: 'email_tracking',
      columns: data,
      hasTrackingPixelId: hasTrackingPixelId,
      columnCount: data?.length || 0,
      missingColumns: hasTrackingPixelId ? [] : ['tracking_pixel_id']
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