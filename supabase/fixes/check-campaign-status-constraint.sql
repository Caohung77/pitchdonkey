-- Check current campaign status constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'campaigns'::regclass 
AND conname LIKE '%status%';

-- Check if 'stopped' is allowed in the current constraint
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
AND column_name = 'status';

-- Check if stopped_at column exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
AND column_name = 'stopped_at';

-- Test if we can insert a campaign with 'stopped' status (this will fail if constraint doesn't allow it)
-- Don't actually run this, just check the constraint first
-- INSERT INTO campaigns (user_id, name, status) VALUES ('test-user-id', 'test-campaign', 'stopped');