import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

// GET /api/contacts/[id]/lists - retrieve lists accessible to the user with membership info
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const resolvedParams = await params
    const contactId = resolvedParams?.id

    if (!contactId) {
      return NextResponse.json({ success: false, error: 'Missing contact id' }, { status: 400 })
    }

    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') || '10')))
    const search = url.searchParams.get('search')?.trim()
    const offset = (page - 1) * limit

    let query = supabase
      .from('contact_lists')
      .select('id, name, description, contact_ids, created_at, updated_at, tags', { count: 'exact', head: false })
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (search) {
      const sanitized = search
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/'/g, "''")
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }

    const { data: lists, error } = await query.range(offset, offset + limit)

    if (error) {
      console.error('Failed to fetch contact lists for contact view:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const hasMore = (lists?.length || 0) > limit
    const actualLists = hasMore ? lists?.slice(0, limit) : lists

    const normalized = (actualLists || []).map((list) => {
      const contactIds = Array.isArray(list.contact_ids) ? list.contact_ids : []
      const isMember = contactIds.includes(contactId)

      return {
        id: list.id,
        name: list.name,
        description: list.description,
        contact_count: contactIds.length,
        created_at: list.created_at,
        updated_at: list.updated_at,
        is_member: isMember,
        tags: list.tags || [],
      }
    })

    const res = NextResponse.json({
      success: true,
      lists: normalized,
      pagination: {
        page,
        limit,
        hasNextPage: hasMore,
        hasPrevPage: page > 1,
      },
    })

    return addSecurityHeaders(res)
  } catch (error: any) {
    console.error('Unexpected error fetching contact lists:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
})
