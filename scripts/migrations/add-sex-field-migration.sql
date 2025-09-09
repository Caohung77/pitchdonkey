-- Migration: Add Sex Field to Contacts Table
-- Author: Claude Code Assistant  
-- Date: 2025-01-09
-- Description: Adds sex/gender field to contacts table for demographic tracking

BEGIN;

-- Add sex field to contacts table
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS sex TEXT DEFAULT NULL;

-- Add helpful comment for the new field
COMMENT ON COLUMN contacts.sex IS 'Gender field: m for male, f for female, null for unspecified/prefer not to say';

-- Add check constraint to ensure only valid values
ALTER TABLE contacts 
  ADD CONSTRAINT chk_contacts_sex 
  CHECK (sex IS NULL OR sex IN ('m', 'f'));

-- Create index for efficient querying/filtering by sex
CREATE INDEX IF NOT EXISTS idx_contacts_sex 
  ON contacts (sex) 
  WHERE sex IS NOT NULL;

-- Update the updated_at trigger to include sex field changes
CREATE OR REPLACE FUNCTION update_contacts_updated_at_on_sex_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update timestamp when sex field changes
  IF (OLD.sex IS DISTINCT FROM NEW.sex) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates on sex changes
DROP TRIGGER IF EXISTS trigger_contacts_sex_updated_at ON contacts;
CREATE TRIGGER trigger_contacts_sex_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at_on_sex_change();

-- Update the enrichment analytics view to include sex demographics
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
  COUNT(CASE WHEN linkedin_extraction_status = 'failed' THEN 1 END) as linkedin_failed,
  -- New demographics fields
  COUNT(CASE WHEN sex = 'm' THEN 1 END) as male_contacts,
  COUNT(CASE WHEN sex = 'f' THEN 1 END) as female_contacts,
  COUNT(CASE WHEN sex IS NULL THEN 1 END) as unspecified_sex_contacts
FROM contacts 
WHERE status != 'deleted' OR status IS NULL
GROUP BY user_id;

COMMENT ON VIEW enrichment_analytics IS 'Analytics view for tracking enrichment performance, usage patterns, and demographics';

-- Sample queries to verify the new field (commented out for production)
/*
-- Check the new field structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'contacts' AND column_name = 'sex';

-- Check constraint
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'contacts'::regclass AND conname = 'chk_contacts_sex';

-- Sample data check
SELECT sex, COUNT(*) as count
FROM contacts 
GROUP BY sex;

-- Updated analytics view
SELECT * FROM enrichment_analytics LIMIT 3;
*/

COMMIT;

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'Sex field migration completed successfully';
  RAISE NOTICE 'Added sex field to contacts table with constraint: m (male), f (female), or null (unspecified)';
  RAISE NOTICE 'Created index for efficient sex-based filtering';
  RAISE NOTICE 'Updated enrichment analytics view to include demographic data';
  RAISE NOTICE 'Added automatic timestamp trigger for sex field changes';
END $$;