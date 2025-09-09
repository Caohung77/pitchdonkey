#!/usr/bin/env node

/**
 * Check the status of a Bright Data snapshot
 */

const API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
const BASE_URL = 'https://api.brightdata.com/datasets/v3'
const SNAPSHOT_ID = 's_mfb5weucwbbi183cf' // From the previous test

async function checkSnapshotStatus() {
  console.log('📊 Checking status of LinkedIn scraping job...')
  console.log(`Snapshot ID: ${SNAPSHOT_ID}\n`)
  
  try {
    // Check progress
    const progressResponse = await fetch(`${BASE_URL}/progress/${SNAPSHOT_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!progressResponse.ok) {
      console.error('❌ Failed to check progress:', progressResponse.status)
      return
    }
    
    const progressData = await progressResponse.json()
    console.log('📊 Job Status:', progressData.status)
    console.log('📊 Rows Collected:', progressData.rows_collected || 0)
    console.log('📊 Total Rows:', progressData.total_rows || 'unknown')
    
    if (progressData.status === 'completed') {
      console.log('\n🎉 Job completed! Downloading data...\n')
      
      // Download the data
      const dataResponse = await fetch(`${BASE_URL}/snapshot/${SNAPSHOT_ID}?format=json`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!dataResponse.ok) {
        console.error('❌ Failed to download data:', dataResponse.status)
        return
      }
      
      const data = await dataResponse.json()
      console.log('✅ Data downloaded successfully!\n')
      
      if (Array.isArray(data) && data.length > 0) {
        const profile = data[0]
        
        console.log('🎯 === EXTRACTED PROFILE DATA ===')
        console.log(`Name: ${profile.name || 'N/A'}`)
        console.log(`Position: ${profile.position || 'N/A'}`)
        console.log(`Company: ${profile.current_company?.name || profile.current_company || 'N/A'}`)
        console.log(`Location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'N/A'}`)
        console.log(`About: ${profile.about ? profile.about.substring(0, 200) + '...' : 'N/A'}`)
        console.log(`Experience: ${profile.experience ? profile.experience.length + ' roles' : 'N/A'}`)
        console.log(`Skills: ${profile.skills ? profile.skills.slice(0, 5).join(', ') : 'N/A'}`)
        
        console.log('\n📊 Full Profile Data:')
        console.log(JSON.stringify(data, null, 2))
        
      } else {
        console.log('⚠️ No profile data in response')
        console.log('Raw response:', JSON.stringify(data, null, 2))
      }
      
    } else if (progressData.status === 'failed') {
      console.log('❌ Job failed!')
      console.log('Error:', progressData.error || 'No error details provided')
      
    } else if (progressData.status === 'running') {
      console.log('⏳ Job is still running...')
      console.log('The LinkedIn scraping process can take 5-10 minutes to complete.')
      console.log('You can run this script again in a few minutes to check the status.')
      
    } else {
      console.log(`ℹ️ Job status: ${progressData.status}`)
    }
    
  } catch (error) {
    console.error('❌ Error checking snapshot:', error.message)
  }
}

checkSnapshotStatus()