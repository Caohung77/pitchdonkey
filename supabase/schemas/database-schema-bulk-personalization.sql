-- Bulk Personalization Jobs Table
CREATE TABLE IF NOT EXISTS bulk_personalization_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL,
  custom_prompt TEXT,
  contact_ids UUID[] NOT NULL,
  ai_provider VARCHAR(50) NOT NULL CHECK (ai_provider IN ('openai', 'anthropic')),
  ai_model VARCHAR(100),
  variables JSONB DEFAULT '{}',
  progress JSONB NOT NULL DEFAULT '{\"total\": 0, \"completed\": 0, \"failed\": 0, \"current_batch\": 0}',
  error_message TEXT,
  estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  actual_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  actual_tokens INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_template_or_prompt CHECK (template_id IS NOT NULL OR custom_prompt IS NOT NULL),
  CONSTRAINT valid_contact_count CHECK (array_length(contact_ids, 1) > 0 AND array_length(contact_ids, 1) <= 1000),
  CONSTRAINT valid_costs CHECK (estimated_cost >= 0 AND actual_cost >= 0),
  CONSTRAINT valid_tokens CHECK (estimated_tokens >= 0 AND actual_tokens >= 0)
);

-- Bulk Personalization Results Table
CREATE TABLE IF NOT EXISTS bulk_personalization_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES bulk_personalization_jobs(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  personalized_content TEXT NOT NULL,
  confidence_score DECIMAL(5, 4) NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  processing_time INTEGER NOT NULL DEFAULT 0 CHECK (processing_time >= 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate results for same contact in same job
  UNIQUE(job_id, contact_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bulk_personalization_jobs_user_id ON bulk_personalization_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_personalization_jobs_status ON bulk_personalization_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_personalization_jobs_created_at ON bulk_personalization_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_personalization_jobs_user_status ON bulk_personalization_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_bulk_personalization_results_job_id ON bulk_personalization_results(job_id);
CREATE INDEX IF NOT EXISTS idx_bulk_personalization_results_contact_id ON bulk_personalization_results(contact_id);
CREATE INDEX IF NOT EXISTS idx_bulk_personalization_results_status ON bulk_personalization_results(status);
CREATE INDEX IF NOT EXISTS idx_bulk_personalization_results_job_status ON bulk_personalization_results(job_id, status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_bulk_personalization_jobs_updated_at 
    BEFORE UPDATE ON bulk_personalization_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) Policies
ALTER TABLE bulk_personalization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_personalization_results ENABLE ROW LEVEL SECURITY;

-- Policy for bulk_personalization_jobs: users can only access their own jobs
CREATE POLICY \"Users can view their own bulk personalization jobs\" ON bulk_personalization_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert their own bulk personalization jobs\" ON bulk_personalization_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update their own bulk personalization jobs\" ON bulk_personalization_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY \"Users can delete their own bulk personalization jobs\" ON bulk_personalization_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- Policy for bulk_personalization_results: users can only access results from their own jobs
CREATE POLICY \"Users can view results from their own jobs\" ON bulk_personalization_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM bulk_personalization_jobs 
            WHERE id = bulk_personalization_results.job_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY \"System can insert bulk personalization results\" ON bulk_personalization_results
    FOR INSERT WITH CHECK (true); -- Allow system to insert results

CREATE POLICY \"System can update bulk personalization results\" ON bulk_personalization_results
    FOR UPDATE USING (true); -- Allow system to update results

-- Views for analytics and reporting

-- Job summary view
CREATE OR REPLACE VIEW bulk_personalization_job_summary AS
SELECT 
    j.id,
    j.user_id,
    j.name,
    j.status,
    j.ai_provider,
    j.progress,
    j.estimated_cost,
    j.actual_cost,
    j.estimated_tokens,
    j.actual_tokens,
    j.created_at,
    j.started_at,
    j.completed_at,
    CASE 
        WHEN j.completed_at IS NOT NULL AND j.started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (j.completed_at - j.started_at))
        ELSE NULL 
    END as duration_seconds,
    COALESCE(r.success_count, 0) as success_count,
    COALESCE(r.failed_count, 0) as failed_count,
    COALESCE(r.avg_confidence, 0) as avg_confidence_score,
    COALESCE(r.total_tokens, 0) as total_result_tokens
FROM bulk_personalization_jobs j
LEFT JOIN (
    SELECT 
        job_id,
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        AVG(confidence_score) FILTER (WHERE status = 'success') as avg_confidence,
        SUM(tokens_used) as total_tokens
    FROM bulk_personalization_results
    GROUP BY job_id
) r ON j.id = r.job_id;

-- User statistics view
CREATE OR REPLACE VIEW user_bulk_personalization_stats AS
SELECT 
    user_id,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE status = 'processing') as active_jobs,
    SUM((progress->>'total')::integer) as total_contacts_processed,
    SUM(actual_cost) as total_cost,
    SUM(actual_tokens) as total_tokens,
    AVG(CASE 
        WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (completed_at - started_at))
        ELSE NULL 
    END) as avg_job_duration_seconds
