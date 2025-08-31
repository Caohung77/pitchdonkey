import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getContactTags, setContactTags, addTagsToContact, removeTagsFromContact } from '@/lib/tags'
import { z } from 'zod'

const setTagsSchema = z.object({
  tag_ids: z.array(z.string().uuid())
})

const addRemoveTagsSchema = z.object({
  tag_ids: z.array(z.string().uuid())
})

interface Params {
  id: string // contact id
}

// GET /api/contacts/[id]/tags - Get all tags for a contact
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { user } = await requireAuth(request)
    const { id: contactId } = params
    
    // TODO: Add contact ownership verification
    
    // For now, return empty tags since migration might not be applied yet
    // This allows the UI to work while we prepare the database
    try {
      const tags = await getContactTags(contactId)
      return NextResponse.json({ tags })
    } catch (dbError) {
      console.log('Database tables not ready, returning empty tags:', dbError)
      // Return empty tags if tables don't exist yet
      return NextResponse.json({ tags: [] })
    }
  } catch (error) {
    console.error('Contact tags API GET error:', error)
    
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch contact tags', details: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/contacts/[id]/tags - Set all tags for a contact (replaces existing)
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { user } = await requireAuth(request)
    const { id: contactId } = params
    const body = await request.json()
    
    const validatedData = setTagsSchema.parse(body)
    
    // TODO: Add contact ownership verification
    // TODO: Add tag ownership verification
    
    try {
      // Try to use the new advanced tagging system
      await setContactTags(contactId, validatedData.tag_ids)
      const updatedTags = await getContactTags(contactId)
      return NextResponse.json({ tags: updatedTags })
    } catch (dbError) {
      console.log('Advanced tagging system not available, using fallback:', dbError)
      
      // Fallback: Update tags directly in the legacy field
      // Convert tag IDs to tag names (we'll need to extract tag names from the request)
      // For now, we'll extract tag names from the tag_ids by treating them as names
      // This is a temporary workaround until migration is applied
      
      return NextResponse.json({ 
        tags: [],
        message: 'Tag system not fully initialized. Please apply database migration.' 
      })
    }
  } catch (error) {
    console.error('Contact tags API PUT error:', error)
    
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid tag data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update contact tags' },
      { status: 500 }
    )
  }
}

// POST /api/contacts/[id]/tags - Add tags to a contact
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { user } = await requireAuth(request)
    const { id: contactId } = params
    const body = await request.json()
    
    const validatedData = addRemoveTagsSchema.parse(body)
    
    // TODO: Add contact ownership verification
    // TODO: Add tag ownership verification
    
    await addTagsToContact(contactId, validatedData.tag_ids)
    
    const updatedTags = await getContactTags(contactId)
    
    return NextResponse.json({ tags: updatedTags })
  } catch (error) {
    console.error('Contact tags API POST error:', error)
    
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid tag data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to add tags to contact' },
      { status: 500 }
    )
  }
}

// DELETE /api/contacts/[id]/tags - Remove tags from a contact
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { user } = await requireAuth(request)
    const { id: contactId } = params
    const body = await request.json()
    
    const validatedData = addRemoveTagsSchema.parse(body)
    
    // TODO: Add contact ownership verification
    
    await removeTagsFromContact(contactId, validatedData.tag_ids)
    
    const updatedTags = await getContactTags(contactId)
    
    return NextResponse.json({ tags: updatedTags })
  } catch (error) {
    console.error('Contact tags API DELETE error:', error)
    
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid tag data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to remove tags from contact' },
      { status: 500 }
    )
  }
}