/**
 * Knowledge Base Extraction Test Script
 *
 * Tests Jina AI extraction with https://www.boniforce.de
 * Run with: node scripts/test-knowledge-extraction.js
 */

require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const TEST_URL = 'https://www.boniforce.de'
const JINA_API_KEY = process.env.JINA_API_KEY

console.log('🧪 Testing Knowledge Base Extraction Feature\n')
console.log('=' .repeat(70))

// Test 1: Verify API Key
console.log('\n📋 Test 1: Verify Jina API Key Configuration')
if (!JINA_API_KEY) {
  console.error('❌ JINA_API_KEY not found in environment')
  process.exit(1)
}
console.log(`✅ API Key configured: ${JINA_API_KEY.substring(0, 10)}...`)

// Test 2: Extract content from URL
async function testUrlExtraction() {
  console.log(`\n📋 Test 2: Extract Content from ${TEST_URL}`)
  console.log('⏳ Making request to Jina AI...')

  const jinaUrl = `https://r.jina.ai/${TEST_URL}`
  const startTime = Date.now()

  try {
    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Accept': 'application/json',
        'X-Return-Format': 'markdown'
      },
      signal: AbortSignal.timeout(30000)
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Jina API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    console.log(`✅ Request successful (${duration}ms)`)
    console.log(`\n📊 Extraction Results:`)

    // Extract content
    const content = data.data?.content || data.content || ''
    const title = data.data?.title || data.title || 'Untitled'
    const description = data.data?.description || data.description || ''

    console.log(`   📄 Title: ${title}`)
    console.log(`   📝 Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`)
    console.log(`   📏 Content Length: ${content.length} characters`)

    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    console.log(`   📊 Word Count: ${wordCount} words`)

    // Show content preview
    console.log(`\n📄 Content Preview (first 500 chars):`)
    console.log('─'.repeat(70))
    console.log(content.substring(0, 500))
    console.log('─'.repeat(70))

    // Validate content quality
    console.log(`\n🔍 Content Quality Checks:`)

    if (content.length < 100) {
      console.log('⚠️  Warning: Content is very short (less than 100 characters)')
    } else {
      console.log('✅ Content length is adequate')
    }

    if (wordCount < 20) {
      console.log('⚠️  Warning: Word count is very low (less than 20 words)')
    } else {
      console.log('✅ Word count is adequate')
    }

    const meaningfulContent = content.replace(/[\s\W]/g, '')
    if (meaningfulContent.length < 50) {
      console.log('⚠️  Warning: Limited meaningful content')
    } else {
      console.log('✅ Contains meaningful content')
    }

    // Check for specific Boniforce content
    console.log(`\n🔎 Boniforce-Specific Content Validation:`)
    const lowerContent = content.toLowerCase()

    const keywords = ['boniforce', 'assessment', 'führungskräfte', 'leadership', 'diagnostik']
    const foundKeywords = keywords.filter(keyword => lowerContent.includes(keyword))

    if (foundKeywords.length > 0) {
      console.log(`✅ Found relevant keywords: ${foundKeywords.join(', ')}`)
    } else {
      console.log('⚠️  Warning: Expected Boniforce-related keywords not found')
    }

    // Test metadata structure
    console.log(`\n📦 Metadata Structure:`)
    console.log(`   • Response format: ${typeof data}`)
    console.log(`   • Has data object: ${!!data.data}`)
    console.log(`   • Has content: ${!!content}`)
    console.log(`   • Has title: ${!!title}`)
    console.log(`   • Has description: ${!!description}`)

    // Final verdict
    console.log(`\n✅ EXTRACTION SUCCESSFUL`)
    console.log(`   • ${content.length} characters extracted`)
    console.log(`   • ${wordCount} words`)
    console.log(`   • ${foundKeywords.length} relevant keywords found`)
    console.log(`   • Duration: ${duration}ms`)

    return {
      success: true,
      content,
      title,
      description,
      wordCount,
      duration
    }

  } catch (error) {
    console.error(`❌ Extraction failed: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
}

// Test 3: PDF Extraction Info
async function testPdfInfo() {
  console.log(`\n📋 Test 3: PDF Extraction Information`)
  console.log(`   ℹ️  PDF extraction works similarly to URL extraction`)
  console.log(`   ℹ️  PDFs must be uploaded to Supabase storage first`)
  console.log(`   ℹ️  Jina AI requires a publicly accessible PDF URL`)
  console.log(`   ℹ️  Process: Upload → Get Public URL → Extract with Jina`)
  console.log(`   ℹ️  Expected timeout: 60 seconds (longer than URL extraction)`)
}

// Run all tests
async function runAllTests() {
  try {
    const result = await testUrlExtraction()
    await testPdfInfo()

    console.log('\n' + '='.repeat(70))
    console.log('📊 Test Summary')
    console.log('='.repeat(70))

    if (result.success) {
      console.log('✅ All tests passed successfully!')
      console.log(`\n💡 Next Steps:`)
      console.log(`   1. Test in the UI by creating a new AI Persona`)
      console.log(`   2. Navigate to Step 6 (Knowledge) in persona creation`)
      console.log(`   3. Add a knowledge item with type "URL"`)
      console.log(`   4. Enter: ${TEST_URL}`)
      console.log(`   5. Verify content is extracted and saved correctly`)
      process.exit(0)
    } else {
      console.log('❌ Tests failed')
      console.log(`   Error: ${result.error}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

runAllTests()
