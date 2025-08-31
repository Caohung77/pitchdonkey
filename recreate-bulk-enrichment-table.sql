-- Recreate bulk_enrichment_jobs table with proper structure
-- Run this manually in Supabase SQL Editor

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.bulk_enrichment_jobs;

-- Create bulk_enrichment_jobs table
CREATE TABLE public.bulk_enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_ids UUID[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    options JSONB NOT NULL DEFAULT '{}',
    progress JSONB NOT NULL DEFAULT '{"total": 0, "completed": 0, "failed": 0, "current_batch": 1}',
    results JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_bulk_enrichment_jobs_user_id ON public.bulk_enrichment_jobs(user_id);
CREATE INDEX idx_bulk_enrichment_jobs_status ON public.bulk_enrichment_jobs(status);
CREATE INDEX idx_bulk_enrichment_jobs_created_at ON public.bulk_enrichment_jobs(created_at DESC);

-- Add RLS policy
ALTER TABLE public.bulk_enrichment_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own jobs
CREATE POLICY "Users can manage their own bulk enrichment jobs"
ON public.bulk_enrichment_jobs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bulk_enrichment_jobs_updated_at
    BEFORE UPDATE ON public.bulk_enrichment_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Also make sure contacts table has the enrichment fields
-- Add enrichment columns if they don't exist
DO $$ 
BEGIN
    -- Add enrichment_status column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='contacts' AND column_name='enrichment_status') THEN
        ALTER TABLE public.contacts ADD COLUMN enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'completed', 'failed'));
    END IF;

    -- Add enrichment_data column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='contacts' AND column_name='enrichment_data') THEN
        ALTER TABLE public.contacts ADD COLUMN enrichment_data JSONB;
    END IF;

    -- Add enrichment_updated_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='contacts' AND column_name='enrichment_updated_at') THEN
        ALTER TABLE public.contacts ADD COLUMN enrichment_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Verify table creation
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'bulk_enrichment_jobs' 
ORDER BY ordinal_position;