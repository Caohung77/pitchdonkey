// Run this in your browser console while logged into your app
// This will create the contact_lists table using your existing Supabase client

console.log('🔧 Creating contact_lists table...')

// SQL to create the table
const createTableSQL = `
-- Create contact_lists table for static contact collections
CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contact_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_lists_user_id ON contact_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_name ON contact_lists(user_id, name);
CREATE INDEX IF NOT EXISTS idx_contact_lists_created_at ON contact_lists(created_at DESC);

-- RLS (Row Level Security) Policies
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contact lists" ON contact_lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact lists" ON contact_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact lists" ON contact_lists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact lists" ON contact_lists
    FOR DELETE USING (auth.uid() = user_id);
`

// Function to create the table
async function createContactListsTable() {
  try {
    console.log('📡 Attempting to create table via API...')
    
    // Try to create via a custom API endpoint (if we had one)
    // Since we don't have direct SQL execution, we'll show instructions
    
    console.log('❌ Cannot create table directly from browser')
    console.log('📋 Please follow these steps:')
    console.log('')
    console.log('1. Go to your Supabase Dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the following SQL:')
    console.log('')
    console.log(createTableSQL)
    console.log('')
    console.log('4. Click "Run" to execute the SQL')
    console.log('5. Refresh this page and try creating a list again')
    
    return false
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

// Test if table exists by trying to fetch lists
async function testTableExists() {
  try {
    console.log('🧪 Testing if contact_lists table exists...')
    const response = await fetch('/api/contacts/lists')
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Table exists! Found', data.length, 'lists')
      return true
    } else {
      console.log('❌ Table does not exist:', data.error)
      return false
    }
  } catch (error) {
    console.log('❌ Error testing table:', error)
    return false
  }
}

// Main function
async function main() {
  const tableExists = await testTableExists()
  
  if (!tableExists) {
    await createContactListsTable()
  } else {
    console.log('🎉 Contact lists table is ready!')
    console.log('💡 You can now create contact lists in the UI')
  }
}

// Run the script
main()