/**
 * Test script to verify enhanced LinkedIn experience extraction
 */

const { createClient } = require('@supabase/supabase-js')
const { LinkedInProfileExtractorService } = require('./lib/linkedin-profile-extractor')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testExperienceFix() {
  console.log('🧪 Testing Enhanced LinkedIn Experience Extraction...\n')

  try {
    // Find contacts with LinkedIn URLs but 0 experience count
    console.log('1. Finding contacts with missing experience data...')
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id, 
        email, 
        first_name, 
        last_name,
        linkedin_url,
        linkedin_extraction_status,
        linkedin_current_company,
        linkedin_current_position,
        linkedin_experience
      `)
      .not('linkedin_url', 'is', null)
      .eq('linkedin_extraction_status', 'completed')
      .is('linkedin_experience', null) // Null or empty experience
      .limit(3)

    if (contactsError) {
      console.error('Error querying contacts:', contactsError)
      return
    }

    console.log(`Found ${contacts.length} contacts with missing experience data`)

    if (contacts.length === 0) {
      console.log('No contacts found that need experience data enhancement.')
      return
    }

    // Test the enhanced extractor on one contact
    const testContact = contacts[0]
    console.log(`\n2. Testing experience extraction for: ${testContact.email}`)
    console.log(`   LinkedIn URL: ${testContact.linkedin_url}`)
    console.log(`   Current Company: ${testContact.linkedin_current_company || 'None'}`)
    console.log(`   Current Position: ${testContact.linkedin_current_position || 'None'}`)
    console.log(`   Current Experience Count: ${testContact.linkedin_experience?.length || 0}`)

    // Get user_id for this contact (we'll use the first user found)
    const { data: contactWithUser, error: userError } = await supabase
      .from('contacts')
      .select('user_id')
      .eq('id', testContact.id)
      .single()

    if (userError || !contactWithUser) {
      console.error('Error getting user_id for contact:', userError)
      return
    }

    // Clear existing LinkedIn data to force re-extraction
    console.log('\n3. Clearing existing LinkedIn data to force re-extraction...')
    await supabase
      .from('contacts')
      .update({
        linkedin_extraction_status: null,
        linkedin_experience: null
      })
      .eq('id', testContact.id)

    // Test the enhanced extraction service
    console.log('\n4. Running enhanced LinkedIn extraction...')
    const extractorService = new LinkedInProfileExtractorService()
    
    const result = await extractorService.extractContactLinkedIn(
      testContact.id, 
      contactWithUser.user_id
    )

    console.log('\n5. Extraction Results:')
    console.log(`   Success: ${result.success}`)
    console.log(`   Status: ${result.status}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }

    // Check the results
    if (result.success && result.data) {
      console.log(`\n6. Enhanced Experience Data:`)
      console.log(`   Experience Count: ${result.data.experience?.length || 0}`)
      
      if (result.data.experience && result.data.experience.length > 0) {
        result.data.experience.forEach((exp, index) => {
          console.log(`   Experience ${index + 1}:`)
          console.log(`      Title: ${exp.title}`)
          console.log(`      Company: ${exp.company}`)
          console.log(`      Location: ${exp.location}`)
          console.log(`      Duration: ${exp.duration}`)
        })
      }
    }

    // Verify database was updated
    console.log('\n7. Verifying database update...')
    const { data: updatedContact } = await supabase
      .from('contacts')
      .select('linkedin_experience, linkedin_current_company, linkedin_current_position')
      .eq('id', testContact.id)
      .single()

    if (updatedContact) {
      console.log(`   Database Experience Count: ${updatedContact.linkedin_experience?.length || 0}`)
      if (updatedContact.linkedin_experience && updatedContact.linkedin_experience.length > 0) {
        console.log(`   Database First Experience:`)
        console.log(`      Title: ${updatedContact.linkedin_experience[0].title}`)
        console.log(`      Company: ${updatedContact.linkedin_experience[0].company}`)
      }
    }

    console.log('\n✅ Experience extraction test complete!')

  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
testExperienceFix()