import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // We cannot run DDL via Supabase REST safely; return SQL for manual execution
    const sql = `
ALTER TABLE IF NOT EXISTS public.incoming_emails ADD COLUMN IF NOT EXISTS imap_uid INTEGER;
ALTER TABLE IF NOT EXISTS public.incoming_emails ADD COLUMN IF NOT EXISTS flags TEXT[];
ALTER TABLE IF NOT EXISTS public.incoming_emails ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_incoming_emails_imap_uid ON public.incoming_emails(imap_uid);
`

    // Smoke-check that table exists
    await supabase.from('incoming_emails').select('id').limit(1)

    return NextResponse.json({
      success: true,
      message: 'Run the following SQL in Supabase to enable deletion mirroring',
      sql
    })

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed' }, { status: 500 })
  }
}

