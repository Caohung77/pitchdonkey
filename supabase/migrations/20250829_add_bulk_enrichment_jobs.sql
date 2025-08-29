-- Create bulk_enrichment_jobs table for tracking batch enrichment operations
CREATE TABLE IF NOT EXISTS bulk_enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  contact_ids UUID[] NOT NULL,
  options JSONB DEFAULT '{}',
  progress JSONB DEFAULT '{"total": 0, "completed": 0, "failed": 0, "current_batch": 1}',
  results JSONB DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bulk_enrichment_jobs_user_id ON bulk_enrichment_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_enrichment_jobs_status ON bulk_enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_enrichment_jobs_created_at ON bulk_enrichment_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE bulk_enrichment_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY IF NOT EXISTS "Users can access their own enrichment jobs" ON bulk_enrichment_jobs
  FOR ALL USING (user_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bulk_enrichment_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER IF NOT EXISTS update_bulk_enrichment_jobs_updated_at_trigger
    BEFORE UPDATE ON bulk_enrichment_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_enrichment_jobs_updated_at();

-- Add enrichment fields to contacts table if they don't exist
DO $$ 
BEGIN
    -- Check and add website column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'website') THEN
        ALTER TABLE contacts ADD COLUMN website TEXT;
    END IF;
    
    -- Check and add enrichment_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'enrichment_status') THEN
        ALTER TABLE contacts ADD COLUMN enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'completed', 'failed'));
    END IF;
    
    -- Check and add enrichment_data column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'enrichment_data') THEN
        ALTER TABLE contacts ADD COLUMN enrichment_data JSONB;
    END IF;
    
    -- Check and add enrichment_updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'enrichment_updated_at') THEN
        ALTER TABLE contacts ADD COLUMN enrichment_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create index on contacts enrichment_status
CREATE INDEX IF NOT EXISTS idx_contacts_enrichment_status ON contacts(enrichment_status) WHERE enrichment_status IS NOT NULL;

-- Create index on contacts website
CREATE INDEX IF NOT EXISTS idx_contacts_website ON contacts(website) WHERE website IS NOT NULL;

-- Update contacts table to include website field in API queries
COMMENT ON COLUMN contacts.website IS 'Company website URL for enrichment';
COMMENT ON COLUMN contacts.enrichment_status IS 'Status of enrichment: pending, completed, failed';
COMMENT ON COLUMN contacts.enrichment_data IS 'JSON data from enrichment analysis';
COMMENT ON COLUMN contacts.enrichment_updated_at IS 'Last time contact was enriched';