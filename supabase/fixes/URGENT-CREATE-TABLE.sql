-- URGENT: Create contact_lists table
-- Copy and paste this ENTIRE SQL into your Supabase SQL Editor and click RUN

-- Step 1: Create the table
CREATE TABLE contact_lists (
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

-- Step 2: Create indexes
CREATE INDEX idx_contact_lists_user_id ON contact_lists(user_id);
CREATE INDEX idx_contact_lists_name ON contact_lists(user_id, name);
CREATE INDEX idx_contact_lists_created_at ON contact_lists(created_at DESC);

-- Step 3: Enable RLS
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies
CREATE POLICY "Users can view their own contact lists" ON contact_lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact lists" ON contact_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact lists" ON contact_lists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact lists" ON contact_lists
    FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Verify table was created
SELECT 'contact_lists table created successfully!' as status,
       COUNT(*) as initial_count 
FROM contact_lists;