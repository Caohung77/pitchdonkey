import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { ContactService } from '@/lib/contacts'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const contactService = new ContactService()
    const stats = await contactService.getContactStats(user.id)

    return createSuccessResponse(stats)

  } catch (error) {
    console.error('Get contact stats error:', error)
    return handleApiError(error)
  }
})