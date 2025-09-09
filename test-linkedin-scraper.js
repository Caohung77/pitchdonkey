#!/usr/bin/env node

/**
 * LinkedIn Scraper Test for Frédéric Titze Profile
 * URL: https://www.linkedin.com/in/frédéric-titze-4a5ba1110/
 */

const { BrightDataLinkedInClient } = require('./lib/brightdata-linkedin-client.ts')

// Test URL - the profile you want to scrape
const TEST_URL = 'https://www.linkedin.com/in/frédéric-titze-4a5ba1110/'

async function testLinkedInScraper() {
  console.log('🔍 === LinkedIn Scraper Test ===')
  console.log(`📄 Target Profile: ${TEST_URL}`)
  console.log('🎯 Goal: Extract personalization fields for email outreach\n')

  try {
    // Initialize the client
    const client = new BrightDataLinkedInClient()
    
    // Check if API is available first
    console.log('🔧 Checking API status...')
    const apiStatus = await client.checkApiStatus()
    console.log(`API Status: ${apiStatus.available ? '✅ Available' : '❌ Unavailable'}`)
    if (apiStatus.message) {
      console.log(`Message: ${apiStatus.message}`)
    }
    
    if (!apiStatus.available) {
      console.log('⚠️ API is not available, but continuing with the test...')
    }
    
    console.log('\n📡 Starting LinkedIn profile extraction...')
    console.log(`URL: ${TEST_URL}`)
    
    // Validate URL first
    const isValidUrl = client.isValidLinkedInUrl(TEST_URL)
    console.log(`URL Validation: ${isValidUrl ? '✅ Valid' : '❌ Invalid'}`)
    
    if (!isValidUrl) {
      console.error('❌ Invalid LinkedIn URL format')
      return
    }
    
    // Extract profile data
    const startTime = Date.now()
    const profile = await client.extractProfile(TEST_URL)
    const extractionTime = Date.now() - startTime
    
    console.log(`\n✅ Profile extraction completed in ${extractionTime}ms`)
    console.log('📊 Profile data received\n')
    
    // Display key information for email personalization
    console.log('🎯 === PERSONALIZATION DATA FOR EMAIL OUTREACH ===\n')
    
    // Basic Information
    console.log('👤 BASIC INFORMATION:')
    console.log(`   Name: ${profile.name || 'N/A'}`)
    console.log(`   First Name: ${profile.first_name || 'N/A'}`)
    console.log(`   Last Name: ${profile.last_name || 'N/A'}`)
    console.log(`   Headline: ${profile.headline || 'N/A'}`)
    console.log(`   Location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'N/A'}`)
    
    // Professional Information
    console.log('\n💼 PROFESSIONAL INFORMATION:')
    console.log(`   Current Position: ${profile.position || 'N/A'}`)
    console.log(`   Current Company: ${profile.current_company?.name || profile.current_company || 'N/A'}`)
    console.log(`   Industry: ${profile.industry || 'N/A'}`)
    
    // Recent Experience
    if (profile.experience && profile.experience.length > 0) {
      console.log('\n🏢 RECENT EXPERIENCE:')
      profile.experience.slice(0, 3).forEach((exp, index) => {
        console.log(`   ${index + 1}. ${exp.title || 'N/A'} at ${exp.company || 'N/A'}`)
        if (exp.start_date || exp.end_date) {
          console.log(`      Duration: ${exp.start_date || 'N/A'} - ${exp.end_date || 'Present'}`)
        }
      })
    }
    
    // Education
    if (profile.education && profile.education.length > 0) {
      console.log('\n🎓 EDUCATION:')
      profile.education.slice(0, 2).forEach((edu, index) => {
        console.log(`   ${index + 1}. ${edu.school || 'N/A'}`)
        if (edu.degree) console.log(`      Degree: ${edu.degree}`)
        if (edu.field_of_study) console.log(`      Field: ${edu.field_of_study}`)
      })
    }
    
    // Skills (top 10)
    if (profile.skills && profile.skills.length > 0) {
      console.log('\n🛠️ TOP SKILLS:')
      const topSkills = profile.skills.slice(0, 10).join(', ')
      console.log(`   ${topSkills}`)
    }
    
    // About Section
    if (profile.about) {
      console.log('\n📝 ABOUT SECTION:')
      const aboutPreview = profile.about.length > 200 
        ? profile.about.substring(0, 200) + '...' 
        : profile.about
      console.log(`   ${aboutPreview}`)
    }
    
    // Languages
    if (profile.languages && profile.languages.length > 0) {
      console.log('\n🌍 LANGUAGES:')
      profile.languages.forEach(lang => {
        console.log(`   ${lang.name}${lang.proficiency ? ` (${lang.proficiency})` : ''}`)
      })
    }
    
    // Recent Activity/Posts (if available)
    if (profile.posts && profile.posts.length > 0) {
      console.log('\n📱 RECENT POSTS:')
      profile.posts.slice(0, 3).forEach((post, index) => {
        console.log(`   ${index + 1}. ${post.title || post.content?.substring(0, 100) || 'N/A'}`)
      })
    }
    
    // Get personalization fields using the client's helper method
    console.log('\n🎯 === PERSONALIZATION FIELD SUMMARY ===')
    const personalizationFields = client.getPersonalizationFields(profile)
    
    console.log('\n📋 BASIC FIELDS:')
    Object.entries(personalizationFields.basic).forEach(([key, value]) => {
      console.log(`   ${key}: ${value || 'N/A'}`)
    })
    
    console.log('\n📋 PROFESSIONAL FIELDS:')
    Object.entries(personalizationFields.professional).forEach(([key, value]) => {
      console.log(`   ${key}: ${Array.isArray(value) ? value.join(', ') : value || 'N/A'}`)
    })
    
    console.log('\n📋 PERSONAL FIELDS:')
    Object.entries(personalizationFields.personal).forEach(([key, value]) => {
      console.log(`   ${key}: ${Array.isArray(value) ? value.join(', ') : value || 'N/A'}`)
    })
    
    console.log('\n🎉 === EMAIL OUTREACH SUGGESTIONS ===')
    console.log('Based on the extracted data, you can personalize emails with:')
    console.log(`• Professional greeting: "Hi ${profile.first_name || profile.name?.split(' ')[0]}"`)
    console.log(`• Role reference: "${profile.position} at ${profile.current_company?.name || profile.current_company}"`)
    console.log(`• Location context: "I noticed you're based in ${profile.city}"`)
    if (profile.education && profile.education[0]) {
      console.log(`• Education connection: "As a fellow ${profile.education[0].school} alum"`)
    }
    if (profile.skills && profile.skills.length > 0) {
      console.log(`• Skill relevance: "Given your expertise in ${profile.skills[0]}"`)
    }
    
    // Technical details
    console.log('\n📊 === TECHNICAL DETAILS ===')
    console.log(`Profile ID: ${profile.id || 'N/A'}`)
    console.log(`LinkedIn URL: ${profile.url || profile.profile_url || 'N/A'}`)
    console.log(`Data Quality: ${profile.status || 'N/A'}`)
    console.log(`Extraction Timestamp: ${new Date().toISOString()}`)
    
    // Raw data (for debugging - truncated)
    console.log('\n🔍 === RAW DATA PREVIEW ===')
    const rawPreview = {
      ...profile,
      about: profile.about ? profile.about.substring(0, 100) + '...' : undefined
    }
    console.log(JSON.stringify(rawPreview, null, 2).substring(0, 1000) + '...')
    
    console.log('\n✅ Test completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error('Stack trace:', error.stack)
    
    // Provide troubleshooting suggestions
    console.log('\n🔧 TROUBLESHOOTING SUGGESTIONS:')
    console.log('1. Check that BRIGHTDATA_API_KEY is set in your environment')
    console.log('2. Verify that the LinkedIn URL is accessible and public')
    console.log('3. Check your Bright Data account quota and status')
    console.log('4. Try with a different LinkedIn profile URL')
    
    // Check environment variables
    console.log('\n🔍 ENVIRONMENT CHECK:')
    console.log(`BRIGHTDATA_API_KEY: ${process.env.BRIGHTDATA_API_KEY ? '✅ Set' : '❌ Not set'}`)
    console.log(`BRIGHTDATA_DATASET_ID: ${process.env.BRIGHTDATA_DATASET_ID ? '✅ Set' : '❌ Not set (using default)'}`)
  }
}

// Run the test
if (require.main === module) {
  testLinkedInScraper()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { testLinkedInScraper }