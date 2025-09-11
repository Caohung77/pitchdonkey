/**
 * Test script to verify LinkedIn data storage redesign
 * This script tests the new individual LinkedIn field structure
 * against the old JSON blob approach
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testLinkedInRedesign() {
  console.log('🔍 Testing LinkedIn Data Storage Redesign...\n')

  try {
    // Test 1: Check if migration was applied
    console.log('1. Checking if migration columns exist...')
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'contacts' })
    
    if (tableError) {
      console.log('Note: get_table_columns function not available, using direct query instead')
    }

    // Test 2: Query contacts with new LinkedIn fields
    console.log('2. Querying contacts with new LinkedIn fields...')
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id, 
        email, 
        first_name, 
        last_name,
        linkedin_url,
        linkedin_profile_data,
        linkedin_extraction_status,
        linkedin_first_name,
        linkedin_last_name,
        linkedin_headline,
        linkedin_about,
        linkedin_current_company,
        linkedin_industry,
        linkedin_location,
        linkedin_follower_count,
        linkedin_connection_count,
        linkedin_experience,
        linkedin_education,
        linkedin_skills
      `)
      .not('linkedin_profile_data', 'is', null)
      .limit(5)

    if (contactsError) {
      console.error('Error querying contacts:', contactsError)
      return
    }

    console.log(`Found ${contacts.length} contacts with LinkedIn data`)

    // Test 3: Compare old vs new data structure
    for (const contact of contacts) {
      console.log(`\n📋 Contact: ${contact.email}`)
      console.log(`   LinkedIn URL: ${contact.linkedin_url || 'None'}`)
      console.log(`   Extraction Status: ${contact.linkedin_extraction_status || 'None'}`)
      
      // Check if individual fields are populated
      const hasNewFields = !!(
        contact.linkedin_first_name ||
        contact.linkedin_headline ||
        contact.linkedin_about ||
        contact.linkedin_current_company
      )

      const hasOldData = !!contact.linkedin_profile_data

      console.log(`   Has Individual Fields: ${hasNewFields ? '✅' : '❌'}`)
      console.log(`   Has JSON Blob: ${hasOldData ? '✅' : '❌'}`)

      if (hasNewFields) {
        console.log(`   🎯 NEW STRUCTURE:`)
        console.log(`      Name: ${contact.linkedin_first_name} ${contact.linkedin_last_name}`)
        console.log(`      Headline: ${contact.linkedin_headline || 'None'}`)
        console.log(`      Company: ${contact.linkedin_current_company || 'None'}`)
        console.log(`      Industry: ${contact.linkedin_industry || 'None'}`)
        console.log(`      Location: ${contact.linkedin_location || 'None'}`)
        console.log(`      Followers: ${contact.linkedin_follower_count || 0}`)
        console.log(`      Connections: ${contact.linkedin_connection_count || 0}`)
        console.log(`      Experience Count: ${contact.linkedin_experience?.length || 0}`)
        console.log(`      Education Count: ${contact.linkedin_education?.length || 0}`)
        console.log(`      Skills Count: ${contact.linkedin_skills?.length || 0}`)
        console.log(`      About Available: ${!!contact.linkedin_about}`)
      }

      if (hasOldData && !hasNewFields) {
        console.log(`   📦 OLD STRUCTURE (JSON blob only)`)
        const jsonData = contact.linkedin_profile_data
        console.log(`      Name: ${jsonData.first_name} ${jsonData.last_name}`)
        console.log(`      Company: ${jsonData.current_company}`)
        console.log(`      Experience Count: ${jsonData.experience?.length || 0}`)
      }
    }

    // Test 4: Query performance comparison
    console.log('\n⚡ Performance Test: Individual Fields vs JSON Queries')
    
    const startTime1 = Date.now()
    const { data: individualQuery } = await supabase
      .from('contacts')
      .select('linkedin_current_company, linkedin_industry, linkedin_location')
      .not('linkedin_current_company', 'is', null)
      .limit(100)
    const individualTime = Date.now() - startTime1

    const startTime2 = Date.now()
    const { data: jsonQuery } = await supabase
      .from('contacts')
      .select('linkedin_profile_data')
      .not('linkedin_profile_data', 'is', null)
      .limit(100)
    const jsonTime = Date.now() - startTime2

    console.log(`   Individual Fields Query: ${individualTime}ms (${individualQuery?.length || 0} results)`)
    console.log(`   JSON Blob Query: ${jsonTime}ms (${jsonQuery?.length || 0} results)`)
    console.log(`   Performance Improvement: ${((jsonTime - individualTime) / jsonTime * 100).toFixed(1)}%`)

    // Test 5: Index usage
    console.log('\n🔍 Testing Index Usage...')
    const { data: companyQuery } = await supabase
      .from('contacts')
      .select('id, linkedin_current_company')
      .eq('linkedin_current_company', 'Google')

    console.log(`   Company filter results: ${companyQuery?.length || 0}`)

    const { data: industryQuery } = await supabase
      .from('contacts')
      .select('id, linkedin_industry')
      .eq('linkedin_industry', 'Technology')

    console.log(`   Industry filter results: ${industryQuery?.length || 0}`)

    console.log('\n✅ LinkedIn Data Storage Redesign Test Complete!')

  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
testLinkedInRedesign()