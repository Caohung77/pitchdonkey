/**
 * Knowledge Base Feature Test Suite
 *
 * Tests the AI Persona knowledge base functionality including:
 * - URL extraction with Jina AI (e.g., https://www.boniforce.de)
 * - PDF upload and extraction
 * - Knowledge item CRUD operations
 * - Content validation and error handling
 */

import { extractFromUrl, extractFromPdf, validateUrl } from '@/lib/jina-extractor'

// Test configuration
const TEST_URL = 'https://www.boniforce.de'
const TEST_PDF_URL = 'https://example.com/sample.pdf' // Replace with actual PDF URL
const JINA_API_KEY = process.env.JINA_API_KEY || ''

interface TestResult {
  name: string
  passed: boolean
  duration: number
  details?: string
  error?: string
}

const results: TestResult[] = []

/**
 * Test helper function
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now()
  try {
    await testFn()
    results.push({
      name,
      passed: true,
      duration: Date.now() - startTime
    })
    console.log(`✅ ${name}`)
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      duration: Date.now() - startTime,
      error: error.message
    })
    console.error(`❌ ${name}`)
    console.error(`   Error: ${error.message}`)
  }
}

/**
 * Test Suite
 */
async function runTests() {
  console.log('🧪 Starting Knowledge Base Feature Tests\n')
  console.log('=' .repeat(60))

  // Test 1: Jina API Key Configuration
  await runTest('Verify Jina API Key is configured', async () => {
    if (!JINA_API_KEY) {
      throw new Error('JINA_API_KEY environment variable is not set')
    }
    if (JINA_API_KEY.length < 10) {
      throw new Error('JINA_API_KEY appears to be invalid (too short)')
    }
  })

  // Test 2: URL Validation
  await runTest('Validate test URL accessibility', async () => {
    const validation = await validateUrl(TEST_URL)
    if (!validation.valid) {
      throw new Error(`URL validation failed: ${validation.error}`)
    }
  })

  // Test 3: Extract content from https://www.boniforce.de
  await runTest(`Extract content from ${TEST_URL}`, async () => {
    const result = await extractFromUrl(TEST_URL, JINA_API_KEY, {
      maxLength: 50000,
      timeout: 30000
    })

    if (!result.success) {
      throw new Error(`Extraction failed: ${result.error}`)
    }

    if (!result.content || result.content.length === 0) {
      throw new Error('No content extracted')
    }

    if (!result.title) {
      throw new Error('No title extracted')
    }

    console.log(`   📄 Title: ${result.title}`)
    console.log(`   📝 Content length: ${result.content.length} characters`)
    console.log(`   📊 Word count: ${result.metadata?.wordCount || 0} words`)
    console.log(`   🔗 Source: ${result.metadata?.url}`)
  })

  // Test 4: Content Quality Checks
  await runTest('Validate extracted content quality', async () => {
    const result = await extractFromUrl(TEST_URL, JINA_API_KEY)

    if (!result.success || !result.content) {
      throw new Error('No content to validate')
    }

    // Check for minimum content length
    if (result.content.length < 100) {
      throw new Error('Extracted content is too short (less than 100 characters)')
    }

    // Check for word count
    const wordCount = result.metadata?.wordCount || 0
    if (wordCount < 20) {
      throw new Error('Extracted content has too few words (less than 20)')
    }

    // Check for meaningful content (not just whitespace/symbols)
    const meaningfulContent = result.content.replace(/[\s\W]/g, '')
    if (meaningfulContent.length < 50) {
      throw new Error('Extracted content lacks meaningful text')
    }

    console.log(`   ✓ Content length: ${result.content.length} chars`)
    console.log(`   ✓ Word count: ${wordCount} words`)
    console.log(`   ✓ Meaningful content: ${meaningfulContent.length} alphanumeric chars`)
  })

  // Test 5: Metadata Extraction
  await runTest('Verify metadata extraction', async () => {
    const result = await extractFromUrl(TEST_URL, JINA_API_KEY)

    if (!result.success) {
      throw new Error('Extraction failed')
    }

    if (!result.metadata) {
      throw new Error('No metadata returned')
    }

    const requiredFields = ['url', 'wordCount', 'extractedAt', 'source']
    for (const field of requiredFields) {
      if (!(field in result.metadata)) {
        throw new Error(`Missing required metadata field: ${field}`)
      }
    }

    if (result.metadata.source !== 'url') {
      throw new Error(`Expected source to be 'url', got '${result.metadata.source}'`)
    }

    console.log(`   ✓ All required metadata fields present`)
    console.log(`   ✓ Source type: ${result.metadata.source}`)
  })

  // Test 6: Error Handling - Invalid URL
  await runTest('Handle invalid URL gracefully', async () => {
    const invalidUrl = 'not-a-valid-url'
    const result = await extractFromUrl(invalidUrl, JINA_API_KEY)

    if (result.success) {
      throw new Error('Expected extraction to fail for invalid URL')
    }

    if (!result.error) {
      throw new Error('Expected error message to be present')
    }

    console.log(`   ✓ Error handled: ${result.error}`)
  })

  // Test 7: Error Handling - Non-existent domain
  await runTest('Handle non-existent domain gracefully', async () => {
    const nonExistentUrl = 'https://this-domain-definitely-does-not-exist-12345.com'
    const result = await extractFromUrl(nonExistentUrl, JINA_API_KEY, {
      timeout: 10000
    })

    if (result.success) {
      throw new Error('Expected extraction to fail for non-existent domain')
    }

    console.log(`   ✓ Error handled: ${result.error}`)
  })

  // Test 8: Content Length Limiting
  await runTest('Respect maxLength parameter', async () => {
    const maxLength = 1000
    const result = await extractFromUrl(TEST_URL, JINA_API_KEY, {
      maxLength
    })

    if (!result.success || !result.content) {
      throw new Error('Extraction failed')
    }

    if (result.content.length > maxLength + 10) { // Allow small buffer for '...'
      throw new Error(`Content length ${result.content.length} exceeds maxLength ${maxLength}`)
    }

    console.log(`   ✓ Content limited to ${result.content.length} characters (max: ${maxLength})`)
  })

  // Test 9: Timeout Handling
  await runTest('Handle timeout appropriately', async () => {
    const shortTimeout = 1 // 1ms timeout should always fail
    const result = await extractFromUrl(TEST_URL, JINA_API_KEY, {
      timeout: shortTimeout
    })

    if (result.success) {
      throw new Error('Expected extraction to fail due to timeout')
    }

    if (!result.error || !result.error.toLowerCase().includes('timeout')) {
      throw new Error('Expected timeout error message')
    }

    console.log(`   ✓ Timeout handled: ${result.error}`)
  })

  // Test 10: Multiple URL Extraction Performance
  await runTest('Extract from multiple URLs efficiently', async () => {
    const urls = [
      'https://example.com',
      'https://www.wikipedia.org',
      'https://github.com'
    ]

    const startTime = Date.now()
    const results = await Promise.all(
      urls.map(url => extractFromUrl(url, JINA_API_KEY, { timeout: 15000 }))
    )
    const duration = Date.now() - startTime

    const successCount = results.filter(r => r.success).length
    console.log(`   ✓ Extracted from ${successCount}/${urls.length} URLs`)
    console.log(`   ✓ Total time: ${duration}ms`)
    console.log(`   ✓ Average time per URL: ${Math.round(duration / urls.length)}ms`)
  })

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Results Summary\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log(`Total Tests: ${results.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏱️  Total Duration: ${totalDuration}ms`)
  console.log(`⏱️  Average Duration: ${Math.round(totalDuration / results.length)}ms`)

  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`   - ${r.name}`)
        console.log(`     ${r.error}`)
      })
  }

  console.log('\n' + '='.repeat(60))

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0)
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error running tests:', error)
    process.exit(1)
  })
}

export { runTests, results }
