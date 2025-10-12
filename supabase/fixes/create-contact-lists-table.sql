-- Create contact_lists table
-- Run this SQL in your Supabase SQL editor

-- Contact Lists Table
-- This table stores user-created contact lists (different from segments)
-- Lists are static collections of contacts, while segments are dynamic filters

CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contact_ids UUID[] DEFAULT '{}', -- Array of contact IDs
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, name), -- Prevent duplicate list names per user
  CONSTRAINT valid_contact_ids CHECK (array_length(contact_ids, 1) >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_lists_user_id ON contact_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_name ON contact_lists(user_id, name);
CREATE INDEX IF NOT EXISTS idx_contact_lists_created_at ON contact_lists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_lists_tags ON contact_lists USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contact_lists_contact_ids ON contact_lists USING GIN(contact_ids);

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

-- Verify the table was created
SELECT 'contact_lists table created successfully' as status;