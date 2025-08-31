-- Advanced Tagging System Migration
-- This migration adds a dedicated tags table for better tag management and autocomplete functionality

-- Create tags table for global tag management
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code for tag display
  description TEXT,
  usage_count INTEGER DEFAULT 0, -- Track how many contacts use this tag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique tag names per user
  UNIQUE(user_id, name)
);

-- Create index for fast tag searches and autocomplete
CREATE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(user_id, usage_count DESC);

-- Create contact_tags junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS contact_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique contact-tag pairs
  UNIQUE(contact_id, tag_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contact_tags(tag_id);

-- Function to update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update usage count when contact_tags changes
  IF TG_OP = 'INSERT' THEN
    UPDATE tags 
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags 
    SET usage_count = usage_count - 1, updated_at = NOW()
    WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update tag usage counts
DROP TRIGGER IF EXISTS trigger_update_tag_usage_count ON contact_tags;
CREATE TRIGGER trigger_update_tag_usage_count
  AFTER INSERT OR DELETE ON contact_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_usage_count();

-- Function to sync legacy tags array with new tagging system
CREATE OR REPLACE FUNCTION sync_legacy_tags()
RETURNS VOID AS $$
DECLARE
  contact_record RECORD;
  tag_name TEXT;
  tag_record RECORD;
BEGIN
  -- Loop through all contacts with tags
  FOR contact_record IN 
    SELECT id, user_id, tags
    FROM contacts 
    WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  LOOP
    -- Loop through each tag for this contact
    FOREACH tag_name IN ARRAY contact_record.tags
    LOOP
      -- Check if tag exists for this user
      SELECT * INTO tag_record 
      FROM tags 
      WHERE user_id = contact_record.user_id AND name = tag_name;
      
      -- Create tag if it doesn't exist
      IF NOT FOUND THEN
        INSERT INTO tags (user_id, name, usage_count)
        VALUES (contact_record.user_id, tag_name, 1)
        ON CONFLICT (user_id, name) DO UPDATE SET
          usage_count = tags.usage_count + 1;
        
        SELECT * INTO tag_record 
        FROM tags 
        WHERE user_id = contact_record.user_id AND name = tag_name;
      END IF;
      
      -- Create contact_tag relationship if it doesn't exist
      INSERT INTO contact_tags (contact_id, tag_id)
      VALUES (contact_record.id, tag_record.id)
      ON CONFLICT (contact_id, tag_id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the sync function to migrate existing tags
SELECT sync_legacy_tags();

-- Add some helpful views
CREATE OR REPLACE VIEW contact_tags_view AS
SELECT 
  c.id as contact_id,
  c.email,
  c.first_name,
  c.last_name,
  c.user_id,
  array_agg(
    json_build_object(
      'id', t.id,
      'name', t.name,
      'color', t.color
    ) ORDER BY t.name
  ) as tag_objects,
  array_agg(t.name ORDER BY t.name) as tag_names
FROM contacts c
LEFT JOIN contact_tags ct ON c.id = ct.contact_id
LEFT JOIN tags t ON ct.tag_id = t.id
GROUP BY c.id, c.email, c.first_name, c.last_name, c.user_id;

-- Add RLS policies for tags table
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for contact_tags table
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their contact tags" ON contact_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contacts c 
      WHERE c.id = contact_tags.contact_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their contact tags" ON contact_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts c 
      WHERE c.id = contact_tags.contact_id AND c.user_id = auth.uid()
    )
  );