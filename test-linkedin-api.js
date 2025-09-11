/**
 * Test script to validate BrightData LinkedIn API integration
 * Testing with Richard Revyn profile: https://www.linkedin.com/in/richard-revyn-1658b4a7/
 */

// Import modules with proper paths
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testLinkedInAPI() {
  console.log('🧪 Testing BrightData LinkedIn API Integration...\n')

  try {
    // Initialize services
    const supabase = createServerSupabaseClient()
    const linkedinExtractor = new LinkedInProfileExtractorService(supabase)
    
    // Test profile
    const testProfile = {
      contactId: 'test-richard-revyn',
      linkedinUrl: 'https://www.linkedin.com/in/richard-revyn-1658b4a7/',
      name: 'Richard Revyn'
    }

    console.log('🎯 Testing Profile:', testProfile.name)
    console.log('🔗 LinkedIn URL:', testProfile.linkedinUrl)
    console.log('📊 Contact ID:', testProfile.contactId)
    console.log('')

    // Test the extraction
    console.log('🔍 Starting LinkedIn data extraction...')
    const result = await linkedinExtractor.extractContactLinkedIn(
      testProfile.contactId,
      testProfile.linkedinUrl
    )

    if (result.success) {
      console.log('✅ LinkedIn extraction successful!\n')
      
      // Analyze the extracted data
      const data = result.data
      console.log('📋 EXTRACTED DATA SUMMARY:')
      console.log('=' * 50)
      
      // Basic Information
      console.log('👤 BASIC INFORMATION:')
      console.log(`   Name: ${data.linkedin_first_name || 'N/A'} ${data.linkedin_last_name || 'N/A'}`)
      console.log(`   Headline: ${data.linkedin_headline || 'N/A'}`)
      console.log(`   About: ${data.linkedin_about ? 'Available' : 'Not available'}`)
      console.log(`   Location: ${data.linkedin_location || 'N/A'}`)
      console.log(`   Industry: ${data.linkedin_industry || 'N/A'}`)
      console.log('')

      // Current Employment
      console.log('💼 CURRENT EMPLOYMENT:')
      console.log(`   Company: ${data.linkedin_current_company || 'N/A'}`)
      console.log('')

      // Professional Experience
      console.log('🏢 PROFESSIONAL EXPERIENCE:')
      const experience = data.linkedin_experience || []
      console.log(`   Total Experience Entries: ${experience.length}`)
      
      if (experience.length > 0) {
        experience.slice(0, 3).forEach((exp, index) => {
          console.log(`   ${index + 1}. ${exp.title || 'N/A'} at ${exp.company || 'N/A'}`)
          console.log(`      Duration: ${exp.duration || 'N/A'}`)
          console.log(`      Location: ${exp.location || 'N/A'}`)
          if (exp.description && exp.description.length > 0) {
            console.log(`      Description: ${exp.description.substring(0, 100)}...`)
          }
          console.log('')
        })
        
        if (experience.length > 3) {
          console.log(`   ... and ${experience.length - 3} more experience entries`)
          console.log('')
        }
      } else {
        console.log('   ❌ No experience data extracted')
        console.log('')
      }

      // Education
      console.log('🎓 EDUCATION:')
      const education = data.linkedin_education || []
      console.log(`   Total Education Entries: ${education.length}`)
      
      if (education.length > 0) {
        education.forEach((edu, index) => {
          console.log(`   ${index + 1}. ${edu.degree || edu.field_of_study || 'N/A'}`)
          console.log(`      School: ${edu.school || 'N/A'}`)
          console.log(`      Duration: ${edu.duration || 'N/A'}`)
          console.log('')
        })
      } else {
        console.log('   ❌ No education data extracted')
        console.log('')
      }

      // Skills
      console.log('🛠️ SKILLS:')
      const skills = data.linkedin_skills || []
      console.log(`   Total Skills: ${skills.length}`)
      if (skills.length > 0) {
        const skillNames = skills.slice(0, 10).map(skill => skill.name || skill).join(', ')
        console.log(`   Top Skills: ${skillNames}`)
        if (skills.length > 10) {
          console.log(`   ... and ${skills.length - 10} more skills`)
        }
      } else {
        console.log('   ❌ No skills data extracted')
      }
      console.log('')

      // Network Stats
      console.log('📈 NETWORK STATISTICS:')
      console.log(`   Followers: ${data.linkedin_follower_count || 0}`)
      console.log(`   Connections: ${data.linkedin_connection_count || 0}`)
      console.log('')

      // Data Quality Assessment
      console.log('📊 DATA QUALITY ASSESSMENT:')
      const hasBasicInfo = !!(data.linkedin_first_name || data.linkedin_headline)
      const hasExperience = experience.length > 0
      const hasEducation = education.length > 0
      const hasSkills = skills.length > 0
      const hasNetworkStats = !!(data.linkedin_follower_count || data.linkedin_connection_count)
      
      console.log(`   ✅ Basic Information: ${hasBasicInfo ? 'PASS' : 'FAIL'}`)
      console.log(`   ✅ Professional Experience: ${hasExperience ? 'PASS' : 'FAIL'}`)
      console.log(`   ✅ Education: ${hasEducation ? 'PASS' : 'FAIL'}`)
      console.log(`   ✅ Skills: ${hasSkills ? 'PASS' : 'FAIL'}`)
      console.log(`   ✅ Network Statistics: ${hasNetworkStats ? 'PASS' : 'FAIL'}`)
      
      const overallQuality = [hasBasicInfo, hasExperience, hasEducation, hasSkills, hasNetworkStats].filter(Boolean).length
      console.log(`   📋 Overall Quality: ${overallQuality}/5 (${(overallQuality/5*100).toFixed(0)}%)`)
      
      if (overallQuality >= 3) {
        console.log('   🎉 EXCELLENT - Rich LinkedIn data successfully extracted!')
      } else if (overallQuality >= 2) {
        console.log('   ⚠️ MODERATE - Some LinkedIn data extracted, but missing key sections')
      } else {
        console.log('   ❌ POOR - Limited LinkedIn data extracted')
      }

    } else {
      console.log('❌ LinkedIn extraction failed!')
      console.log('Error:', result.error)
      
      if (result.details) {
        console.log('Details:', result.details)
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
    console.error('Stack trace:', error.stack)
  }

  console.log('\n🏁 Test completed!')
}

// Run the test
testLinkedInAPI()