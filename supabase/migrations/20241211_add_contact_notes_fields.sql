-- Add notes fields to contacts table
-- This enables rich text notes for each contact with timestamp tracking

-- Add notes field for storing rich text content (HTML from Quill.js)
ALTER TABLE contacts 
ADD COLUMN notes TEXT DEFAULT '';

-- Add timestamp for when notes were last updated
ALTER TABLE contacts 
ADD COLUMN notes_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to automatically update notes_updated_at when notes are modified
CREATE OR REPLACE FUNCTION update_contact_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if notes field actually changed
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
        NEW.notes_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before any update to contacts table
CREATE TRIGGER trigger_update_contact_notes_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_notes_updated_at();

-- Add comment for documentation
COMMENT ON COLUMN contacts.notes IS 'Rich text notes content in HTML format from Quill.js editor';
COMMENT ON COLUMN contacts.notes_updated_at IS 'Timestamp of when notes were last modified';