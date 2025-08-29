-- Add enrichment fields to contacts table
-- Migration: Add contact website enrichment functionality

ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT NULL CHECK (enrichment_status IN ('pending', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS enrichment_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for enrichment status queries
CREATE INDEX IF NOT EXISTS idx_contacts_enrichment_status ON contacts(enrichment_status) WHERE enrichment_status IS NOT NULL;

-- Create index for enrichment data queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_contacts_enrichment_data ON contacts USING GIN(enrichment_data) WHERE enrichment_data IS NOT NULL;

-- Add comment to document the new columns
COMMENT ON COLUMN contacts.enrichment_data IS 'JSONB data containing website analysis results from Perplexity AI';
COMMENT ON COLUMN contacts.enrichment_status IS 'Status of website enrichment process: pending, completed, or failed';
COMMENT ON COLUMN contacts.enrichment_updated_at IS 'Timestamp of last enrichment update';

-- Example enrichment_data structure:
-- {
--   "company_name": "Example Corp",
--   "industry": "Software Development",
--   "products_services": ["Web development", "Mobile apps"],
--   "target_audience": ["Small businesses", "Startups"],
--   "unique_points": ["Fast delivery", "Custom solutions"],
--   "tone_style": "Professional and innovative"
-- }