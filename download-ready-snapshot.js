#!/usr/bin/env node

/**
 * Download data from "ready" status snapshot
 */

const API_KEY = '7063183122a7a1eb3cf38525692055af6b7202cc5e4a669cb26def699e7b1442'
const BASE_URL = 'https://api.brightdata.com/datasets/v3'
const SNAPSHOT_ID = 's_mfb5weucwbbi183cf' // The "ready" snapshot with 1 record

async function downloadSnapshotData() {
  console.log('📥 === Download Ready Snapshot Data ===\n')
  console.log(`Snapshot ID: ${SNAPSHOT_ID}`)
  
  try {
    console.log('🔍 Trying to download data...')
    
    const dataResponse = await fetch(`${BASE_URL}/snapshot/${SNAPSHOT_ID}?format=json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    })
    
    console.log(`Status: ${dataResponse.status} ${dataResponse.statusText}`)
    
    if (dataResponse.ok) {
      const actualData = await dataResponse.json()
      console.log('✅ Data downloaded successfully!\n')
      
      console.log('📊 Full Data:')
      console.log(JSON.stringify(actualData, null, 2))
      
      if (Array.isArray(actualData) && actualData.length > 0) {
        const profile = actualData[0]
        
        console.log('\n🎯 === EXTRACTED PROFILE DATA ===')
        console.log(`Name: ${profile.name || 'N/A'}`)
        console.log(`First Name: ${profile.first_name || 'N/A'}`)
        console.log(`Last Name: ${profile.last_name || 'N/A'}`)
        console.log(`Headline: ${profile.headline || 'N/A'}`)
        console.log(`Position: ${profile.position || 'N/A'}`)
        console.log(`Company: ${profile.current_company?.name || profile.current_company || 'N/A'}`)
        console.log(`Location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'N/A'}`)
        console.log(`About: ${profile.about ? profile.about.substring(0, 200) + '...' : 'N/A'}`)
        
        if (profile.experience && profile.experience.length > 0) {
          console.log('\n💼 Experience:')
          profile.experience.slice(0, 3).forEach((exp, i) => {
            console.log(`  ${i + 1}. ${exp.title || 'N/A'} at ${exp.company || 'N/A'}`)
          })
        }
        
        if (profile.skills && profile.skills.length > 0) {
          console.log('\n🛠️ Top Skills:')
          console.log(`  ${profile.skills.slice(0, 10).join(', ')}`)
        }
        
        if (profile.education && profile.education.length > 0) {
          console.log('\n🎓 Education:')
          profile.education.slice(0, 2).forEach((edu, i) => {
            console.log(`  ${i + 1}. ${edu.school || 'N/A'} - ${edu.degree || 'N/A'}`)
          })
        }
        
        console.log('\n🚀 SUCCESS! LinkedIn data was extracted successfully!')
        console.log('The issue is that "ready" status should be treated as completed.')
        
      } else if (actualData && typeof actualData === 'object') {
        console.log('\n📄 Single Profile Data:')
        console.log(`Name: ${actualData.name || 'N/A'}`)
        console.log(`Position: ${actualData.position || 'N/A'}`)
        console.log(`Company: ${actualData.current_company?.name || actualData.current_company || 'N/A'}`)
      } else {
        console.log('\n⚠️ Unexpected data format:', typeof actualData)
      }
      
    } else {
      console.log(`❌ Download failed: ${dataResponse.status}`)
      const errorText = await dataResponse.text()
      console.log('Error:', errorText)
    }
    
  } catch (error) {
    console.error('❌ Download error:', error.message)
  }
}

downloadSnapshotData()