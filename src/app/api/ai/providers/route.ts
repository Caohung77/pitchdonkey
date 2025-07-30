import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AIPersonalizationService } from '@/lib/ai-providers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize providers
    await AIPersonalizationService.initialize()

    // Get available providers
    const providers = AIPersonalizationService.getAvailableProviders()
    
    return NextResponse.json({
      success: true,
      data: {
        providers,
        totalProviders: providers.length
      }
    })

  } catch (error) {
    console.error('Get AI providers error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, provider } = body

    switch (action) {
      case 'test':
        if (!provider) {
          return NextResponse.json(
            { error: 'Provider is required for test action' },
            { status: 400 }
          )
        }

        // Initialize providers first
        await AIPersonalizationService.initialize()

        const testResult = await AIPersonalizationService.testProvider(provider)
        
        return NextResponse.json({
          success: true,
          data: testResult
        })

      case 'validate':
        // Initialize providers first
        await AIPersonalizationService.initialize()

        const validationResults = await AIPersonalizationService.validateApiKeys()
        
        return NextResponse.json({
          success: true,
          data: validationResults
        })

      case 'initialize':
        await AIPersonalizationService.initialize()
        const availableProviders = AIPersonalizationService.getAvailableProviders()
        
        return NextResponse.json({
          success: true,
          data: {
            message: `Initialized ${availableProviders.length} providers`,
            providers: availableProviders
          }
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: test, validate, initialize' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('AI providers action error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}