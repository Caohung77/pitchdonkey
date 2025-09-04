import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

// GET /api/contacts/lookup - Look up a contact by email address
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 100, 60000) // 100 lookups per minute

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email parameter is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    // Look up contact by email address for the authenticated user
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error looking up contact:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to look up contact',
        code: 'LOOKUP_ERROR'
      }, { status: 500 })
    }

    const response = NextResponse.json({
      success: true,
      contact: contact || null,
      exists: !!contact
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in contact lookup API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})