import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * POST /api/ai-personas/[personaId]/knowledge/upload-pdf
 *
 * Upload PDF file to Supabase storage and return public URL
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase, params }) => {
  try {
    const personaId = params.personaId

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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
    const fileName = `${user.id}/${personaId}/${timestamp}_${sanitizedName}`

    // Upload to Supabase storage
    const fileBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('persona-knowledge')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('persona-knowledge')
      .getPublicUrl(fileName)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          fileName: file.name,
          fileSize: file.size,
          storagePath: fileName,
          publicUrl: publicUrl,
          uploadedAt: new Date().toISOString()
        }
      })
    )
  } catch (error) {
    console.error('POST /api/ai-personas/[personaId]/knowledge/upload-pdf error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
