#!/usr/bin/env node

/**
 * Simple LinkedIn API Test with correct endpoints
 */

const API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
const DATASET_ID = 'gd_l1viktl72bvl7bjuj0' // Original working dataset
const BASE_URL = 'https://api.brightdata.com/datasets/v3'
const TEST_URL = 'https://www.linkedin.com/in/williamhgates/'

async function testLinkedInAPI() {
  console.log('🚀 === Simple LinkedIn API Test ===\n')
  console.log(`Dataset ID: ${DATASET_ID}`)
  console.log(`Test URL: ${TEST_URL}\n`)
  
  try {
    // Test trigger endpoint
    console.log('📤 Sending trigger request...')
    
    const payload = [{ url: TEST_URL }]
    console.log('Payload:', JSON.stringify(payload, null, 2))
    
    const response = await fetch(`${BASE_URL}/trigger?dataset_id=${DATASET_ID}&include_errors=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    
    console.log(`Status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', errorText)
      return
    }
    
    const data = await response.json()
    console.log('✅ Response received:')
    console.log(JSON.stringify(data, null, 2))
    
    if (data.snapshot_id) {
      console.log(`\n📝 Got snapshot ID: ${data.snapshot_id}`)
      
      // Test progress endpoint a few times
      for (let i = 1; i <= 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
        
        console.log(`\n📊 Checking progress (attempt ${i}/5)...`)
        
        const progressResponse = await fetch(`${BASE_URL}/progress/${data.snapshot_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          }
        })
        
        if (progressResponse.ok) {
          const progressData = await progressResponse.json()
          console.log(`Status: ${progressData.status}`)
          console.log(`Rows: ${progressData.rows_collected || 0}/${progressData.total_rows || 0}`)
          console.log('Full progress:', JSON.stringify(progressData, null, 2))
          
          if (progressData.status === 'completed') {
            console.log('\n🎉 Job completed! Downloading data...')
            
            const dataResponse = await fetch(`${BASE_URL}/snapshot/${data.snapshot_id}?format=json`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
              }
            })
            
            if (dataResponse.ok) {
              const actualData = await dataResponse.json()
              console.log('✅ Data downloaded:')
              console.log(JSON.stringify(actualData, null, 2))
            } else {
              console.log('❌ Data download failed:', dataResponse.status)
              const errorText = await dataResponse.text()
              console.log('Error:', errorText)
            }
            break
            
          } else if (progressData.status === 'failed') {
            console.log('❌ Job failed!')
            break
          }
        } else {
          console.log(`❌ Progress check failed: ${progressResponse.status}`)
          const errorText = await progressResponse.text()
          console.log('Error:', errorText)
        }
      }
    } else {
      console.log('⚠️ No snapshot ID in response')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testLinkedInAPI()