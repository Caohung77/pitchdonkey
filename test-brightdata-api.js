#!/usr/bin/env node

/**
 * Manual Bright Data API Test Script
 * This script tests the Bright Data API directly to understand the polling behavior
 */

const API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
const DATASET_ID = 'gd_l1viktl72bvl7bjuj0'
const BASE_URL = 'https://api.brightdata.com/datasets/v3'

// Test LinkedIn URLs
const TEST_URLS = [
  'https://www.linkedin.com/in/satya-nadella/',
  'https://www.linkedin.com/in/sundarpichai/',
  'https://www.linkedin.com/in/jeffweiner08/'
]

async function makeRequest(url, options = {}) {
  try {
    console.log(`🔗 Making request to: ${url}`)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Error Response: ${errorText}`)
      return { error: errorText, status: response.status }
    }
    
    const data = await response.json()
    console.log(`✅ Response Data:`, JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error(`❌ Request Failed:`, error.message)
    return { error: error.message }
  }
}

async function testTriggerEndpoint() {
  console.log('\n🚀 === Testing Trigger Endpoint ===')
  
  const payload = [
    { url: TEST_URLS[0] } // Test with just one URL first
  ]
  
  const result = await makeRequest(`${BASE_URL}/trigger?dataset_id=${DATASET_ID}&include_errors=true`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  
  return result
}

async function testProgressEndpoint(snapshotId) {
  console.log(`\n📊 === Testing Progress Endpoint ===`)
  console.log(`Snapshot ID: ${snapshotId}`)
  
  const result = await makeRequest(`${BASE_URL}/progress/${snapshotId}`)
  return result
}

async function testSnapshotEndpoint(snapshotId) {
  console.log(`\n📥 === Testing Snapshot Data Endpoint ===`)
  console.log(`Snapshot ID: ${snapshotId}`)
  
  const result = await makeRequest(`${BASE_URL}/snapshot/${snapshotId}?format=json`)
  return result
}

async function testDatasetInfo() {
  console.log('\n📋 === Testing Dataset Info ===')
  
  const result = await makeRequest(`${BASE_URL}/dataset/${DATASET_ID}`)
  return result
}

async function runFullTest() {
  console.log('🔍 === Bright Data API Manual Test ===')
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`)
  console.log(`Dataset ID: ${DATASET_ID}`)
  console.log(`Base URL: ${BASE_URL}`)
  
  // Test dataset info first
  console.log('\n1️⃣ Testing dataset access...')
  await testDatasetInfo()
  
  // Test trigger endpoint
  console.log('\n2️⃣ Testing trigger endpoint...')
  const triggerResult = await testTriggerEndpoint()
  
  if (triggerResult.error) {
    console.error('❌ Cannot proceed - trigger failed')
    return
  }
  
  const snapshotId = triggerResult.snapshot_id
  if (!snapshotId) {
    console.error('❌ No snapshot_id in response')
    return
  }
  
  console.log(`📝 Got Snapshot ID: ${snapshotId}`)
  
  // Test progress endpoint multiple times
  console.log('\n3️⃣ Testing progress monitoring...')
  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- Progress Check ${i}/5 ---`)
    const progressResult = await testProgressEndpoint(snapshotId)
    
    if (progressResult.error) {
      console.error(`❌ Progress check ${i} failed:`, progressResult.error)
      continue
    }
    
    console.log(`Status: ${progressResult.status}`)
    console.log(`Rows: ${progressResult.rows_collected || 0}/${progressResult.total_rows || 0}`)
    
    if (progressResult.status === 'completed') {
      console.log('✅ Job completed! Testing data download...')
      const dataResult = await testSnapshotEndpoint(snapshotId)
      if (!dataResult.error) {
        console.log(`✅ Successfully downloaded data: ${Array.isArray(dataResult) ? dataResult.length : 1} records`)
      }
      break
    } else if (progressResult.status === 'failed') {
      console.error('❌ Job failed!')
      break
    }
    
    if (i < 5) {
      console.log('⏳ Waiting 10 seconds...')
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
  
  console.log('\n🏁 Test Complete!')
}

// Run the test
runFullTest().catch(console.error)