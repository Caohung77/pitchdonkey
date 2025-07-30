import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AIPersonalizationService } from '@/lib/ai-providers'
import { z } from 'zod'

const estimateRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  template_content: z.string().min(1, 'Template content is required'),
  contact_count: z.number().min(1, 'Contact count must be at least 1').max(10000, 'Contact count cannot exceed 10,000'),
  include_contact_data: z.boolean().optional().default(true)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate request
    const validatedRequest = estimateRequestSchema.parse(body)

    // Initialize providers
    await AIPersonalizationService.initialize()

    // Check if provider is available
    const availableProviders = AIPersonalizationService.getAvailableProviders()
    const providerExists = availableProviders.some(p => p.id === validatedRequest.provider)
    
    if (!providerExists) {
      return NextResponse.json(
        { error: `Provider '${validatedRequest.provider}' is not available or configured` },
        { status: 400 }
      )
    }

    // Calculate estimate
    const contentLength = validatedRequest.template_content.length
    const adjustedLength = validatedRequest.include_contact_data 
      ? contentLength + 300 // Add estimated contact data length
      : contentLength

    const estimate = AIPersonalizationService.getUsageEstimate(
      adjustedLength,
      validatedRequest.contact_count,
      validatedRequest.provider
    )

    // Get provider info for additional details
    const provider = AIPersonalizationService.getProvider(validatedRequest.provider)
    
    return NextResponse.json({
      success: true,
      data: {
        provider: validatedRequest.provider,
        contact_count: validatedRequest.contact_count,
        template_length: contentLength,
        estimated_tokens: estimate.estimatedTokens,
        estimated_cost: estimate.estimatedCost,
        cost_breakdown: {
          input_tokens: Math.ceil((adjustedLength / 4 + 200) * validatedRequest.contact_count),
          output_tokens: Math.ceil((adjustedLength / 4 + 100) * validatedRequest.contact_count),
          input_cost: ((adjustedLength / 4 + 200) * validatedRequest.contact_count / 1000) * (provider?.pricing.inputTokens || 0),
          output_cost: ((adjustedLength / 4 + 100) * validatedRequest.contact_count / 1000) * (provider?.pricing.outputTokens || 0)
        },
        provider_info: {
          name: provider?.name,
          rate_limit: provider?.limits.rateLimit,
          max_tokens: provider?.limits.maxTokens
        },
        estimated_duration: {
          seconds: Math.ceil(validatedRequest.contact_count / (provider?.limits.rateLimit || 60) * 60),
          formatted: formatDuration(Math.ceil(validatedRequest.contact_count / (provider?.limits.rateLimit || 60) * 60))
        }
      }
    })

  } catch (error) {
    console.error('AI cost estimation error:', error)
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 
      ? `${minutes} minutes ${remainingSeconds} seconds`
      : `${minutes} minutes`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 
      ? `${hours} hours ${minutes} minutes`
      : `${hours} hours`
  }
}