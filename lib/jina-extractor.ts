/**
 * Jina AI Content Extraction Library
 *
 * Provides utilities for extracting content from URLs and PDFs using Jina AI's Reader API.
 * https://docs.jina.ai
 */

export interface JinaExtractionResult {
  success: boolean
  content?: string
  title?: string
  description?: string
  error?: string
  metadata?: {
    url?: string
    wordCount?: number
    extractedAt?: string
    source?: 'url' | 'pdf'
  }
}

export interface JinaExtractionOptions {
  maxLength?: number // Maximum content length in characters
  includeLinks?: boolean // Include links in extracted content
  timeout?: number // Request timeout in milliseconds
}

/**
 * Extract content from a URL using Jina AI Reader API
 *
 * @param url - The URL to extract content from
 * @param apiKey - Jina AI API key
 * @param options - Extraction options
 * @returns Extraction result with content and metadata
 */
export async function extractFromUrl(
  url: string,
  apiKey: string,
  options: JinaExtractionOptions = {}
): Promise<JinaExtractionResult> {
  try {
    // Validate URL
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported')
    }

    // Build Jina API URL
    const jinaUrl = `https://r.jina.ai/${url}`

    // Make request to Jina AI
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000)

    try {
      const response = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'X-Return-Format': 'markdown' // Get content in markdown format
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Jina API error (${response.status}): ${errorText}`)
      }

      // Parse response
      const data = await response.json()

      // Extract content
      let content = data.data?.content || data.content || ''
      const title = data.data?.title || data.title || extractTitleFromUrl(url)
      const description = data.data?.description || data.description || ''

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength) + '...'
      }

      // Calculate word count
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length

      return {
        success: true,
        content,
        title,
        description,
        metadata: {
          url,
          wordCount,
          extractedAt: new Date().toISOString(),
          source: 'url'
        }
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout - the URL took too long to fetch')
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error('Jina URL extraction error:', error)
    return {
      success: false,
      error: error.message || 'Failed to extract content from URL',
      metadata: {
        url,
        extractedAt: new Date().toISOString(),
        source: 'url'
      }
    }
  }
}

/**
 * Extract content from a PDF using Jina AI Reader API
 *
 * Note: Jina AI requires a publicly accessible PDF URL.
 * PDFs must be uploaded to Supabase storage first to get a public URL.
 *
 * @param pdfUrl - Publicly accessible URL to the PDF file
 * @param apiKey - Jina AI API key
 * @param options - Extraction options
 * @returns Extraction result with content and metadata
 */
export async function extractFromPdf(
  pdfUrl: string,
  apiKey: string,
  options: JinaExtractionOptions = {}
): Promise<JinaExtractionResult> {
  try {
    // Validate PDF URL
    const urlObj = new URL(pdfUrl)
    if (!pdfUrl.toLowerCase().endsWith('.pdf')) {
      throw new Error('URL must point to a PDF file')
    }

    // Build Jina API URL for PDF
    const jinaUrl = `https://r.jina.ai/${pdfUrl}`

    // Make request to Jina AI
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 60000) // Longer timeout for PDFs

    try {
      const response = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'X-Return-Format': 'markdown' // Get content in markdown format
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Jina API error (${response.status}): ${errorText}`)
      }

      // Parse response
      const data = await response.json()

      // Extract content
      let content = data.data?.content || data.content || ''
      const title = data.data?.title || data.title || extractTitleFromUrl(pdfUrl)
      const description = data.data?.description || data.description || ''

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength) + '...'
      }

      // Calculate word count
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length

      return {
        success: true,
        content,
        title,
        description,
        metadata: {
          url: pdfUrl,
          wordCount,
          extractedAt: new Date().toISOString(),
          source: 'pdf'
        }
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout - the PDF took too long to process')
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error('Jina PDF extraction error:', error)
    return {
      success: false,
      error: error.message || 'Failed to extract content from PDF',
      metadata: {
        url: pdfUrl,
        extractedAt: new Date().toISOString(),
        source: 'pdf'
      }
    }
  }
}

/**
 * Extract multiple URLs in batch
 *
 * @param urls - Array of URLs to extract
 * @param apiKey - Jina AI API key
 * @param options - Extraction options
 * @returns Array of extraction results
 */
export async function extractMultipleUrls(
  urls: string[],
  apiKey: string,
  options: JinaExtractionOptions = {}
): Promise<JinaExtractionResult[]> {
  // Process in batches of 3 to avoid rate limits
  const batchSize = 3
  const results: JinaExtractionResult[] = []

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(url => extractFromUrl(url, apiKey, options))
    )
    results.push(...batchResults)

    // Add delay between batches to respect rate limits
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}

/**
 * Validate if a URL is accessible and returns a valid response
 *
 * @param url - URL to validate
 * @returns Validation result
 */
export async function validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' }
    }

    // Quick HEAD request to check if URL is accessible
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { valid: false, error: `URL returned status ${response.status}` }
      }

      return { valid: true }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        return { valid: false, error: 'URL validation timeout' }
      }
      return { valid: false, error: fetchError.message }
    }
  } catch (error: any) {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Extract a readable title from a URL
 *
 * @param url - URL to extract title from
 * @returns Extracted title
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // Get last segment of path
    const segments = pathname.split('/').filter(s => s.length > 0)
    const lastSegment = segments[segments.length - 1] || urlObj.hostname

    // Remove file extension and decode
    const title = decodeURIComponent(lastSegment)
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize
      .join(' ')

    return title || urlObj.hostname
  } catch {
    return url
  }
}

/**
 * Estimate extraction time based on content type
 *
 * @param type - Content type ('url' or 'pdf')
 * @returns Estimated time in seconds
 */
export function estimateExtractionTime(type: 'url' | 'pdf'): number {
  return type === 'pdf' ? 30 : 10 // PDFs take longer to process
}
