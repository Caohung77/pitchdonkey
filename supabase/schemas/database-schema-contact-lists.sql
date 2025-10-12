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

-- Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contact_lists_updated_at 
    BEFORE UPDATE ON contact_lists 
    FOR EACH ROW 
    EXECUTE FUNCTION update_contact_lists_updated_at();

-- Function to get contact count for a list
CREATE OR REPLACE FUNCTION get_contact_list_count(list_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    contact_count INTEGER;
BEGIN
    SELECT array_length(contact_ids, 1) INTO contact_count
    FROM contact_lists
    WHERE id = list_uuid;
    
    RETURN COALESCE(contact_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add contacts to a list
CREATE OR REPLACE FUNCTION add_contacts_to_list(
    list_uuid UUID,
    new_contact_ids UUID[],
    user_uuid UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE contact_lists 
    SET contact_ids = array(
        SELECT DISTINCT unnest(contact_ids || new_contact_ids)
    ),
    updated_at = NOW()
    WHERE id = list_uuid AND user_id = user_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove contacts from a list
CREATE OR REPLACE FUNCTION remove_contacts_from_list(
    list_uuid UUID,
    remove_contact_ids UUID[],
    user_uuid UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE contact_lists 
    SET contact_ids = array(
        SELECT unnest(contact_ids) 
        EXCEPT 
        SELECT unnest(remove_contact_ids)
    ),
    updated_at = NOW()
    WHERE id = list_uuid AND user_id = user_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE contact_lists IS 'User-created static contact lists';
COMMENT ON COLUMN contact_lists.contact_ids IS 'Array of contact UUIDs in this list';
COMMENT ON FUNCTION get_contact_list_count IS 'Get the number of contacts in a list';
COMMENT ON FUNCTION add_contacts_to_list IS 'Add contacts to an existing list';
COMMENT ON FUNCTION remove_contacts_from_list IS 'Remove contacts from an existing list';