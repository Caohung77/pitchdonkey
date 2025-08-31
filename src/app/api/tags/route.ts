import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getUserTags, createTag, searchUserTags } from '@/lib/tags'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  description: z.string().max(500).optional()
})

const searchSchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional()
})

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    try {
      if (query) {
        // Search tags with query
        const tags = await searchUserTags(user.id, query)
        return NextResponse.json({ tags })
      } else {
        // Get all user tags
        const tags = await getUserTags(user.id)
        return NextResponse.json({ tags })
      }
    } catch (dbError) {
      console.log('Database tables not ready, returning empty tags:', dbError)
      // Return empty tags if tables don't exist yet
      return NextResponse.json({ tags: [] })
    }
  } catch (error) {
    console.error('Tags API GET error:', error)
    
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch tags', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    const body = await request.json()
    
    const validatedData = createTagSchema.parse(body)
    
    try {
      const tag = await createTag(user.id, validatedData)
      return NextResponse.json({ tag }, { status: 201 })
    } catch (dbError) {
      console.log('Database tables not ready, cannot create tags yet:', dbError)
      return NextResponse.json(
        { error: 'Tag system not initialized. Please apply database migrations first.' },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('Tags API POST error:', error)
    
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
      { error: 'Failed to create tag', details: error.message },
      { status: 500 }
    )
  }
}