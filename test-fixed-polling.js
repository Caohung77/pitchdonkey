#!/usr/bin/env node

/**
 * Test the fixed polling logic with the existing ready snapshot
 */

const { BrightDataLinkedInClient } = require('./lib/brightdata-linkedin-client.ts')

async function testFixedPolling() {
  console.log('🔧 === Testing Fixed Polling Logic ===\n')
  
  try {
    const client = new BrightDataLinkedInClient()
    
    // Test with the existing "ready" snapshot that has data
    const snapshotId = 's_mfb5weucwbbi183cf'
    
    console.log(`Testing snapshot: ${snapshotId}`)
    console.log('This snapshot status is "ready" with 1 record')
    
    const results = await client.pollSnapshotResults(snapshotId, 30000, 5000)
    
    if (results && results.length > 0) {
      console.log('\n🎉 SUCCESS! Fixed polling logic works!')
      console.log(`Retrieved ${results.length} LinkedIn profiles`)
      
      const profile = results[0]
      console.log('\n📊 Profile Summary:')
      console.log(`Name: ${profile.name}`)
      console.log(`Position: ${profile.position}`)
      console.log(`Company: ${profile.current_company?.name || profile.current_company}`)
      console.log(`Location: ${profile.city}`)
      
      // Test personalization fields
      const personalizationFields = client.getPersonalizationFields(profile)
      console.log('\n🎯 Personalization Data Ready!')
      console.log(`First Name: ${personalizationFields.basic.name}`)
      console.log(`Position: ${personalizationFields.basic.position}`)
      console.log(`Company: ${personalizationFields.basic.company}`)
      
    } else {
      console.log('❌ No results returned')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Set environment variable and run test
process.env.BRIGHTDATA_API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
testFixedPolling()