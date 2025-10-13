#!/usr/bin/env node

/**
 * Test Perplexity API key validity
 */

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

async function testPerplexityKey() {
  if (!PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY environment variable is not set')
    console.log('Set it in .env.local or run: PERPLEXITY_API_KEY=your-key node scripts/test-perplexity-key.js')
    process.exit(1)
  }

  console.log('Testing Perplexity API key...')
  console.log('Key:', PERPLEXITY_API_KEY.substring(0, 15) + '...')

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: 'Say hello'
          }
        ]
      })
    })

    console.log('Status:', response.status, response.statusText)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ API Key is VALID!')
      console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200))
    } else {
      const errorText = await response.text()
      console.log('❌ API Key is INVALID or EXPIRED')
      console.log('Error:', errorText.substring(0, 500))
      console.log('\n📝 Get a new key at: https://www.perplexity.ai/settings/api')
    }
  } catch (error) {
    console.error('❌ Network error:', error.message)
  }
}

testPerplexityKey()
