import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import { extractFromUrl, extractFromPdf } from '@/lib/jina-extractor'

const extractSchema = z.object({
  type: z.enum(['url', 'pdf']),
  url: z.string().url('Invalid URL format'),
  title: z.string().optional(),
  description: z.string().optional()
})

/**
 * POST /api/ai-personas/[personaId]/knowledge/extract
 *
 * Extract content from URL or PDF using Jina AI and save as knowledge
 */
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }: { user: any; supabase: any },
  { params }: { params: Promise<{ personaId: string }> }
) => {
  let parsed: z.infer<typeof extractSchema> | null = null
  try {
    const { personaId } = await params

    // Verify persona belongs to user
    const { data: persona, error: personaError } = await supabase
      .from('ai_personas')
      .select('id')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .single()

    if (personaError || !persona) {
      return NextResponse.json(
        { success: false, error: 'Persona not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    parsed = extractSchema.parse(body)
    const shouldCleanupTempPdf =
      parsed.type === 'pdf' && parsed.url.includes('temp-pdf-uploads')

    // Get Jina API key from environment
    const jinaApiKey = process.env.JINA_API_KEY
    if (!jinaApiKey) {
      return NextResponse.json(
        { success: false, error: 'Jina AI API key not configured' },
        { status: 500 }
      )
    }

    // Extract content based on type
    let extractionResult

    if (parsed.type === 'url') {
      extractionResult = await extractFromUrl(parsed.url, jinaApiKey, {
        maxLength: 50000, // Limit to 50K characters
        timeout: 30000 // 30 second timeout
      })
    } else {
      // For PDF, the URL should point to the uploaded file in Supabase storage
      extractionResult = await extractFromPdf(parsed.url, jinaApiKey, {
        maxLength: 50000,
        timeout: 60000 // 60 second timeout for PDFs
      })
    }

    if (!extractionResult.success) {
      if (shouldCleanupTempPdf) {
        await cleanupTempPdf(supabase, parsed.url)
      }
      return NextResponse.json(
        {
          success: false,
          error: extractionResult.error || 'Failed to extract content'
        },
        { status: 422 }
      )
    }

    // Create knowledge item with extracted content
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('ai_persona_knowledge')
      .insert({
        persona_id: personaId,
        user_id: user.id,
        type: parsed.type === 'url' ? 'link' : 'pdf',
        title: parsed.title || extractionResult.title || 'Untitled',
        description: parsed.description || extractionResult.description || '',
        content: extractionResult.content,
        url: parsed.url,
        embedding_status: 'ready', // Mark as ready since content is extracted
        embedding_metadata: extractionResult.metadata
      })
      .select()
      .single()

    if (knowledgeError) {
      throw knowledgeError
    }

    // Cleanup: Delete temporary PDF file if this was a PDF upload
    if (shouldCleanupTempPdf) {
      await cleanupTempPdf(supabase, parsed.url)
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          knowledge,
          extraction: {
            wordCount: extractionResult.metadata?.wordCount,
            extractedAt: extractionResult.metadata?.extractedAt
          }
        }
      }, { status: 201 })
    )
  } catch (error) {
    if (parsed?.type === 'pdf' && parsed.url.includes('temp-pdf-uploads')) {
      await cleanupTempPdf(supabase, parsed.url)
    }

    console.error('POST /api/ai-personas/[personaId]/knowledge/extract error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.flatten()
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to extract and save knowledge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

/**
 * Clean up temporary PDF file from storage after content extraction
 */
async function cleanupTempPdf(supabase: any, pdfUrl: string) {
  try {
    // Extract filename from URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/temp-pdf-uploads/filename.pdf
    const urlParts = pdfUrl.split('/temp-pdf-uploads/')
    if (urlParts.length < 2) {
      console.error('Invalid temp PDF URL format:', pdfUrl)
      return
    }

    const fileName = urlParts[1]

    // Delete from temp storage
    const { error } = await supabase
      .storage
      .from('temp-pdf-uploads')
      .remove([fileName])

    if (error) {
      console.error('Failed to delete temp PDF:', error)
    } else {
      console.log('✅ Temp PDF deleted:', fileName)
    }
  } catch (error) {
    console.error('Error cleaning up temp PDF:', error)
  }
}