FROM bulk_personalization_jobs
GROUP BY user_id;

-- Recent activity view
CREATE OR REPLACE VIEW recent_bulk_personalization_activity AS
SELECT 
    j.id as job_id,
    j.user_id,
    j.name as job_name,
    j.status,
    j.ai_provider,
    (j.progress->>'completed')::integer as contacts_completed,
    (j.progress->>'total')::integer as total_contacts,
    j.actual_cost,
    j.created_at,
    j.updated_at,
    CASE 
        WHEN j.status = 'processing' THEN 'Job in progress'
        WHEN j.status = 'completed' THEN 'Job completed successfully'
        WHEN j.status = 'failed' THEN 'Job failed'
        WHEN j.status = 'cancelled' THEN 'Job cancelled'
        ELSE 'Job pending'
    END as activity_description
FROM bulk_personalization_jobs j
WHERE j.updated_at >= NOW() - INTERVAL '7 days'
ORDER BY j.updated_at DESC;

-- Grant permissions for views
GRANT SELECT ON bulk_personalization_job_summary TO authenticated;
GRANT SELECT ON user_bulk_personalization_stats TO authenticated;
GRANT SELECT ON recent_bulk_personalization_activity TO authenticated;

-- Add RLS policies for views
ALTER VIEW bulk_personalization_job_summary SET (security_invoker = true);
ALTER VIEW user_bulk_personalization_stats SET (security_invoker = true);
ALTER VIEW recent_bulk_personalization_activity SET (security_invoker = true);

-- Function to clean up old completed jobs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_bulk_personalization_jobs(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete jobs older than specified days that are completed or failed
    DELETE FROM bulk_personalization_jobs 
    WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get job progress (useful for real-time updates)
CREATE OR REPLACE FUNCTION get_bulk_personalization_progress(job_uuid UUID)
RETURNS TABLE(
    job_id UUID,
    status VARCHAR(50),
    total_contacts INTEGER,
    completed_contacts INTEGER,
    failed_contacts INTEGER,
    current_batch INTEGER,
    progress_percentage DECIMAL(5,2),
    estimated_completion TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.status,
        (j.progress->>'total')::INTEGER,
        (j.progress->>'completed')::INTEGER,
        (j.progress->>'failed')::INTEGER,
        (j.progress->>'current_batch')::INTEGER,
        CASE 
            WHEN (j.progress->>'total')::INTEGER > 0 
            THEN ROUND(((j.progress->>'completed')::INTEGER * 100.0) / (j.progress->>'total')::INTEGER, 2)
            ELSE 0.00
        END,
        CASE 
            WHEN j.status = 'processing' AND j.started_at IS NOT NULL AND (j.progress->>'completed')::INTEGER > 0
            THEN j.started_at + (
                (EXTRACT(EPOCH FROM (NOW() - j.started_at)) / (j.progress->>'completed')::INTEGER) * 
                (j.progress->>'total')::INTEGER
            ) * INTERVAL '1 second'
            ELSE NULL
        END
    FROM bulk_personalization_jobs j
    WHERE j.id = job_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE bulk_personalization_jobs IS 'Stores bulk AI personalization job information and progress';
COMMENT ON TABLE bulk_personalization_results IS 'Stores individual personalization results for each contact in a job';
COMMENT ON VIEW bulk_personalization_job_summary IS 'Comprehensive view of job information with aggregated results';
COMMENT ON VIEW user_bulk_personalization_stats IS 'User-level statistics for bulk personalization usage';
COMMENT ON VIEW recent_bulk_personalization_activity IS 'Recent bulk personalization activity for activity feeds';
COMMENT ON FUNCTION cleanup_old_bulk_personalization_jobs IS 'Maintenance function to clean up old completed jobs';
COMMENT ON FUNCTION get_bulk_personalization_progress IS 'Real-time progress information for a specific job';"