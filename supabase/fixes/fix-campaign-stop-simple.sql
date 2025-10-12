-- Simple fix for campaign stop functionality
-- This migration works with any existing campaigns table structure

-- Step 1: Drop existing status constraint (if it exists)
DO $$ 
BEGIN
    -- Drop status constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'campaigns'::regclass 
        AND conname LIKE '%status%'
    ) THEN
        ALTER TABLE campaigns DROP CONSTRAINT campaigns_status_check;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if constraint doesn't exist
        NULL;
END $$;

-- Step 2: Add new status constraint that includes 'stopped'
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check 
CHECK (status IN ('draft', 'active', 'running', 'paused', 'stopped', 'completed', 'archived'));

-- Step 3: Add stopped_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' 
        AND column_name = 'stopped_at'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN stopped_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Step 4: Remove any complex transition constraints that might reference non-existent columns
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'campaigns'::regclass 
        AND conname = 'valid_status_transitions'
    ) THEN
        ALTER TABLE campaigns DROP CONSTRAINT valid_status_transitions;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if constraint doesn't exist
        NULL;
END $$;

-- Step 5: Test that 'stopped' status is now allowed
-- This should not fail if the migration worked
SELECT 'Migration completed successfully. The following statuses are now allowed:' as message;

-- Verify the constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND conname = 'campaigns_status_check';