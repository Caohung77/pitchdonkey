import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { ContactService } from '@/lib/contacts'

// DELETE /api/contacts/[id] - Delete a single contact and prune from all lists
export async function DELETE(request: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { user } = await requireAuth(request)
    const contactId = ctx?.params?.id
    if (!contactId) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
    }

    const service = new ContactService()
    const result = await service.bulkDeleteContacts([contactId], user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to delete contact' }, { status: 500 })
  }
}

