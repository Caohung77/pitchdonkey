#!/usr/bin/env tsx
/**
 * Test script for Bright Data LinkedIn API integration
 * Tests the TypeScript implementation against the Java example
 */
import { BrightDataLinkedInClient } from '@/lib/brightdata-linkedin-client'

async function testBrightDataLinkedIn() {
  console.log('🧪 Testing Bright Data LinkedIn API Integration...')
  
  // Test URLs from the Java example
  const testUrls = [
    'https://www.linkedin.com/in/elad-moshe-05a90413/',
    'https://www.linkedin.com/in/jonathan-myrvik-3baa01109',
    'https://www.linkedin.com/in/aviv-tal-75b81/',
    'https://www.linkedin.com/in/bulentakar/'
  ]

  try {
    // Initialize client
    console.log('🔧 Initializing Bright Data LinkedIn client...')
    const client = new BrightDataLinkedInClient()
    
    // Test API status first
    console.log('🔍 Checking API status...')
    const apiStatus = await client.checkApiStatus()
    console.log(`📊 API Status: ${apiStatus.available ? 'Available' : 'Unavailable'}`)
    if (apiStatus.message) {
      console.log(`📝 Message: ${apiStatus.message}`)
    }
    
    if (!apiStatus.available) {
      console.warn('⚠️ API not available, skipping profile extraction test')
      return
    }

    // Test URL validation
    console.log('\n--- URL Validation Test ---')
    testUrls.forEach((url, index) => {
      const isValid = client.isValidLinkedInUrl(url)
      console.log(`${index + 1}. ${url} - ${isValid ? '✅ Valid' : '❌ Invalid'}`)
      
      if (isValid) {
        try {
          const normalized = client.normalizeLinkedInUrl(url)
          console.log(`   Normalized: ${normalized}`)
        } catch (error) {
          console.log(`   ❌ Normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    })

    // Test single profile extraction
    console.log('\n--- Single Profile Extraction Test ---')
    try {
      console.log(`🔍 Testing single profile extraction with: ${testUrls[0]}`)
      const singleProfile = await client.extractProfile(testUrls[0])
      
      console.log('✅ Single profile extraction successful!')
      console.log('📊 Profile summary:')
      console.log(`   Name: ${singleProfile.name || 'N/A'}`)
      console.log(`   Position: ${singleProfile.position || 'N/A'}`)
      console.log(`   Company: ${singleProfile.current_company || 'N/A'}`)
      console.log(`   Location: ${[singleProfile.city, singleProfile.country].filter(Boolean).join(', ') || 'N/A'}`)
      console.log(`   Status: ${singleProfile.status || 'N/A'}`)
      
      if (singleProfile.error) {
        console.log(`   Error: ${singleProfile.error}`)
      }

      // Test personalization fields extraction
      const personalizationFields = client.getPersonalizationFields(singleProfile)
      console.log('\n📝 Personalization fields:')
      console.log('   Basic:', JSON.stringify(personalizationFields.basic, null, 2))
      console.log('   Professional:', JSON.stringify(personalizationFields.professional, null, 2))
      console.log('   Personal:', JSON.stringify(personalizationFields.personal, null, 2))

    } catch (error) {
      console.error('❌ Single profile extraction failed:', error instanceof Error ? error.message : 'Unknown error')
    }

    // Test batch profile extraction
    console.log('\n--- Batch Profile Extraction Test ---')
    try {
      console.log(`🔍 Testing batch extraction with ${testUrls.length} profiles...`)
      const batchProfiles = await client.extractProfiles(testUrls)
      
      console.log(`✅ Batch extraction completed! Retrieved ${batchProfiles.length} profiles`)
      
      batchProfiles.forEach((profile, index) => {
        console.log(`\n${index + 1}. Profile Summary:`)
        console.log(`   URL: ${testUrls[index]}`)
        console.log(`   Name: ${profile.name || 'N/A'}`)
        console.log(`   Position: ${profile.position || 'N/A'}`)
        console.log(`   Company: ${profile.current_company || 'N/A'}`)
        console.log(`   Status: ${profile.status || 'N/A'}`)
        
        if (profile.error) {
          console.log(`   Error: ${profile.error}`)
        }
        
        // Show data richness
        const dataPoints = [
          profile.experience?.length || 0,
          profile.education?.length || 0,
          profile.skills?.length || 0,
          profile.certifications?.length || 0
        ]
        console.log(`   Data richness: Exp(${dataPoints[0]}) Edu(${dataPoints[1]}) Skills(${dataPoints[2]}) Certs(${dataPoints[3]})`)
      })

    } catch (error) {
      console.error('❌ Batch profile extraction failed:', error instanceof Error ? error.message : 'Unknown error')
    }

    console.log('\n🎉 Test completed!')

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error')
    console.error('🔍 Make sure environment variables are set:')
    console.error('   - BRIGHTDATA_API_KEY')
    console.error('   - BRIGHTDATA_DATASET_ID (optional)')
    console.error('   - BRIGHTDATA_API_URL (optional)')
  }
}

// Test invalid URLs
async function testInvalidUrls() {
  console.log('\n--- Invalid URL Test ---')
  const client = new BrightDataLinkedInClient()
  
  const invalidUrls = [
    'https://facebook.com/profile',
    'not-a-url',
    'https://linkedin.com/company/microsoft', // Company page, not profile
    'https://linkedin.com/in/', // Missing profile ID
  ]

  invalidUrls.forEach((url, index) => {
    const isValid = client.isValidLinkedInUrl(url)
    console.log(`${index + 1}. ${url} - ${isValid ? '✅ Valid' : '❌ Invalid'} ${isValid ? '(Unexpected!)' : '(Expected)'}`)
  })
}

// Run tests
testBrightDataLinkedIn().then(() => {
  testInvalidUrls()
}).catch((error) => {
  console.error('❌ Test execution failed:', error)
  process.exit(1)
})