#!/usr/bin/env node

/**
 * LinkedIn API Debug Test
 * Tests different API approaches and endpoints
 */

const API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
const BASE_URL = 'https://api.brightdata.com/datasets/v3'

// Test different dataset IDs
const DATASET_IDS = [
  'gd_l1viktl72bvl7bjuj0', // Original
  'gd_l7q7dkf2b2vl1mjkj0', // LinkedIn specific
  'gd_lcamkkqjwvbepz0wf0', // Alternative
]

const TEST_URL = 'https://www.linkedin.com/in/williamhgates/'

async function makeRequest(url, options = {}) {
  try {
    console.log(`🌐 Making request to: ${url}`)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`)
    
    let responseData
    try {
      responseData = await response.json()
    } catch {
      responseData = await response.text()
    }
    
    return { 
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseData
    }
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`)
    return { 
      ok: false,
      error: error.message 
    }
  }
}

async function testDatasetInfo(datasetId) {
  console.log(`\n🔍 Testing dataset: ${datasetId}`)
  
  // Test dataset info endpoint
  const infoResult = await makeRequest(`${BASE_URL}/datasets/${datasetId}`)
  console.log(`Dataset info status: ${infoResult.status}`)
  if (infoResult.ok) {
    console.log('✅ Dataset exists and accessible')
    console.log('Dataset info:', JSON.stringify(infoResult.data, null, 2))
  } else {
    console.log('❌ Dataset not accessible')
    console.log('Error:', infoResult.data)
  }
  
  return infoResult.ok
}

async function testTriggerRequest(datasetId) {
  console.log(`\n🚀 Testing trigger request with dataset: ${datasetId}`)
  
  const payload = [{ url: TEST_URL }]
  
  const triggerResult = await makeRequest(`${BASE_URL}/trigger?dataset_id=${datasetId}&include_errors=true&format=json`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  
  console.log(`Trigger status: ${triggerResult.status}`)
  console.log('Trigger response:', JSON.stringify(triggerResult.data, null, 2))
  
  if (triggerResult.ok && triggerResult.data.snapshot_id) {
    console.log(`✅ Got snapshot ID: ${triggerResult.data.snapshot_id}`)
    
    // Quick status check
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const statusResult = await makeRequest(`${BASE_URL}/progress/${triggerResult.data.snapshot_id}`)
    console.log('Initial status:', JSON.stringify(statusResult.data, null, 2))
    
    return {
      success: true,
      snapshotId: triggerResult.data.snapshot_id,
      initialStatus: statusResult.data
    }
  }
  
  return { success: false, error: triggerResult.data }
}

async function testDirectDatasetAccess() {
  console.log('\n📊 Testing direct dataset access...')
  
  // Try to list available datasets
  const datasetsResult = await makeRequest(`${BASE_URL}/datasets`)
  console.log('Datasets list status:', datasetsResult.status)
  
  if (datasetsResult.ok) {
    console.log('Available datasets:')
    if (Array.isArray(datasetsResult.data)) {
      datasetsResult.data.forEach(dataset => {
        console.log(`- ${dataset.id}: ${dataset.name || 'No name'} (${dataset.category || 'No category'})`)
      })
    } else {
      console.log(JSON.stringify(datasetsResult.data, null, 2))
    }
  } else {
    console.log('❌ Could not list datasets')
    console.log('Error:', datasetsResult.data)
  }
}

async function testAccountInfo() {
  console.log('\n👤 Testing account info...')
  
  const accountResult = await makeRequest(`${BASE_URL}/account`)
  console.log('Account status:', accountResult.status)
  
  if (accountResult.ok) {
    console.log('Account info:', JSON.stringify(accountResult.data, null, 2))
  } else {
    console.log('Account error:', accountResult.data)
  }
}

async function runDebugTests() {
  console.log('🔬 === LinkedIn API Debug Test ===\n')
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`)
  console.log(`Test URL: ${TEST_URL}`)
  
  // 1. Test account access
  await testAccountInfo()
  
  // 2. Test dataset access
  await testDirectDatasetAccess()
  
  // 3. Test each dataset ID
  for (const datasetId of DATASET_IDS) {
    const isAccessible = await testDatasetInfo(datasetId)
    
    if (isAccessible) {
      const result = await testTriggerRequest(datasetId)
      if (result.success) {
        console.log(`\n✅ Dataset ${datasetId} works!`)
        console.log(`Snapshot ID: ${result.snapshotId}`)
        console.log(`Initial Status: ${result.initialStatus?.status}`)
        break
      }
    }
  }
  
  console.log('\n🎯 Debug test completed!')
}

runDebugTests().catch(console.error)