import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { createServerSupabaseClient } from '@/lib/supabase'
import { processAIContactQuery } from '@/lib/ai-contact-query-service'

const requestSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID format'),
  query: z.string().min(3, 'Query must be at least 3 characters').max(500, 'Query is too long'),
  maxResults: z.number().int().min(1).max(500).optional().default(100)
})

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Rate limit: 10 AI queries per minute per user
    await withRateLimit(user, 10, 60000)

    // Parse and validate request body
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request payload',
          details: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { agentId, query, maxResults } = parsed.data

    // Check if Gemini API key is configured
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI query feature is not configured. Please contact support.'
        },
        { status: 503 }
      )
    }

    // Create Supabase client
    const supabase = createServerSupabaseClient()

    // Process AI query
    const result = await processAIContactQuery(
      query,
      agentId,
      user.id,
      supabase,
      maxResults
    )

    // Return successful response
    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          contacts: result.contacts,
          reasoning: result.reasoning,
          functionsUsed: result.functionsUsed,
          metadata: {
            tokensUsed: result.tokensUsed,
            executionTimeMs: result.executionTimeMs,
            totalMatches: result.contacts.length,
            query: query,
            agentId: agentId
          }
        }
      })
    )
  } catch (error) {
    console.error('POST /api/contacts/ai-query error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Agent not found or you do not have access to it',
            details: error.message
          },
          { status: 404 }
        )
      }

      if (error.message.includes('Gemini API')) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI service temporarily unavailable. Please try again.',
            details: error.message
          },
          { status: 502 }
        )
      }
    }

    // Generic error response with full details for debugging
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process AI query',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
})