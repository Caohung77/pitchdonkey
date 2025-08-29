-- Add source field to contacts table
-- Migration: Add source tracking for contact creation method

-- Add source column to track how contacts were created
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Update existing contacts to have 'manual' as default source
UPDATE contacts 
SET source = 'manual' 
WHERE source IS NULL;

-- Create index for source queries
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);

-- Add comment to document the source field
COMMENT ON COLUMN contacts.source IS 'Source of contact creation: manual, import filename, API, etc.';

-- Examples of source values:
-- - 'manual' - manually added contact
-- - 'import:contacts.csv' - imported from CSV file
-- - 'import:leads_2024.xlsx' - imported from Excel file
-- - 'api' - added via API
-- - 'webhook' - added via webhook integration