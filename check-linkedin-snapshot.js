#!/usr/bin/env node

/**
 * Check the status of LinkedIn snapshots
 */

const API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
const BASE_URL = 'https://api.brightdata.com/datasets/v3'

// Recent snapshot IDs to check
const SNAPSHOT_IDS = [
  's_mfb71z182cz7huh0t6', // From the latest test
  's_mfb5weucwbbi183cf',  // From earlier test
]

async function checkSnapshot(snapshotId) {
  console.log(`\n📊 Checking snapshot: ${snapshotId}`)
  
  try {
    // Check progress
    const progressResponse = await fetch(`${BASE_URL}/progress/${snapshotId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!progressResponse.ok) {
      console.log(`❌ Progress check failed: ${progressResponse.status}`)
      return
    }
    
    const progressData = await progressResponse.json()
    console.log(`Status: ${progressData.status}`)
    console.log(`Rows: ${progressData.rows_collected || 0}/${progressData.total_rows || 0}`)
    console.log('Full progress:', JSON.stringify(progressData, null, 2))
    
    if (progressData.status === 'completed') {
      console.log('\n🎉 Snapshot completed! Downloading data...')
      
      const dataResponse = await fetch(`${BASE_URL}/snapshot/${snapshotId}?format=json`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (dataResponse.ok) {
        const actualData = await dataResponse.json()
        console.log('✅ Data downloaded successfully!')
        console.log('Data preview:', JSON.stringify(actualData, null, 2).substring(0, 1000) + '...')
        
        if (Array.isArray(actualData) && actualData.length > 0) {
          const profile = actualData[0]
          console.log('\n🎯 Profile Summary:')
          console.log(`Name: ${profile.name || 'N/A'}`)
          console.log(`Headline: ${profile.headline || 'N/A'}`)
          console.log(`Position: ${profile.position || 'N/A'}`)
          console.log(`Company: ${profile.current_company?.name || profile.current_company || 'N/A'}`)
          console.log(`Location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'N/A'}`)
        }
      } else {
        console.log(`❌ Data download failed: ${dataResponse.status}`)
        const errorText = await dataResponse.text()
        console.log('Error:', errorText)
      }
      
    } else if (progressData.status === 'failed') {
      console.log('❌ Snapshot failed!')
      console.log('Error:', progressData.error || 'No error details')
      
    } else {
      console.log(`⏳ Snapshot is still ${progressData.status}`)
    }
    
  } catch (error) {
    console.error(`❌ Error checking snapshot ${snapshotId}:`, error.message)
  }
}

async function checkAllSnapshots() {
  console.log('📊 === LinkedIn Snapshot Status Check ===')
  
  for (const snapshotId of SNAPSHOT_IDS) {
    await checkSnapshot(snapshotId)
  }
  
  console.log('\n✅ All snapshots checked!')
}

checkAllSnapshots()