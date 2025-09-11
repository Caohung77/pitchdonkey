import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { ContactService } from '@/lib/contacts'
import { contactSchema } from '@/lib/validations'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',').filter(Boolean)
    
    // If requesting specific contacts by IDs
    if (ids && ids.length > 0) {
      const contactService = new ContactService()
      const result = await contactService.getContactsByIds(user.id, ids)
      return createSuccessResponse({ contacts: result })
    }

    // Otherwise, use pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined
    const enrichment = searchParams.get('enrichment') || undefined
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const contactService = new ContactService()
    const result = await contactService.getUserContacts(user.id, {
      page,
      limit,
      search,
      status,
      tags,
      enrichment,
      sortBy,
      sortOrder
    })

    return createSuccessResponse(result)

  } catch (error) {
    console.error('Get contacts error:', error)
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = contactSchema.parse(body)

    const contactService = new ContactService()
    const contact = await contactService.createContact(user.id, validatedData)

    return createSuccessResponse(contact, 201)

  } catch (error) {
    console.error('Create contact error:', error)
    
    // Handle duplicate contact error with specific status code
    if (error instanceof Error && error.name === 'DuplicateContactError') {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: 'DUPLICATE_CONTACT'
        },
        { status: 409 } // Conflict
      )
    }
    
    return handleApiError(error)
  }
})