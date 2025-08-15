import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { ContactService } from '@/lib/contacts'
import { contactSchema } from '@/lib/validations'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const contactService = new ContactService()
    const result = await contactService.getUserContacts(user.id, {
      page,
      limit,
      search,
      status,
      tags,
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
    return handleApiError(error)
  }
})