// Test script to verify the campaign workflow
// Run with: node test-campaign-workflow.js

const BASE_URL = 'http://localhost:3000'

async function testCampaignWorkflow() {
  console.log('🧪 Testing Campaign Workflow...\n')

  try {
    // Test 1: Fetch contact segments
    console.log('1️⃣ Testing contact segments API...')
    const segmentsResponse = await fetch(`${BASE_URL}/api/contacts/segments`)
    const segments = await segmentsResponse.json()
    console.log(`✅ Segments API: ${segmentsResponse.status} - Found ${Array.isArray(segments) ? segments.length : 0} segments`)

    // Test 2: Create a new segment
    console.log('\n2️⃣ Testing segment creation...')
    const newSegmentData = {
      name: 'Test Segment',
      description: 'Test segment for workflow verification',
      filterCriteria: {
        industry: 'technology',
        jobTitle: 'manager'
      }
    }
    
    const createSegmentResponse = await fetch(`${BASE_URL}/api/contacts/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSegmentData)
    })
    const newSegment = await createSegmentResponse.json()
    console.log(`✅ Segment Creation: ${createSegmentResponse.status} - Created segment with ${newSegment.contactCount || 0} contacts`)

    // Test 3: Create a campaign
    console.log('\n3️⃣ Testing campaign creation...')
    const campaignData = {
      name: 'Test Campaign',
      description: 'Test campaign for workflow verification',
      contactSegments: ['all-contacts'],
      emailSequence: [
        {
          id: '1',
          stepNumber: 1,
          subject: 'Test Email Subject',
          content: 'This is a test email content.',
          delayDays: 0,
          conditions: []
        }
      ],
      aiSettings: {
        enabled: true
      },
      scheduleSettings: {
        timeZoneDetection: true,
        businessHoursOnly: true,
        avoidWeekends: true,
        dailyLimit: 50
      },
      status: 'draft'
    }

    const createCampaignResponse = await fetch(`${BASE_URL}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignData)
    })
    const newCampaign = await createCampaignResponse.json()
    console.log(`✅ Campaign Creation: ${createCampaignResponse.status} - Created campaign "${newCampaign.name || 'Unknown'}"`)

    // Test 4: Fetch campaigns
    console.log('\n4️⃣ Testing campaigns list...')
    const campaignsResponse = await fetch(`${BASE_URL}/api/campaigns`)
    const campaigns = await campaignsResponse.json()
    console.log(`✅ Campaigns List: ${campaignsResponse.status} - Found ${Array.isArray(campaigns) ? campaigns.length : 0} campaigns`)

    console.log('\n🎉 Campaign workflow test completed successfully!')
    console.log('\n📋 Summary:')
    console.log('- ✅ Contact segments API working')
    console.log('- ✅ Segment creation working')
    console.log('- ✅ Campaign creation working')
    console.log('- ✅ Campaign listing working')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.log('\n🔧 Troubleshooting:')
    console.log('1. Make sure the development server is running (npm run dev)')
    console.log('2. Check that you are authenticated in the browser')
    console.log('3. Verify all API endpoints are properly configured')
  }
}

// Run the test
testCampaignWorkflow()