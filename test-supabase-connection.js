// Test Supabase Connection
// Run this with: node test-supabase-connection.js

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function testConnection() {
  console.log('🔍 Testing Supabase connection...')
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables!')
    console.log('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
    return
  }
  
  console.log('✅ Environment variables found')
  console.log('📡 Supabase URL:', supabaseUrl)
  
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test connection by trying to fetch from a system table
    const { data, error } = await supabase
      .from('subscription_limits')
      .select('tier')
      .limit(1)
    
    if (error) {
      console.error('❌ Connection test failed:', error.message)
      if (error.message.includes('relation "subscription_limits" does not exist')) {
        console.log('💡 This means you need to run the database schema first!')
        console.log('📋 Copy the contents of supabase-setup.sql and run it in your Supabase SQL Editor')
      }
    } else {
      console.log('✅ Supabase connection successful!')
      console.log('📊 Sample data:', data)
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
  }
}

testConnection()