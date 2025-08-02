// Test script to verify segment creation works
// This simulates what the modal does

const testSegmentCreation = async () => {
  console.log('🧪 Testing Segment Creation API...\n')

  const testData = {
    name: 'Test Tech Segment',
    description: 'Testing segment creation',
    filterCriteria: {
      industry: 'technology',
      company: 'tech'
    }
  }

  try {
    console.log('📤 Sending request to /api/contacts/segments')
    console.log('Data:', JSON.stringify(testData, null, 2))

    const response = await fetch('http://localhost:3000/api/contacts/segments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This won't work without proper authentication cookies
        // But it will help us see what error we get
      },
      body: JSON.stringify(testData)
    })

    console.log(`📥 Response Status: ${response.status}`)
    
    const responseData = await response.json()
    console.log('Response Data:', JSON.stringify(responseData, null, 2))

    if (response.ok) {
      console.log('✅ Segment creation successful!')
    } else {
      console.log('❌ Segment creation failed')
      if (response.status === 401) {
        console.log('🔐 This is expected - authentication required')
        console.log('💡 The fix should work when called from authenticated browser')
      }
    }

  } catch (error) {
    console.error('❌ Network error:', error.message)
  }
}

// Run the test
testSegmentCreation()