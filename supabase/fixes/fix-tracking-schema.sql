-- Fix email_tracking table schema - add missing updated_at column
-- This fixes the pixel tracking issue where updates fail due to missing updated_at column

ALTER TABLE email_tracking 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add trigger to automatically update updated_at when record is modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_email_tracking_updated_at'
    ) THEN
        CREATE TRIGGER update_email_tracking_updated_at 
        BEFORE UPDATE ON email_tracking 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;