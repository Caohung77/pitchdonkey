#!/usr/bin/env node

/**
 * Test script for Smart Fill API endpoint
 * Tests the AI persona smart fill feature that scrapes website information
 */

const SMART_FILL_API = 'http://localhost:3000/api/ai-personas/smart-fill'
const TEST_URL = 'https://theaiwhisperer.de/about-me/'

async function testSmartFill() {
  console.log('🧪 Testing Smart Fill API...')
  console.log('📍 Test URL:', TEST_URL)
  console.log('🔗 API Endpoint:', SMART_FILL_API)
  console.log('')

  try {
    // Note: In a real scenario, this would need authentication
    // For testing, you'll need to run this with a valid session token
    console.log('⏳ Making request...')

    const response = await fetch(SMART_FILL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: TEST_URL
      })
    })

    console.log('📊 Response Status:', response.status, response.statusText)
    console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()))
    console.log('')

    const responseText = await response.text()
    console.log('📄 Raw Response:', responseText)
    console.log('')

    try {
      const data = JSON.parse(responseText)
      console.log('✅ Parsed Response:', JSON.stringify(data, null, 2))

      if (data.success) {
        console.log('')
        console.log('🎉 Smart Fill SUCCESS!')
        console.log('📊 Extracted Data:')
        console.log('  Company:', data.data?.companyName || 'N/A')
        console.log('  Industry:', data.data?.industry || 'N/A')
        console.log('  One-liner:', data.data?.productOneLiner || 'N/A')
        console.log('  USPs:', data.data?.uniqueSellingPoints?.length || 0, 'points')
      } else {
        console.log('')
        console.log('❌ Smart Fill FAILED')
        console.log('Error:', data.error)
        if (data.details) {
          console.log('Details:', data.details)
        }
      }
    } catch (parseError) {
      console.log('❌ Failed to parse response as JSON')
      console.log('Parse error:', parseError.message)
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Error details:', error)
  }
}

// Check if dev server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000', { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('   Smart Fill API Test Script')
  console.log('═══════════════════════════════════════════')
  console.log('')

  const serverRunning = await checkServer()
  if (!serverRunning) {
    console.log('❌ Dev server not running on localhost:3000')
    console.log('💡 Please start the dev server first:')
    console.log('   npm run dev')
    console.log('')
    process.exit(1)
  }

  console.log('✅ Dev server is running')
  console.log('')

  await testSmartFill()
}

main()
