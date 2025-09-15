import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

// GET /api/inbox/email/[id] - Fetch a single email (simplified)
export const GET = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: emailId } = await params
  
  if (!emailId) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }
  
  // Single query for email with account info
  const { data: email, error } = await supabase
    .from('incoming_emails')
    .select(`
      *,
      email_accounts (
        id,
        email,
        provider
      )
    `)
    .eq('id', emailId)
    .eq('user_id', user.id)
    .single()

  if (error || !email) {
    return NextResponse.json({ success: false, error: 'Email not found' }, { status: 404 })
  }

  const res = NextResponse.json({ success: true, email })
  return addSecurityHeaders(res)
})