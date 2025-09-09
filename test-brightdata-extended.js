#!/usr/bin/env node

/**
 * Extended Bright Data API Test - Longer polling with multiple strategies
 */

const API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
const DATASET_ID = 'gd_l1viktl72bvl7bjuj0'
const BASE_URL = 'https://api.brightdata.com/datasets/v3'

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return { error: errorText, status: response.status }
    }
    
    return await response.json()
  } catch (error) {
    return { error: error.message }
  }
}

async function testWithDifferentUrl() {
  console.log('🧪 === Testing with a simpler LinkedIn profile ===')
  
  // Try a very basic LinkedIn profile that might process faster
  const payload = [
    { url: 'https://www.linkedin.com/in/williamhgates/' }
  ]
  
  console.log('Triggering job...')
  const triggerResult = await makeRequest(`${BASE_URL}/trigger?dataset_id=${DATASET_ID}&include_errors=true`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  
  if (triggerResult.error) {
    console.error('❌ Trigger failed:', triggerResult.error)
    return
  }
  
  const snapshotId = triggerResult.snapshot_id
  console.log(`📝 Snapshot ID: ${snapshotId}`)
  
  // Extended polling - up to 10 minutes
  const maxChecks = 30 // 30 checks * 20 seconds = 10 minutes
  
  for (let i = 1; i <= maxChecks; i++) {
    console.log(`\n--- Check ${i}/${maxChecks} (${i * 20}s elapsed) ---`)
    
    const progressResult = await makeRequest(`${BASE_URL}/progress/${snapshotId}`)
    
    if (progressResult.error) {
      console.error(`❌ Progress check failed:`, progressResult.error)
      break
    }
    
    console.log(`Status: ${progressResult.status}`)
    console.log(`Rows: ${progressResult.rows_collected || 0}/${progressResult.total_rows || 'unknown'}`)
    
    if (progressResult.status === 'completed') {
      console.log('🎉 Job completed!')
      
      // Download the data
      const dataResult = await makeRequest(`${BASE_URL}/snapshot/${snapshotId}?format=json`)
      if (!dataResult.error) {
        console.log('✅ Data downloaded successfully!')
        console.log(`📊 Data structure:`, JSON.stringify(dataResult, null, 2))
        
        // Look for key fields we need
        if (Array.isArray(dataResult) && dataResult.length > 0) {
          const profile = dataResult[0]
          console.log('\n🔍 Key fields found:')
          console.log(`- id: ${profile.id}`)
          console.log(`- name: ${profile.name}`)
          console.log(`- city: ${profile.city}`)
          console.log(`- country_code: ${profile.country_code}`)
          console.log(`- position: ${profile.position}`)
          console.log(`- current_company: ${JSON.stringify(profile.current_company)}`)
          console.log(`- about: ${profile.about ? profile.about.substring(0, 100) + '...' : 'N/A'}`)
          console.log(`- experience: ${profile.experience ? profile.experience.length + ' entries' : 'N/A'}`)
        }
      } else {
        console.error('❌ Failed to download data:', dataResult.error)
      }
      return
    } else if (progressResult.status === 'failed') {
      console.error('❌ Job failed!')
      console.error('Error details:', progressResult.error || 'No error details provided')
      return
    }
    
    // Wait 20 seconds between checks
    if (i < maxChecks) {
      await new Promise(resolve => setTimeout(resolve, 20000))
    }
  }
  
  console.log('⏰ Timeout reached - job still running after 10 minutes')
}

async function checkAccountQuota() {
  console.log('\n💳 === Checking Account Quota ===')
  
  // Try to get account info (this might not work with current API structure)
  const endpoints = [
    '/account',
    '/quota',
    '/usage',
    '/datasets'
  ]
  
  for (const endpoint of endpoints) {
    console.log(`\nTrying: ${BASE_URL}${endpoint}`)
    const result = await makeRequest(`${BASE_URL}${endpoint}`)
    if (!result.error) {
      console.log('✅ Success:', JSON.stringify(result, null, 2))
    } else {
      console.log(`❌ Failed: ${result.status} - ${result.error.substring(0, 100)}`)
    }
  }
}

async function testSmallBatch() {
  console.log('\n🎯 === Testing Minimal Payload ===')
  
  // Try with minimal payload
  const payload = [{ url: 'https://linkedin.com/in/test' }] // Invalid URL to see quick response
  
  const triggerResult = await makeRequest(`${BASE_URL}/trigger?dataset_id=${DATASET_ID}&include_errors=true`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  
  if (triggerResult.snapshot_id) {
    console.log(`📝 Snapshot ID: ${triggerResult.snapshot_id}`)
    
    // Check progress a few times
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      const progressResult = await makeRequest(`${BASE_URL}/progress/${triggerResult.snapshot_id}`)
      console.log(`Check ${i}: ${progressResult.status} - ${progressResult.rows_collected || 0} rows`)
      
      if (progressResult.status !== 'running') {
        if (progressResult.status === 'completed') {
          const dataResult = await makeRequest(`${BASE_URL}/snapshot/${triggerResult.snapshot_id}?format=json`)
          console.log('Quick test data:', JSON.stringify(dataResult, null, 2))
        }
        break
      }
    }
  }
}

async function runExtendedTest() {
  console.log('🔬 === Extended Bright Data API Analysis ===\n')
  
  // 1. Check account/quota status
  await checkAccountQuota()
  
  // 2. Test with minimal/invalid data for quick response
  await testSmallBatch()
  
  // 3. Test with real profile but longer polling
  await testWithDifferentUrl()
}

runExtendedTest().catch(console.error)