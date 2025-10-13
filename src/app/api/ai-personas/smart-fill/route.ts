import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { PerplexityService } from '@/lib/perplexity-service'

const requestSchema = z.object({
  url: z.string().min(4),
})

const normalizeUrl = (input: string) => {
  let trimmed = input.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`
  }
  try {
    const url = new URL(trimmed)
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    await withRateLimit(user, 5, 60000)

    const body = await request.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    // Check for required API keys
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Smart fill is not configured. Missing PERPLEXITY_API_KEY.',
        },
        { status: 503 }
      )
    }

    const normalized = normalizeUrl(parsed.data.url)
    if (!normalized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Enter a valid URL (example: https://example.com)',
        },
        { status: 422 }
      )
    }

    console.log(`🔍 Verifying website accessibility: ${normalized}`)
    const accessibility = await PerplexityService.verifyWebsiteAccessible(normalized)
    if (!accessibility.ok) {
      console.error(`❌ Website not accessible: ${normalized}`, accessibility.error)
      return NextResponse.json(
        {
          success: false,
          error: `We could not reach that website. ${accessibility.error ? `Error: ${accessibility.error}` : 'Check the URL and try again.'}`,
        },
        { status: 422 }
      )
    }
    console.log(`✅ Website verified: ${accessibility.finalUrl || normalized}`)

    // Use the SAME Perplexity service that contact enrichment uses
    const service = new PerplexityService()
    const enrichment = await service.analyzeWebsite(accessibility.finalUrl || normalized)

    const productOneLiner = enrichment.products_services?.[0]
      ? `${enrichment.products_services[0]}`
      : enrichment.industry
        ? `${enrichment.company_name || 'We'} provide ${enrichment.industry.toLowerCase()}.`
        : ''

    const extendedDescription = enrichment.products_services?.length
      ? enrichment.products_services.join(', ')
      : ''

    const uniqueSellingPoints = (enrichment.unique_points || [])
      .map((point: string) => point.trim())
      .filter(Boolean)
      .slice(0, 5)

    const targetPersona = enrichment.target_audience?.length
      ? `We typically work with ${enrichment.target_audience.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
      : ''

    console.log('✅ Smart fill completed successfully')

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          companyName: enrichment.company_name || '',
          productOneLiner: productOneLiner || '',
          extendedDescription: extendedDescription || '',
          uniqueSellingPoints,
          targetPersona,
          industry: enrichment.industry || '',
          tone: enrichment.tone_style || '',
        },
      })
    )
  } catch (error) {
    console.error('POST /api/ai-personas/smart-fill error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze company website',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 }
    )
  }
})
