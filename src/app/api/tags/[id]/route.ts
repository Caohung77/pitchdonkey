import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateTag, deleteTag } from '@/lib/tags'
import { z } from 'zod'

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  description: z.string().max(500).optional()
})

interface Params {
  id: string
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { user } = await requireAuth(request)
    const { id } = params
    const body = await request.json()
    
    const validatedData = updateTagSchema.parse(body)
    
    const tag = await updateTag(user.id, id, validatedData)
    
    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Tags API PUT error:', error)
    
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
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { user } = await requireAuth(request)
    const { id } = params
    
    await deleteTag(user.id, id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tags API DELETE error:', error)
    
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    )
  }
}