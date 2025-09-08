#!/usr/bin/env tsx
/**
 * Test LinkedIn extraction with specific profile
 * URL: https://de.linkedin.com/in/johannes-gstettner-985998101
 */
import { BrightDataLinkedInClient } from '@/lib/brightdata-linkedin-client'
import { LinkedInProfileExtractorService } from '@/lib/linkedin-profile-extractor'

async function testSpecificLinkedInProfile() {
  const testUrl = 'https://de.linkedin.com/in/johannes-gstettner-985998101'
  
  console.log('🧪 Testing LinkedIn extraction with specific profile:')
  console.log(`🔗 URL: ${testUrl}`)
  console.log('=' .repeat(60))

  try {
    // Test 1: URL Validation
    console.log('\n--- 1. URL Validation Test ---')
    const client = new BrightDataLinkedInClient()
    
    const isValid = client.isValidLinkedInUrl(testUrl)
    console.log(`✅ URL Valid: ${isValid}`)
    
    if (isValid) {
      const normalizedUrl = client.normalizeLinkedInUrl(testUrl)
      console.log(`🔧 Normalized URL: ${normalizedUrl}`)
    }

    // Test 2: API Connectivity
    console.log('\n--- 2. API Connectivity Test ---')
    const apiStatus = await client.checkApiStatus()
    console.log(`📡 API Available: ${apiStatus.available}`)
    console.log(`📝 Message: ${apiStatus.message}`)

    if (!apiStatus.available) {
      console.warn('⚠️ API not available, skipping extraction test')
      return
    }

    // Test 3: Direct API Extraction
    console.log('\n--- 3. Direct API Extraction Test ---')
    console.log('🔍 Attempting profile extraction...')
    
    try {
      // Set a shorter timeout for this test to avoid long waits
      const startTime = Date.now()
      
      // Try extraction with timeout
      const extractionPromise = client.extractProfile(testUrl)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Extraction timeout after 60 seconds')), 60000)
      })

      const profileData = await Promise.race([extractionPromise, timeoutPromise]) as any
      const extractionTime = Date.now() - startTime

      console.log(`⏱️ Extraction completed in: ${extractionTime}ms`)
      console.log('✅ Profile extraction successful!')
      
      // Display extracted data
      console.log('\n📊 Profile Summary:')
      console.log(`   Name: ${profileData.name || 'N/A'}`)
      console.log(`   First Name: ${profileData.first_name || 'N/A'}`)
      console.log(`   Last Name: ${profileData.last_name || 'N/A'}`)
      console.log(`   Headline: ${profileData.headline || 'N/A'}`)
      console.log(`   Position: ${profileData.position || 'N/A'}`)
      console.log(`   Company: ${profileData.current_company || 'N/A'}`)
      console.log(`   Industry: ${profileData.industry || 'N/A'}`)
      console.log(`   Location: ${[profileData.city, profileData.country].filter(Boolean).join(', ') || 'N/A'}`)
      console.log(`   Country Code: ${profileData.country_code || 'N/A'}`)
      console.log(`   Status: ${profileData.status || 'N/A'}`)

      if (profileData.summary) {
        console.log(`   Summary: ${profileData.summary.substring(0, 100)}${profileData.summary.length > 100 ? '...' : ''}`)
      }

      // Display experience data
      if (profileData.experience && profileData.experience.length > 0) {
        console.log(`\n💼 Experience (${profileData.experience.length} entries):`)
        profileData.experience.slice(0, 3).forEach((exp: any, index: number) => {
          console.log(`   ${index + 1}. ${exp.title || 'N/A'} at ${exp.company || 'N/A'}`)
          if (exp.duration) console.log(`      Duration: ${exp.duration}`)
          if (exp.location) console.log(`      Location: ${exp.location}`)
        })
      }

      // Display education data
      if (profileData.education && profileData.education.length > 0) {
        console.log(`\n🎓 Education (${profileData.education.length} entries):`)
        profileData.education.slice(0, 2).forEach((edu: any, index: number) => {
          console.log(`   ${index + 1}. ${edu.degree || 'N/A'} at ${edu.school || 'N/A'}`)
          if (edu.field_of_study) console.log(`      Field: ${edu.field_of_study}`)
        })
      }

      // Display skills
      if (profileData.skills && profileData.skills.length > 0) {
        console.log(`\n🛠️ Skills (${profileData.skills.length} total):`)
        console.log(`   ${profileData.skills.slice(0, 10).join(', ')}${profileData.skills.length > 10 ? '...' : ''}`)
      }

      // Display social proof
      if (profileData.follower_count || profileData.connection_count) {
        console.log('\n📈 Social Proof:')
        if (profileData.follower_count) console.log(`   Followers: ${profileData.follower_count}`)
        if (profileData.connection_count) console.log(`   Connections: ${profileData.connection_count}`)
      }

      // Test personalization hooks
      console.log('\n--- 4. Personalization Hooks Test ---')
      const personalizationFields = client.getPersonalizationFields(profileData)
      
      console.log('🎯 Basic Personalization:')
      Object.entries(personalizationFields.basic).forEach(([key, value]) => {
        if (value) console.log(`   ${key}: ${value}`)
      })
      
      console.log('💼 Professional Personalization:')
      Object.entries(personalizationFields.professional).forEach(([key, value]) => {
        if (value && value !== 0) console.log(`   ${key}: ${value}`)
      })
      
      console.log('👤 Personal Personalization:')
      Object.entries(personalizationFields.personal).forEach(([key, value]) => {
        if (value && value !== 0) console.log(`   ${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      })

      // Generate sample outreach hooks
      console.log('\n--- 5. Sample Outreach Hooks ---')
      const hooks: string[] = []
      
      if (profileData.position && profileData.current_company) {
        hooks.push(`I noticed your role as ${profileData.position} at ${profileData.current_company}`)
      }
      
      if (profileData.experience && profileData.experience.length > 1) {
        hooks.push(`Your career progression through ${profileData.experience.length} roles caught my attention`)
      }
      
      if (profileData.education && profileData.education[0]?.school) {
        hooks.push(`As a fellow ${profileData.education[0].school} connection`)
      }
      
      if (profileData.city && profileData.country) {
        hooks.push(`I see you're based in ${profileData.city}, ${profileData.country}`)
      }
      
      if (profileData.skills && profileData.skills.length > 0) {
        hooks.push(`Your expertise in ${profileData.skills.slice(0, 3).join(', ')} aligns well`)
      }

      if (hooks.length > 0) {
        console.log('✨ Generated outreach hooks:')
        hooks.forEach((hook, index) => {
          console.log(`   ${index + 1}. "${hook}..."`)
        })
      }

      console.log('\n🎉 LinkedIn extraction test completed successfully!')

    } catch (extractionError) {
      console.error('❌ Profile extraction failed:', extractionError instanceof Error ? extractionError.message : 'Unknown error')
      
      // If extraction failed, it might be due to async processing
      console.log('\n💡 Note: This might be due to Bright Data\'s asynchronous processing.')
      console.log('   In production, the system would handle async jobs properly.')
    }

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error')
  }
}

// Run the test
console.log('🚀 Starting LinkedIn profile extraction test...')
testSpecificLinkedInProfile().catch(console.error)