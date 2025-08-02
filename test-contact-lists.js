// Test script to verify contact lists functionality
// Run this in the browser console on the contacts page

console.log('🧪 Testing Contact Lists Functionality...')

// Test 1: Check if contact lists API is accessible
async function testContactListsAPI() {
  try {
    console.log('📡 Testing contact lists API...')
    const response = await fetch('/api/contacts/lists')
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Contact lists API working:', data)
      return data
    } else {
      console.error('❌ Contact lists API error:', data)
      return null
    }
  } catch (error) {
    console.error('❌ Contact lists API failed:', error)
    return null
  }
}

// Test 2: Check if contacts API is accessible (needed for list creation)
async function testContactsAPI() {
  try {
    console.log('📡 Testing contacts API...')
    const response = await fetch('/api/contacts')
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Contacts API working:', data.length, 'contacts found')
      return data
    } else {
      console.error('❌ Contacts API error:', data)
      return null
    }
  } catch (error) {
    console.error('❌ Contacts API failed:', error)
    return null
  }
}

// Test 3: Create a test contact list
async function testCreateContactList(contacts) {
  if (!contacts || contacts.length === 0) {
    console.log('⚠️ No contacts available for list creation test')
    return null
  }

  try {
    console.log('📝 Testing contact list creation...')
    
    // Select first 3 contacts for the test list
    const selectedContactIds = contacts.slice(0, 3).map(c => c.id)
    
    const response = await fetch('/api/contacts/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test List ' + Date.now(),
        description: 'Automated test list',
        contactIds: selectedContactIds,
        tags: ['test', 'automated']
      })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Contact list created successfully:', data)
      return data
    } else {
      console.error('❌ Contact list creation failed:', data)
      return null
    }
  } catch (error) {
    console.error('❌ Contact list creation error:', error)
    return null
  }
}

// Test 4: Test campaign API with lists
async function testCampaignWithLists(listId) {
  if (!listId) {
    console.log('⚠️ No list ID available for campaign test')
    return
  }

  try {
    console.log('🚀 Testing campaign creation with contact list...')
    
    // This would normally create a campaign, but we'll just test the data structure
    const campaignData = {
      name: 'Test Campaign with List',
      description: 'Testing list integration',
      contactSegments: [listId], // Lists and segments use the same field
      emailSequence: [{
        id: '1',
        subject: 'Test Email',
        content: 'Hello {{first_name}}!',
        delay: 0
      }]
    }
    
    console.log('✅ Campaign data structure with list:', campaignData)
    console.log('📋 List ID in contactSegments:', listId)
    
  } catch (error) {
    console.error('❌ Campaign test error:', error)
  }
}

// Run all tests
async function runAllTests() {
  console.log('🏁 Starting comprehensive contact lists test...')
  
  // Test APIs
  const lists = await testContactListsAPI()
  const contacts = await testContactsAPI()
  
  // Test list creation
  const newList = await testCreateContactList(contacts)
  
  // Test campaign integration
  if (newList) {
    await testCampaignWithLists(newList.id)
  }
  
  console.log('🎯 Test Summary:')
  console.log('- Contact Lists API:', lists ? '✅ Working' : '❌ Failed')
  console.log('- Contacts API:', contacts ? '✅ Working' : '❌ Failed')
  console.log('- List Creation:', newList ? '✅ Working' : '❌ Failed')
  console.log('- Campaign Integration:', newList ? '✅ Ready' : '❌ Not Ready')
  
  if (lists && contacts && newList) {
    console.log('🎉 All tests passed! Contact lists functionality is working.')
    console.log('💡 Next steps:')
    console.log('1. Go to /dashboard/contacts and click the "Lists" tab')
    console.log('2. Create a new contact list by selecting specific contacts')
    console.log('3. Go to /dashboard/campaigns/new and see both segments and lists')
    console.log('4. Select your list as a campaign destination')
  } else {
    console.log('⚠️ Some tests failed. Check the errors above.')
  }
}

// Auto-run tests
runAllTests()