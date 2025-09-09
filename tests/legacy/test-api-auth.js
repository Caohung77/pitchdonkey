const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Testing API Authentication...')
console.log('📡 Supabase URL:', supabaseUrl)

async function testApiAuth() {
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Try to get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('📋 Session check:', !!session, sessionError?.message || 'OK')
    
    if (!session) {
      console.log('❌ No active session found')
      console.log('💡 This is expected if you\'re not signed in')
      return
    }
    
    // Test API calls with session
    const accessToken = session.access_token
    console.log('🔑 Access token:', accessToken ? 'Present' : 'Missing')
    
    // Test contacts API
    const contactsResponse = await fetch('http://localhost:3000/api/contacts', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📞 Contacts API:', contactsResponse.status, contactsResponse.statusText)
    
    if (!contactsResponse.ok) {
      const errorText = await contactsResponse.text()
      console.log('❌ Contacts API Error:', errorText)
    } else {
      const data = await contactsResponse.json()
      console.log('✅ Contacts API Success:', data.success ? 'OK' : 'Failed')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testApiAuth()