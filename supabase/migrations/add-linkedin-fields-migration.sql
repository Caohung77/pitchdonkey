-- Migration: Add LinkedIn Profile Storage Fields to Contacts Table
-- Author: Claude Code Assistant
-- Date: 2025-01-09
-- Description: Adds LinkedIn profile extraction and enrichment fields to support 
--              dual enrichment strategy (website + LinkedIn)

BEGIN;

-- Add LinkedIn profile storage fields to contacts table
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS linkedin_profile_data JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linkedin_extraction_status TEXT DEFAULT NULL,  
  ADD COLUMN IF NOT EXISTS linkedin_extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrichment_sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enrichment_priority TEXT DEFAULT NULL;

-- Add helpful comments for the new fields
COMMENT ON COLUMN contacts.linkedin_profile_data IS 'Complete LinkedIn profile data extracted via Bright Data API - includes personal, professional, education, and skills data';
COMMENT ON COLUMN contacts.linkedin_extraction_status IS 'Status of LinkedIn extraction: pending, completed, failed';
COMMENT ON COLUMN contacts.linkedin_extracted_at IS 'Timestamp when LinkedIn profile was last extracted';
COMMENT ON COLUMN contacts.enrichment_sources IS 'Array of enrichment sources used: [website, linkedin]';
COMMENT ON COLUMN contacts.enrichment_priority IS 'Enrichment strategy used: company_first, website_only, linkedin_only';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_extraction_status 
  ON contacts (linkedin_extraction_status) 
  WHERE linkedin_extraction_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_extracted_at 
  ON contacts (linkedin_extracted_at DESC) 
  WHERE linkedin_extracted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_enrichment_sources 
  ON contacts USING GIN (enrichment_sources);

CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_url_not_null 
  ON contacts (id) 
  WHERE linkedin_url IS NOT NULL;

-- Add check constraints for valid statuses
ALTER TABLE contacts 
  ADD CONSTRAINT chk_linkedin_extraction_status 
  CHECK (linkedin_extraction_status IS NULL OR linkedin_extraction_status IN ('pending', 'completed', 'failed'));

ALTER TABLE contacts 
  ADD CONSTRAINT chk_enrichment_priority 
  CHECK (enrichment_priority IS NULL OR enrichment_priority IN ('company_first', 'website_only', 'linkedin_only'));

-- Update existing contacts with empty enrichment_sources array where NULL
UPDATE contacts 
SET enrichment_sources = '{}' 
WHERE enrichment_sources IS NULL;

-- Create a function to automatically update the updated_at timestamp when LinkedIn data changes
CREATE OR REPLACE FUNCTION update_contacts_updated_at_on_linkedin_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if LinkedIn-related fields have changed
  IF (OLD.linkedin_profile_data IS DISTINCT FROM NEW.linkedin_profile_data) OR
     (OLD.linkedin_extraction_status IS DISTINCT FROM NEW.linkedin_extraction_status) OR
     (OLD.linkedin_extracted_at IS DISTINCT FROM NEW.linkedin_extracted_at) OR
     (OLD.enrichment_sources IS DISTINCT FROM NEW.enrichment_sources) OR
     (OLD.enrichment_priority IS DISTINCT FROM NEW.enrichment_priority) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_contacts_linkedin_updated_at ON contacts;
CREATE TRIGGER trigger_contacts_linkedin_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at_on_linkedin_change();

-- Create a view for enrichment analytics
CREATE OR REPLACE VIEW enrichment_analytics AS
SELECT 
  user_id,
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN website IS NOT NULL THEN 1 END) as contacts_with_website,
  COUNT(CASE WHEN linkedin_url IS NOT NULL THEN 1 END) as contacts_with_linkedin,
  COUNT(CASE WHEN website IS NOT NULL AND linkedin_url IS NOT NULL THEN 1 END) as contacts_with_both,
  COUNT(CASE WHEN enrichment_status = 'completed' THEN 1 END) as website_enriched,
  COUNT(CASE WHEN linkedin_extraction_status = 'completed' THEN 1 END) as linkedin_enriched,
  COUNT(CASE WHEN enrichment_status = 'completed' AND linkedin_extraction_status = 'completed' THEN 1 END) as fully_enriched,
  COUNT(CASE WHEN enrichment_sources @> ARRAY['website'] THEN 1 END) as used_website_source,
  COUNT(CASE WHEN enrichment_sources @> ARRAY['linkedin'] THEN 1 END) as used_linkedin_source,
  COUNT(CASE WHEN enrichment_sources @> ARRAY['website', 'linkedin'] THEN 1 END) as used_both_sources,
  COUNT(CASE WHEN enrichment_priority = 'company_first' THEN 1 END) as company_first_strategy,
  COUNT(CASE WHEN linkedin_extraction_status = 'pending' THEN 1 END) as linkedin_pending,
  COUNT(CASE WHEN linkedin_extraction_status = 'failed' THEN 1 END) as linkedin_failed
FROM contacts 
WHERE status != 'deleted' OR status IS NULL
GROUP BY user_id;

COMMENT ON VIEW enrichment_analytics IS 'Analytics view for tracking enrichment performance and usage patterns';

-- Sample data validation queries (commented out for production)
/*
-- Query to check the new fields
SELECT 
  id, 
  email, 
  linkedin_url,
  linkedin_extraction_status,
  linkedin_extracted_at,
  enrichment_sources,
  enrichment_priority,
  (linkedin_profile_data IS NOT NULL) as has_linkedin_data
FROM contacts 
WHERE linkedin_url IS NOT NULL 
LIMIT 5;

-- Query to see enrichment analytics
SELECT * FROM enrichment_analytics;
*/

COMMIT;

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'LinkedIn profile storage fields migration completed successfully';
  RAISE NOTICE 'Added fields: linkedin_profile_data, linkedin_extraction_status, linkedin_extracted_at, enrichment_sources, enrichment_priority';
  RAISE NOTICE 'Created indexes and constraints for efficient querying and data integrity';
  RAISE NOTICE 'Created enrichment_analytics view for monitoring enrichment performance';
END $$;